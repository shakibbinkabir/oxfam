from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.unit import Unit
from app.models.user import User
from app.schemas.unit import UnitCreate, UnitResponse, UnitUpdate

router = APIRouter(prefix="/api/v1/units", tags=["units"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


@router.get("/")
async def list_units(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Unit)
    count_query = select(func.count(Unit.id))

    if search:
        query = query.where(Unit.name.ilike(f"%{search}%"))
        count_query = count_query.where(Unit.name.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Unit.name).offset(skip).limit(limit)
    result = await db.execute(query)
    units = result.scalars().all()

    return envelope(data={
        "units": [UnitResponse.model_validate(u).model_dump(mode="json") for u in units],
        "total": total,
    })


@router.post("/")
async def create_unit(
    req: UnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(Unit).where(Unit.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Unit name already exists")

    unit = Unit(name=req.name, abbreviation=req.abbreviation)
    db.add(unit)
    await db.flush()
    await db.refresh(unit)
    return envelope(
        data=UnitResponse.model_validate(unit).model_dump(mode="json"),
        message="Unit created successfully",
    )


@router.put("/{unit_id}")
async def update_unit(
    unit_id: int,
    req: UnitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Unit).where(Unit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    if req.name is not None:
        # Check uniqueness
        existing = await db.execute(
            select(Unit).where(Unit.name == req.name, Unit.id != unit_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Unit name already exists")
        unit.name = req.name
    if req.abbreviation is not None:
        unit.abbreviation = req.abbreviation

    db.add(unit)
    await db.flush()
    await db.refresh(unit)
    return envelope(
        data=UnitResponse.model_validate(unit).model_dump(mode="json"),
        message="Unit updated successfully",
    )


@router.delete("/{unit_id}")
async def delete_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Unit).where(Unit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    await db.delete(unit)
    await db.flush()
    return envelope(message="Unit deleted successfully")
