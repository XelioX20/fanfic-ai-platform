from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


def _make_engine():
    url = settings.DATABASE_URL
    # asyncpg does not accept sslmode= in the URL — strip it and pass ssl via connect_args
    url = url.replace("?sslmode=require", "").replace("&sslmode=require", "")
    # asyncpg requires postgresql+asyncpg:// scheme
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    is_sqlite = url.startswith("sqlite")
    kwargs = {
        "echo": settings.APP_ENV == "development",
    }
    # SQLite's aiosqlite driver uses StaticPool and rejects pool_size/max_overflow.
    # Pool tuning is only meaningful for real network backends.
    if not is_sqlite:
        kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
        kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
        kwargs["pool_pre_ping"] = True
    # Pass SSL as a boolean via connect_args for asyncpg
    if "neon.tech" in url or settings.APP_ENV == "production":
        import ssl as ssl_module
        ssl_ctx = ssl_module.create_default_context()
        kwargs["connect_args"] = {"ssl": ssl_ctx}
    return create_async_engine(url, **kwargs)


engine = _make_engine()

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Lightweight in-place migrations for columns added after the table
        # was originally created. Base.metadata.create_all() creates missing
        # TABLES but not missing COLUMNS on existing tables — so a plain
        # ALTER TABLE ... ADD COLUMN IF NOT EXISTS keeps prod schema in sync
        # without pulling in Alembic. Idempotent on both Postgres and SQLite.
        await _ensure_columns(conn)


async def _ensure_columns(conn) -> None:
    from sqlalchemy import text
    # Correct table name is "platform_users" (see app/db/models/user.py).
    # Postgres and SQLite both accept "ADD COLUMN IF NOT EXISTS".
    statements = (
        "ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT",
    )
    for sql in statements:
        try:
            await conn.execute(text(sql))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("_ensure_columns skipped: %s", e)
            pass
