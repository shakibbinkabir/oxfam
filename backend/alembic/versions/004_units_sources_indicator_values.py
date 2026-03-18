"""Add units, sources, indicator_values tables and migrate indicators

Revision ID: 004
Revises: 003
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create units table
    op.create_table(
        "units",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("abbreviation", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create sources table
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(200), unique=True, nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Migrate existing unit/source string values into tables
    # Insert distinct units
    op.execute("""
        INSERT INTO units (name)
        SELECT DISTINCT unit FROM climate_indicators
        WHERE unit IS NOT NULL AND TRIM(unit) != ''
        ON CONFLICT (name) DO NOTHING
    """)

    # Insert distinct sources
    op.execute("""
        INSERT INTO sources (name)
        SELECT DISTINCT source FROM climate_indicators
        WHERE source IS NOT NULL AND TRIM(source) != ''
        ON CONFLICT (name) DO NOTHING
    """)

    # Add unit_id and source_id columns
    op.add_column("climate_indicators", sa.Column("unit_id", sa.Integer(), nullable=True))
    op.add_column("climate_indicators", sa.Column("source_id", sa.Integer(), nullable=True))

    # Populate unit_id from existing unit strings
    op.execute("""
        UPDATE climate_indicators ci
        SET unit_id = u.id
        FROM units u
        WHERE ci.unit = u.name
    """)

    # Populate source_id from existing source strings
    op.execute("""
        UPDATE climate_indicators ci
        SET source_id = s.id
        FROM sources s
        WHERE ci.source = s.name
    """)

    # Add foreign key constraints
    op.create_foreign_key(
        "fk_indicators_unit_id", "climate_indicators", "units",
        ["unit_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_indicators_source_id", "climate_indicators", "sources",
        ["source_id"], ["id"], ondelete="SET NULL"
    )

    # Drop old string columns
    op.drop_column("climate_indicators", "unit")
    op.drop_column("climate_indicators", "source")

    # Create indicator_values table
    op.create_table(
        "indicator_values",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("indicator_id", sa.Integer(), sa.ForeignKey("climate_indicators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("boundary_pcode", sa.String(20), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("indicator_id", "boundary_pcode", name="uq_indicator_boundary"),
    )
    op.create_index("idx_indicator_values_pcode", "indicator_values", ["boundary_pcode"])
    op.create_index("idx_indicator_values_indicator", "indicator_values", ["indicator_id"])


def downgrade() -> None:
    op.drop_index("idx_indicator_values_indicator")
    op.drop_index("idx_indicator_values_pcode")
    op.drop_table("indicator_values")

    # Re-add old string columns
    op.add_column("climate_indicators", sa.Column("unit", sa.String(50), nullable=True))
    op.add_column("climate_indicators", sa.Column("source", sa.String(200), nullable=True))

    # Restore data from FK tables
    op.execute("""
        UPDATE climate_indicators ci
        SET unit = u.name
        FROM units u
        WHERE ci.unit_id = u.id
    """)
    op.execute("""
        UPDATE climate_indicators ci
        SET source = s.name
        FROM sources s
        WHERE ci.source_id = s.id
    """)

    op.drop_constraint("fk_indicators_source_id", "climate_indicators", type_="foreignkey")
    op.drop_constraint("fk_indicators_unit_id", "climate_indicators", type_="foreignkey")
    op.drop_column("climate_indicators", "source_id")
    op.drop_column("climate_indicators", "unit_id")

    op.drop_table("sources")
    op.drop_table("units")
