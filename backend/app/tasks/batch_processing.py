"""Celery tasks for async batch processing."""

import csv
import io
from datetime import datetime, timezone

from app.celery_app import celery
from app.config import settings

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Use synchronous engine for Celery tasks
SYNC_DB_URL = settings.DATABASE_URL.replace("+asyncpg", "")


def get_sync_session():
    engine = create_engine(SYNC_DB_URL, pool_pre_ping=True)
    return Session(engine)


@celery.task(bind=True)
def process_batch_upload(self, job_id: int, file_content: str, filename: str, user_id: str):
    """Process a batch upload file asynchronously."""
    from app.models.batch_job import BatchJob
    from app.models.indicator import ClimateIndicator
    from app.models.indicator_value import IndicatorValue
    from app.models.indicator_reference import IndicatorReference
    from app.models.boundary import AdminBoundary
    from app.models.source import Source

    session = get_sync_session()
    try:
        # Update job status to processing
        job = session.execute(select(BatchJob).where(BatchJob.id == job_id)).scalar_one()
        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        session.commit()

        # Parse CSV
        reader = csv.DictReader(io.StringIO(file_content))
        data_rows = list(reader)
        job.total_rows = len(data_rows)
        session.commit()

        # Pre-fetch lookups
        ind_result = session.execute(select(ClimateIndicator.id, ClimateIndicator.code, ClimateIndicator.gis_attribute_id))
        code_to_id = {}
        for row in ind_result.all():
            code_to_id[row.code] = row.id
            if row.gis_attribute_id:
                code_to_id[row.gis_attribute_id] = row.id

        bnd_result = session.execute(select(AdminBoundary.pcode))
        valid_pcodes = {row.pcode for row in bnd_result.all()}

        src_result = session.execute(select(Source.id, Source.name))
        name_to_source_id = {row.name.lower(): row.id for row in src_result.all()}

        ref_result = session.execute(
            select(IndicatorReference.indicator_id, IndicatorReference.global_min, IndicatorReference.global_max)
        )
        ref_by_ind_id = {row.indicator_id: (row.global_min, row.global_max) for row in ref_result.all()}

        errors = []
        warnings = []
        created = 0
        updated = 0

        for i, row in enumerate(data_rows, start=2):
            indicator_code = (row.get("indicator_code") or "").strip()
            boundary_pcode = (row.get("boundary_pcode") or "").strip()
            value_str = (row.get("value") or "").strip()
            source_name = (row.get("source_name") or "").strip()

            if not indicator_code:
                errors.append({"row": i, "error": "missing indicator_code"})
                continue
            if not boundary_pcode:
                errors.append({"row": i, "error": "missing boundary_pcode"})
                continue
            if not value_str:
                errors.append({"row": i, "error": "missing value"})
                continue

            try:
                num_value = float(value_str)
            except ValueError:
                errors.append({"row": i, "error": f"invalid value '{value_str}'"})
                continue

            if indicator_code not in code_to_id:
                errors.append({"row": i, "error": f"unknown indicator_code '{indicator_code}'"})
                continue
            if boundary_pcode not in valid_pcodes:
                errors.append({"row": i, "error": f"unknown boundary_pcode '{boundary_pcode}'"})
                continue

            source_id = None
            if source_name:
                source_id = name_to_source_id.get(source_name.lower())

            ind_id = code_to_id[indicator_code]

            ref = ref_by_ind_id.get(ind_id)
            if ref:
                g_min, g_max = ref
                if num_value < g_min or num_value > g_max:
                    warnings.append(f"Row {i}: value {num_value} outside range [{g_min}, {g_max}]")

            existing = session.execute(
                select(IndicatorValue).where(
                    IndicatorValue.indicator_id == ind_id,
                    IndicatorValue.boundary_pcode == boundary_pcode,
                )
            ).scalar_one_or_none()

            if existing:
                existing.value = num_value
                existing.source_id = source_id
                existing.is_deleted = False
                existing.deleted_at = None
                updated += 1
            else:
                iv = IndicatorValue(
                    indicator_id=ind_id,
                    boundary_pcode=boundary_pcode,
                    value=num_value,
                    source_id=source_id,
                    submitted_by=user_id,
                )
                session.add(iv)
                created += 1

            # Update progress every 100 rows
            if (i - 1) % 100 == 0:
                job.processed_rows = i - 1
                session.commit()

        session.commit()

        # Final update
        job.status = "completed"
        job.processed_rows = len(data_rows)
        job.created_count = created
        job.updated_count = updated
        job.error_count = len(errors)
        job.errors = errors if errors else None
        job.warnings = warnings if warnings else None
        job.completed_at = datetime.now(timezone.utc)
        session.commit()

        return {"job_id": job_id, "created": created, "updated": updated, "errors": len(errors)}

    except Exception as e:
        session.rollback()
        try:
            job = session.execute(select(BatchJob).where(BatchJob.id == job_id)).scalar_one()
            job.status = "failed"
            job.errors = [{"error": str(e)}]
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
        except Exception:
            pass
        raise
    finally:
        session.close()
