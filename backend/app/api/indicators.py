import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.indicator import ClimateIndicator
from app.models.indicator_value import IndicatorValue
from app.models.source import Source
from app.models.unit import Unit
from app.models.user import User
from app.schemas.indicator import (
    IndicatorCreate,
    IndicatorResponse,
    IndicatorUpdate,
    IndicatorValueCreate,
    IndicatorValueResponse,
    IndicatorValueUpdate,
)

router = APIRouter(prefix="/api/v1/indicators", tags=["indicators"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


def indicator_to_response(ind: ClimateIndicator) -> dict:
    return {
        "id": ind.id,
        "component": ind.component,
        "subcategory": ind.subcategory,
        "indicator_name": ind.indicator_name,
        "code": ind.code,
        "unit_id": ind.unit_id,
        "unit_name": ind.unit.name if ind.unit else None,
        "unit_abbreviation": ind.unit.abbreviation if ind.unit else None,
        "source_id": ind.source_id,
        "source_name": ind.source.name if ind.source else None,
        "gis_attribute_id": ind.gis_attribute_id,
        "created_by": str(ind.created_by) if ind.created_by else None,
        "created_at": ind.created_at.isoformat(),
        "updated_at": ind.updated_at.isoformat(),
    }


# ── Static /export path must come before /{indicator_id} ──

@router.get("/export")
async def export_indicators(
    format: str = Query("csv", regex="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClimateIndicator)
        .options(joinedload(ClimateIndicator.unit), joinedload(ClimateIndicator.source))
        .order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    indicators = result.scalars().unique().all()

    if format == "json":
        data = [indicator_to_response(ind) for ind in indicators]
        return envelope(data=data)

    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Component", "Subcategory", "Indicator Name", "Code", "Unit", "Source", "GIS Attribute ID"])
    for ind in indicators:
        writer.writerow([
            ind.component, ind.subcategory or "", ind.indicator_name,
            ind.code, ind.unit.name if ind.unit else "", ind.source.name if ind.source else "",
            ind.gis_attribute_id or "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=climate_indicators.csv"},
    )


# ── All /values/* routes must come before /{indicator_id} ──

@router.get("/values")
async def list_indicator_values(
    indicator_id: Optional[int] = Query(None),
    component: Optional[str] = Query(None),
    boundary_pcode: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all indicator values with filtering and pagination."""
    query = (
        select(
            IndicatorValue.id,
            IndicatorValue.indicator_id,
            IndicatorValue.boundary_pcode,
            IndicatorValue.value,
            IndicatorValue.source_id,
            IndicatorValue.submitted_by,
            IndicatorValue.created_at,
            IndicatorValue.updated_at,
            ClimateIndicator.indicator_name,
            ClimateIndicator.code,
            ClimateIndicator.component,
            ClimateIndicator.subcategory,
            Source.name.label("source_name"),
            AdminBoundary.name_en.label("boundary_name"),
            AdminBoundary.division_name,
            AdminBoundary.district_name,
            AdminBoundary.upazila_name,
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .outerjoin(Source, IndicatorValue.source_id == Source.id)
        .outerjoin(AdminBoundary, IndicatorValue.boundary_pcode == AdminBoundary.pcode)
    )
    count_query = (
        select(func.count(IndicatorValue.id))
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
    )

    if indicator_id:
        query = query.where(IndicatorValue.indicator_id == indicator_id)
        count_query = count_query.where(IndicatorValue.indicator_id == indicator_id)
    if component:
        query = query.where(ClimateIndicator.component == component)
        count_query = count_query.where(ClimateIndicator.component == component)
    if boundary_pcode:
        query = query.where(IndicatorValue.boundary_pcode == boundary_pcode)
        count_query = count_query.where(IndicatorValue.boundary_pcode == boundary_pcode)
    if search:
        query = query.where(ClimateIndicator.indicator_name.ilike(f"%{search}%"))
        count_query = count_query.where(ClimateIndicator.indicator_name.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(IndicatorValue.updated_at.desc())
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    data = []
    for row in rows:
        data.append({
            "id": row.id,
            "indicator_id": row.indicator_id,
            "boundary_pcode": row.boundary_pcode,
            "boundary_name": row.boundary_name,
            "division_name": row.division_name,
            "district_name": row.district_name,
            "upazila_name": row.upazila_name,
            "value": row.value,
            "source_id": row.source_id,
            "source_name": row.source_name,
            "indicator_name": row.indicator_name,
            "indicator_code": row.code,
            "component": row.component,
            "subcategory": row.subcategory,
            "submitted_by": str(row.submitted_by) if row.submitted_by else None,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        })

    return envelope(data={"values": data, "total": total, "skip": skip, "limit": limit})


@router.get("/values/sample-csv")
async def download_sample_csv(
    current_user: User = Depends(get_current_user),
):
    """Download a sample CSV template for bulk uploading indicator values."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["indicator_code", "boundary_pcode", "value", "source_name"])
    writer.writerow(["HAZ_FL_01", "20100201", "0.75", "BBS Census 2022"])
    writer.writerow(["HAZ_FL_01", "20100202", "0.42", ""])
    writer.writerow(["SOC_EXP_01", "20100201", "1.23", "World Bank"])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=indicator_values_sample.csv"},
    )


@router.get("/values/by-boundary/{pcode}")
async def get_indicator_values_for_boundary(
    pcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all indicator values for a specific boundary (union)."""
    result = await db.execute(
        select(
            IndicatorValue.id,
            IndicatorValue.indicator_id,
            IndicatorValue.boundary_pcode,
            IndicatorValue.value,
            IndicatorValue.source_id,
            IndicatorValue.submitted_by,
            IndicatorValue.created_at,
            IndicatorValue.updated_at,
            ClimateIndicator.indicator_name,
            ClimateIndicator.code,
            ClimateIndicator.component,
            ClimateIndicator.subcategory,
            Source.name.label("source_name"),
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .outerjoin(Source, IndicatorValue.source_id == Source.id)
        .where(IndicatorValue.boundary_pcode == pcode)
        .order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    rows = result.all()

    data = []
    for row in rows:
        data.append({
            "id": row.id,
            "indicator_id": row.indicator_id,
            "boundary_pcode": row.boundary_pcode,
            "value": row.value,
            "source_id": row.source_id,
            "source_name": row.source_name,
            "indicator_name": row.indicator_name,
            "indicator_code": row.code,
            "component": row.component,
            "subcategory": row.subcategory,
            "submitted_by": str(row.submitted_by) if row.submitted_by else None,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        })

    return envelope(data=data)


@router.post("/values")
async def submit_indicator_value(
    req: IndicatorValueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Submit or update an indicator value for a boundary."""
    # Verify indicator exists
    ind_result = await db.execute(
        select(ClimateIndicator).where(ClimateIndicator.id == req.indicator_id)
    )
    if not ind_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Indicator not found")

    # Check if value already exists (upsert)
    existing = await db.execute(
        select(IndicatorValue).where(
            IndicatorValue.indicator_id == req.indicator_id,
            IndicatorValue.boundary_pcode == req.boundary_pcode,
        )
    )
    iv = existing.scalar_one_or_none()

    if iv:
        iv.value = req.value
        iv.source_id = req.source_id
        iv.submitted_by = current_user.id
        msg = "Indicator value updated successfully"
    else:
        iv = IndicatorValue(
            indicator_id=req.indicator_id,
            boundary_pcode=req.boundary_pcode,
            value=req.value,
            source_id=req.source_id,
            submitted_by=current_user.id,
        )
        db.add(iv)
        msg = "Indicator value submitted successfully"

    await db.flush()
    await db.refresh(iv)

    return envelope(
        data={
            "id": iv.id,
            "indicator_id": iv.indicator_id,
            "boundary_pcode": iv.boundary_pcode,
            "value": iv.value,
            "source_id": iv.source_id,
            "submitted_by": str(iv.submitted_by) if iv.submitted_by else None,
            "created_at": iv.created_at.isoformat(),
            "updated_at": iv.updated_at.isoformat(),
        },
        message=msg,
    )


@router.post("/values/bulk")
async def bulk_upload_indicator_values(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Bulk upload indicator values from a CSV file.

    CSV columns: indicator_code, boundary_pcode, value, source_name (optional)
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))

    required_cols = {"indicator_code", "boundary_pcode", "value"}
    if not required_cols.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have columns: indicator_code, boundary_pcode, value, source_name (optional). Found: {reader.fieldnames}",
        )

    # Pre-fetch indicator codes
    ind_result = await db.execute(select(ClimateIndicator.id, ClimateIndicator.code))
    code_to_id = {row.code: row.id for row in ind_result.all()}

    # Pre-fetch boundary pcodes
    bnd_result = await db.execute(select(AdminBoundary.pcode))
    valid_pcodes = {row.pcode for row in bnd_result.all()}

    # Pre-fetch source names
    src_result = await db.execute(select(Source.id, Source.name))
    name_to_source_id = {row.name.lower(): row.id for row in src_result.all()}

    errors = []
    created = 0
    updated = 0

    for i, row in enumerate(reader, start=2):
        indicator_code = (row.get("indicator_code") or "").strip()
        boundary_pcode = (row.get("boundary_pcode") or "").strip()
        value_str = (row.get("value") or "").strip()
        source_name = (row.get("source_name") or "").strip()

        # Validate
        if not indicator_code:
            errors.append(f"Row {i}: missing indicator_code")
            continue
        if not boundary_pcode:
            errors.append(f"Row {i}: missing boundary_pcode")
            continue
        if not value_str:
            errors.append(f"Row {i}: missing value")
            continue

        try:
            num_value = float(value_str)
        except ValueError:
            errors.append(f"Row {i}: invalid value '{value_str}'")
            continue

        if indicator_code not in code_to_id:
            errors.append(f"Row {i}: unknown indicator_code '{indicator_code}'")
            continue
        if boundary_pcode not in valid_pcodes:
            errors.append(f"Row {i}: unknown boundary_pcode '{boundary_pcode}'")
            continue

        source_id = None
        if source_name:
            source_id = name_to_source_id.get(source_name.lower())
            if source_id is None:
                errors.append(f"Row {i}: unknown source_name '{source_name}' (skipping source, value still saved)")

        ind_id = code_to_id[indicator_code]

        # Upsert
        existing = await db.execute(
            select(IndicatorValue).where(
                IndicatorValue.indicator_id == ind_id,
                IndicatorValue.boundary_pcode == boundary_pcode,
            )
        )
        iv = existing.scalar_one_or_none()

        if iv:
            iv.value = num_value
            iv.source_id = source_id
            iv.submitted_by = current_user.id
            updated += 1
        else:
            iv = IndicatorValue(
                indicator_id=ind_id,
                boundary_pcode=boundary_pcode,
                value=num_value,
                source_id=source_id,
                submitted_by=current_user.id,
            )
            db.add(iv)
            created += 1

    await db.flush()

    return envelope(
        data={"created": created, "updated": updated, "errors": errors},
        message=f"Bulk upload complete: {created} created, {updated} updated, {len(errors)} errors",
    )


@router.delete("/values/{value_id}")
async def delete_indicator_value(
    value_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(IndicatorValue).where(IndicatorValue.id == value_id)
    )
    iv = result.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Indicator value not found")

    await db.delete(iv)
    await db.flush()
    return envelope(message="Indicator value deleted successfully")


# ── Indicator CRUD (parameterized /{indicator_id} routes last) ──

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
    query = select(ClimateIndicator).options(
        joinedload(ClimateIndicator.unit), joinedload(ClimateIndicator.source)
    )
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
    indicators = result.scalars().unique().all()

    return envelope(data={
        "indicators": [indicator_to_response(ind) for ind in indicators],
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
        unit_id=req.unit_id,
        source_id=req.source_id,
        gis_attribute_id=req.gis_attribute_id,
        created_by=current_user.id,
    )
    db.add(indicator)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(ClimateIndicator)
        .options(joinedload(ClimateIndicator.unit), joinedload(ClimateIndicator.source))
        .where(ClimateIndicator.id == indicator.id)
    )
    indicator = result.scalars().unique().one()

    return envelope(
        data=indicator_to_response(indicator),
        message="Indicator created successfully",
    )


@router.get("/{indicator_id}")
async def get_indicator(
    indicator_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClimateIndicator)
        .options(joinedload(ClimateIndicator.unit), joinedload(ClimateIndicator.source))
        .where(ClimateIndicator.id == indicator_id)
    )
    indicator = result.scalars().unique().one_or_none()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")
    return envelope(data=indicator_to_response(indicator))


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
    if req.unit_id is not None:
        indicator.unit_id = req.unit_id
    if req.source_id is not None:
        indicator.source_id = req.source_id
    if req.gis_attribute_id is not None:
        indicator.gis_attribute_id = req.gis_attribute_id

    db.add(indicator)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(ClimateIndicator)
        .options(joinedload(ClimateIndicator.unit), joinedload(ClimateIndicator.source))
        .where(ClimateIndicator.id == indicator.id)
    )
    indicator = result.scalars().unique().one()

    return envelope(
        data=indicator_to_response(indicator),
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
