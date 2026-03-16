"""
Import polygon geometry from geoBoundaries GeoJSON files into admin_boundaries.
Matches features to existing DB records by name and updates their geometry.

Usage:
    python -m app.scripts.import_geojson
    python -m app.scripts.import_geojson --data-dir /data/geojson
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from shapely.geometry import shape, MultiPolygon
from sqlalchemy import text

from app.database import async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Name mappings: geoBoundaries name -> BBS name (for mismatches)
NAME_FIXES = {
    "Bangledesh": "Bangladesh",
    "Chittagong": "Chattogram",
    "Comilla": "Cumilla",
    "Jessore": "Jashore",
    "Bogra": "Bogura",
    "Jhenaidah": "Jhenaidha",
    "Maulvi Bazar": "Moulvibazar",
    "Maulvibazar": "Moulvibazar",
    "Netrakona": "Netrokona",
    "Chapai Nawabganj": "Chapainawabganj",
    "Habiganj": "Habigonj",
    "Rajshani": "Rajshahi",
}


def normalize_name(name: str) -> str:
    """Normalize a name for fuzzy matching."""
    if not name:
        return ""
    name = NAME_FIXES.get(name, name)
    return name.strip().lower()


def ensure_multi(geom):
    """Convert Polygon to MultiPolygon if needed."""
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


async def import_level(level: int, geojson_path: Path):
    """Import geometry for a single admin level."""
    with open(geojson_path) as f:
        data = json.load(f)

    features = data["features"]
    logger.info(f"ADM{level}: {len(features)} features in GeoJSON")

    async with async_session() as session:
        # Get all existing records for this level
        result = await session.execute(
            text("SELECT id, name_en, pcode FROM admin_boundaries WHERE adm_level = :level"),
            {"level": level},
        )
        db_records = result.all()
        # Build lookup: normalized name -> list of (id, pcode, original_name)
        name_lookup = {}
        for row in db_records:
            key = normalize_name(row.name_en)
            if key not in name_lookup:
                name_lookup[key] = []
            name_lookup[key].append({"id": row.id, "pcode": row.pcode, "name": row.name_en})

        matched = 0
        unmatched = []

        for feature in features:
            geojson_name = feature["properties"].get("shapeName", "")
            normalized = normalize_name(geojson_name)

            candidates = name_lookup.get(normalized)
            if not candidates:
                unmatched.append(geojson_name)
                continue

            # Use first match (for levels with unique names this works fine)
            # For duplicate names, we pick the first unmatched one
            target = candidates[0]

            geom = shape(feature["geometry"])
            multi = ensure_multi(geom)
            wkt = multi.wkt
            centroid_wkt = multi.centroid.wkt
            area = multi.area  # rough degrees-based area

            sql = text("""
                UPDATE admin_boundaries
                SET geom = ST_GeomFromText(:wkt, 4326),
                    centroid = ST_GeomFromText(:centroid_wkt, 4326)
                WHERE id = :id
            """)
            await session.execute(sql, {
                "wkt": wkt,
                "centroid_wkt": centroid_wkt,
                "id": target["id"],
            })
            matched += 1

            # Remove used candidate so duplicates get next match
            candidates.pop(0)
            if not candidates:
                del name_lookup[normalized]

        await session.commit()
        logger.info(f"ADM{level}: matched {matched}/{len(features)}, unmatched {len(unmatched)}")
        if unmatched:
            logger.warning(f"  Unmatched names: {unmatched[:20]}")


async def main_async(data_dir: str):
    data_path = Path(data_dir)

    for level in range(5):
        geojson_path = data_path / f"adm{level}.geojson"
        if not geojson_path.exists():
            logger.warning(f"File not found: {geojson_path}")
            continue
        await import_level(level, geojson_path)

    # Final verification
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT adm_level, COUNT(*) as total,
                       COUNT(geom) as with_geom
                FROM admin_boundaries
                GROUP BY adm_level ORDER BY adm_level
            """)
        )
        logger.info("Geometry import verification:")
        for row in result.all():
            logger.info(f"  ADM{row.adm_level}: {row.with_geom}/{row.total} have polygon geometry")


def main():
    parser = argparse.ArgumentParser(description="Import GeoJSON polygon geometry")
    parser.add_argument("--data-dir", default="./data/geojson")
    args = parser.parse_args()

    if not Path(args.data_dir).exists():
        logger.error(f"Directory not found: {args.data_dir}")
        sys.exit(1)

    asyncio.run(main_async(args.data_dir))


if __name__ == "__main__":
    main()
