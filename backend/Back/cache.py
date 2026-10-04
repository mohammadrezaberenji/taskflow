"""Small Redis cache helper.

Redis is used to cache read-heavy responses (task list and dashboard stats).
Every operation degrades gracefully: if Redis is not configured or is
temporarily unavailable, the API simply reads from PostgreSQL.
"""
import hashlib
import json
import logging
import time
from typing import Any, Optional

import redis
from redis.backoff import NoBackoff
from redis.retry import Retry

from .config import settings

logger = logging.getLogger(__name__)

_VERSION_KEY = "tasks:cache_version"
_RETRY_AFTER_SECONDS = 15  # back-off after a failure so requests are not slowed down

_client: Optional[redis.Redis] = None
_unavailable_until = 0.0


def _get_client() -> Optional[redis.Redis]:
    global _client
    if not settings.redis_host:
        return None
    if _client is None:
        _client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password,
            db=settings.redis_db,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            # Fail fast: no client-side retries, the API falls back to PostgreSQL
            retry=Retry(NoBackoff(), 0),
            retry_on_timeout=False,
        )
    return _client


def _available_client() -> Optional[redis.Redis]:
    if time.monotonic() < _unavailable_until:
        return None
    return _get_client()


def _mark_failure(operation: str, exc: Exception) -> None:
    global _unavailable_until
    _unavailable_until = time.monotonic() + _RETRY_AFTER_SECONDS
    logger.warning(
        "Redis %s failed (%s); serving without cache for %ds",
        operation,
        type(exc).__name__,
        _RETRY_AFTER_SECONDS,
    )


def build_key(namespace: str, params: dict[str, Any]) -> Optional[str]:
    """Build a versioned key; bumping the version invalidates every cached entry."""
    client = _available_client()
    if client is None:
        return None
    try:
        version = client.get(_VERSION_KEY) or "0"
    except redis.RedisError as exc:
        _mark_failure("get version", exc)
        return None
    digest = hashlib.sha1(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()
    return f"tasks:v{version}:{namespace}:{digest}"


def get_json(key: Optional[str]) -> Any:
    client = _available_client()
    if key is None or client is None:
        return None
    try:
        raw = client.get(key)
    except redis.RedisError as exc:
        _mark_failure("get", exc)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def set_json(key: Optional[str], value: Any) -> None:
    client = _available_client()
    if key is None or client is None:
        return
    try:
        client.set(key, json.dumps(value, default=str), ex=settings.cache_ttl_seconds)
    except redis.RedisError as exc:
        _mark_failure("set", exc)


def invalidate() -> None:
    # Always attempt invalidation (even during back-off) so other replicas
    # never keep serving stale data after a write.
    client = _get_client()
    if client is None:
        return
    try:
        client.incr(_VERSION_KEY)
    except redis.RedisError as exc:
        _mark_failure("invalidate", exc)


def check_redis() -> str:
    """Return 'ok', 'error' or 'disabled' (not configured)."""
    client = _get_client()
    if client is None:
        return "disabled"
    if time.monotonic() < _unavailable_until:
        # Recently failed: answer immediately so probes stay fast
        return "error"
    try:
        client.ping()
        return "ok"
    except redis.RedisError as exc:
        _mark_failure("health check", exc)
        return "error"
