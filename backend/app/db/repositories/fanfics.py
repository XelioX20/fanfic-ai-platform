from typing import Optional, Sequence
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.fanfic import Fanfic


class FanficRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, fanfic_id: str) -> Optional[Fanfic]:
        result = await self.db.execute(select(Fanfic).where(Fanfic.id == fanfic_id))
        return result.scalar_one_or_none()

    async def get_by_ficbook_url(self, url: str) -> Optional[Fanfic]:
        result = await self.db.execute(select(Fanfic).where(Fanfic.ficbook_url == url))
        return result.scalar_one_or_none()

    async def get_many(
        self,
        offset: int = 0,
        limit: int = 20,
        direction: Optional[str] = None,
        rating: Optional[str] = None,
        status: Optional[str] = None,
        fandom: Optional[str] = None,
        min_words: Optional[int] = None,
        max_words: Optional[int] = None,
    ) -> tuple[Sequence[Fanfic], int]:
        query = select(Fanfic)
        filters = []
        if direction:
            filters.append(Fanfic.direction == direction)
        if rating:
            filters.append(Fanfic.rating == rating)
        if status:
            filters.append(Fanfic.completion_status == status)
        if min_words:
            filters.append(Fanfic.words_count >= min_words)
        if max_words:
            filters.append(Fanfic.words_count <= max_words)
        if filters:
            query = query.where(and_(*filters))
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar_one()
        result = await self.db.execute(query.offset(offset).limit(limit))
        return result.scalars().all(), total

    async def upsert(self, fanfic: Fanfic) -> Fanfic:
        existing = await self.get_by_ficbook_url(fanfic.ficbook_url)
        if existing:
            for attr, val in vars(fanfic).items():
                if not attr.startswith("_") and val is not None:
                    setattr(existing, attr, val)
            await self.db.flush()
            return existing
        self.db.add(fanfic)
        await self.db.flush()
        return fanfic

    async def bulk_upsert(self, fanfics: list[Fanfic]) -> list[Fanfic]:
        result = []
        for f in fanfics:
            if not f.id:  # skip fanfics without ID
                continue
            try:
                result.append(await self.upsert(f))
            except Exception as e:
                await self.db.rollback()
                continue
        await self.db.commit()
        return result
