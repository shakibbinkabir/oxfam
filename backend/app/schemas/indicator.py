import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IndicatorCreate(BaseModel):
    component: str
    subcategory: Optional[str] = None
    indicator_name: str
    code: str
    unit_id: Optional[int] = None
    source_id: Optional[int] = None
    gis_attribute_id: Optional[str] = None


class IndicatorUpdate(BaseModel):
    component: Optional[str] = None
    subcategory: Optional[str] = None
    indicator_name: Optional[str] = None
    unit_id: Optional[int] = None
    source_id: Optional[int] = None
    gis_attribute_id: Optional[str] = None


class IndicatorResponse(BaseModel):
    id: int
    component: str
    subcategory: Optional[str] = None
    indicator_name: str
    code: str
    unit_id: Optional[int] = None
    unit_name: Optional[str] = None
    unit_abbreviation: Optional[str] = None
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    gis_attribute_id: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IndicatorValueCreate(BaseModel):
    indicator_id: int
    boundary_pcode: str
    value: float
    source_id: Optional[int] = None


class IndicatorValueUpdate(BaseModel):
    value: Optional[float] = None
    source_id: Optional[int] = None


class IndicatorValueResponse(BaseModel):
    id: int
    indicator_id: int
    boundary_pcode: str
    value: float
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    indicator_name: Optional[str] = None
    indicator_code: Optional[str] = None
    component: Optional[str] = None
    submitted_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
