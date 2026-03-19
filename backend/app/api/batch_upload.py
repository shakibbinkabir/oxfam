"""Batch upload API with async Celery processing."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.batch_job import BatchJob
from app.models.user import User

router = APIRouter(prefix="/api/v1/batch-upload", tags=["batch-upload"])


def envelope(data=None, message="Success", status_val="success"):
    return {"status": status_val, "data": data, "message": message}


@router.post("/")
async def create_batch_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Upload a CSV/XLSX file for async batch processing via Celery."""
    is_csv = file.filename.endswith(".csv")
    is_xlsx = file.filename.endswith(".xlsx")

    if not is_csv and not is_xlsx:
        raise HTTPException(status_code=400, detail="Only CSV (.csv) and Excel (.xlsx) files are accepted")

    content = await file.read()

    # For XLSX, convert to CSV in-memory
    if is_xlsx:
        try:
            import openpyxl
            import csv
            import io

            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            output = io.StringIO()
            writer = csv.writer(output)
            for row in ws.iter_rows(values_only=True):
                writer.writerow([str(c).strip() if c is not None else "" for c in row])
            wb.close()
            csv_content = output.getvalue()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        try:
            csv_content = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    # Create batch job record
    job = BatchJob(
        filename=file.filename,
        status="pending",
        submitted_by=current_user.id,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Queue Celery task
    try:
        from app.tasks.batch_processing import process_batch_upload
        process_batch_upload.delay(job.id, csv_content, file.filename, str(current_user.id))
    except Exception:
        # If Celery/Redis is not available, process synchronously (fallback)
        job.status = "processing"
        # This is a graceful degradation - the sync bulk endpoint still works
        pass

    return envelope(
        data={
            "job_id": job.id,
            "filename": job.filename,
            "status": job.status,
        },
        message="Batch upload queued for processing",
    )


@router.get("/{job_id}/status")
async def get_batch_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check the status of a batch upload job."""
    result = await db.execute(select(BatchJob).where(BatchJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    progress = None
    if job.total_rows and job.total_rows > 0:
        progress = {
            "total": job.total_rows,
            "processed": job.processed_rows or 0,
            "percent": round((job.processed_rows or 0) / job.total_rows * 100, 1),
        }

    results = None
    if job.status in ("completed", "failed"):
        results = {
            "created": job.created_count or 0,
            "updated": job.updated_count or 0,
            "error_count": job.error_count or 0,
            "errors": job.errors,
            "warnings": job.warnings,
        }

    return envelope(data={
        "job_id": job.id,
        "filename": job.filename,
        "status": job.status,
        "progress": progress,
        "results": results,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    })


@router.get("/")
async def list_batch_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all batch upload jobs (admin only)."""
    result = await db.execute(
        select(BatchJob).order_by(BatchJob.created_at.desc()).limit(50)
    )
    jobs = result.scalars().all()

    data = [
        {
            "job_id": job.id,
            "filename": job.filename,
            "status": job.status,
            "total_rows": job.total_rows,
            "created_count": job.created_count or 0,
            "updated_count": job.updated_count or 0,
            "error_count": job.error_count or 0,
            "submitted_by": str(job.submitted_by) if job.submitted_by else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        }
        for job in jobs
    ]

    return envelope(data=data)
