"""
Seed indicator_reference table with global min/max computed from indicator_values,
and direction from the PRD indicator table.

Computes global_min and global_max from all union-level indicator values in the database.
Sets direction based on the PRD-defined indicator directionality.

Usage:
    python -m app.scripts.seed_indicator_reference
"""

import asyncio
import logging

from sqlalchemy import func, select, text

from app.database import async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Direction mapping from PRD indicator table
# '+' = positive direction (higher value = higher vulnerability)
# '-' = inverted direction (higher value = lower vulnerability)
DIRECTION_MAP = {
    # Hazard indicators (all +)
    "rainfall": "+", "heat": "+", "colddays": "+", "drought": "+",
    "water": "+", "erosion": "+", "surge": "+", "salinity": "+", "lightning": "+",
    # Socioeconomic Exposure (all +)
    "population": "+", "household": "+", "female": "+", "child_old": "+",
    # Sensitivity (all +)
    "pop_density": "+", "dependency": "+", "disable": "+", "unemployed": "+",
    "fm_ratio": "+", "vulnerable_hh": "+", "hh_size": "+", "slum_float": "+",
    "poverty": "+", "crop_damage": "+", "occupation": "+", "edu_hamper": "+",
    "migration": "+",
    # Adaptive Capacity (all -)
    "literacy": "-", "electricity": "-", "solar": "-", "drink_water": "-",
    "sanitation": "-", "handwash": "-", "edu_institute": "-", "shelter_cov": "-",
    "market_cov": "-", "mfs": "-", "internet": "-", "production": "-",
    "mangrove": "-", "cc_awareness": "-", "disaster_prep": "-",
    "safety_net": "-", "pavedroad": "-",
    # Environmental Exposure (all +)
    "forest": "+", "waterbody": "+", "agri_land": "+",
    # Environmental Sensitivity (all +)
    "ndvi": "+", "wetland_loss": "+", "groundwater": "+",
}


async def seed_indicator_reference():
    """Compute global min/max from indicator_values and populate indicator_reference."""
    async with async_session() as session:
        # Get all indicators with their gis_attribute_id
        result = await session.execute(
            text("SELECT id, code, gis_attribute_id FROM climate_indicators WHERE gis_attribute_id IS NOT NULL")
        )
        indicators = result.all()

        if not indicators:
            logger.warning("No indicators found in database. Run seed_indicators first.")
            return

        count = 0
        for ind in indicators:
            indicator_id = ind.id
            gis_attr = ind.gis_attribute_id

            # Compute global min/max from all values for this indicator
            stats_result = await session.execute(
                text("""
                    SELECT MIN(value) as min_val, MAX(value) as max_val, COUNT(*) as cnt
                    FROM indicator_values
                    WHERE indicator_id = :ind_id
                """),
                {"ind_id": indicator_id},
            )
            stats = stats_result.one()

            if stats.cnt == 0:
                # No values yet — use defaults
                global_min = 0.0
                global_max = 1.0
            else:
                global_min = float(stats.min_val) if stats.min_val is not None else 0.0
                global_max = float(stats.max_val) if stats.max_val is not None else 1.0

            # Look up direction from PRD
            direction = DIRECTION_MAP.get(gis_attr, "+")

            # Upsert
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
                {
                    "ind_id": indicator_id,
                    "gmin": global_min,
                    "gmax": global_max,
                    "dir": direction,
                },
            )
            count += 1
            logger.info(
                f"  [{gis_attr}] min={global_min:.4f} max={global_max:.4f} dir={direction}"
            )

        await session.commit()
        logger.info(f"Seeded {count} indicator reference entries")


def main():
    asyncio.run(seed_indicator_reference())


if __name__ == "__main__":
    main()
