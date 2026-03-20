"""Add indicator_reference table for CVI calculation

Revision ID: 005
Revises: 004
Create Date: 2026-03-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "indicator_reference" not in inspector.get_table_names():
        op.create_table(
            "indicator_reference",
            sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
            sa.Column(
                "indicator_id",
                sa.Integer(),
                sa.ForeignKey("climate_indicators.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("global_min", sa.Float(), nullable=False, server_default="0"),
            sa.Column("global_max", sa.Float(), nullable=False, server_default="1"),
            sa.Column("direction", sa.String(1), nullable=False, server_default="+"),
            sa.Column("weight", sa.Float(), nullable=False, server_default="1"),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
            sa.UniqueConstraint("indicator_id", name="uq_indicator_reference_indicator"),
        )
    if "idx_indicator_reference_indicator_id" not in [
        idx["name"] for idx in inspector.get_indexes("indicator_reference")
    ]:
        op.create_index(
            "idx_indicator_reference_indicator_id",
            "indicator_reference",
            ["indicator_id"],
        )


def downgrade() -> None:
    op.drop_index("idx_indicator_reference_indicator_id")
    op.drop_table("indicator_reference")
