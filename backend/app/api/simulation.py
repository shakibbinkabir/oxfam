"""Simulation and Scenarios API endpoints for what-if analysis."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.indicator_value import IndicatorValue
from app.models.scenario import Scenario
from app.models.user import User
from app.services.cvi_engine import (
    ALL_DIMENSION_CODES,
    run_simulation,
)

router = APIRouter(prefix="/api/v1", tags=["simulation"])

ALL_VALID_CODES = set()
for codes in ALL_DIMENSION_CODES.values():
    ALL_VALID_CODES.update(codes)


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


def safe_float(val):
    if val is None:
        return None
    if isinstance(val, float) and (val != val or val == float("inf") or val == float("-inf")):
        return None
    return round(val, 6)


def get_cri_category(cri: Optional[float]) -> Optional[str]:
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


def format_score_dict(d: dict) -> dict:
    return {k: safe_float(v) if isinstance(v, (int, float)) else v for k, v in d.items()}


# ── Schemas ──

class SimulationRequest(BaseModel):
    boundary_pcode: str
    modified_values: dict[str, float]
    weights: Optional[dict[str, float]] = None

    @field_validator("modified_values")
    @classmethod
    def validate_modified_values(cls, v):
        if not v:
            raise ValueError("modified_values must contain at least one indicator")
        for code in v:
            if code not in ALL_VALID_CODES:
                raise ValueError(f"Unknown indicator code: {code}")
        return v

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, v):
        if v is None:
            return v
        required_keys = {"hazard", "exposure", "sensitivity", "adaptive_capacity"}
        if set(v.keys()) != required_keys:
            raise ValueError(f"Weights must contain exactly: {required_keys}")
        total = sum(v.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0 (got {total:.4f})")
        return v


class ScenarioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    boundary_pcode: str
    modified_values: dict[str, float]
    weights: Optional[dict[str, float]] = None
    original_cri: Optional[float] = None
    simulated_cri: Optional[float] = None


# ── Simulation Endpoint ──

@router.post("/simulate")
async def simulate(
    req: SimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run what-if simulation — pure computation, no data persisted."""
    # Validate boundary exists and has data
    bnd_result = await db.execute(
        select(AdminBoundary.name_en, AdminBoundary.adm_level).where(
            AdminBoundary.pcode == req.boundary_pcode
        )
    )
    boundary = bnd_result.one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    # Check that boundary has indicator data
    iv_count = await db.execute(
        select(func.count(IndicatorValue.id)).where(
            IndicatorValue.boundary_pcode == req.boundary_pcode
        )
    )
    if iv_count.scalar() == 0:
        raise HTTPException(status_code=404, detail="No indicator data for this boundary")

    result = await run_simulation(
        db, req.boundary_pcode, req.modified_values, req.weights
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Could not compute simulation")

    original_category = get_cri_category(result["original_scores"].get("cri"))
    simulated_category = get_cri_category(result["simulated_scores"].get("cri"))

    return envelope(data={
        "boundary_pcode": req.boundary_pcode,
        "boundary_name": boundary.name_en,
        "original_scores": format_score_dict(result["original_scores"]),
        "simulated_scores": format_score_dict(result["simulated_scores"]),
        "deltas": format_score_dict(result["deltas"]),
        "modified_indicators": result["modified_indicators"],
        "original_category": original_category,
        "simulated_category": simulated_category,
        "category_changed": original_category != simulated_category,
        "weights_used": req.weights or {
            "hazard": 0.5, "exposure": 0.167, "sensitivity": 0.167, "adaptive_capacity": 0.167
        },
    })


# ── Scenario CRUD ──

@router.post("/scenarios")
async def create_scenario(
    req: ScenarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Save a simulation as a named scenario (admin only)."""
    # Validate boundary exists
    bnd = await db.execute(
        select(AdminBoundary.pcode).where(AdminBoundary.pcode == req.boundary_pcode)
    )
    if not bnd.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Boundary not found")

    scenario = Scenario(
        name=req.name,
        description=req.description,
        boundary_pcode=req.boundary_pcode,
        modified_values=req.modified_values,
        weights=req.weights,
        original_cri=req.original_cri,
        simulated_cri=req.simulated_cri,
        created_by=current_user.id,
    )
    db.add(scenario)
    await db.flush()
    await db.refresh(scenario)

    return envelope(
        data={
            "id": str(scenario.id),
            "name": scenario.name,
            "boundary_pcode": scenario.boundary_pcode,
            "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
        },
        message="Scenario saved",
    )


@router.get("/scenarios")
async def list_scenarios(
    boundary_pcode: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List saved scenarios (all authenticated users)."""
    query = (
        select(Scenario)
        .where(Scenario.is_deleted == False)
        .order_by(Scenario.created_at.desc())
    )

    count_query = select(func.count(Scenario.id)).where(Scenario.is_deleted == False)

    if boundary_pcode:
        query = query.where(Scenario.boundary_pcode == boundary_pcode)
        count_query = count_query.where(Scenario.boundary_pcode == boundary_pcode)
    if search:
        query = query.where(Scenario.name.ilike(f"%{search}%"))
        count_query = count_query.where(Scenario.name.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.offset(skip).limit(limit))
    scenarios = result.scalars().all()

    data = []
    for s in scenarios:
        data.append({
            "id": str(s.id),
            "name": s.name,
            "description": s.description,
            "boundary_pcode": s.boundary_pcode,
            "original_cri": safe_float(s.original_cri),
            "simulated_cri": safe_float(s.simulated_cri),
            "delta_cri": safe_float(s.simulated_cri - s.original_cri)
                if s.original_cri is not None and s.simulated_cri is not None else None,
            "modified_values": s.modified_values,
            "weights": s.weights,
            "created_by": str(s.created_by),
            "creator_name": s.creator.full_name if s.creator else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return envelope(data={"scenarios": data, "total": total, "skip": skip, "limit": limit})


@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get scenario detail."""
    result = await db.execute(
        select(Scenario).where(Scenario.id == scenario_id, Scenario.is_deleted == False)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")

    return envelope(data={
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "boundary_pcode": s.boundary_pcode,
        "modified_values": s.modified_values,
        "weights": s.weights,
        "original_cri": safe_float(s.original_cri),
        "simulated_cri": safe_float(s.simulated_cri),
        "created_by": str(s.created_by),
        "creator_name": s.creator.full_name if s.creator else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    })


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Soft-delete a scenario (admin only)."""
    result = await db.execute(
        select(Scenario).where(Scenario.id == scenario_id, Scenario.is_deleted == False)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")

    s.is_deleted = True
    await db.flush()

    return envelope(message="Scenario deleted")
