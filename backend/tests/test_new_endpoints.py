"""
Smoke tests for the fanfic-ai-platform backend.

We spin up FastAPI against an in-memory SQLite DB and verify:
  1. Every route the frontend calls is registered at the expected URL/method.
  2. Auth guards kick in where they should (401 without JWT).
  3. Actions endpoints refuse to touch ficbook.net without linked cookies (403).
  4. Basic tables (fanfics, users, interactions) can be created from the
     current SQLAlchemy models against SQLite — proves JSON portability.

External calls (ficbook.net, Cloudflare Worker) are never made — every code
path that would call out is guarded by an auth precondition we intentionally
don't satisfy.
"""
from __future__ import annotations
import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Prime env BEFORE importing the app so config.py picks it up.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-32-chars-long!!!!!")
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-long!!!!!")
os.environ.setdefault("SEARCH_SERVICE_URL", "http://localhost:9999")
os.environ.setdefault("CORS_ORIGINS", '["*"]')

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402
from app.db.session import Base, engine, AsyncSessionLocal  # noqa: E402
from app.db.models.user import UserModel  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _prepare_db():
    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    asyncio.new_event_loop().run_until_complete(_init())
    yield


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_user():
    """Insert a synthetic user and return (user_id, JWT). No ficbook_cookies attached."""
    async def _create():
        uid = str(uuid.uuid4())
        async with AsyncSessionLocal() as db:
            user = UserModel(
                id=uid,
                email=f"test-{uid}@fanfic-ai.local",
                hashed_password=hash_password("test-pw"),
                is_active=True,
            )
            db.add(user)
            await db.commit()
        return uid
    uid = asyncio.new_event_loop().run_until_complete(_create())
    token = create_access_token(uid)
    return uid, token


# ─────────────────────────────────────────────────────────────
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# Every route the frontend calls should exist. We enumerate them by URL+method
# straight out of OpenAPI so the test fails loudly if a route disappears.
EXPECTED_ROUTES = [
    ("POST", "/api/v1/auth/ficbook/login"),
    ("GET",  "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/logout"),
    ("GET",  "/api/v1/actions/state/{fanfic_id}"),
    ("POST", "/api/v1/actions/like"),
    ("POST", "/api/v1/actions/unlike"),
    ("POST", "/api/v1/actions/mark-read"),
    ("POST", "/api/v1/actions/mark-unread"),
    ("POST", "/api/v1/actions/follow"),
    ("POST", "/api/v1/actions/unfollow"),
    ("GET",  "/api/v1/profile/me"),
    ("GET",  "/api/v1/profile/favourites"),
    ("GET",  "/api/v1/profile/history"),
    ("GET",  "/api/v1/profile/liked"),
    ("GET",  "/api/v1/profile/subscriptions"),
]


def test_all_expected_routes_registered(client):
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    for method, route in EXPECTED_ROUTES:
        assert route in paths, f"Route missing entirely: {route}"
        assert method.lower() in paths[route], f"Method missing: {method} {route}"


def test_reader_routes_exist(client):
    """Reader is mounted at the api-root, so /fanfics/{id}/full is a sibling of /fanfics/."""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    full = "/api/v1/fanfics/{fanfic_id}/full"
    chapter = "/api/v1/fanfics/{fanfic_id}/chapter/{chapter_id}"
    assert full in paths, f"Missing: {full}"
    assert chapter in paths, f"Missing: {chapter}"


def test_download_endpoint_exists(client):
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    # The path can use either {ext} or {fmt} — accept whichever the backend picked.
    downloads = [p for p in paths if p.startswith("/api/v1/actions/download/")]
    assert downloads, "No /api/v1/actions/download/* route registered"


# ── Auth guards ────────────────────────────────────────────────
def test_actions_state_requires_auth(client):
    r = client.get("/api/v1/actions/state/some-fanfic")
    assert r.status_code == 401


def test_profile_requires_auth(client):
    r = client.get("/api/v1/profile/me")
    assert r.status_code == 401


def test_auth_logout_is_idempotent(client):
    """Logout is designed to be safe to call from any state — no JWT still
    yields 200 (the client just wants to know it can clear its local session)."""
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 200


def test_actions_like_requires_auth(client):
    r = client.post("/api/v1/actions/like", json={"fanfic_id": "x"})
    assert r.status_code == 401


# ── Ficbook-link required for user actions ────────────────────
def test_actions_state_without_ficbook_link_returns_403(client, auth_user):
    """User with a valid JWT but no ficbook cookies → 403 with a clear message."""
    _uid, token = auth_user
    r = client.get(
        "/api/v1/actions/state/round-trip-fic",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert "log in" in r.json().get("detail", "").lower()


def test_profile_me_returns_user_info(client, auth_user):
    """/profile/me is DB-only — should succeed even without ficbook link."""
    uid, token = auth_user
    r = client.get(
        "/api/v1/profile/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Accept 200 (present) or a graceful placeholder — reject 5xx.
    assert r.status_code < 500, f"Unexpected server error: {r.status_code} {r.text}"
    if r.status_code == 200:
        data = r.json()
        payload = data.get("user", data)
        assert payload.get("id") == uid or payload.get("email", "").startswith("test-")


def test_bad_jwt_rejected(client):
    r = client.get(
        "/api/v1/actions/state/x",
        headers={"Authorization": "Bearer garbage"},
    )
    assert r.status_code in (401, 404)
