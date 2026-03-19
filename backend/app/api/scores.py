"""Score computation and retrieval API endpoints for CVI/CRI."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.computed_score import ComputedScore
from app.models.indicator_reference import IndicatorReference
from app.models.indicator import ClimateIndicator
from app.models.indicator_value import IndicatorValue
from app.models.user import User
from app.services.cvi_engine import (
    compute_and_cache,
    compute_calculation_trace,
    get_cached_or_compute,
    aggregate_scores_for_parent,
    load_indicator_values,
    load_reference_map,
)

router = APIRouter(prefix="/api/v1/scores", tags=["scores"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


def safe_float(val):
    if val is None:
        return None
    if isinstance(val, float) and (val != val or val == float("inf") or val == float("-inf")):
        return None
    return round(val, 6)


def format_scores(scores: dict) -> dict:
    """Format score values to 6 decimal places."""
    return {
        k: safe_float(v) if isinstance(v, (int, float)) else v
        for k, v in scores.items()
    }


def get_cri_category(cri: Optional[float]) -> Optional[str]:
    """Map CRI value to category label per PRD."""
    if cri is None:
        return None
    if cri < 0.2:
        return "Very Low"
    if cri < 0.4:
        return "Low"
    if cri < 0.6:
        return "Medium"
    if cri < 0.8:
        return "High"
    return "Very High"


# ── Static routes MUST come before parameterized /{boundary_pcode} ──


@router.get("/reference")
async def list_indicator_references(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all indicator reference entries (global min/max, direction, weight)."""
    result = await db.execute(
        select(
            IndicatorReference.id,
            IndicatorReference.indicator_id,
            IndicatorReference.global_min,
            IndicatorReference.global_max,
            IndicatorReference.direction,
            IndicatorReference.weight,
            IndicatorReference.updated_at,
            ClimateIndicator.indicator_name,
            ClimateIndicator.code,
            ClimateIndicator.gis_attribute_id,
            ClimateIndicator.component,
            ClimateIndicator.subcategory,
        )
        .join(ClimateIndicator, IndicatorReference.indicator_id == ClimateIndicator.id)
        .order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    rows = result.all()
    data = [
        {
            "id": row.id,
            "indicator_id": row.indicator_id,
            "indicator_name": row.indicator_name,
            "code": row.code,
            "gis_attribute_id": row.gis_attribute_id,
            "component": row.component,
            "subcategory": row.subcategory,
            "global_min": row.global_min,
            "global_max": row.global_max,
            "direction": row.direction,
            "weight": row.weight,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in rows
    ]
    return envelope(data=data)


@router.put("/reference/{ref_id}")
async def update_indicator_reference(
    ref_id: int,
    global_min: Optional[float] = None,
    global_max: Optional[float] = None,
    direction: Optional[str] = None,
    weight: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update an indicator reference entry (admin only)."""
    result = await db.execute(
        select(IndicatorReference).where(IndicatorReference.id == ref_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Indicator reference not found")

    if global_min is not None:
        ref.global_min = global_min
    if global_max is not None:
        ref.global_max = global_max
    if direction is not None:
        if direction not in ("+", "-"):
            raise HTTPException(status_code=400, detail="Direction must be '+' or '-'")
        ref.direction = direction
    if weight is not None:
        ref.weight = weight

    await db.flush()
    await db.refresh(ref)

    return envelope(
        data={
            "id": ref.id,
            "indicator_id": ref.indicator_id,
            "global_min": ref.global_min,
            "global_max": ref.global_max,
            "direction": ref.direction,
            "weight": ref.weight,
        },
        message="Indicator reference updated",
    )


@router.get("/map/geojson")
async def get_scores_map_geojson(
    level: int = Query(4, ge=1, le=4),
    indicator: str = Query("cri"),
    bbox: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return GeoJSON FeatureCollection with score properties for choropleth rendering."""
    SIMPLIFY_TOLERANCE = {1: 0.01, 2: 0.005, 3: 0.002, 4: 0}
    tolerance = SIMPLIFY_TOLERANCE.get(level, 0)

    if tolerance > 0:
        geom_col = func.ST_AsGeoJSON(func.ST_Simplify(AdminBoundary.geom, tolerance))
    else:
        geom_col = func.ST_AsGeoJSON(AdminBoundary.geom)

    query = (
        select(
            AdminBoundary.name_en,
            AdminBoundary.pcode,
            AdminBoundary.adm_level,
            AdminBoundary.parent_pcode,
            geom_col.label("geojson"),
            ComputedScore.hazard_score,
            ComputedScore.soc_exposure_score,
            ComputedScore.sensitivity_score,
            ComputedScore.adaptive_capacity_score,
            ComputedScore.exposure_score,
            ComputedScore.vulnerability_score,
            ComputedScore.cri_score,
        )
        .outerjoin(ComputedScore, AdminBoundary.pcode == ComputedScore.boundary_pcode)
        .where(AdminBoundary.adm_level == level)
    )

    if bbox:
        try:
            west, south, east, north = [float(x.strip()) for x in bbox.split(",")]
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid bbox format")
        bbox_geom = func.ST_MakeEnvelope(west, south, east, north, 4326)
        query = query.where(func.ST_Intersects(AdminBoundary.geom, bbox_geom))

    result = await db.execute(query)
    rows = result.all()

    INDICATOR_MAP = {
        "cri": "cri_score",
        "hazard": "hazard_score",
        "exposure": "exposure_score",
        "soc_exposure": "soc_exposure_score",
        "sensitivity": "sensitivity_score",
        "adaptive_capacity": "adaptive_capacity_score",
        "vulnerability": "vulnerability_score",
    }
    score_field = INDICATOR_MAP.get(indicator, "cri_score")

    features = []
    for row in rows:
        geom = json.loads(row.geojson) if row.geojson else None
        score_val = safe_float(getattr(row, score_field, None))
        features.append({
            "type": "Feature",
            "properties": {
                "name_en": row.name_en,
                "pcode": row.pcode,
                "adm_level": row.adm_level,
                "parent_pcode": row.parent_pcode,
                "score": score_val,
                "cri": safe_float(row.cri_score),
                "hazard": safe_float(row.hazard_score),
                "exposure": safe_float(row.exposure_score),
                "sensitivity": safe_float(row.sensitivity_score),
                "adaptive_capacity": safe_float(row.adaptive_capacity_score),
                "vulnerability": safe_float(row.vulnerability_score),
                "cri_category": get_cri_category(row.cri_score),
            },
            "geometry": geom,
        })

    return {"type": "FeatureCollection", "features": features}


@router.post("/recompute")
async def recompute_all_scores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Bulk recompute scores for all unions with indicator data (admin only)."""
    result = await db.execute(
        select(IndicatorValue.boundary_pcode).distinct()
    )
    pcodes = [row.boundary_pcode for row in result.all()]

    computed = 0
    for pcode in pcodes:
        await compute_and_cache(db, pcode)
        computed += 1

    return envelope(
        data={"computed": computed},
        message=f"Recomputed scores for {computed} boundaries",
    )


@router.get("/list")
async def list_scores(
    level: Optional[int] = Query(None, ge=1, le=4),
    division_pcode: Optional[str] = Query(None),
    district_pcode: Optional[str] = Query(None),
    upazila_pcode: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List computed scores for boundaries with filtering."""
    query = (
        select(
            ComputedScore.boundary_pcode,
            ComputedScore.hazard_score,
            ComputedScore.soc_exposure_score,
            ComputedScore.sensitivity_score,
            ComputedScore.adaptive_capacity_score,
            ComputedScore.env_exposure_score,
            ComputedScore.env_sensitivity_score,
            ComputedScore.exposure_score,
            ComputedScore.vulnerability_score,
            ComputedScore.cri_score,
            ComputedScore.computed_at,
            AdminBoundary.name_en,
            AdminBoundary.adm_level,
            AdminBoundary.division_name,
            AdminBoundary.district_name,
            AdminBoundary.upazila_name,
        )
        .join(AdminBoundary, ComputedScore.boundary_pcode == AdminBoundary.pcode)
    )

    count_query = (
        select(func.count(ComputedScore.id))
        .join(AdminBoundary, ComputedScore.boundary_pcode == AdminBoundary.pcode)
    )

    if level:
        query = query.where(AdminBoundary.adm_level == level)
        count_query = count_query.where(AdminBoundary.adm_level == level)
    if division_pcode:
        query = query.where(AdminBoundary.pcode.like(division_pcode[:2] + "%"))
        count_query = count_query.where(AdminBoundary.pcode.like(division_pcode[:2] + "%"))
    if district_pcode:
        query = query.where(AdminBoundary.pcode.like(district_pcode[:4] + "%"))
        count_query = count_query.where(AdminBoundary.pcode.like(district_pcode[:4] + "%"))
    if upazila_pcode:
        query = query.where(AdminBoundary.parent_pcode == upazila_pcode)
        count_query = count_query.where(AdminBoundary.parent_pcode == upazila_pcode)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(ComputedScore.cri_score.desc().nulls_last())
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    data = []
    for row in rows:
        data.append({
            "boundary_pcode": row.boundary_pcode,
            "name_en": row.name_en,
            "adm_level": row.adm_level,
            "division_name": row.division_name,
            "district_name": row.district_name,
            "upazila_name": row.upazila_name,
            "hazard": safe_float(row.hazard_score),
            "soc_exposure": safe_float(row.soc_exposure_score),
            "sensitivity": safe_float(row.sensitivity_score),
            "adaptive_capacity": safe_float(row.adaptive_capacity_score),
            "env_exposure": safe_float(row.env_exposure_score),
            "env_sensitivity": safe_float(row.env_sensitivity_score),
            "exposure": safe_float(row.exposure_score),
            "vulnerability": safe_float(row.vulnerability_score),
            "cri": safe_float(row.cri_score),
            "cri_category": get_cri_category(row.cri_score),
            "computed_at": row.computed_at.isoformat() if row.computed_at else None,
        })

    return envelope(data={"scores": data, "total": total, "skip": skip, "limit": limit})


# ── Parameterized routes (MUST come last) ──


@router.get("/{boundary_pcode}")
async def get_scores_for_boundary(
    boundary_pcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute and return full CVI breakdown for a single boundary."""
    bnd_result = await db.execute(
        select(AdminBoundary.adm_level, AdminBoundary.name_en).where(
            AdminBoundary.pcode == boundary_pcode
        )
    )
    boundary = bnd_result.one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    if boundary.adm_level == 4:
        scores = await get_cached_or_compute(db, boundary_pcode)
    else:
        scores = await aggregate_scores_for_parent(db, boundary_pcode)

    scores["name_en"] = boundary.name_en
    scores["adm_level"] = boundary.adm_level
    scores["cri_category"] = get_cri_category(scores.get("cri"))

    return envelope(data=format_scores(scores))


@router.get("/{boundary_pcode}/trace")
async def get_calculation_trace(
    boundary_pcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return step-by-step calculation trace for transparency."""
    bnd_result = await db.execute(
        select(AdminBoundary.adm_level).where(AdminBoundary.pcode == boundary_pcode)
    )
    boundary = bnd_result.scalar_one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    reference_map = await load_reference_map(db)
    raw_values = await load_indicator_values(db, boundary_pcode)

    if not raw_values:
        return envelope(data={"message": "No indicator values found for this boundary"})

    trace = compute_calculation_trace(raw_values, reference_map)
    return envelope(data=trace)
