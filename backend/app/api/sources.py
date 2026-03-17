from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.source import Source
from app.models.user import User
from app.schemas.source import SourceCreate, SourceResponse, SourceUpdate

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


@router.get("/")
async def list_sources(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Source)
    count_query = select(func.count(Source.id))

    if search:
        query = query.where(Source.name.ilike(f"%{search}%"))
        count_query = count_query.where(Source.name.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Source.name).offset(skip).limit(limit)
    result = await db.execute(query)
    sources = result.scalars().all()

    return envelope(data={
        "sources": [SourceResponse.model_validate(s).model_dump(mode="json") for s in sources],
        "total": total,
    })


@router.post("/")
async def create_source(
    req: SourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(Source).where(Source.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Source name already exists")

    source = Source(name=req.name, description=req.description, url=req.url)
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return envelope(
        data=SourceResponse.model_validate(source).model_dump(mode="json"),
        message="Source created successfully",
    )


@router.put("/{source_id}")
async def update_source(
    source_id: int,
    req: SourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    if req.name is not None:
        existing = await db.execute(
            select(Source).where(Source.name == req.name, Source.id != source_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Source name already exists")
        source.name = req.name
    if req.description is not None:
        source.description = req.description
    if req.url is not None:
        source.url = req.url

    db.add(source)
    await db.flush()
    await db.refresh(source)
    return envelope(
        data=SourceResponse.model_validate(source).model_dump(mode="json"),
        message="Source updated successfully",
    )


@router.delete("/{source_id}")
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    await db.delete(source)
    await db.flush()
    return envelope(message="Source deleted successfully")
