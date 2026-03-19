import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.api.auth import hash_password, create_tokens

# Use a test database URL (same DB with test_ prefix or override via env)
TEST_DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        try:
            yield db_session
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def superadmin_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"superadmin_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=hash_password("password123"),
        full_name="Super Admin",
        role=UserRole.superadmin,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=hash_password("password123"),
        full_name="Admin User",
        role=UserRole.admin,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def regular_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"user_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=hash_password("password123"),
        full_name="Regular User",
        role=UserRole.user,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def superadmin_token(superadmin_user: User) -> str:
    tokens = create_tokens(superadmin_user)
    return tokens["access_token"]


@pytest_asyncio.fixture
async def admin_token(admin_user: User) -> str:
    tokens = create_tokens(admin_user)
    return tokens["access_token"]


@pytest_asyncio.fixture
async def user_token(regular_user: User) -> str:
    tokens = create_tokens(regular_user)
    return tokens["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
