"""Add climate_indicators table

Revision ID: 003
Revises: 002
Create Date: 2026-03-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "climate_indicators",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("component", sa.String(50), nullable=False),
        sa.Column("subcategory", sa.String(50), nullable=True),
        sa.Column("indicator_name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("gis_attribute_id", sa.String(50), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("idx_indicators_component", "climate_indicators", ["component"])


def downgrade() -> None:
    op.drop_index("idx_indicators_component")
    op.drop_table("climate_indicators")
