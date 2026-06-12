from celery import Celery

from src.config import get_settings

settings = get_settings()

celery = Celery(
    "quillvault",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["src.tasks.pipeline"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,  # Ack only after task completes (crash safety)
    worker_prefetch_multiplier=1,  # One task per worker (heavy ML tasks)
    task_track_started=True,
)
