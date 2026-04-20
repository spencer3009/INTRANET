"""
Support Panel — real-time active sessions monitoring.

Returns live snapshot of authenticated users with open WebSocket connections,
grouped by school. Restricted to system_admin_global role.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from routes.core import ws_manager, db, get_current_user

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


async def _require_support_global(current_user=Depends(get_current_user)):
    """Only system_admin_global can access monitoring endpoints."""
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user or user.get("role") != "system_admin_global":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo soporte global.")
    return user


@router.get("/support/active-sessions")
async def get_active_sessions(_user=Depends(_require_support_global)):
    """
    Snapshot of currently connected users (with at least 1 open WebSocket),
    grouped by school. Data lives in memory (ws_manager.active_sessions)
    and is lost on backend restart — by design.
    """
    sessions = list(ws_manager.active_sessions.values())

    # Group by school
    buckets: dict[str, dict] = {}
    no_school_bucket = {
        "school_id": None,
        "school_name": "Sin colegio / Soporte global",
        "connected_users": [],
    }

    for s in sessions:
        sid = s.get("school_id")
        entry = {
            "user_id": s.get("user_id"),
            "name": s.get("name", ""),
            "role": s.get("role", ""),
            "connected_at": s.get("connected_at"),
            "connection_count": s.get("connection_count", 1),
            "current_page": s.get("current_page"),
            "last_activity": s.get("last_activity"),
        }
        if not sid:
            no_school_bucket["connected_users"].append(entry)
            continue
        if sid not in buckets:
            buckets[sid] = {
                "school_id": sid,
                "school_name": s.get("school_name") or "",
                "connected_users": [],
            }
        buckets[sid]["connected_users"].append(entry)

    by_school = sorted(
        buckets.values(),
        key=lambda b: len(b["connected_users"]),
        reverse=True,
    )
    if no_school_bucket["connected_users"]:
        by_school.append(no_school_bucket)

    return {
        "total_connected": len(sessions),
        "total_connections": sum(s.get("connection_count", 1) for s in sessions),
        "by_school": by_school,
    }
