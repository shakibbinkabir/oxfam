"""011 performance indexes

Revision ID: 011_performance_indexes
Revises: 010_batch_jobs
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa

revision = "011_performance_indexes"
down_revision = "010_batch_jobs"
branch_labels = None
depends_on = None


def _index_exists(inspector, table, index_name):
    return index_name in [idx["name"] for idx in inspector.get_indexes(table)]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _index_exists(inspector, "indicator_values", "ix_indicator_values_boundary_indicator"):
        op.create_index(
            "ix_indicator_values_boundary_indicator",
            "indicator_values",
            ["boundary_pcode", "indicator_id"],
        )
    if not _index_exists(inspector, "computed_scores", "ix_computed_scores_boundary"):
        op.create_index(
            "ix_computed_scores_boundary",
            "computed_scores",
            ["boundary_pcode"],
        )
    if not _index_exists(inspector, "indicator_values", "ix_indicator_values_not_deleted"):
        op.create_index(
            "ix_indicator_values_not_deleted",
            "indicator_values",
            ["boundary_pcode", "indicator_id"],
            postgresql_where="is_deleted = false",
        )
    if not _index_exists(inspector, "batch_jobs", "ix_batch_jobs_status"):
        op.create_index(
            "ix_batch_jobs_status",
            "batch_jobs",
            ["status"],
        )
    if not _index_exists(inspector, "audit_logs", "ix_audit_logs_entity_type"):
        op.create_index(
            "ix_audit_logs_entity_type",
            "audit_logs",
            ["entity_type", "timestamp"],
        )


def downgrade():
    op.drop_index("ix_audit_logs_entity_type")
    op.drop_index("ix_batch_jobs_status")
    op.drop_index("ix_indicator_values_not_deleted")
    op.drop_index("ix_computed_scores_boundary")
    op.drop_index("ix_indicator_values_boundary_indicator")
