import asyncio

from passlib.context import CryptContext
from sqlalchemy import select, text

from app.config import settings
from app.database import async_session
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_superadmin():
    async with async_session() as session:
        # Check if tables exist before querying
        check = await session.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
        )
        if not check.scalar():
            print("Database tables not ready yet — skipping superadmin seed. Run migrations first.")
            return

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
