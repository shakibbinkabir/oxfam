"""Batch job model for tracking async CSV/XLSX uploads."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    total_rows = Column(Integer, default=0, server_default="0")
    processed_rows = Column(Integer, default=0, server_default="0")
    created_count = Column(Integer, default=0, server_default="0")
    updated_count = Column(Integer, default=0, server_default="0")
    error_count = Column(Integer, default=0, server_default="0")
    errors = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=None,
    )
