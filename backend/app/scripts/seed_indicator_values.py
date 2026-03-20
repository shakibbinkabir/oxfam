"""
Seed indicator_values table with realistic, geographically-varied data
for all 67 indicators across all 5,160 unions in Bangladesh.

Generates values that reflect real-world geographic patterns:
  - Coastal divisions (Barisal, Khulna, Chittagong) get higher surge/salinity
  - Northern divisions (Rangpur) get more cold days, higher poverty
  - Sylhet gets highest rainfall
  - Dhaka gets highest population density, best infrastructure
  - etc.

After seeding values, also recomputes indicator_reference (global min/max).

Usage:
    python -m app.scripts.seed_indicator_values
    python -m app.scripts.seed_indicator_values --batch-size 5000
"""

import argparse
import asyncio
import hashlib
import logging
import random
import sys
import time

from sqlalchemy import text

from app.database import async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Indicator value ranges: (min, max) — realistic for Bangladesh unions
# ---------------------------------------------------------------------------
INDICATOR_RANGES = {
    # ── Hazard (9) ──────────────────────────────────────────────────────
    "rainfall":   (0.05, 0.95),    # risk index 0-1
    "heat":       (0.10, 0.90),    # heat index 0-1
    "colddays":   (0, 25),         # days per year
    "drought":    (0.05, 0.85),    # intensity index 0-1
    "water":      (0.05, 0.80),    # occurrence index 0-1
    "erosion":    (0.00, 0.50),    # fraction of area
    "surge":      (0.00, 3.50),    # meters inundation depth
    "salinity":   (0.00, 15.0),    # ppt
    "lightning":  (0.05, 0.80),    # severity index 0-1

    # ── Socioeconomic Exposure (4) ──────────────────────────────────────
    "population": (5000, 150000),  # persons
    "household":  (1000, 35000),   # households
    "female":     (2500, 75000),   # persons
    "child_old":  (1500, 50000),   # persons

    # ── Sensitivity (13) ────────────────────────────────────────────────
    "pop_density":    (200, 30000),   # per km²
    "dependency":     (30, 80),       # ratio %
    "disable":        (1, 15),        # %
    "unemployed":     (5, 40),        # %
    "fm_ratio":       (90, 115),      # per 100 males
    "vulnerable_hh":  (5, 60),        # %
    "hh_size":        (3.5, 6.5),     # persons
    "slum_float":     (0, 20),        # %
    "poverty":        (10, 70),       # %
    "crop_damage":    (0, 50),        # %
    "occupation":     (5, 40),        # % shifting
    "edu_hamper":     (5, 50),        # %
    "migration":      (2, 30),        # %

    # ── Adaptive Capacity (17) ──────────────────────────────────────────
    "literacy":       (30, 85),    # %
    "electricity":    (40, 99),    # %
    "solar":          (1, 40),     # %
    "drink_water":    (50, 98),    # %
    "sanitation":     (30, 90),    # %
    "handwash":       (20, 85),    # %
    "edu_institute":  (1, 15),     # per 10k pop
    "shelter_cov":    (0, 8),      # per 10k pop
    "market_cov":     (0.5, 5.0),  # per 10k pop
    "mfs":            (10, 70),    # %
    "internet":       (5, 60),     # %
    "production":     (500, 5000), # metric tons
    "mangrove":       (0, 25),     # %
    "cc_awareness":   (10, 70),    # %
    "disaster_prep":  (10, 65),    # %
    "safety_net":     (5, 40),     # %
    "pavedroad":      (10, 80),    # %

    # ── Environmental Exposure (3) ──────────────────────────────────────
    "forest":     (0, 35),     # %
    "waterbody":  (2, 40),     # %
    "agri_land":  (20, 85),    # %

    # ── Environmental Sensitivity (3) ───────────────────────────────────
    "ndvi":          (0.10, 0.70),  # vegetation index
    "wetland_loss":  (0, 30),       # %
    "groundwater":   (20, 90),      # % dependency

    # ── Environmental Adaptive Capacity (4) ─────────────────────────────
    "env_ac_mangrove":  (0, 25),    # %
    "elevation":        (1, 50),    # meters
    "eca_pa":           (0, 10),    # %
    "awareness":        (10, 70),   # %

    # ── Infrastructural Exposure (4) ────────────────────────────────────
    "resident_ss":  (100, 5000),  # count
    "road":         (10, 500),    # km
    "shelter":      (0, 20),      # count
    "market":       (1, 30),      # count

    # ── Infrastructural Sensitivity (2) ─────────────────────────────────
    "inf_sen_vulnerable_hh":  (5, 60),    # %
    "unpavedroad":            (20, 300),  # km

    # ── Infrastructural Adaptive Capacity (8) ───────────────────────────
    "inf_ac_pavedroad":    (10, 80),    # %
    "inf_ac_elevation":    (1, 15),     # meters
    "inf_ac_mangrove":     (0, 25),     # %
    "inf_ac_solar":        (1, 40),     # %
    "healthcare":          (0.5, 5.0),  # per 10k pop
    "inf_ac_sanitation":   (30, 90),    # %
    "inf_ac_shelter_cov":  (0, 8),      # per 10k pop
    "inf_ac_market_cov":   (0.5, 5.0),  # per 10k pop
}


# ---------------------------------------------------------------------------
# Regional modifier profiles per division
# Each modifier shifts the generated value within the range.
# 1.0 = neutral, >1 = higher, <1 = lower (clamped to valid range)
# ---------------------------------------------------------------------------
DIVISION_PROFILES = {
    "Barisal": {
        # Southern coastal — high surge, salinity, water; moderate poverty
        "surge": 1.6, "salinity": 1.5, "water": 1.3, "erosion": 1.3,
        "rainfall": 1.1, "lightning": 0.9,
        "population": 0.6, "household": 0.6, "pop_density": 0.5,
        "poverty": 1.2, "vulnerable_hh": 1.2, "crop_damage": 1.3,
        "literacy": 0.9, "electricity": 0.85, "internet": 0.7,
        "shelter_cov": 1.4, "disaster_prep": 1.2, "mangrove": 0.8,
        "waterbody": 1.4, "agri_land": 1.1,
        "shelter": 1.4, "inf_ac_shelter_cov": 1.3,
    },
    "Chittagong": {
        # Southeast coastal + hills — high rainfall, some surge, high forest/elevation
        "rainfall": 1.3, "surge": 1.2, "lightning": 1.1, "heat": 0.9,
        "erosion": 1.2, "salinity": 0.8,
        "population": 1.1, "household": 1.0, "pop_density": 1.1,
        "poverty": 0.85, "literacy": 1.05,
        "electricity": 1.0, "internet": 1.0,
        "forest": 1.8, "elevation": 1.6, "ndvi": 1.3,
        "mangrove": 0.6, "agri_land": 0.8,
        "road": 1.1, "inf_ac_elevation": 1.4,
    },
    "Dhaka": {
        # Central — highest density, best infrastructure, low agriculture
        "population": 1.8, "household": 1.7, "female": 1.7, "child_old": 1.5,
        "pop_density": 2.0, "slum_float": 1.5,
        "poverty": 0.6, "vulnerable_hh": 0.7, "unemployed": 0.7,
        "literacy": 1.3, "electricity": 1.3, "internet": 1.8,
        "mfs": 1.4, "pavedroad": 1.5, "sanitation": 1.3, "handwash": 1.3,
        "drink_water": 1.2, "healthcare": 1.3,
        "agri_land": 0.5, "forest": 0.3, "production": 0.6,
        "mangrove": 0.1,
        "resident_ss": 1.5, "road": 1.4, "market": 1.3,
        "surge": 0.2, "salinity": 0.1, "drought": 0.7,
        "inf_ac_pavedroad": 1.5, "inf_ac_sanitation": 1.3,
    },
    "Khulna": {
        # Southwest — Sundarbans, high mangrove, salinity, surge
        "mangrove": 2.5, "env_ac_mangrove": 2.5, "inf_ac_mangrove": 2.5,
        "salinity": 1.8, "surge": 1.4, "water": 1.2,
        "rainfall": 0.9, "drought": 0.8,
        "poverty": 1.1, "vulnerable_hh": 1.1,
        "drink_water": 0.8, "groundwater": 1.3,
        "forest": 1.5, "waterbody": 1.3, "ndvi": 1.1,
        "literacy": 0.95, "electricity": 0.9,
        "shelter_cov": 1.3, "disaster_prep": 1.3,
        "eca_pa": 1.8,
    },
    "Mymensingh": {
        # North-central — moderate agriculture, moderate poverty
        "rainfall": 1.05, "water": 1.0, "drought": 0.8,
        "population": 0.8, "pop_density": 0.7,
        "poverty": 1.1, "vulnerable_hh": 1.05,
        "agri_land": 1.2, "production": 1.1,
        "literacy": 0.9, "electricity": 0.85, "internet": 0.7,
        "surge": 0.1, "salinity": 0.05, "mangrove": 0.05,
        "elevation": 0.8, "forest": 0.6,
    },
    "Rajshahi": {
        # Northwest — drought-prone, hot, high agriculture
        "drought": 1.6, "heat": 1.5, "colddays": 0.8,
        "rainfall": 0.6, "water": 0.6,
        "surge": 0.05, "salinity": 0.05, "erosion": 0.7,
        "agri_land": 1.4, "production": 1.3,
        "poverty": 1.05, "crop_damage": 1.2,
        "groundwater": 1.3, "ndvi": 0.8, "waterbody": 0.6,
        "literacy": 1.0, "electricity": 0.95,
        "mangrove": 0.02, "forest": 0.4,
        "elevation": 0.9,
    },
    "Rangpur": {
        # Northern — cold-prone, high poverty (monga), moderate drought
        "colddays": 1.8, "drought": 1.3, "heat": 0.8,
        "rainfall": 0.8, "surge": 0.05, "salinity": 0.05,
        "poverty": 1.5, "vulnerable_hh": 1.4, "unemployed": 1.3,
        "migration": 1.5, "edu_hamper": 1.3,
        "literacy": 0.8, "electricity": 0.8, "internet": 0.6,
        "mfs": 0.7, "safety_net": 1.3,
        "agri_land": 1.3, "production": 1.1,
        "mangrove": 0.02, "forest": 0.3, "waterbody": 0.7,
        "elevation": 1.1,
    },
    "Sylhet": {
        # Northeast — very high rainfall, haor wetlands, hilly, tea gardens
        "rainfall": 1.7, "water": 1.5, "lightning": 1.2,
        "erosion": 1.1,
        "surge": 0.1, "salinity": 0.05, "drought": 0.3,
        "forest": 1.6, "waterbody": 1.5, "wetland_loss": 1.4,
        "ndvi": 1.2, "elevation": 1.3,
        "population": 0.7, "pop_density": 0.6,
        "poverty": 0.9, "literacy": 0.95,
        "electricity": 0.9, "internet": 0.8,
        "mangrove": 0.02, "agri_land": 0.7,
        "groundwater": 0.7,
    },
}


def _pcode_seed(pcode: str, indicator_code: str) -> int:
    """Deterministic seed from pcode + indicator code for reproducibility."""
    h = hashlib.md5(f"{pcode}:{indicator_code}".encode()).hexdigest()
    return int(h[:8], 16)


def generate_value(
    indicator_code: str,
    division: str,
    pcode: str,
) -> float:
    """Generate a realistic value for one indicator in one union."""
    lo, hi = INDICATOR_RANGES.get(indicator_code, (0, 1))
    span = hi - lo

    # Deterministic random per (pcode, indicator)
    rng = random.Random(_pcode_seed(pcode, indicator_code))

    # Base position within range (0 to 1)
    base_pos = rng.random()

    # Apply regional modifier: scales the position within the range
    # modifier < 1 → pushes values lower, modifier > 1 → pushes higher
    profile = DIVISION_PROFILES.get(division, {})
    modifier = profile.get(indicator_code, 1.0)
    adjusted_pos = base_pos * modifier

    # Add noise (±8% of range) for within-division variation
    noise = rng.gauss(0, 0.08)
    adjusted_pos += noise

    # Clamp position to [0, 1]
    adjusted_pos = max(0.0, min(1.0, adjusted_pos))

    # Convert position back to value
    value = lo + adjusted_pos * span

    # Round based on the scale of values
    if hi - lo > 100:
        return round(value, 1)
    elif hi - lo > 10:
        return round(value, 2)
    else:
        return round(value, 4)


async def seed_indicator_values(batch_size: int = 2000):
    """Generate and insert indicator values for all unions × all indicators."""
    async with async_session() as session:
        # ── Fetch all union pcodes with division names ──────────────────
        result = await session.execute(
            text("""
                SELECT pcode, division_name
                FROM admin_boundaries
                WHERE adm_level = 4
                ORDER BY pcode
            """)
        )
        unions = result.all()
        logger.info(f"Found {len(unions)} unions")

        if not unions:
            logger.error("No unions found. Import boundary shapefiles first.")
            return

        # ── Fetch all indicator IDs and codes ───────────────────────────
        result = await session.execute(
            text("SELECT id, code FROM climate_indicators ORDER BY id")
        )
        indicators = result.all()
        logger.info(f"Found {len(indicators)} indicators")

        if not indicators:
            logger.error("No indicators found. Run seed_indicators first.")
            return

        indicator_map = {ind.code: ind.id for ind in indicators}
        total_expected = len(unions) * len(indicators)
        logger.info(f"Will generate {total_expected:,} indicator values")

        # ── Check for existing data ─────────────────────────────────────
        result = await session.execute(
            text("SELECT COUNT(*) as cnt FROM indicator_values WHERE is_deleted = false")
        )
        existing = result.one().cnt
        if existing > 0:
            logger.warning(f"Found {existing:,} existing indicator values — will upsert (ON CONFLICT UPDATE)")

        # ── Generate and batch-insert ───────────────────────────────────
        t0 = time.time()
        inserted = 0
        batch = []

        for union in unions:
            pcode = union.pcode
            division = union.division_name or "Dhaka"

            for ind in indicators:
                value = generate_value(ind.code, division, pcode)
                batch.append({
                    "indicator_id": ind.id,
                    "boundary_pcode": pcode,
                    "value": value,
                })

                if len(batch) >= batch_size:
                    await _insert_batch(session, batch)
                    inserted += len(batch)
                    elapsed = time.time() - t0
                    pct = inserted / total_expected * 100
                    logger.info(
                        f"  Inserted {inserted:>7,} / {total_expected:,} "
                        f"({pct:5.1f}%) — {elapsed:.1f}s"
                    )
                    batch = []

        # Flush remaining
        if batch:
            await _insert_batch(session, batch)
            inserted += len(batch)

        await session.commit()
        elapsed = time.time() - t0
        logger.info(f"Seeded {inserted:,} indicator values in {elapsed:.1f}s")

        # ── Verify counts ───────────────────────────────────────────────
        result = await session.execute(
            text("""
                SELECT ci.component, COUNT(*) as cnt
                FROM indicator_values iv
                JOIN climate_indicators ci ON ci.id = iv.indicator_id
                WHERE iv.is_deleted = false
                GROUP BY ci.component
                ORDER BY ci.component
            """)
        )
        for row in result.all():
            logger.info(f"  {row.component}: {row.cnt:,} values")


async def _insert_batch(session, batch: list[dict]):
    """Bulk upsert a batch of indicator values using multi-row VALUES."""
    if not batch:
        return

    # Build parameterized multi-row INSERT
    placeholders = []
    params = {}
    for i, r in enumerate(batch):
        placeholders.append(f"(:ind_{i}, :pcode_{i}, :val_{i})")
        params[f"ind_{i}"] = r["indicator_id"]
        params[f"pcode_{i}"] = r["boundary_pcode"]
        params[f"val_{i}"] = r["value"]

    values_sql = ", ".join(placeholders)
    await session.execute(
        text(f"""
            INSERT INTO indicator_values (indicator_id, boundary_pcode, value)
            VALUES {values_sql}
            ON CONFLICT ON CONSTRAINT uq_indicator_boundary
            DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        """),
        params,
    )


async def seed_indicator_reference():
    """Recompute indicator_reference global min/max from the freshly seeded values."""
    from app.scripts.seed_indicator_reference import DIRECTION_MAP

    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, code, gis_attribute_id FROM climate_indicators ORDER BY id")
        )
        indicators = result.all()

        count = 0
        for ind in indicators:
            stats = await session.execute(
                text("""
                    SELECT MIN(value) as min_val, MAX(value) as max_val, COUNT(*) as cnt
                    FROM indicator_values
                    WHERE indicator_id = :ind_id AND is_deleted = false
                """),
                {"ind_id": ind.id},
            )
            s = stats.one()

            if s.cnt == 0:
                global_min, global_max = 0.0, 1.0
            else:
                global_min = float(s.min_val) if s.min_val is not None else 0.0
                global_max = float(s.max_val) if s.max_val is not None else 1.0

            # Use gis_attribute_id or code for direction lookup
            direction = DIRECTION_MAP.get(ind.gis_attribute_id or "", None)
            if direction is None:
                direction = DIRECTION_MAP.get(ind.code, "+")

            await session.execute(
                text("""
                    INSERT INTO indicator_reference (indicator_id, global_min, global_max, direction, weight)
                    VALUES (:ind_id, :gmin, :gmax, :dir, 1.0)
                    ON CONFLICT ON CONSTRAINT uq_indicator_reference_indicator DO UPDATE SET
                        global_min = EXCLUDED.global_min,
                        global_max = EXCLUDED.global_max,
                        direction = EXCLUDED.direction,
                        updated_at = NOW()
                """),
                {"ind_id": ind.id, "gmin": global_min, "gmax": global_max, "dir": direction},
            )
            count += 1
            logger.info(f"  [{ind.code}] min={global_min:.4f} max={global_max:.4f} dir={direction}")

        await session.commit()
        logger.info(f"Seeded {count} indicator reference entries")


async def mark_scores_stale():
    """Mark all computed scores as stale so they get recomputed on next access."""
    async with async_session() as session:
        result = await session.execute(
            text("UPDATE computed_scores SET is_stale = true")
        )
        await session.commit()
        logger.info(f"Marked {result.rowcount} computed scores as stale")


def main():
    parser = argparse.ArgumentParser(description="Seed indicator values for all unions")
    parser.add_argument(
        "--batch-size", type=int, default=2000,
        help="Number of rows per INSERT batch (default: 2000)",
    )
    args = parser.parse_args()

    async def run_all():
        logger.info("=" * 60)
        logger.info("STEP 1: Seeding indicator values for all unions")
        logger.info("=" * 60)
        await seed_indicator_values(args.batch_size)

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 2: Computing indicator_reference (global min/max)")
        logger.info("=" * 60)
        await seed_indicator_reference()

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 3: Marking computed scores as stale")
        logger.info("=" * 60)
        await mark_scores_stale()

        logger.info("")
        logger.info("All done!")

    asyncio.run(run_all())


if __name__ == "__main__":
    main()
