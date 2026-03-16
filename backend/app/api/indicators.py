import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.indicator import ClimateIndicator
from app.models.user import User
from app.schemas.indicator import IndicatorCreate, IndicatorResponse, IndicatorUpdate

router = APIRouter(prefix="/api/v1/indicators", tags=["indicators"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


@router.get("/export")
async def export_indicators(
    format: str = Query("csv", regex="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClimateIndicator).order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    indicators = result.scalars().all()

    if format == "json":
        data = [IndicatorResponse.model_validate(ind).model_dump(mode="json") for ind in indicators]
        return envelope(data=data)

    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Component", "Subcategory", "Indicator Name", "Code", "Unit", "Source", "GIS Attribute ID"])
    for ind in indicators:
        writer.writerow([
            ind.component, ind.subcategory or "", ind.indicator_name,
            ind.code, ind.unit or "", ind.source or "", ind.gis_attribute_id or "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=climate_indicators.csv"},
    )


@router.get("/")
async def list_indicators(
    component: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(ClimateIndicator)
    count_query = select(func.count(ClimateIndicator.id))

    if component:
        query = query.where(ClimateIndicator.component == component)
        count_query = count_query.where(ClimateIndicator.component == component)
    if subcategory:
        query = query.where(ClimateIndicator.subcategory == subcategory)
        count_query = count_query.where(ClimateIndicator.subcategory == subcategory)
    if search:
        query = query.where(ClimateIndicator.indicator_name.ilike(f"%{search}%"))
        count_query = count_query.where(ClimateIndicator.indicator_name.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    indicators = result.scalars().all()

    return envelope(data={
        "indicators": [IndicatorResponse.model_validate(ind).model_dump(mode="json") for ind in indicators],
        "total": total,
        "skip": skip,
        "limit": limit,
    })


@router.post("/")
async def create_indicator(
    req: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = await db.execute(
        select(ClimateIndicator).where(ClimateIndicator.code == req.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Indicator code already exists")

    indicator = ClimateIndicator(
        component=req.component,
        subcategory=req.subcategory,
        indicator_name=req.indicator_name,
        code=req.code,
        unit=req.unit,
        source=req.source,
        gis_attribute_id=req.gis_attribute_id,
        created_by=current_user.id,
    )
    db.add(indicator)
    await db.flush()
    await db.refresh(indicator)
    return envelope(
        data=IndicatorResponse.model_validate(indicator).model_dump(mode="json"),
        message="Indicator created successfully",
    )


@router.get("/{indicator_id}")
async def get_indicator(
    indicator_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClimateIndicator).where(ClimateIndicator.id == indicator_id)
    )
    indicator = result.scalar_one_or_none()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")
    return envelope(data=IndicatorResponse.model_validate(indicator).model_dump(mode="json"))


@router.put("/{indicator_id}")
async def update_indicator(
    indicator_id: int,
    req: IndicatorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(ClimateIndicator).where(ClimateIndicator.id == indicator_id)
    )
    indicator = result.scalar_one_or_none()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    if req.component is not None:
        indicator.component = req.component
    if req.subcategory is not None:
        indicator.subcategory = req.subcategory
    if req.indicator_name is not None:
        indicator.indicator_name = req.indicator_name
    if req.unit is not None:
        indicator.unit = req.unit
    if req.source is not None:
        indicator.source = req.source
    if req.gis_attribute_id is not None:
        indicator.gis_attribute_id = req.gis_attribute_id

    db.add(indicator)
    await db.flush()
    await db.refresh(indicator)
    return envelope(
        data=IndicatorResponse.model_validate(indicator).model_dump(mode="json"),
        message="Indicator updated successfully",
    )


@router.delete("/{indicator_id}")
async def delete_indicator(
    indicator_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(ClimateIndicator).where(ClimateIndicator.id == indicator_id)
    )
    indicator = result.scalar_one_or_none()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    await db.delete(indicator)
    await db.flush()
    return envelope(message="Indicator deleted successfully")
