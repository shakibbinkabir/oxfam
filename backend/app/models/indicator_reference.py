from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IndicatorReference(Base):
    __tablename__ = "indicator_reference"
    __table_args__ = (
        UniqueConstraint("indicator_id", name="uq_indicator_reference_indicator"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    indicator_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("climate_indicators.id", ondelete="CASCADE"), nullable=False
    )
    global_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    global_max: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    direction: Mapped[str] = mapped_column(
        String(1), nullable=False, default="+"
    )
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    indicator = relationship("ClimateIndicator", lazy="joined")
