"""Add soft-delete to indicator_values and create audit_logs table

Revision ID: 008
Revises: 007
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Soft-delete columns on indicator_values
    existing_cols = [c["name"] for c in inspector.get_columns("indicator_values")]
    if "is_deleted" not in existing_cols:
        op.add_column(
            "indicator_values",
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        )
    if "deleted_at" not in existing_cols:
        op.add_column(
            "indicator_values",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    # Audit logs table
    if "audit_logs" not in inspector.get_table_names():
        op.create_table(
            "audit_logs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "action",
                sa.String(20),
                nullable=False,
            ),
            sa.Column("entity_type", sa.String(50), nullable=False),
            sa.Column("entity_id", sa.String(100), nullable=False),
            sa.Column("old_values", JSONB, nullable=True),
            sa.Column("new_values", JSONB, nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("audit_logs")]
    if "idx_audit_logs_user_id" not in existing_indexes:
        op.create_index("idx_audit_logs_user_id", "audit_logs", ["user_id"])
    if "idx_audit_logs_entity_type" not in existing_indexes:
        op.create_index("idx_audit_logs_entity_type", "audit_logs", ["entity_type"])
    if "idx_audit_logs_timestamp" not in existing_indexes:
        op.create_index("idx_audit_logs_timestamp", "audit_logs", ["timestamp"])


def downgrade() -> None:
    op.drop_index("idx_audit_logs_timestamp")
    op.drop_index("idx_audit_logs_entity_type")
    op.drop_index("idx_audit_logs_user_id")
    op.drop_table("audit_logs")
    op.drop_column("indicator_values", "deleted_at")
    op.drop_column("indicator_values", "is_deleted")
