"""010 batch_jobs table

Revision ID: 010_batch_jobs
Revises: 009_bilingual_columns
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "010_batch_jobs"
down_revision = "009_bilingual_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "batch_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), server_default="0"),
        sa.Column("processed_rows", sa.Integer(), server_default="0"),
        sa.Column("created_count", sa.Integer(), server_default="0"),
        sa.Column("updated_count", sa.Integer(), server_default="0"),
        sa.Column("error_count", sa.Integer(), server_default="0"),
        sa.Column("errors", JSON, nullable=True),
        sa.Column("warnings", JSON, nullable=True),
        sa.Column("submitted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("batch_jobs")
