"""
Infrastructure monitoring endpoints.

Exposes lightweight, unauthenticated probes so uptime monitors
(UptimeRobot, Pingdom, k8s liveness) can detect downtime without
going through auth or business logic.

    GET /api/health     — app is up, no DB touch, <10ms
    GET /api/health/db  — ping MongoDB (1 round-trip), <100ms typical

Both return 200 JSON always; on DB failure /api/health/db still
responds 200 with {"db": "error", "error": "..."} so the monitor
can read the body instead of timing out.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from routes.core import db, client

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """Liveness probe. No DB, no external I/O. Always fast."""
    return {
        "status": "ok",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/db")
async def health_check_db():
    """
    Readiness probe: validates MongoDB connectivity with a short ping.
    Timeout: 3s. Returns {"db":"ok"} or {"db":"error", "error":...}.
    """
    t0 = time.perf_counter()
    try:
        # admin.ping is the cheapest MongoDB op (no auth scope required on replica)
        await asyncio.wait_for(client.admin.command("ping"), timeout=3.0)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"db": "ok", "latency_ms": latency_ms}
    except asyncio.TimeoutError:
        logger.error("[HEALTH_DB] MongoDB ping timeout (>3s)")
        return {"db": "error", "error": "timeout", "latency_ms": 3000.0}
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        logger.error(f"[HEALTH_DB] MongoDB ping failed: {type(e).__name__}: {e}")
        return {
            "db": "error",
            "error": type(e).__name__,
            "message": str(e)[:200],
            "latency_ms": latency_ms,
        }
