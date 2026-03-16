from typing import Any, Optional

from pydantic import BaseModel


class BoundaryProperties(BaseModel):
    name_en: str
    pcode: str
    adm_level: int
    parent_pcode: Optional[str] = None
    division_name: Optional[str] = None
    district_name: Optional[str] = None
    upazila_name: Optional[str] = None
    area_sq_km: Optional[float] = None


class BoundaryFeature(BaseModel):
    type: str = "Feature"
    properties: BoundaryProperties
    geometry: Any


class BoundaryFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[BoundaryFeature]


class BoundaryListItem(BaseModel):
    name_en: str
    pcode: str
    centroid: Optional[Any] = None

    model_config = {"from_attributes": True}


class UnionDetail(BaseModel):
    name_en: str
    pcode: str
    adm_level: int
    parent_pcode: Optional[str] = None
    division_name: Optional[str] = None
    district_name: Optional[str] = None
    upazila_name: Optional[str] = None
    area_sq_km: Optional[float] = None
    geometry: Any

    model_config = {"from_attributes": True}


class GeoStatsResponse(BaseModel):
    adm_level: int
    count: int
