"""Add admin_boundaries table with PostGIS geometry

Revision ID: 002
Revises: 001
Create Date: 2026-03-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_boundaries",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("adm_level", sa.SmallInteger(), nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("pcode", sa.String(20), unique=True, nullable=False),
        sa.Column("parent_pcode", sa.String(20), nullable=True),
        sa.Column("division_name", sa.String(100), nullable=True),
        sa.Column("district_name", sa.String(100), nullable=True),
        sa.Column("upazila_name", sa.String(100), nullable=True),
        sa.Column("geom", Geometry("MULTIPOLYGON", srid=4326), nullable=True),
        sa.Column("centroid", Geometry("POINT", srid=4326), nullable=True),
        sa.Column("area_sq_km", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("idx_boundaries_geom", "admin_boundaries", ["geom"], postgresql_using="gist")
    op.create_index("idx_boundaries_pcode", "admin_boundaries", ["pcode"])
    op.create_index("idx_boundaries_level", "admin_boundaries", ["adm_level"])
    op.create_index("idx_boundaries_parent", "admin_boundaries", ["parent_pcode"])


def downgrade() -> None:
    op.drop_index("idx_boundaries_parent")
    op.drop_index("idx_boundaries_level")
    op.drop_index("idx_boundaries_pcode")
    op.drop_index("idx_boundaries_geom")
    op.drop_table("admin_boundaries")
