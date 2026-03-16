"""
Import point coordinates from the BBS points DBF file.
Updates admin_boundaries with centroids from POINT_X/POINT_Y columns.

Usage:
    python -m app.scripts.import_points
    python -m app.scripts.import_points --data-dir ./data/shapefiles/
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

import geopandas as gpd
from sqlalchemy import text

from app.config import settings
from app.database import async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def import_points(data_dir: str):
    dbf_path = Path(data_dir) / "bgd_admbndp_admALL_bbs_itos_20201113.dbf"
    if not dbf_path.exists():
        logger.error(f"Points DBF not found: {dbf_path}")
        sys.exit(1)

    logger.info(f"Reading points from {dbf_path}...")
    gdf = gpd.read_file(str(dbf_path))

    if "POINT_X" not in gdf.columns or "POINT_Y" not in gdf.columns:
        logger.error("Missing POINT_X/POINT_Y columns")
        sys.exit(1)

    logger.info(f"Found {len(gdf)} point records")

    async with async_session() as session:
        count = 0
        for _, row in gdf.iterrows():
            pcode = str(row.get("ADM4_PCODE", "")).strip()
            x = row.get("POINT_X")
            y = row.get("POINT_Y")
            if not pcode or x is None or y is None:
                continue

            sql = text("""
                UPDATE admin_boundaries
                SET centroid = ST_SetSRID(ST_MakePoint(:x, :y), 4326)
                WHERE pcode = :pcode
            """)
            result = await session.execute(sql, {"x": float(x), "y": float(y), "pcode": pcode})
            if result.rowcount > 0:
                count += 1

        # Also set centroids for ADM3 (upazilas) by averaging their unions
        sql_adm3 = text("""
            UPDATE admin_boundaries p
            SET centroid = sub.centroid
            FROM (
                SELECT parent_pcode, ST_SetSRID(ST_MakePoint(
                    AVG(ST_X(centroid)), AVG(ST_Y(centroid))
                ), 4326) as centroid
                FROM admin_boundaries
                WHERE adm_level = 4 AND centroid IS NOT NULL
                GROUP BY parent_pcode
            ) sub
            WHERE p.pcode = sub.parent_pcode AND p.adm_level = 3
        """)
        result = await session.execute(sql_adm3)
        logger.info(f"Updated {result.rowcount} ADM3 centroids from union averages")

        # ADM2 (districts) from upazilas
        sql_adm2 = text("""
            UPDATE admin_boundaries p
            SET centroid = sub.centroid
            FROM (
                SELECT parent_pcode, ST_SetSRID(ST_MakePoint(
                    AVG(ST_X(centroid)), AVG(ST_Y(centroid))
                ), 4326) as centroid
                FROM admin_boundaries
                WHERE adm_level = 3 AND centroid IS NOT NULL
                GROUP BY parent_pcode
            ) sub
            WHERE p.pcode = sub.parent_pcode AND p.adm_level = 2
        """)
        result = await session.execute(sql_adm2)
        logger.info(f"Updated {result.rowcount} ADM2 centroids from upazila averages")

        # ADM1 (divisions) from districts
        sql_adm1 = text("""
            UPDATE admin_boundaries p
            SET centroid = sub.centroid
            FROM (
                SELECT parent_pcode, ST_SetSRID(ST_MakePoint(
                    AVG(ST_X(centroid)), AVG(ST_Y(centroid))
                ), 4326) as centroid
                FROM admin_boundaries
                WHERE adm_level = 2 AND centroid IS NOT NULL
                GROUP BY parent_pcode
            ) sub
            WHERE p.pcode = sub.parent_pcode AND p.adm_level = 1
        """)
        result = await session.execute(sql_adm1)
        logger.info(f"Updated {result.rowcount} ADM1 centroids from district averages")

        await session.commit()
        logger.info(f"Updated {count} ADM4 union centroids from points file")

        # Verify
        result = await session.execute(
            text("SELECT adm_level, COUNT(*) as total, COUNT(centroid) as with_centroid FROM admin_boundaries GROUP BY adm_level ORDER BY adm_level")
        )
        for row in result.all():
            logger.info(f"  ADM{row.adm_level}: {row.with_centroid}/{row.total} have centroids")


def main():
    parser = argparse.ArgumentParser(description="Import point coordinates as centroids")
    parser.add_argument("--data-dir", default=settings.SHAPEFILE_DIR)
    args = parser.parse_args()
    asyncio.run(import_points(args.data_dir))


if __name__ == "__main__":
    main()
