import json
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.functions import ST_AsGeoJSON, ST_Intersects, ST_MakeEnvelope, ST_Simplify
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased


def safe_float(val):
    """Return None for NaN/Infinity floats that aren't JSON-serializable."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val

from app.api.deps import get_current_user
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.user import User

router = APIRouter(prefix="/api/v1/geo", tags=["geo"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


ZOOM_TO_LEVEL = {
    range(1, 7): 1,
    range(7, 9): 2,
    range(9, 11): 3,
}

SIMPLIFY_TOLERANCE = {
    1: 0.01,
    2: 0.005,
    3: 0.002,
    4: 0,
}


def get_adm_level(zoom: int) -> int:
    for zoom_range, level in ZOOM_TO_LEVEL.items():
        if zoom in zoom_range:
            return level
    return 4


@router.get("/boundaries")
async def get_boundaries(
    zoom: int = Query(7, ge=1, le=18),
    bbox: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    adm_level = get_adm_level(zoom)
    tolerance = SIMPLIFY_TOLERANCE[adm_level]

    if tolerance > 0:
        geom_col = func.ST_AsGeoJSON(func.ST_Simplify(AdminBoundary.geom, tolerance))
    else:
        geom_col = func.ST_AsGeoJSON(AdminBoundary.geom)

    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        AdminBoundary.adm_level,
        AdminBoundary.parent_pcode,
        AdminBoundary.division_name,
        AdminBoundary.district_name,
        AdminBoundary.upazila_name,
        AdminBoundary.area_sq_km,
        geom_col.label("geojson"),
        func.ST_X(AdminBoundary.centroid).label("centroid_lon"),
        func.ST_Y(AdminBoundary.centroid).label("centroid_lat"),
    ).where(AdminBoundary.adm_level == adm_level)

    if adm_level == 4 and bbox:
        try:
            west, south, east, north = [float(x.strip()) for x in bbox.split(",")]
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid bbox format. Use: west,south,east,north")
        bbox_geom = func.ST_MakeEnvelope(west, south, east, north, 4326)
        # Use centroid for bbox filtering when polygon geometry may be null
        query = query.where(
            func.ST_Intersects(AdminBoundary.geom, bbox_geom)
            | func.ST_Within(AdminBoundary.centroid, bbox_geom)
        )

    result = await db.execute(query)
    rows = result.all()

    features = []
    for row in rows:
        geom = json.loads(row.geojson) if row.geojson else None
        # If no polygon geometry but we have centroid, create a Point geometry
        if geom is None and row.centroid_lon is not None and row.centroid_lat is not None:
            geom = {
                "type": "Point",
                "coordinates": [row.centroid_lon, row.centroid_lat],
            }
        features.append({
            "type": "Feature",
            "properties": {
                "name_en": row.name_en,
                "name_bn": row.name_bn,
                "pcode": row.pcode,
                "adm_level": row.adm_level,
                "parent_pcode": row.parent_pcode,
                "division_name": row.division_name,
                "district_name": row.district_name,
                "upazila_name": row.upazila_name,
                "area_sq_km": safe_float(row.area_sq_km),
                "centroid_lat": safe_float(row.centroid_lat),
                "centroid_lon": safe_float(row.centroid_lon),
            },
            "geometry": geom,
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/divisions")
async def get_divisions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        func.ST_AsGeoJSON(AdminBoundary.centroid).label("centroid"),
    ).where(AdminBoundary.adm_level == 1).order_by(AdminBoundary.name_en)

    result = await db.execute(query)
    rows = result.all()
    data = [
        {
            "name_en": row.name_en,
            "name_bn": row.name_bn,
            "pcode": row.pcode,
            "centroid": json.loads(row.centroid) if row.centroid else None,
        }
        for row in rows
    ]
    return envelope(data=data)


@router.get("/districts")
async def get_districts(
    division_pcode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        AdminBoundary.parent_pcode,
        AdminBoundary.division_name,
        func.ST_AsGeoJSON(AdminBoundary.centroid).label("centroid"),
    ).where(AdminBoundary.adm_level == 2).order_by(AdminBoundary.name_en)

    if division_pcode:
        query = query.where(AdminBoundary.parent_pcode == division_pcode)

    result = await db.execute(query)
    rows = result.all()
    data = [
        {
            "name_en": row.name_en,
            "name_bn": row.name_bn,
            "pcode": row.pcode,
            "parent_pcode": row.parent_pcode,
            "division_name": row.division_name,
            "centroid": json.loads(row.centroid) if row.centroid else None,
        }
        for row in rows
    ]
    return envelope(data=data)


@router.get("/upazilas")
async def get_upazilas(
    district_pcode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        AdminBoundary.parent_pcode,
        AdminBoundary.division_name,
        AdminBoundary.district_name,
        func.ST_AsGeoJSON(AdminBoundary.centroid).label("centroid"),
    ).where(AdminBoundary.adm_level == 3).order_by(AdminBoundary.name_en)

    if district_pcode:
        query = query.where(AdminBoundary.parent_pcode == district_pcode)

    result = await db.execute(query)
    rows = result.all()
    data = [
        {
            "name_en": row.name_en,
            "name_bn": row.name_bn,
            "pcode": row.pcode,
            "parent_pcode": row.parent_pcode,
            "division_name": row.division_name,
            "district_name": row.district_name,
            "centroid": json.loads(row.centroid) if row.centroid else None,
        }
        for row in rows
    ]
    return envelope(data=data)


@router.get("/unions")
async def get_unions(
    upazila_pcode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        AdminBoundary.parent_pcode,
        AdminBoundary.division_name,
        AdminBoundary.district_name,
        AdminBoundary.upazila_name,
        func.ST_AsGeoJSON(AdminBoundary.centroid).label("centroid"),
    ).where(AdminBoundary.adm_level == 4).order_by(AdminBoundary.name_en)

    if upazila_pcode:
        query = query.where(AdminBoundary.parent_pcode == upazila_pcode)

    result = await db.execute(query)
    rows = result.all()
    data = [
        {
            "name_en": row.name_en,
            "name_bn": row.name_bn,
            "pcode": row.pcode,
            "parent_pcode": row.parent_pcode,
            "division_name": row.division_name,
            "district_name": row.district_name,
            "upazila_name": row.upazila_name,
            "centroid": json.loads(row.centroid) if row.centroid else None,
        }
        for row in rows
    ]
    return envelope(data=data)


@router.get("/unions/{pcode}")
async def get_union_detail(
    pcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(
        AdminBoundary.name_en,
        AdminBoundary.name_bn,
        AdminBoundary.pcode,
        AdminBoundary.adm_level,
        AdminBoundary.parent_pcode,
        AdminBoundary.division_name,
        AdminBoundary.district_name,
        AdminBoundary.upazila_name,
        AdminBoundary.area_sq_km,
        func.ST_AsGeoJSON(AdminBoundary.geom).label("geojson"),
    ).where(AdminBoundary.pcode == pcode)

    result = await db.execute(query)
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Union not found")

    data = {
        "name_en": row.name_en,
        "name_bn": row.name_bn,
        "pcode": row.pcode,
        "adm_level": row.adm_level,
        "parent_pcode": row.parent_pcode,
        "division_name": row.division_name,
        "district_name": row.district_name,
        "upazila_name": row.upazila_name,
        "area_sq_km": safe_float(row.area_sq_km),
        "geometry": json.loads(row.geojson) if row.geojson else None,
    }
    return envelope(data=data)


@router.get("/search")
async def search_boundaries(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    P1 = aliased(AdminBoundary)
    P2 = aliased(AdminBoundary)
    P3 = aliased(AdminBoundary)

    search_term = f"%{q}%"
    query = (
        select(
            AdminBoundary.pcode,
            AdminBoundary.name_en,
            AdminBoundary.name_bn,
            AdminBoundary.adm_level,
            AdminBoundary.parent_pcode,
            AdminBoundary.division_name,
            AdminBoundary.district_name,
            AdminBoundary.upazila_name,
            P1.pcode.label("p1_pcode"),
            P2.pcode.label("p2_pcode"),
            P3.pcode.label("p3_pcode"),
        )
        .outerjoin(P1, AdminBoundary.parent_pcode == P1.pcode)
        .outerjoin(P2, P1.parent_pcode == P2.pcode)
        .outerjoin(P3, P2.parent_pcode == P3.pcode)
        .where(
            or_(
                AdminBoundary.name_en.ilike(search_term),
                AdminBoundary.name_bn.ilike(search_term),
                AdminBoundary.pcode.ilike(search_term),
            )
        )
        .order_by(AdminBoundary.adm_level, AdminBoundary.name_en)
        .limit(20)
    )

    result = await db.execute(query)
    rows = result.all()

    data = []
    for row in rows:
        # Build ancestry (drill history) for frontend navigation
        ancestry = []
        if row.adm_level == 2:
            ancestry = [{"level": 1, "parentPcode": None}]
        elif row.adm_level == 3:
            ancestry = [
                {"level": 1, "parentPcode": None},
                {"level": 2, "parentPcode": row.p2_pcode},
            ]
        elif row.adm_level == 4:
            ancestry = [
                {"level": 1, "parentPcode": None},
                {"level": 2, "parentPcode": row.p3_pcode},
                {"level": 3, "parentPcode": row.p2_pcode},
            ]

        data.append({
            "pcode": row.pcode,
            "name_en": row.name_en,
            "name_bn": row.name_bn,
            "adm_level": row.adm_level,
            "parent_pcode": row.parent_pcode,
            "division_name": row.division_name,
            "district_name": row.district_name,
            "upazila_name": row.upazila_name,
            "ancestry": ancestry,
        })

    return envelope(data=data)


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(AdminBoundary.adm_level, func.count(AdminBoundary.id).label("count"))
        .group_by(AdminBoundary.adm_level)
        .order_by(AdminBoundary.adm_level)
    )
    result = await db.execute(query)
    rows = result.all()
    data = [{"adm_level": row.adm_level, "count": row.count} for row in rows]
    return envelope(data=data)
