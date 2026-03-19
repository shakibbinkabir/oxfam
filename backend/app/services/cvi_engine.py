"""
CVI Calculation Engine — the core intelligence layer of CRVAP.

Implements the 3-stage CVI pipeline from the PRD:
  Stage 1: Min-Max Normalisation
  Stage 2: Component Score Aggregation
  Stage 3: Vulnerability & Climate Risk Index (CRI)
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.computed_score import ComputedScore
from app.models.indicator import ClimateIndicator
from app.models.indicator_reference import IndicatorReference
from app.models.indicator_value import IndicatorValue
from app.models.boundary import AdminBoundary

# Component groupings — maps GIS attribute IDs to their CVI dimension
# Matches the PRD indicator table exactly
HAZARD_CODES = [
    "rainfall", "heat", "colddays", "drought", "water",
    "erosion", "surge", "salinity", "lightning",
]

SOC_EXPOSURE_CODES = ["population", "household", "female", "child_old"]

SENSITIVITY_CODES = [
    "pop_density", "dependency", "disable", "unemployed", "fm_ratio",
    "vulnerable_hh", "hh_size", "slum_float", "poverty", "crop_damage",
    "occupation", "edu_hamper", "migration",
]

ADAPTIVE_CAPACITY_CODES = [
    "literacy", "electricity", "solar", "drink_water", "sanitation",
    "handwash", "edu_institute", "shelter_cov", "market_cov", "mfs",
    "internet", "production", "mangrove", "cc_awareness", "disaster_prep",
    "safety_net", "pavedroad",
]

ENV_EXPOSURE_CODES = ["forest", "waterbody", "agri_land"]

ENV_SENSITIVITY_CODES = ["ndvi", "wetland_loss", "groundwater"]

ALL_DIMENSION_CODES = {
    "hazard": HAZARD_CODES,
    "soc_exposure": SOC_EXPOSURE_CODES,
    "sensitivity": SENSITIVITY_CODES,
    "adaptive_capacity": ADAPTIVE_CAPACITY_CODES,
    "env_exposure": ENV_EXPOSURE_CODES,
    "env_sensitivity": ENV_SENSITIVITY_CODES,
}


def normalise(value: float, global_min: float, global_max: float, direction: str) -> float:
    """Stage 1: Min-Max normalisation to [0, 1].

    For positive direction (+): higher value = higher vulnerability.
    For inverted direction (-): higher value = lower vulnerability.
    """
    if global_min == global_max:
        return 0.5

    normalised = (value - global_min) / (global_max - global_min)

    if direction == "-":
        normalised = 1.0 - normalised

    return max(0.0, min(1.0, normalised))


def compute_component_score(normalised_values: list[float]) -> Optional[float]:
    """Stage 2: Arithmetic mean of normalised sub-indicator values within a dimension."""
    if not normalised_values:
        return None
    return sum(normalised_values) / len(normalised_values)


def compute_vulnerability(
    exposure: Optional[float],
    sensitivity: Optional[float],
    adaptive_capacity: Optional[float],
) -> Optional[float]:
    """Stage 3a: Vulnerability = (Exposure + Sensitivity + (1 - Adaptive_Capacity)) / 3

    Exposure here is the combined socioeconomic + environmental exposure.
    """
    components = []
    if exposure is not None:
        components.append(exposure)
    if sensitivity is not None:
        components.append(sensitivity)
    if adaptive_capacity is not None:
        components.append(1.0 - adaptive_capacity)

    if not components:
        return None

    return sum(components) / len(components)


def compute_cri(hazard_score: Optional[float], vulnerability: Optional[float]) -> Optional[float]:
    """Stage 3b: CRI = (Hazard + Vulnerability) / 2, bounded [0, 1]."""
    components = []
    if hazard_score is not None:
        components.append(hazard_score)
    if vulnerability is not None:
        components.append(vulnerability)

    if not components:
        return None

    cri = sum(components) / len(components)
    return max(0.0, min(1.0, cri))


async def load_reference_map(db: AsyncSession) -> dict:
    """Load all indicator references keyed by indicator GIS attribute ID."""
    result = await db.execute(
        select(
            IndicatorReference.global_min,
            IndicatorReference.global_max,
            IndicatorReference.direction,
            IndicatorReference.weight,
            ClimateIndicator.gis_attribute_id,
        )
        .join(ClimateIndicator, IndicatorReference.indicator_id == ClimateIndicator.id)
    )
    rows = result.all()
    return {
        row.gis_attribute_id: {
            "global_min": row.global_min,
            "global_max": row.global_max,
            "direction": row.direction,
            "weight": row.weight,
        }
        for row in rows
        if row.gis_attribute_id
    }


async def load_indicator_values(db: AsyncSession, boundary_pcode: str) -> dict:
    """Load all raw indicator values for a boundary, keyed by GIS attribute ID."""
    result = await db.execute(
        select(
            ClimateIndicator.gis_attribute_id,
            ClimateIndicator.indicator_name,
            IndicatorValue.value,
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .where(IndicatorValue.boundary_pcode == boundary_pcode)
        .where(IndicatorValue.is_deleted == False)
    )
    rows = result.all()
    return {
        row.gis_attribute_id: {
            "name": row.indicator_name,
            "raw_value": row.value,
        }
        for row in rows
        if row.gis_attribute_id
    }


def normalise_all(
    raw_values: dict, reference_map: dict
) -> dict:
    """Normalise all raw values using reference data. Returns dict of gis_attr_id -> normalised info."""
    normalised = {}
    for gis_id, val_info in raw_values.items():
        ref = reference_map.get(gis_id)
        if ref is None:
            continue
        norm_val = normalise(
            val_info["raw_value"],
            ref["global_min"],
            ref["global_max"],
            ref["direction"],
        )
        normalised[gis_id] = {
            "name": val_info["name"],
            "raw_value": val_info["raw_value"],
            "normalised_value": norm_val,
            "global_min": ref["global_min"],
            "global_max": ref["global_max"],
            "direction": ref["direction"],
        }
    return normalised


def compute_dimension_scores(normalised: dict) -> dict:
    """Compute component scores for all 6 dimensions from normalised values."""
    scores = {}
    for dimension, codes in ALL_DIMENSION_CODES.items():
        values = [
            normalised[c]["normalised_value"]
            for c in codes
            if c in normalised
        ]
        scores[dimension] = compute_component_score(values)
    return scores


def compute_full_scores(dimension_scores: dict) -> dict:
    """Compute combined exposure, vulnerability, and CRI from dimension scores."""
    # Combined exposure: mean of socioeconomic + environmental exposure
    exp_parts = [
        s for s in [dimension_scores.get("soc_exposure"), dimension_scores.get("env_exposure")]
        if s is not None
    ]
    combined_exposure = sum(exp_parts) / len(exp_parts) if exp_parts else None

    # Combined sensitivity: mean of socioeconomic + environmental sensitivity
    sens_parts = [
        s for s in [dimension_scores.get("sensitivity"), dimension_scores.get("env_sensitivity")]
        if s is not None
    ]
    combined_sensitivity = sum(sens_parts) / len(sens_parts) if sens_parts else None

    vulnerability = compute_vulnerability(
        combined_exposure,
        combined_sensitivity,
        dimension_scores.get("adaptive_capacity"),
    )

    cri = compute_cri(dimension_scores.get("hazard"), vulnerability)

    return {
        "exposure": combined_exposure,
        "vulnerability": vulnerability,
        "cri": cri,
    }


async def compute_all_scores(db: AsyncSession, boundary_pcode: str) -> dict:
    """Full pipeline: fetch data, normalise, aggregate, compute CVI/CRI for a boundary."""
    reference_map = await load_reference_map(db)
    raw_values = await load_indicator_values(db, boundary_pcode)

    if not raw_values:
        return {
            "boundary_pcode": boundary_pcode,
            "hazard": None,
            "soc_exposure": None,
            "sensitivity": None,
            "adaptive_capacity": None,
            "env_exposure": None,
            "env_sensitivity": None,
            "exposure": None,
            "vulnerability": None,
            "cri": None,
            "normalised_values": {},
        }

    normalised = normalise_all(raw_values, reference_map)
    dimension_scores = compute_dimension_scores(normalised)
    full_scores = compute_full_scores(dimension_scores)

    return {
        "boundary_pcode": boundary_pcode,
        "hazard": dimension_scores.get("hazard"),
        "soc_exposure": dimension_scores.get("soc_exposure"),
        "sensitivity": dimension_scores.get("sensitivity"),
        "adaptive_capacity": dimension_scores.get("adaptive_capacity"),
        "env_exposure": dimension_scores.get("env_exposure"),
        "env_sensitivity": dimension_scores.get("env_sensitivity"),
        "exposure": full_scores["exposure"],
        "vulnerability": full_scores["vulnerability"],
        "cri": full_scores["cri"],
        "normalised_values": normalised,
    }


async def compute_and_cache(db: AsyncSession, boundary_pcode: str) -> dict:
    """Compute scores and persist them in the computed_scores cache table."""
    scores = await compute_all_scores(db, boundary_pcode)

    result = await db.execute(
        select(ComputedScore).where(ComputedScore.boundary_pcode == boundary_pcode)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.hazard_score = scores["hazard"]
        existing.soc_exposure_score = scores["soc_exposure"]
        existing.sensitivity_score = scores["sensitivity"]
        existing.adaptive_capacity_score = scores["adaptive_capacity"]
        existing.env_exposure_score = scores["env_exposure"]
        existing.env_sensitivity_score = scores["env_sensitivity"]
        existing.exposure_score = scores["exposure"]
        existing.vulnerability_score = scores["vulnerability"]
        existing.cri_score = scores["cri"]
        existing.computed_at = datetime.now(timezone.utc)
        existing.is_stale = False
    else:
        cs = ComputedScore(
            boundary_pcode=boundary_pcode,
            hazard_score=scores["hazard"],
            soc_exposure_score=scores["soc_exposure"],
            sensitivity_score=scores["sensitivity"],
            adaptive_capacity_score=scores["adaptive_capacity"],
            env_exposure_score=scores["env_exposure"],
            env_sensitivity_score=scores["env_sensitivity"],
            exposure_score=scores["exposure"],
            vulnerability_score=scores["vulnerability"],
            cri_score=scores["cri"],
        )
        db.add(cs)

    await db.flush()
    return scores


async def get_cached_or_compute(db: AsyncSession, boundary_pcode: str) -> dict:
    """Return cached scores if fresh, otherwise recompute."""
    result = await db.execute(
        select(ComputedScore).where(
            ComputedScore.boundary_pcode == boundary_pcode,
            ComputedScore.is_stale == False,
        )
    )
    cached = result.scalar_one_or_none()

    if cached:
        return {
            "boundary_pcode": boundary_pcode,
            "hazard": cached.hazard_score,
            "soc_exposure": cached.soc_exposure_score,
            "sensitivity": cached.sensitivity_score,
            "adaptive_capacity": cached.adaptive_capacity_score,
            "env_exposure": cached.env_exposure_score,
            "env_sensitivity": cached.env_sensitivity_score,
            "exposure": cached.exposure_score,
            "vulnerability": cached.vulnerability_score,
            "cri": cached.cri_score,
        }

    return await compute_and_cache(db, boundary_pcode)


async def mark_scores_stale(db: AsyncSession, boundary_pcode: str) -> None:
    """Mark cached scores as stale when underlying data changes."""
    result = await db.execute(
        select(ComputedScore).where(ComputedScore.boundary_pcode == boundary_pcode)
    )
    cached = result.scalar_one_or_none()
    if cached:
        cached.is_stale = True
        await db.flush()


async def aggregate_scores_for_parent(db: AsyncSession, parent_pcode: str) -> dict:
    """Compute aggregated scores for a non-union boundary (division/district/upazila)
    as the arithmetic mean of all constituent union scores."""
    # Find all child unions
    child_result = await db.execute(
        select(AdminBoundary.pcode).where(
            AdminBoundary.adm_level == 4,
            (
                (AdminBoundary.parent_pcode == parent_pcode)
                | (AdminBoundary.pcode.like(parent_pcode + "%"))
            ),
        )
    )
    child_pcodes = [row.pcode for row in child_result.all()]

    if not child_pcodes:
        # Try hierarchical lookup for divisions/districts
        # Get boundaries whose pcode starts with the parent pcode prefix
        child_result = await db.execute(
            select(AdminBoundary.pcode).where(
                AdminBoundary.adm_level == 4,
                AdminBoundary.pcode.like(parent_pcode[:4] + "%") if len(parent_pcode) <= 4
                else AdminBoundary.pcode.like(parent_pcode[:6] + "%") if len(parent_pcode) <= 6
                else AdminBoundary.parent_pcode == parent_pcode,
            )
        )
        child_pcodes = [row.pcode for row in child_result.all()]

    if not child_pcodes:
        return {
            "boundary_pcode": parent_pcode,
            "hazard": None, "soc_exposure": None, "sensitivity": None,
            "adaptive_capacity": None, "env_exposure": None, "env_sensitivity": None,
            "exposure": None, "vulnerability": None, "cri": None,
            "child_count": 0,
        }

    # Collect scores for all child unions
    score_fields = [
        "hazard", "soc_exposure", "sensitivity", "adaptive_capacity",
        "env_exposure", "env_sensitivity", "exposure", "vulnerability", "cri",
    ]
    field_sums = {f: [] for f in score_fields}

    for pcode in child_pcodes:
        child_scores = await get_cached_or_compute(db, pcode)
        for f in score_fields:
            val = child_scores.get(f)
            if val is not None:
                field_sums[f].append(val)

    aggregated = {"boundary_pcode": parent_pcode, "child_count": len(child_pcodes)}
    for f in score_fields:
        values = field_sums[f]
        aggregated[f] = sum(values) / len(values) if values else None

    return aggregated


def compute_weighted_scores(
    dimension_scores: dict,
    weights: dict | None = None,
) -> dict:
    """Compute vulnerability and CRI using optional custom dimension weights.

    When weights are provided (hazard, exposure, sensitivity, adaptive_capacity
    summing to ~1.0), use weighted aggregation instead of equal-weight defaults.
    """
    if not weights:
        return compute_full_scores(dimension_scores)

    w_h = weights.get("hazard", 0.25)
    w_e = weights.get("exposure", 0.25)
    w_s = weights.get("sensitivity", 0.25)
    w_a = weights.get("adaptive_capacity", 0.25)

    # Combined exposure & sensitivity (same as standard pipeline)
    exp_parts = [
        s for s in [dimension_scores.get("soc_exposure"), dimension_scores.get("env_exposure")]
        if s is not None
    ]
    combined_exposure = sum(exp_parts) / len(exp_parts) if exp_parts else None

    sens_parts = [
        s for s in [dimension_scores.get("sensitivity"), dimension_scores.get("env_sensitivity")]
        if s is not None
    ]
    combined_sensitivity = sum(sens_parts) / len(sens_parts) if sens_parts else None

    ac = dimension_scores.get("adaptive_capacity")

    # Weighted vulnerability
    vuln_parts = []
    vuln_weight_sum = 0.0
    if combined_exposure is not None:
        vuln_parts.append(w_e * combined_exposure)
        vuln_weight_sum += w_e
    if combined_sensitivity is not None:
        vuln_parts.append(w_s * combined_sensitivity)
        vuln_weight_sum += w_s
    if ac is not None:
        vuln_parts.append(w_a * (1.0 - ac))
        vuln_weight_sum += w_a

    vulnerability = sum(vuln_parts) / vuln_weight_sum if vuln_weight_sum > 0 else None

    # Weighted CRI
    hazard = dimension_scores.get("hazard")
    cri_parts = []
    cri_weight_sum = 0.0
    if hazard is not None:
        cri_parts.append(w_h * hazard)
        cri_weight_sum += w_h
    if vulnerability is not None:
        non_hazard_weight = 1.0 - w_h
        cri_parts.append(non_hazard_weight * vulnerability)
        cri_weight_sum += non_hazard_weight

    cri = sum(cri_parts) / cri_weight_sum if cri_weight_sum > 0 else None
    if cri is not None:
        cri = max(0.0, min(1.0, cri))

    return {
        "exposure": combined_exposure,
        "vulnerability": vulnerability,
        "cri": cri,
    }


async def run_simulation(
    db: AsyncSession,
    boundary_pcode: str,
    modified_values: dict[str, float],
    weights: dict | None = None,
) -> dict:
    """Run what-if simulation: apply modified indicator values and optional custom weights.

    Returns original scores, simulated scores, deltas, and modified indicator details.
    No data is persisted.
    """
    reference_map = await load_reference_map(db)
    raw_values = await load_indicator_values(db, boundary_pcode)

    if not raw_values:
        return None

    # Compute original scores
    orig_normalised = normalise_all(raw_values, reference_map)
    orig_dimension = compute_dimension_scores(orig_normalised)
    orig_full = compute_full_scores(orig_dimension)

    original_scores = {
        "hazard": orig_dimension.get("hazard"),
        "exposure": orig_full["exposure"],
        "sensitivity": orig_dimension.get("sensitivity"),
        "adaptive_capacity": orig_dimension.get("adaptive_capacity"),
        "vulnerability": orig_full["vulnerability"],
        "cri": orig_full["cri"],
    }

    # Build simulated raw values by applying overrides
    sim_raw = {}
    for gis_id, val_info in raw_values.items():
        if gis_id in modified_values:
            sim_raw[gis_id] = {
                "name": val_info["name"],
                "raw_value": modified_values[gis_id],
            }
        else:
            sim_raw[gis_id] = val_info

    # Compute simulated scores
    sim_normalised = normalise_all(sim_raw, reference_map)
    sim_dimension = compute_dimension_scores(sim_normalised)
    sim_full = compute_weighted_scores(sim_dimension, weights)

    simulated_scores = {
        "hazard": sim_dimension.get("hazard"),
        "exposure": sim_full["exposure"],
        "sensitivity": sim_dimension.get("sensitivity"),
        "adaptive_capacity": sim_dimension.get("adaptive_capacity"),
        "vulnerability": sim_full["vulnerability"],
        "cri": sim_full["cri"],
    }

    # Compute deltas
    deltas = {}
    for key in original_scores:
        orig = original_scores[key]
        sim = simulated_scores[key]
        if orig is not None and sim is not None:
            deltas[key] = round(sim - orig, 6)
        else:
            deltas[key] = None

    # Build modified indicators detail
    modified_indicators = []
    for code, new_value in modified_values.items():
        if code in raw_values and code in reference_map:
            orig_info = orig_normalised.get(code, {})
            sim_info = sim_normalised.get(code, {})
            modified_indicators.append({
                "code": code,
                "name": raw_values[code]["name"],
                "original_value": raw_values[code]["raw_value"],
                "simulated_value": new_value,
                "original_normalised": orig_info.get("normalised_value"),
                "simulated_normalised": sim_info.get("normalised_value"),
            })

    return {
        "original_scores": original_scores,
        "simulated_scores": simulated_scores,
        "deltas": deltas,
        "modified_indicators": modified_indicators,
    }


def compute_calculation_trace(
    raw_values: dict, reference_map: dict
) -> dict:
    """Generate a step-by-step calculation trace for transparency."""
    # Step 1: Normalisation
    normalised = normalise_all(raw_values, reference_map)

    # Step 2: Component aggregation
    dimension_scores = compute_dimension_scores(normalised)

    # Step 3: Full scores
    full_scores = compute_full_scores(dimension_scores)

    # Build trace
    trace = {
        "step_1_normalisation": {
            gis_id: {
                "indicator_name": info["name"],
                "raw_value": info["raw_value"],
                "global_min": info["global_min"],
                "global_max": info["global_max"],
                "direction": info["direction"],
                "formula": (
                    f"1 - ({info['raw_value']} - {info['global_min']}) / ({info['global_max']} - {info['global_min']})"
                    if info["direction"] == "-"
                    else f"({info['raw_value']} - {info['global_min']}) / ({info['global_max']} - {info['global_min']})"
                ),
                "normalised_value": info["normalised_value"],
            }
            for gis_id, info in normalised.items()
        },
        "step_2_component_aggregation": {
            dimension: {
                "indicators_used": [c for c in codes if c in normalised],
                "values": [normalised[c]["normalised_value"] for c in codes if c in normalised],
                "formula": "arithmetic_mean(normalised_values)",
                "score": dimension_scores.get(dimension),
            }
            for dimension, codes in ALL_DIMENSION_CODES.items()
        },
        "step_3_vulnerability_and_cri": {
            "combined_exposure": {
                "components": ["soc_exposure", "env_exposure"],
                "values": [dimension_scores.get("soc_exposure"), dimension_scores.get("env_exposure")],
                "score": full_scores["exposure"],
            },
            "combined_sensitivity": {
                "components": ["sensitivity", "env_sensitivity"],
                "values": [dimension_scores.get("sensitivity"), dimension_scores.get("env_sensitivity")],
            },
            "vulnerability": {
                "formula": "(Exposure + Sensitivity + (1 - Adaptive_Capacity)) / 3",
                "exposure": full_scores["exposure"],
                "sensitivity": dimension_scores.get("sensitivity"),
                "adaptive_capacity": dimension_scores.get("adaptive_capacity"),
                "score": full_scores["vulnerability"],
            },
            "cri": {
                "formula": "(Hazard + Vulnerability) / 2",
                "hazard": dimension_scores.get("hazard"),
                "vulnerability": full_scores["vulnerability"],
                "score": full_scores["cri"],
            },
        },
    }

    return trace
