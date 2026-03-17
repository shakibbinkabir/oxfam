from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UnitCreate(BaseModel):
    name: str
    abbreviation: Optional[str] = None


class UnitUpdate(BaseModel):
    name: Optional[str] = None
    abbreviation: Optional[str] = None


class UnitResponse(BaseModel):
    id: int
    name: str
    abbreviation: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
