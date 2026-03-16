from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdminBoundary(Base):
    __tablename__ = "admin_boundaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    adm_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    pcode: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    parent_pcode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    division_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    upazila_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)
    centroid = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    area_sq_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
