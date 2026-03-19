from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ComputedScore(Base):
    __tablename__ = "computed_scores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    boundary_pcode: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    hazard_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    soc_exposure_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    sensitivity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    adaptive_capacity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    env_exposure_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    env_sensitivity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    vulnerability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cri_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False)
