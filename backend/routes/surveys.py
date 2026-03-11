"""
Surveys module
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

# SURVEYS MODULE - ENCUESTAS INSTITUCIONALES
# ══════════════════════════════════════════════════════════════════════════════

class SurveyCreate(BaseModel):
    """Request to create a new survey"""
    question: str = Field(..., min_length=1, max_length=500)
    options: List[str] = Field(..., min_length=2)
    target_roles: List[str] = []  # Empty means all roles can see
    status: Literal["draft", "active"] = "draft"

class SurveyUpdate(BaseModel):
    """Request to update a survey"""
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    options: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    status: Optional[Literal["draft", "active", "closed"]] = None

class SurveyAnswer(BaseModel):
    """Request to answer a survey"""
    option_selected: int  # Index of the option selected

@router.get("/surveys")
async def get_surveys(
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """
    Get all surveys for the current tenant.
    Admin/directors see all, other users see only active surveys targeting their role.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Build query
    query = {"school_id": school_id}
    
    if is_admin:
        # Admins can filter by status
        if status:
            query["status"] = status
    else:
        # Non-admin users can only see active surveys targeting their role
        query["status"] = "active"
        query["$or"] = [
            {"target_roles": {"$size": 0}},  # Empty means all roles
            {"target_roles": user_role}
        ]
    
    surveys_cursor = db.surveys.find(query, {"_id": 0}).sort("created_at", -1)
    surveys = await surveys_cursor.to_list(200)
    
    # Calculate response statistics for each survey
    for survey in surveys:
        # Count total responses
        response_count = await db.survey_answers.count_documents({"survey_id": survey["id"]})
        survey["response_count"] = response_count
        
        # Check if current user has responded
        user_response = await db.survey_answers.find_one({
            "survey_id": survey["id"],
            "user_id": user["id"]
        }, {"_id": 0})
        survey["user_has_responded"] = user_response is not None
        if user_response:
            survey["user_response"] = user_response.get("option_selected")
        
        # Calculate target user count for participation indicator
        if is_admin:
            target_roles = survey.get("target_roles", [])
            if target_roles:
                target_count = await db.users.count_documents({
                    "school_id": school_id,
                    "role": {"$in": target_roles}
                })
            else:
                target_count = await db.users.count_documents({"school_id": school_id})
            survey["target_count"] = target_count
            survey["participation_rate"] = round((response_count / target_count * 100), 1) if target_count > 0 else 0
    
    return surveys

@router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str, current_user = Depends(get_current_user)):
    """Get a single survey by ID"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Calculate response count
    response_count = await db.survey_answers.count_documents({"survey_id": survey_id})
    survey["response_count"] = response_count
    
    # Check if current user has responded
    user_response = await db.survey_answers.find_one({
        "survey_id": survey_id,
        "user_id": user["id"]
    }, {"_id": 0})
    survey["user_has_responded"] = user_response is not None
    if user_response:
        survey["user_response"] = user_response.get("option_selected")
    
    return survey

@router.post("/surveys")
async def create_survey(data: SurveyCreate, current_user = Depends(get_current_user)):
    """
    Create a new survey.
    Only admin/owner/director can create surveys.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear encuestas")
    
    # Validate options
    if len(data.options) < 2:
        raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones")
    
    # Clean empty options
    options = [opt.strip() for opt in data.options if opt.strip()]
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones válidas")
    
    school_id = user["school_id"]
    
    survey = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "question": data.question.strip(),
        "options": options,
        "target_roles": data.target_roles,
        "status": data.status,
        "created_by": user["id"],
        "created_by_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.surveys.insert_one(survey)
    survey.pop("_id", None)
    survey["response_count"] = 0
    survey["user_has_responded"] = False
    
    logger.info(f"Survey created: {survey['id']} by {user['id']}")
    
    return {"message": "Encuesta creada correctamente", "survey": survey}

@router.put("/surveys/{survey_id}")
async def update_survey(survey_id: str, data: SurveyUpdate, current_user = Depends(get_current_user)):
    """
    Update a survey.
    Only admin/owner/director can update surveys.
    Cannot edit surveys that are closed or have responses (if changing options).
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Cannot edit closed surveys
    if survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="No se puede editar una encuesta cerrada")
    
    # Check if survey has responses
    response_count = await db.survey_answers.count_documents({"survey_id": survey_id})
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.question is not None:
        update_data["question"] = data.question.strip()
    
    if data.options is not None:
        if response_count > 0:
            raise HTTPException(status_code=400, detail="No se pueden modificar las opciones de una encuesta con respuestas")
        options = [opt.strip() for opt in data.options if opt.strip()]
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="La encuesta debe tener al menos 2 opciones válidas")
        update_data["options"] = options
    
    if data.target_roles is not None:
        update_data["target_roles"] = data.target_roles
    
    if data.status is not None:
        update_data["status"] = data.status
    
    await db.surveys.update_one({"id": survey_id}, {"$set": update_data})
    
    # Get updated survey
    updated_survey = await db.surveys.find_one({"id": survey_id}, {"_id": 0})
    updated_survey["response_count"] = response_count
    
    logger.info(f"Survey updated: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta actualizada correctamente", "survey": updated_survey}

@router.put("/surveys/{survey_id}/close")
async def close_survey(survey_id: str, current_user = Depends(get_current_user)):
    """
    Close a survey.
    Only admin/owner/director can close surveys.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden cerrar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    if survey.get("status") == "closed":
        raise HTTPException(status_code=400, detail="La encuesta ya está cerrada")
    
    await db.surveys.update_one(
        {"id": survey_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Survey closed: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta cerrada correctamente"}

@router.delete("/surveys/{survey_id}")
async def delete_survey(survey_id: str, current_user = Depends(get_current_user)):
    """
    Delete a survey and all its responses.
    Only admin/owner/director can delete surveys.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar encuestas")
    
    school_id = user["school_id"]
    
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Delete all responses first
    await db.survey_answers.delete_many({"survey_id": survey_id})
    
    # Delete survey
    await db.surveys.delete_one({"id": survey_id})
    
    logger.info(f"Survey deleted: {survey_id} by {user['id']}")
    
    return {"message": "Encuesta eliminada correctamente"}

@router.post("/surveys/{survey_id}/answer")
async def answer_survey(survey_id: str, data: SurveyAnswer, current_user = Depends(get_current_user)):
    """
    Submit an answer to a survey.
    Each user can only answer once per survey.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    
    # Get the survey
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Check if survey is active
    if survey.get("status") != "active":
        raise HTTPException(status_code=400, detail="Esta encuesta no está activa")
    
    # Check if user's role is in target roles
    target_roles = survey.get("target_roles", [])
    if target_roles and user_role not in target_roles:
        raise HTTPException(status_code=403, detail="No tienes permiso para responder esta encuesta")
    
    # Check if user has already answered
    existing = await db.survey_answers.find_one({
        "survey_id": survey_id,
        "user_id": user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya has respondido a esta encuesta")
    
    # Validate option index
    options = survey.get("options", [])
    if data.option_selected < 0 or data.option_selected >= len(options):
        raise HTTPException(status_code=400, detail="Opción de respuesta inválida")
    
    # Save answer
    answer = {
        "id": str(uuid.uuid4()),
        "survey_id": survey_id,
        "user_id": user["id"],
        "option_selected": data.option_selected,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.survey_answers.insert_one(answer)
    
    logger.info(f"Survey answered: {survey_id} by {user['id']}")
    
    return {"message": "¡Gracias por tu participación!", "answer": {"option_selected": data.option_selected}}

@router.get("/surveys/{survey_id}/results")
async def get_survey_results(survey_id: str, current_user = Depends(get_current_user)):
    """
    Get detailed results and statistics for a survey.
    Only admin/owner/director can see results, or anyone if survey is closed.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    # Get the survey
    survey = await db.surveys.find_one({"id": survey_id, "school_id": school_id}, {"_id": 0})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    
    # Non-admin users can only see results of closed surveys
    if not is_admin and survey.get("status") != "closed":
        raise HTTPException(status_code=403, detail="Los resultados aún no están disponibles")
    
    # Get all answers
    answers = await db.survey_answers.find({"survey_id": survey_id}, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total_responses = len(answers)
    options = survey.get("options", [])
    
    # Count votes per option
    option_counts = [0] * len(options)
    for answer in answers:
        idx = answer.get("option_selected", -1)
        if 0 <= idx < len(options):
            option_counts[idx] += 1
    
    # Build results with percentages
    results = []
    for i, option in enumerate(options):
        count = option_counts[i]
        percentage = round((count / total_responses * 100), 1) if total_responses > 0 else 0
        results.append({
            "option": option,
            "count": count,
            "percentage": percentage
        })
    
    # Calculate target user count for participation indicator
    target_roles = survey.get("target_roles", [])
    if target_roles:
        target_count = await db.users.count_documents({
            "school_id": school_id,
            "role": {"$in": target_roles}
        })
    else:
        target_count = await db.users.count_documents({"school_id": school_id})
    
    participation_rate = round((total_responses / target_count * 100), 1) if target_count > 0 else 0
    
    return {
        "survey": survey,
        "total_responses": total_responses,
        "target_count": target_count,
        "participation_rate": participation_rate,
        "results": results
    }

# ══════════════════════════════════════════════════════════════════════════════

