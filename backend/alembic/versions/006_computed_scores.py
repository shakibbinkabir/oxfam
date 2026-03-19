"""Add computed_scores table for score caching

Revision ID: 006
Revises: 005
Create Date: 2026-03-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "computed_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("boundary_pcode", sa.String(20), unique=True, nullable=False),
        sa.Column("hazard_score", sa.Float(), nullable=True),
        sa.Column("soc_exposure_score", sa.Float(), nullable=True),
        sa.Column("sensitivity_score", sa.Float(), nullable=True),
        sa.Column("adaptive_capacity_score", sa.Float(), nullable=True),
        sa.Column("env_exposure_score", sa.Float(), nullable=True),
        sa.Column("env_sensitivity_score", sa.Float(), nullable=True),
        sa.Column("exposure_score", sa.Float(), nullable=True),
        sa.Column("vulnerability_score", sa.Float(), nullable=True),
        sa.Column("cri_score", sa.Float(), nullable=True),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("is_stale", sa.Boolean(), server_default="false"),
    )
    op.create_index(
        "idx_computed_scores_pcode", "computed_scores", ["boundary_pcode"]
    )


def downgrade() -> None:
    op.drop_index("idx_computed_scores_pcode")
    op.drop_table("computed_scores")
