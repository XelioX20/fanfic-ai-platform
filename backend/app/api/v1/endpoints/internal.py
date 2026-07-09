"""Internal / diagnostic endpoints for the recommendation pipeline.

Secret-gated (X-Internal-Secret header must match ENRICH_SECRET) so these
can't be hit by the public. Called by the Cloudflare Worker cron and used
for pipeline diagnostics.
"""
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from sqlalchemy import text
from app.core.config import settings
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)
router = APIRouter()


def _check_secret(secret: Optional[str]) -> None:
    expected = settings.ENRICH_SECRET
    if not expected:
        raise HTTPException(status_code=503, detail="Internal endpoints disabled (ENRICH_SECRET unset)")
    if secret != expected:
        raise HTTPException(status_code=403, detail="Bad internal secret")


@router.get("/reco/status")
async def reco_status(x_internal_secret: Optional[str] = Header(None)):
    """Diagnostic: confirms pgvector is live and reports enrichment progress.
    Used to verify Phase 1 landed correctly on Neon and to monitor the
    enrichment backlog in Phase 2."""
    _check_secret(x_internal_secret)

    out: dict = {}
    async with AsyncSessionLocal() as db:
        # 1. Is pgvector installed?
        try:
            r = await db.execute(text("SELECT extversion FROM pg_extension WHERE extname='vector'"))
            row = r.first()
            out["pgvector"] = row[0] if row else None
        except Exception as e:
            out["pgvector"] = f"error: {e}"

        # 2. Does the halfvec column exist on fanfics?
        try:
            r = await db.execute(text(
                "SELECT data_type, udt_name FROM information_schema.columns "
                "WHERE table_name='fanfics' AND column_name='embedding_vec'"
            ))
            row = r.first()
            out["embedding_vec_column"] = (row[1] if row else None)
        except Exception as e:
            out["embedding_vec_column"] = f"error: {e}"

        # 3. Enrichment backlog breakdown
        try:
            r = await db.execute(text(
                "SELECT enrichment_status, COUNT(*) FROM fanfics GROUP BY enrichment_status"
            ))
            out["enrichment_counts"] = {k: v for k, v in r.all()}
        except Exception as e:
            out["enrichment_counts"] = f"error: {e}"

        # 4. How many fics actually have a vector
        try:
            r = await db.execute(text("SELECT COUNT(*) FROM fanfics WHERE embedding_vec IS NOT NULL"))
            out["fics_with_vector"] = r.scalar()
        except Exception as e:
            out["fics_with_vector"] = f"error: {e}"

    return out
