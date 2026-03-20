"""Add scenarios table for what-if simulation persistence

Revision ID: 007
Revises: 006
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "scenarios" not in inspector.get_table_names():
        op.create_table(
            "scenarios",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("boundary_pcode", sa.String(20), nullable=False),
            sa.Column("modified_values", JSONB, nullable=False),
            sa.Column("weights", JSONB, nullable=True),
            sa.Column("original_cri", sa.Float(), nullable=True),
            sa.Column("simulated_cri", sa.Float(), nullable=True),
            sa.Column(
                "created_by",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
            sa.Column("is_deleted", sa.Boolean(), server_default="false"),
        )
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("scenarios")]
    if "idx_scenarios_boundary" not in existing_indexes:
        op.create_index("idx_scenarios_boundary", "scenarios", ["boundary_pcode"])
    if "idx_scenarios_created_by" not in existing_indexes:
        op.create_index("idx_scenarios_created_by", "scenarios", ["created_by"])


def downgrade() -> None:
    op.drop_index("idx_scenarios_created_by")
    op.drop_index("idx_scenarios_boundary")
    op.drop_table("scenarios")
