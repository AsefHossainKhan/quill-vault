import warnings

# Suppress noisy warnings from ML libraries at process start.
warnings.filterwarnings("ignore", message=".*torchcodec.*", category=UserWarning)
warnings.filterwarnings("ignore", message=".*torchcodec is not installed.*")
warnings.filterwarnings("ignore", message=".*degrees of freedom.*")
warnings.filterwarnings("ignore", message=".*std\(\).*")

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
    worker_send_task_events=True,
    task_send_sent_event=True,
)
