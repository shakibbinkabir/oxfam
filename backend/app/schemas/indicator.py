import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IndicatorCreate(BaseModel):
    component: str
    subcategory: Optional[str] = None
    indicator_name: str
    code: str
    unit: Optional[str] = None
    source: Optional[str] = None
    gis_attribute_id: Optional[str] = None


class IndicatorUpdate(BaseModel):
    component: Optional[str] = None
    subcategory: Optional[str] = None
    indicator_name: Optional[str] = None
    unit: Optional[str] = None
    source: Optional[str] = None
    gis_attribute_id: Optional[str] = None


class IndicatorResponse(BaseModel):
    id: int
    component: str
    subcategory: Optional[str] = None
    indicator_name: str
    code: str
    unit: Optional[str] = None
    source: Optional[str] = None
    gis_attribute_id: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
