from celery import Celery

celery = Celery(
    "crvap",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1",
)
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,
)
