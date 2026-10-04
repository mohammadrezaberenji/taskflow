import logging
import socket
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

from .cache import check_redis
from .config import settings
from .database import check_database, init_db
from .routers import tasks
from .schemas import HealthResponse

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("app")

INSTANCE = socket.gethostname()  # pod name in Kubernetes - handy to demo load balancing


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s v%s on %s", settings.app_name, settings.app_version, INSTANCE)
    init_db()
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="REST API of the Task Management System.",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[tasks.TOTAL_COUNT_HEADER],
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    # Probe requests are frequent; keep them out of the INFO log
    level = logging.DEBUG if "/health" in request.url.path else logging.INFO
    logger.log(
        level,
        "%s %s -> %d (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Error handling: clear messages, never leak SQL, stack traces or credentials
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        # loc looks like ("body", "title", ...) - report the field name only
        location = [part for part in error["loc"] if part not in ("body", "query", "path")]
        errors.append(
            {
                "field": str(location[0]) if location else "",
                "message": error["msg"].removeprefix("Value error, "),
            }
        )
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid input", "errors": errors},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    logger.warning("Integrity error: %s", exc.orig)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "The request conflicts with existing data"},
    )


@app.exception_handler(OperationalError)
async def database_unavailable_handler(_: Request, exc: OperationalError):
    logger.error("Database unavailable: %s", type(exc.orig).__name__ if exc.orig else exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database is temporarily unavailable. Please try again later."},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_: Request, exc: SQLAlchemyError):
    logger.exception("Database error")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Health checks
#   /health        -> overall status incl. dependencies; always 200 while the
#                     process is alive (safe for liveness probes)
#   /health/live   -> minimal liveness check, no dependency calls
#   /health/ready  -> 503 when PostgreSQL is unreachable (readiness probe)
# Redis is optional, so a Redis outage reports "degraded" but stays ready.
# ---------------------------------------------------------------------------
health_router = APIRouter(tags=["Health"])  # mounted with and without /api


def _dependency_checks() -> dict[str, str]:
    return {
        "database": "ok" if check_database() else "error",
        "redis": check_redis(),
    }


@health_router.get("/health", response_model=HealthResponse)
def health():
    checks = _dependency_checks()
    overall = "ok" if all(value in ("ok", "disabled") for value in checks.values()) else "degraded"
    return {"status": overall, "version": settings.app_version, "instance": INSTANCE, "checks": checks}


@health_router.get("/health/live", response_model=HealthResponse)
def liveness():
    return {"status": "ok", "version": settings.app_version, "instance": INSTANCE}


@health_router.get("/health/ready", response_model=HealthResponse)
def readiness():
    checks = _dependency_checks()
    ready = checks["database"] == "ok"
    body = {
        "status": "ok" if ready else "unavailable",
        "version": settings.app_version,
        "instance": INSTANCE,
        "checks": checks,
    }
    return JSONResponse(
        status_code=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=body,
    )


# Routes are served both at the root (/tasks, /health) and under /api
# (/api/tasks, /api/health) so the app works whether or not the reverse proxy
# strips the /api prefix.
app.include_router(health_router)
app.include_router(tasks.router)
app.include_router(health_router, prefix="/api", include_in_schema=False)
app.include_router(tasks.router, prefix="/api", include_in_schema=False)
