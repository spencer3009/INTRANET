"""
News module
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

# NEWS MODULE - NOTICIAS INSTITUCIONALES
# ══════════════════════════════════════════════════════════════════════════════

NEWS_STATUSES = {
    "draft": {"label": "Borrador", "color": "#64748B"},
    "published": {"label": "Publicado", "color": "#22C55E"},
    "archived": {"label": "Archivado", "color": "#94A3B8"}
}

class NewsGalleryItem(BaseModel):
    url: str
    type: Literal["image", "video"] = "image"

class NewsVisibility(BaseModel):
    roles: List[str] = []  # Empty means all roles
    grades: List[str] = []
    sections: List[str] = []

class NewsCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[NewsGalleryItem]] = []
    visibility: Optional[NewsVisibility] = None
    status: Literal["draft", "published"] = "draft"
    pinned: bool = False
    reactions_enabled: bool = False
    comments_enabled: bool = False

class NewsUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = None
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[NewsGalleryItem]] = None
    visibility: Optional[NewsVisibility] = None
    status: Optional[Literal["draft", "published", "archived"]] = None
    pinned: Optional[bool] = None
    reactions_enabled: Optional[bool] = None
    comments_enabled: Optional[bool] = None

def check_news_visibility(news: dict, user: dict) -> bool:
    """Check if a user can see a specific news article based on visibility settings"""
    visibility = news.get("visibility", {})
    
    # If no visibility restrictions, everyone can see
    roles = visibility.get("roles", [])
    grades = visibility.get("grades", [])
    sections = visibility.get("sections", [])
    
    if not roles and not grades and not sections:
        return True
    
    user_role = user.get("role", "")
    user_grade = user.get("grado_id", "")
    user_section = user.get("seccion_id", "")
    
    # Check role restriction
    if roles and user_role not in roles:
        return False
    
    # Check grade restriction (if applicable)
    if grades and user_grade and user_grade not in grades:
        return False
    
    # Check section restriction (if applicable)
    if sections and user_section and user_section not in sections:
        return False
    
    return True

@router.get("/news")
async def get_news(
    status: Optional[str] = None,
    pinned_only: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """
    Get news articles.
    - Admin/Director see all (including drafts)
    - Others see only published articles that match their visibility
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
        # Exclude archived unless specifically requested
        elif status != "archived":
            query["status"] = {"$ne": "archived"}
    else:
        # Non-admin users only see published articles
        query["status"] = "published"
    
    if pinned_only:
        query["pinned"] = True
    
    # Calculate pagination
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.news.count_documents(query)
    
    # Get news with sorting: pinned first, then by published_at desc
    news_cursor = db.news.find(query, {"_id": 0}).sort([
        ("pinned", -1),
        ("published_at", -1),
        ("created_at", -1)
    ]).skip(skip).limit(limit)
    
    news_list = await news_cursor.to_list(limit)
    
    # Filter by visibility for non-admin users
    if not is_admin:
        news_list = [n for n in news_list if check_news_visibility(n, user)]
    
    # Enrich with author info
    authors_cache = {}
    for news in news_list:
        author_id = news.get("author_id")
        if author_id and author_id not in authors_cache:
            author = await db.users.find_one({"id": author_id}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
            authors_cache[author_id] = author
        
        author_info = authors_cache.get(author_id)
        if author_info:
            news["author_name"] = f"{author_info.get('name', '')} {author_info.get('last_name', '')}".strip()
            news["author_photo"] = author_info.get("photo_url")
        else:
            news["author_name"] = news.get("author_name", "Desconocido")
            news["author_photo"] = None
        
        # Add status label
        news["status_label"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("label", "")
        news["status_color"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("color", "#64748B")
    
    return {
        "news": news_list,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/news/{news_id}")
async def get_news_article(news_id: str, current_user = Depends(get_current_user)):
    """Get a single news article by ID"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    school_id = user["school_id"]
    user_role = user.get("role", "")
    is_admin = user_role in ["owner", "admin", "director"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id}, {"_id": 0})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    # Check permissions
    if not is_admin:
        if news.get("status") != "published":
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta noticia")
        if not check_news_visibility(news, user):
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta noticia")
    
    # Enrich with author info
    author = await db.users.find_one({"id": news.get("author_id")}, {"_id": 0, "name": 1, "last_name": 1, "photo_url": 1})
    if author:
        news["author_name"] = f"{author.get('name', '')} {author.get('last_name', '')}".strip()
        news["author_photo"] = author.get("photo_url")
    
    news["status_label"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("label", "")
    news["status_color"] = NEWS_STATUSES.get(news.get("status", ""), {}).get("color", "#64748B")
    
    return news

@router.post("/news")
async def create_news(data: NewsCreate, current_user = Depends(get_current_user)):
    """
    Create a new news article.
    Only Admin/Director can create news.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden crear noticias")
    
    school_id = user["school_id"]
    
    # Check max pinned (3)
    if data.pinned:
        pinned_count = await db.news.count_documents({"school_id": school_id, "pinned": True, "status": "published"})
        if pinned_count >= 3:
            raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
    
    now = datetime.now(timezone.utc).isoformat()
    
    news = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "title": data.title.strip(),
        "content": data.content,
        "summary": data.summary.strip() if data.summary else None,
        "cover_image": data.cover_image,
        "gallery": [g.model_dump() for g in data.gallery] if data.gallery else [],
        "author_id": user["id"],
        "author_name": f"{user.get('name', '')} {user.get('last_name', '')}".strip(),
        "visibility": data.visibility.model_dump() if data.visibility else {"roles": [], "grades": [], "sections": []},
        "status": data.status,
        "pinned": data.pinned if data.status == "published" else False,
        "reactions_enabled": data.reactions_enabled,
        "comments_enabled": data.comments_enabled,
        "created_at": now,
        "updated_at": now,
        "published_at": now if data.status == "published" else None
    }
    
    await db.news.insert_one(news)
    news.pop("_id", None)
    
    news["author_photo"] = user.get("photo_url")
    news["status_label"] = NEWS_STATUSES.get(data.status, {}).get("label", "")
    news["status_color"] = NEWS_STATUSES.get(data.status, {}).get("color", "#64748B")
    
    logger.info(f"News created: {news['id']} by {user['id']}")
    
    return {"message": "Noticia creada correctamente", "news": news}

@router.put("/news/{news_id}")
async def update_news(news_id: str, data: NewsUpdate, current_user = Depends(get_current_user)):
    """
    Update a news article.
    Only Admin/Director can edit news.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden editar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.content is not None:
        update_data["content"] = data.content
    if data.summary is not None:
        update_data["summary"] = data.summary.strip() if data.summary else None
    if data.cover_image is not None:
        update_data["cover_image"] = data.cover_image
    if data.gallery is not None:
        update_data["gallery"] = [g.model_dump() for g in data.gallery]
    if data.visibility is not None:
        update_data["visibility"] = data.visibility.model_dump()
    if data.reactions_enabled is not None:
        update_data["reactions_enabled"] = data.reactions_enabled
    if data.comments_enabled is not None:
        update_data["comments_enabled"] = data.comments_enabled
    
    # Handle status change
    if data.status is not None:
        update_data["status"] = data.status
        if data.status == "published" and news.get("status") != "published":
            update_data["published_at"] = datetime.now(timezone.utc).isoformat()
    
    # Handle pinned
    if data.pinned is not None:
        new_status = data.status if data.status else news.get("status")
        if data.pinned and new_status == "published":
            pinned_count = await db.news.count_documents({
                "school_id": school_id, 
                "pinned": True, 
                "status": "published",
                "id": {"$ne": news_id}
            })
            if pinned_count >= 3:
                raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
        update_data["pinned"] = data.pinned
    
    await db.news.update_one({"id": news_id}, {"$set": update_data})
    
    updated_news = await db.news.find_one({"id": news_id}, {"_id": 0})
    
    logger.info(f"News updated: {news_id} by {user['id']}")
    
    return {"message": "Noticia actualizada correctamente", "news": updated_news}

@router.put("/news/{news_id}/publish")
async def publish_news(news_id: str, current_user = Depends(get_current_user)):
    """Publish a draft news article"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden publicar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") == "published":
        raise HTTPException(status_code=400, detail="La noticia ya está publicada")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News published: {news_id} by {user['id']}")
    
    return {"message": "Noticia publicada correctamente"}

@router.put("/news/{news_id}/archive")
async def archive_news(news_id: str, current_user = Depends(get_current_user)):
    """Archive a news article"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden archivar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") == "archived":
        raise HTTPException(status_code=400, detail="La noticia ya está archivada")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "status": "archived",
            "pinned": False,  # Unpin when archiving
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News archived: {news_id} by {user['id']}")
    
    return {"message": "Noticia archivada correctamente"}

@router.put("/news/{news_id}/pin")
async def pin_news(news_id: str, current_user = Depends(get_current_user)):
    """Toggle pin status of a news article"""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if user.get("role") not in ["owner", "admin", "director"]:
        raise HTTPException(status_code=403, detail="Solo administradores y directores pueden fijar noticias")
    
    school_id = user["school_id"]
    
    news = await db.news.find_one({"id": news_id, "school_id": school_id})
    if not news:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    if news.get("status") != "published":
        raise HTTPException(status_code=400, detail="Solo se pueden fijar noticias publicadas")
    
    new_pinned = not news.get("pinned", False)
    
    # Check max pinned
    if new_pinned:
        pinned_count = await db.news.count_documents({
            "school_id": school_id, 
            "pinned": True, 
            "status": "published",
            "id": {"$ne": news_id}
        })
        if pinned_count >= 3:
            raise HTTPException(status_code=400, detail="Solo se pueden tener 3 noticias destacadas simultáneamente")
    
    await db.news.update_one(
        {"id": news_id},
        {"$set": {
            "pinned": new_pinned,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"News pin toggled: {news_id} -> {new_pinned} by {user['id']}")
    
    return {
        "message": f"Noticia {'destacada' if new_pinned else 'quitada de destacados'} correctamente",
        "pinned": new_pinned
    }

@router.delete("/news/{news_id}")
async def delete_news(news_id: str, current_user = Depends(get_current_user)):
    """
    Delete a news article.
    Only Admin can delete news.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")
    
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar noticias")
    
    school_id = user["school_id"]
    
    result = await db.news.delete_one({"id": news_id, "school_id": school_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    
    logger.info(f"News deleted: {news_id} by {user['id']}")
    
    return {"message": "Noticia eliminada correctamente"}

# ══════════════════════════════════════════════════════════════════════════════

