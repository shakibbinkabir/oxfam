"""011 performance indexes

Revision ID: 011_performance_indexes
Revises: 010_batch_jobs
Create Date: 2026-03-20
"""

from alembic import op

revision = "011_performance_indexes"
down_revision = "010_batch_jobs"
branch_labels = None
depends_on = None


def upgrade():
    # Composite index for indicator value lookups
    op.create_index(
        "ix_indicator_values_boundary_indicator",
        "indicator_values",
        ["boundary_pcode", "indicator_id"],
    )
    # Index for computed scores by boundary
    op.create_index(
        "ix_computed_scores_boundary",
        "computed_scores",
        ["boundary_pcode"],
    )
    # Partial index for non-deleted indicator values
    op.create_index(
        "ix_indicator_values_not_deleted",
        "indicator_values",
        ["boundary_pcode", "indicator_id"],
        postgresql_where="is_deleted = false",
    )
    # Index for batch jobs by status
    op.create_index(
        "ix_batch_jobs_status",
        "batch_jobs",
        ["status"],
    )
    # Index for audit logs by entity type
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
