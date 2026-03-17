import asyncio

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_superadmin():
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.role == "superadmin")
        )
        if result.scalar_one_or_none():
            print("Superadmin already exists, skipping seed.")
            return

        user = User(
            email=settings.FIRST_SUPERADMIN_EMAIL,
            hashed_password=pwd_context.hash(settings.FIRST_SUPERADMIN_PASSWORD),
            full_name="Super Admin",
            role="superadmin",
        )
        session.add(user)
        await session.commit()
        print(f"Superadmin created: {settings.FIRST_SUPERADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed_superadmin())
