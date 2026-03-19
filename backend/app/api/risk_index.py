"""Risk Index API — full-record CRUD for all 40+ indicators per boundary."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.indicator import ClimateIndicator
from app.models.indicator_reference import IndicatorReference
from app.models.indicator_value import IndicatorValue
from app.models.user import User
from app.services.audit import create_audit_log
from app.services.cvi_engine import compute_and_cache
from app.api.websocket import broadcast_event

router = APIRouter(prefix="/api/v1/risk-index", tags=["risk-index"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


class RiskIndexCreate(BaseModel):
    boundary_pcode: str
    year: Optional[int] = None
    values: dict[str, float]


class RiskIndexUpdate(BaseModel):
    values: dict[str, float]


@router.post("/")
async def create_risk_index(
    req: RiskIndexCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update all indicator values for a boundary (all 40+ indicators)."""
    # Validate boundary
    bnd = await db.execute(
        select(AdminBoundary.pcode, AdminBoundary.name_en).where(
            AdminBoundary.pcode == req.boundary_pcode
        )
    )
    boundary = bnd.one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    # Load indicator code->id mapping
    ind_result = await db.execute(
        select(ClimateIndicator.id, ClimateIndicator.code, ClimateIndicator.gis_attribute_id)
    )
    rows = ind_result.all()
    code_to_id = {}
    for row in rows:
        if row.gis_attribute_id:
            code_to_id[row.gis_attribute_id] = row.id
        code_to_id[row.code] = row.id

    # Load reference for range warnings
    ref_result = await db.execute(
        select(
            IndicatorReference.indicator_id,
            IndicatorReference.global_min,
            IndicatorReference.global_max,
            ClimateIndicator.gis_attribute_id,
            ClimateIndicator.code,
        )
        .join(ClimateIndicator, IndicatorReference.indicator_id == ClimateIndicator.id)
    )
    ref_map = {}
    for row in ref_result.all():
        key = row.gis_attribute_id or row.code
        ref_map[key] = {"global_min": row.global_min, "global_max": row.global_max}

    warnings = []
    created = 0
    updated = 0

    for code, value in req.values.items():
        ind_id = code_to_id.get(code)
        if ind_id is None:
            warnings.append(f"Unknown indicator code: {code}")
            continue

        # Range check
        ref = ref_map.get(code)
        if ref:
            if value < ref["global_min"] or value > ref["global_max"]:
                warnings.append(
                    f"{code}: value {value} outside range [{ref['global_min']}, {ref['global_max']}]"
                )

        # Upsert
        existing = await db.execute(
            select(IndicatorValue).where(
                IndicatorValue.indicator_id == ind_id,
                IndicatorValue.boundary_pcode == req.boundary_pcode,
            )
        )
        iv = existing.scalar_one_or_none()

        if iv:
            iv.value = value
            iv.submitted_by = current_user.id
            iv.is_deleted = False
            iv.deleted_at = None
            updated += 1
        else:
            iv = IndicatorValue(
                indicator_id=ind_id,
                boundary_pcode=req.boundary_pcode,
                value=value,
                submitted_by=current_user.id,
            )
            db.add(iv)
            created += 1

    await db.flush()

    # Compute and cache scores
    scores = await compute_and_cache(db, req.boundary_pcode)

    # Audit log
    await create_audit_log(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="risk_index",
        entity_id=req.boundary_pcode,
        new_values={"values": req.values, "year": req.year},
        request=request,
    )

    def safe_float(v):
        if v is None:
            return None
        return round(v, 6)

    await broadcast_event("scores_updated", {
        "boundary_pcode": req.boundary_pcode,
        "cri": safe_float(scores.get("cri")),
    })

    return envelope(
        data={
            "boundary_pcode": req.boundary_pcode,
            "boundary_name": boundary.name_en,
            "created": created,
            "updated": updated,
            "warnings": warnings,
            "scores": {
                "hazard": safe_float(scores.get("hazard")),
                "soc_exposure": safe_float(scores.get("soc_exposure")),
                "sensitivity": safe_float(scores.get("sensitivity")),
                "adaptive_capacity": safe_float(scores.get("adaptive_capacity")),
                "exposure": safe_float(scores.get("exposure")),
                "vulnerability": safe_float(scores.get("vulnerability")),
                "cri": safe_float(scores.get("cri")),
            },
        },
        message=f"Risk index saved: {created} created, {updated} updated",
    )


@router.put("/{boundary_pcode}")
async def update_risk_index(
    boundary_pcode: str,
    req: RiskIndexUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update indicator values for a boundary (admin only). Creates audit version."""
    # Validate boundary
    bnd = await db.execute(
        select(AdminBoundary.pcode, AdminBoundary.name_en).where(
            AdminBoundary.pcode == boundary_pcode
        )
    )
    boundary = bnd.one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    # Load indicator mappings
    ind_result = await db.execute(
        select(ClimateIndicator.id, ClimateIndicator.code, ClimateIndicator.gis_attribute_id)
    )
    rows = ind_result.all()
    code_to_id = {}
    for row in rows:
        if row.gis_attribute_id:
            code_to_id[row.gis_attribute_id] = row.id
        code_to_id[row.code] = row.id

    # Capture old values for audit
    old_vals_result = await db.execute(
        select(
            ClimateIndicator.gis_attribute_id,
            IndicatorValue.value,
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .where(
            IndicatorValue.boundary_pcode == boundary_pcode,
            IndicatorValue.is_deleted == False,
        )
    )
    old_values = {row.gis_attribute_id: row.value for row in old_vals_result.all() if row.gis_attribute_id}

    updated = 0
    created = 0

    for code, value in req.values.items():
        ind_id = code_to_id.get(code)
        if ind_id is None:
            continue

        existing = await db.execute(
            select(IndicatorValue).where(
                IndicatorValue.indicator_id == ind_id,
                IndicatorValue.boundary_pcode == boundary_pcode,
            )
        )
        iv = existing.scalar_one_or_none()

        if iv:
            iv.value = value
            iv.submitted_by = current_user.id
            iv.is_deleted = False
            iv.deleted_at = None
            updated += 1
        else:
            iv = IndicatorValue(
                indicator_id=ind_id,
                boundary_pcode=boundary_pcode,
                value=value,
                submitted_by=current_user.id,
            )
            db.add(iv)
            created += 1

    await db.flush()

    scores = await compute_and_cache(db, boundary_pcode)

    # Audit with old/new diff
    await create_audit_log(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="risk_index",
        entity_id=boundary_pcode,
        old_values=old_values,
        new_values=req.values,
        request=request,
    )

    def safe_float(v):
        if v is None:
            return None
        return round(v, 6)

    await broadcast_event("scores_updated", {
        "boundary_pcode": boundary_pcode,
        "cri": safe_float(scores.get("cri")),
    })

    return envelope(
        data={
            "boundary_pcode": boundary_pcode,
            "boundary_name": boundary.name_en,
            "created": created,
            "updated": updated,
            "scores": {
                "hazard": safe_float(scores.get("hazard")),
                "soc_exposure": safe_float(scores.get("soc_exposure")),
                "sensitivity": safe_float(scores.get("sensitivity")),
                "adaptive_capacity": safe_float(scores.get("adaptive_capacity")),
                "exposure": safe_float(scores.get("exposure")),
                "vulnerability": safe_float(scores.get("vulnerability")),
                "cri": safe_float(scores.get("cri")),
            },
        },
        message=f"Risk index updated: {created} created, {updated} updated",
    )
