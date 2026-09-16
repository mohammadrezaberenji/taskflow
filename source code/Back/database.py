import logging
import time

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Example: postgresql://user:password@localhost:5432/tasks"
    )

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    # SQLite is only used for local tests
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # transparently replace connections dropped by PostgreSQL
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first version of the schema. `create_all` does not
# alter existing tables, so databases created by the original application are
# upgraded in place (idempotent, PostgreSQL only).
_TASK_COLUMN_UPGRADES = {
    "description": "TEXT",
    "priority": "VARCHAR(10) NOT NULL DEFAULT 'medium'",
    "due_date": "DATE",
    "created_at": "TIMESTAMPTZ NOT NULL DEFAULT now()",
    "updated_at": "TIMESTAMPTZ NOT NULL DEFAULT now()",
}


def _upgrade_existing_schema() -> None:
    if engine.dialect.name != "postgresql":
        return
    existing = {column["name"] for column in inspect(engine).get_columns("tasks")}
    missing = {name: ddl for name, ddl in _TASK_COLUMN_UPGRADES.items() if name not in existing}
    if not missing:
        return
    with engine.begin() as conn:
        for name, ddl in missing.items():
            logger.info("Adding missing column tasks.%s", name)
            conn.execute(text(f"ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {name} {ddl}"))
        conn.execute(text("UPDATE tasks SET status = 'todo' WHERE status IS NULL"))


def init_db() -> None:
    """Create tables, retrying while the database is still starting up."""
    from . import models  # noqa: F401  (register models on Base)

    attempts = max(settings.db_connect_retries, 1)
    for attempt in range(1, attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _upgrade_existing_schema()
            logger.info("Database schema is ready")
            return
        except OperationalError:
            if attempt == attempts:
                logger.error("Database is unreachable after %d attempts", attempts)
                raise
            logger.warning(
                "Database not ready (attempt %d/%d), retrying in %ds",
                attempt,
                attempts,
                settings.db_connect_retry_delay,
            )
            time.sleep(settings.db_connect_retry_delay)


def check_database() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 - health checks must never raise
        logger.warning("Database health check failed", exc_info=True)
        return False
