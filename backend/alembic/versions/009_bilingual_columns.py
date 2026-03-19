"""Add bilingual name columns — name_bn to admin_boundaries, indicator_name_bn to climate_indicators

Revision ID: 009
Revises: 008
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "admin_boundaries",
        sa.Column("name_bn", sa.String(200), nullable=True),
    )
    op.add_column(
        "climate_indicators",
        sa.Column("indicator_name_bn", sa.String(300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("climate_indicators", "indicator_name_bn")
    op.drop_column("admin_boundaries", "name_bn")
