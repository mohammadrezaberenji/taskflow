"""Application configuration, read exclusively from environment variables.

Nothing sensitive is hardcoded here so the same image can run locally,
in Docker Compose and in Kubernetes (ConfigMaps / Secrets).
"""
import os


def _int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name} must be an integer") from exc


def _list(name: str) -> list[str]:
    value = os.getenv(name, "")
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    app_name: str = os.getenv("APP_NAME", "Task Management System")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

    # PostgreSQL, e.g. postgresql://user:password@postgres:5432/tasks
    database_url: str | None = os.getenv("DATABASE_URL")
    db_connect_retries: int = _int("DB_CONNECT_RETRIES", 10)
    db_connect_retry_delay: int = _int("DB_CONNECT_RETRY_DELAY", 3)

    # Redis (optional - the API keeps working without it)
    redis_host: str | None = os.getenv("REDIS_HOST")
    redis_port: int = _int("REDIS_PORT", 6379)
    redis_password: str | None = os.getenv("REDIS_PASSWORD") or None
    redis_db: int = _int("REDIS_DB", 0)
    cache_ttl_seconds: int = _int("CACHE_TTL_SECONDS", 60)

    # Only needed when the frontend is served from a different origin
    cors_origins: list[str] = _list("CORS_ORIGINS")


settings = Settings()
