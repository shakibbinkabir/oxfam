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
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    ab_cols = [c["name"] for c in inspector.get_columns("admin_boundaries")]
    if "name_bn" not in ab_cols:
        op.add_column(
            "admin_boundaries",
            sa.Column("name_bn", sa.String(200), nullable=True),
        )

    ci_cols = [c["name"] for c in inspector.get_columns("climate_indicators")]
    if "indicator_name_bn" not in ci_cols:
        op.add_column(
            "climate_indicators",
            sa.Column("indicator_name_bn", sa.String(300), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("climate_indicators", "indicator_name_bn")
    op.drop_column("admin_boundaries", "name_bn")
