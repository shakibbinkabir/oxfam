import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import hash_password
from app.api.deps import require_role
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


@router.get("/")
async def list_users(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar()
    return envelope(
        data={
            "users": [UserResponse.model_validate(u).model_dump(mode="json") for u in users],
            "total": total,
            "skip": skip,
            "limit": limit,
        }
    )


@router.post("/")
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=req.email,
        hashed_password=await hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return envelope(
        data=UserResponse.model_validate(user).model_dump(mode="json"),
        message="User created successfully",
    )


@router.put("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.email is not None:
        user.email = req.email
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.role is not None:
        user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active

    db.add(user)
    await db.flush()
    await db.refresh(user)
    return envelope(
        data=UserResponse.model_validate(user).model_dump(mode="json"),
        message="User updated successfully",
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.add(user)
    await db.flush()
    return envelope(message="User deleted successfully")
