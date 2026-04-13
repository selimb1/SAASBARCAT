from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "contabilizAR"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/contabilizar"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "contabilizar-docs"
    S3_PRESIGNED_URL_EXPIRY: int = 3600  # 1 hora

    # IA
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # OCR
    USE_GOOGLE_DOC_AI: bool = False
    GOOGLE_DOC_AI_PROCESSOR_ID: str = ""
    GOOGLE_CLOUD_PROJECT: str = ""

    # Auth Social
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""

    # Email
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@contabilizar.ar"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://contabilizar.ar"]

    # Sentry
    SENTRY_DSN: Optional[str] = None

    # Storage
    IMAGE_RETENTION_DAYS: int = 90
    MAX_FILES_PER_BATCH: int = 200
    MAX_FILE_SIZE_MB: int = 20

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
