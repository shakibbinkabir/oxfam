from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SourceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    url: Optional[str] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


class SourceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
