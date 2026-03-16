"""
Shapefile import pipeline for Bangladesh admin boundaries.

Reads BBS administrative boundary shapefiles (ADM0-ADM4) and loads them
into the admin_boundaries PostGIS table.

Usage:
    python -m app.scripts.import_shapefiles
    python -m app.scripts.import_shapefiles --data-dir ./data/shapefiles/
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import MultiPolygon, mapping
from sqlalchemy import text

from app.config import settings
from app.database import async_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

FILE_PATTERN = "bgd_admbnda_adm{level}_bbs_20201113.shp"


def get_shapefile_path(data_dir: str, level: int) -> Path:
    filename = FILE_PATTERN.format(level=level)
    return Path(data_dir) / filename


def ensure_multi(geom):
    """Ensure geometry is MultiPolygon."""
    if geom is None:
        return None
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    if geom.geom_type == "MultiPolygon":
        return geom
    return None


def process_shapefile(data_dir: str, level: int) -> list[dict]:
    """Read a shapefile and transform it into records for the admin_boundaries table."""
    path = get_shapefile_path(data_dir, level)
    if not path.exists():
        logger.warning(f"Shapefile not found: {path}")
        return []

    logger.info(f"Reading {path}...")

    try:
        gdf = gpd.read_file(str(path))
    except Exception:
        # If .shp geometry is corrupted/empty, try reading just the .dbf
        logger.warning(f"Cannot read .shp geometry for ADM{level}, reading attributes from .dbf")
        dbf_path = path.with_suffix(".dbf")
        if dbf_path.exists():
            gdf = gpd.read_file(str(dbf_path))
        else:
            logger.error(f"DBF file not found: {dbf_path}")
            return []

    name_col = f"ADM{level}_EN"
    pcode_col = f"ADM{level}_PCODE"

    if name_col not in gdf.columns or pcode_col not in gdf.columns:
        logger.error(f"Missing required columns {name_col}, {pcode_col} in ADM{level}")
        return []

    # Determine parent pcode column
    parent_pcode_col = f"ADM{level - 1}_PCODE" if level > 0 else None

    # Compute area in km² using projected CRS (EPSG:32646 = UTM zone 46N for Bangladesh)
    has_geometry = "geometry" in gdf.columns and not gdf.geometry.is_empty.all()

    if has_geometry:
        try:
            gdf_projected = gdf.to_crs(epsg=32646)
            areas = gdf_projected.geometry.area / 1_000_000  # m² to km²
        except Exception:
            logger.warning(f"Cannot project geometry for ADM{level}, skipping area calculation")
            areas = [None] * len(gdf)
            has_geometry = False
    else:
        areas = [None] * len(gdf)

    records = []
    for idx, row in gdf.iterrows():
        # Get geometry
        geom = None
        centroid_wkt = None
        if has_geometry and row.geometry is not None and not row.geometry.is_empty:
            multi = ensure_multi(row.geometry)
            if multi is not None:
                geom = multi.wkt
                centroid_wkt = multi.centroid.wkt

        # Build record
        record = {
            "adm_level": level,
            "name_en": str(row[name_col]).strip() if row[name_col] else f"Unknown ADM{level}",
            "pcode": str(row[pcode_col]).strip(),
            "parent_pcode": str(row[parent_pcode_col]).strip() if parent_pcode_col and parent_pcode_col in gdf.columns and row.get(parent_pcode_col) else None,
            "division_name": str(row.get("ADM1_EN", "")).strip() or None if "ADM1_EN" in gdf.columns else None,
            "district_name": str(row.get("ADM2_EN", "")).strip() or None if "ADM2_EN" in gdf.columns else None,
            "upazila_name": str(row.get("ADM3_EN", "")).strip() or None if "ADM3_EN" in gdf.columns else None,
            "geom_wkt": geom,
            "centroid_wkt": centroid_wkt,
            "area_sq_km": float(areas.iloc[idx]) if areas is not None and hasattr(areas, "iloc") and areas.iloc[idx] is not None else None,
        }
        records.append(record)

    return records


async def upsert_records(records: list[dict]):
    """Bulk upsert records into admin_boundaries using ON CONFLICT."""
    if not records:
        return 0

    async with async_session() as session:
        count = 0
        for rec in records:
            if rec["geom_wkt"]:
                sql = text("""
                    INSERT INTO admin_boundaries
                        (adm_level, name_en, pcode, parent_pcode, division_name,
                         district_name, upazila_name, geom, centroid, area_sq_km)
                    VALUES
                        (:adm_level, :name_en, :pcode, :parent_pcode, :division_name,
                         :district_name, :upazila_name,
                         ST_GeomFromText(:geom_wkt, 4326),
                         ST_GeomFromText(:centroid_wkt, 4326),
                         :area_sq_km)
                    ON CONFLICT (pcode) DO UPDATE SET
                        adm_level = EXCLUDED.adm_level,
                        name_en = EXCLUDED.name_en,
                        parent_pcode = EXCLUDED.parent_pcode,
                        division_name = EXCLUDED.division_name,
                        district_name = EXCLUDED.district_name,
                        upazila_name = EXCLUDED.upazila_name,
                        geom = EXCLUDED.geom,
                        centroid = EXCLUDED.centroid,
                        area_sq_km = EXCLUDED.area_sq_km
                """)
                await session.execute(sql, {
                    "adm_level": rec["adm_level"],
                    "name_en": rec["name_en"],
                    "pcode": rec["pcode"],
                    "parent_pcode": rec["parent_pcode"],
                    "division_name": rec["division_name"],
                    "district_name": rec["district_name"],
                    "upazila_name": rec["upazila_name"],
                    "geom_wkt": rec["geom_wkt"],
                    "centroid_wkt": rec["centroid_wkt"],
                    "area_sq_km": rec["area_sq_km"],
                })
            else:
                sql = text("""
                    INSERT INTO admin_boundaries
                        (adm_level, name_en, pcode, parent_pcode, division_name,
                         district_name, upazila_name, area_sq_km)
                    VALUES
                        (:adm_level, :name_en, :pcode, :parent_pcode, :division_name,
                         :district_name, :upazila_name, :area_sq_km)
                    ON CONFLICT (pcode) DO UPDATE SET
                        adm_level = EXCLUDED.adm_level,
                        name_en = EXCLUDED.name_en,
                        parent_pcode = EXCLUDED.parent_pcode,
                        division_name = EXCLUDED.division_name,
                        district_name = EXCLUDED.district_name,
                        upazila_name = EXCLUDED.upazila_name,
                        area_sq_km = EXCLUDED.area_sq_km
                """)
                await session.execute(sql, {
                    "adm_level": rec["adm_level"],
                    "name_en": rec["name_en"],
                    "pcode": rec["pcode"],
                    "parent_pcode": rec["parent_pcode"],
                    "division_name": rec["division_name"],
                    "district_name": rec["district_name"],
                    "upazila_name": rec["upazila_name"],
                    "area_sq_km": rec["area_sq_km"],
                })
            count += 1

        await session.commit()
        return count


async def import_all(data_dir: str):
    """Import all admin boundary levels in order."""
    logger.info(f"Starting import from: {data_dir}")

    for level in range(5):
        records = process_shapefile(data_dir, level)
        if records:
            count = await upsert_records(records)
            logger.info(f"Imported {count} features for ADM{level}")
        else:
            logger.warning(f"No records found for ADM{level}")

    # Verify counts
    async with async_session() as session:
        result = await session.execute(
            text("SELECT adm_level, COUNT(*) as cnt FROM admin_boundaries GROUP BY adm_level ORDER BY adm_level")
        )
        rows = result.all()
        logger.info("Import verification:")
        for row in rows:
            logger.info(f"  ADM{row.adm_level}: {row.cnt} features")


def main():
    parser = argparse.ArgumentParser(description="Import BBS shapefiles into PostGIS")
    parser.add_argument(
        "--data-dir",
        default=settings.SHAPEFILE_DIR,
        help=f"Path to shapefile directory (default: {settings.SHAPEFILE_DIR})",
    )
    args = parser.parse_args()

    data_dir = args.data_dir
    if not Path(data_dir).exists():
        logger.error(f"Data directory not found: {data_dir}")
        sys.exit(1)

    asyncio.run(import_all(data_dir))


if __name__ == "__main__":
    main()
