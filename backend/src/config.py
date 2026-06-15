from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "QuillVault API"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]

    # Database
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host/db

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_EVENTS: bool = True  # Send task events for progress visibility

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Storage
    AUDIO_STORAGE_PATH: str = "./data/audio"
    MAX_AUDIO_SIZE_MB: int = 2048

    # Models
    WHISPER_MODEL: str = "large-v3"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "float32"
    DIARIZATION_MODEL: str = "pyannote/speaker-diarization-3.1"
    HUGGINGFACE_TOKEN: str = ""
    EMBEDDING_SIMILARITY_THRESHOLD: float = 0.30

    # LLM (LangChain / OpenRouter)
    LLM_PROVIDER: str = "openrouter"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "openrouter/free"
    LLM_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MAX_TOKENS: int = 4096

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    BACKEND_URL: str = "http://localhost:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
