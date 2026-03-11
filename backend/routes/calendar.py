"""
Calendar events module
Extracted from server.py during modularization.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Form, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import re
import logging

from .core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_role, require_admin, require_staff, require_section_access,
    is_demo_user, check_demo_user_block, require_not_demo, is_real_owner,
    is_system_user, check_system_user_block, is_protected_user,
    has_role, is_student, is_parent, is_staff,
    can_access_section, get_user_permissions,
    hash_password, verify_password, create_token,
    get_academic_filter,
    JWT_SECRET, JWT_ALGORITHM, now_iso, generate_id,
    ADMIN_ROLES, STAFF_ROLES, ROLE_HIERARCHY,
)

import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

class CalendarEventVisibility(BaseModel):
    """Visibility settings for calendar events"""
    roles: Optional[List[str]] = None  # ["teacher", "student", "parent"]
    grades: Optional[List[str]] = None  # Grade IDs
    sections: Optional[List[str]] = None  # Section IDs

class CalendarEventCreate(BaseModel):
    """Create a calendar event"""
    title: str
    description: Optional[str] = None
    type: Literal["academic", "institutional", "administrative", "holiday", "special", "communication"]
    color: Optional[str] = None
    start_date: str  # ISO date or datetime
    end_date: str
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None
    all_day: bool = True
    visibility: Optional[CalendarEventVisibility] = None

class CalendarEventUpdate(BaseModel):
    """Update a calendar event"""
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    visibility: Optional[CalendarEventVisibility] = None

@router.get("/calendar/event-types")
async def get_event_types():
    """Get available event types with their default colors"""
    return EVENT_TYPES

@router.get("/calendar/events")
async def get_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get calendar events filtered by date range and type.
    Events are filtered based on user's role and visibility settings.
    """
    user = await resolve_user_from_token(current_user)
    if not user:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user.get("school_id")
    if not school_id:
        school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    user_role = user.get("role", "")
    user_grade = user.get("grado_id")
    user_section = user.get("seccion_id")
    
    # Build query
    query = {"school_id": school_id}
    
    # Date range filter
    if start_date and end_date:
        query["$or"] = [
            # Event starts within range
            {"start_date": {"$gte": start_date, "$lte": end_date}},
            # Event ends within range
            {"end_date": {"$gte": start_date, "$lte": end_date}},
            # Event spans the entire range
            {"start_date": {"$lte": start_date}, "end_date": {"$gte": end_date}}
        ]
    elif start_date:
        query["end_date"] = {"$gte": start_date}
    elif end_date:
        query["start_date"] = {"$lte": end_date}
    
    # Type filter
    if event_type:
        query["type"] = event_type
    
    # Get events
    events_cursor = db.calendar_events.find(query, {"_id": 0}).sort("start_date", 1)
    events = await events_cursor.to_list(length=500)
    
    # Filter by visibility (only for non-admin users)
    is_admin = user_role in ["owner", "admin", "director"]
    
    if not is_admin:
        filtered_events = []
        for event in events:
            visibility = event.get("visibility", {})
            
            # If no visibility set, event is public (visible to all)
            if not visibility or (not visibility.get("roles") and not visibility.get("grades") and not visibility.get("sections")):
                filtered_events.append(event)
                continue
            
            # Check role visibility
            visible_roles = visibility.get("roles", [])
            if visible_roles and user_role not in visible_roles:
                continue
            
            # Check grade visibility
            visible_grades = visibility.get("grades", [])
            if visible_grades and user_grade and user_grade not in visible_grades:
                continue
            
            # Check section visibility
            visible_sections = visibility.get("sections", [])
            if visible_sections and user_section and user_section not in visible_sections:
                continue
            
            filtered_events.append(event)
        
        events = filtered_events
    
    # Add type label to each event
    for event in events:
        event_type_info = EVENT_TYPES.get(event.get("type", ""), {})
        event["type_label"] = event_type_info.get("label", event.get("type", ""))
        if not event.get("color"):
            event["color"] = event_type_info.get("color", "#64748B")
    
    return events

@router.post("/calendar/events")
async def create_calendar_event(data: CalendarEventCreate, current_user = Depends(get_current_user)):
    """
    Create a new calendar event.
    Only admin/director roles can create events.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear eventos")
    
    # Validate dates
    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="La fecha de inicio no puede ser posterior a la fecha de fin")
    
    school_id = user["school_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Get default color if not provided
    color = data.color
    if not color:
        color = EVENT_TYPES.get(data.type, {}).get("color", "#64748B")
    
    # Build visibility object
    visibility = {}
    if data.visibility:
        if data.visibility.roles:
            visibility["roles"] = data.visibility.roles
        if data.visibility.grades:
            visibility["grades"] = data.visibility.grades
        if data.visibility.sections:
            visibility["sections"] = data.visibility.sections
    
    event = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title,
        "description": data.description,
        "type": data.type,
        "color": color,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "all_day": data.all_day,
        "visibility": visibility,
        "created_by": current_user["sub"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.calendar_events.insert_one(event)
    if "_id" in event:
        del event["_id"]
    
    # Add type label
    event["type_label"] = EVENT_TYPES.get(data.type, {}).get("label", data.type)
    
    logger.info(f"Calendar event created: {data.title} by {current_user['sub']}")
    
    return {"message": "Evento creado correctamente", "event": event}

@router.put("/calendar/events/{event_id}")
async def update_calendar_event(event_id: str, data: CalendarEventUpdate, current_user = Depends(get_current_user)):
    """
    Update a calendar event.
    Only admin/director roles can update events.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar eventos")
    
    school_id = user["school_id"]
    
    # Find event
    event = await db.calendar_events.find_one({"id": event_id, "school_id": school_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    if data.type is not None:
        update_data["type"] = data.type
        # Update color if type changed and no custom color
        if not data.color and data.type in EVENT_TYPES:
            update_data["color"] = EVENT_TYPES[data.type]["color"]
    if data.color is not None:
        update_data["color"] = data.color
    if data.start_date is not None:
        update_data["start_date"] = data.start_date
    if data.end_date is not None:
        update_data["end_date"] = data.end_date
    if data.start_time is not None:
        update_data["start_time"] = data.start_time
    if data.end_time is not None:
        update_data["end_time"] = data.end_time
    if data.all_day is not None:
        update_data["all_day"] = data.all_day
    if data.visibility is not None:
        visibility = {}
        if data.visibility.roles:
            visibility["roles"] = data.visibility.roles
        if data.visibility.grades:
            visibility["grades"] = data.visibility.grades
        if data.visibility.sections:
            visibility["sections"] = data.visibility.sections
        update_data["visibility"] = visibility
    
    # Validate dates
    start = update_data.get("start_date", event["start_date"])
    end = update_data.get("end_date", event["end_date"])
    if start > end:
        raise HTTPException(status_code=400, detail="La fecha de inicio no puede ser posterior a la fecha de fin")
    
    await db.calendar_events.update_one({"id": event_id}, {"$set": update_data})
    
    # Get updated event
    updated_event = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
    updated_event["type_label"] = EVENT_TYPES.get(updated_event.get("type", ""), {}).get("label", updated_event.get("type", ""))
    
    logger.info(f"Calendar event updated: {event_id} by {current_user['sub']}")
    
    return {"message": "Evento actualizado correctamente", "event": updated_event}

@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(event_id: str, current_user = Depends(get_current_user)):
    """
    Delete a calendar event.
    Only admin/director roles can delete events.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    # Check permissions
    user_role = user.get("role", "")
    if user_role not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar eventos")
    
    school_id = user["school_id"]
    
    # Find and delete event
    result = await db.calendar_events.delete_one({"id": event_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    logger.info(f"Calendar event deleted: {event_id} by {current_user['sub']}")
    
    return {"message": "Evento eliminado correctamente"}

@router.get("/calendar/events/{event_id}")
async def get_calendar_event(event_id: str, current_user = Depends(get_current_user)):
    """Get a single calendar event by ID"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    event = await db.calendar_events.find_one({"id": event_id, "school_id": school_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    event["type_label"] = EVENT_TYPES.get(event.get("type", ""), {}).get("label", event.get("type", ""))
    
    return event

# ══════════════════════════════════════════════════════════════════════════════

