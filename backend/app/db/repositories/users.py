from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.user import UserModel


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[UserModel]:
        result = await self.db.execute(select(UserModel).where(UserModel.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        result = await self.db.execute(select(UserModel).where(UserModel.email == email))
        return result.scalar_one_or_none()

    async def get_by_ficbook_id(self, ficbook_user_id: str) -> Optional[UserModel]:
        result = await self.db.execute(
            select(UserModel).where(UserModel.ficbook_user_id == ficbook_user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user: UserModel) -> UserModel:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: UserModel) -> UserModel:
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_cookies(self, user_id: str, cookies: dict) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.ficbook_cookies = cookies
            user.ficbook_cookies_updated_at = datetime.utcnow()
            await self.db.commit()

    async def clear_cookies(self, user_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.ficbook_cookies = None
            user.ficbook_cookies_updated_at = None
            await self.db.commit()
