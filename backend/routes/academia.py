"""
Academia - Tutorial Video Library
CRUD for categories, subcategories and YouTube tutorial videos.
Only accessible by support (system_admin_global).
"""
import uuid
import re
import httpx
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from routes.support import require_support_admin
from routes.core import db, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["academia"])


# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None

class SubcategoryCreate(BaseModel):
    name: str

class SubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class VideoCreate(BaseModel):
    youtube_url: str
    title: str
    description: Optional[str] = None
    category_id: str
    subcategory_id: Optional[str] = None
    duration: Optional[str] = None
    is_published: bool = False
    platform: Optional[str] = "youtube"

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    duration: Optional[str] = None
    youtube_url: Optional[str] = None
    is_published: Optional[bool] = None
    platform: Optional[str] = None

class ReorderRequest(BaseModel):
    ordered_ids: List[str]

class YouTubeExtractRequest(BaseModel):
    url: str


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def extract_youtube_id(url: str) -> Optional[str]:
    pattern = r'(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def extract_vimeo_id(url: str) -> Optional[str]:
    pattern = r'(?:vimeo\.com/)(\d+)'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def detect_platform(url: str) -> Optional[str]:
    if extract_youtube_id(url):
        return "youtube"
    if extract_vimeo_id(url):
        return "vimeo"
    return None

def get_thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

def get_vimeo_thumbnail_url(video_id: str) -> str:
    return f"https://vumbnail.com/{video_id}.jpg"

async def get_next_sort_order(collection: str, filter_dict: dict) -> int:
    last = await db[collection].find_one(filter_dict, {"_id": 0, "sort_order": 1}, sort=[("sort_order", -1)])
    return (last.get("sort_order", 0) + 1) if last else 0


# ═══════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════

@router.get("/academia/stats")
async def get_academia_stats(user=Depends(require_support_admin)):
    total_videos = await db.tutorial_videos.count_documents({})
    total_categories = await db.tutorial_categories.count_documents({})
    published = await db.tutorial_videos.count_documents({"is_published": True})
    drafts = await db.tutorial_videos.count_documents({"is_published": False})
    return {
        "total_videos": total_videos,
        "total_categories": total_categories,
        "published_count": published,
        "draft_count": drafts,
    }


# ═══════════════════════════════════════════════════════════
# CATEGORIES
# ═══════════════════════════════════════════════════════════

@router.get("/academia/categories")
async def get_categories(user=Depends(require_support_admin)):
    cats = await db.tutorial_categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    for cat in cats:
        cat["video_count"] = await db.tutorial_videos.count_documents({"category_id": cat["id"]})
        subs = await db.tutorial_subcategories.find(
            {"category_id": cat["id"]}, {"_id": 0}
        ).sort("sort_order", 1).to_list(50)
        for sub in subs:
            sub["video_count"] = await db.tutorial_videos.count_documents({"subcategory_id": sub["id"]})
        cat["subcategories"] = subs
    return cats

@router.post("/academia/categories")
async def create_category(data: CategoryCreate, user=Depends(require_support_admin)):
    existing = await db.tutorial_categories.find_one({"name": data.name}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Ya existe una categoria con ese nombre")
    now = datetime.now(timezone.utc).isoformat()
    sort_order = await get_next_sort_order("tutorial_categories", {})
    cat = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "icon": data.icon,
        "sort_order": sort_order,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.tutorial_categories.insert_one(cat)
    cat.pop("_id", None)
    return cat

@router.put("/academia/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryUpdate, user=Depends(require_support_admin)):
    cat = await db.tutorial_categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Categoria no encontrada")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if "name" in updates:
        dup = await db.tutorial_categories.find_one({"name": updates["name"], "id": {"$ne": cat_id}}, {"_id": 0})
        if dup:
            raise HTTPException(409, "Ya existe una categoria con ese nombre")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tutorial_categories.update_one({"id": cat_id}, {"$set": updates})
    return {**cat, **updates}

@router.delete("/academia/categories/{cat_id}")
async def delete_category(cat_id: str, user=Depends(require_support_admin)):
    video_count = await db.tutorial_videos.count_documents({"category_id": cat_id})
    if video_count > 0:
        raise HTTPException(409, f"Esta categoria tiene {video_count} video(s). Muevelos a otra categoria antes de eliminar.")
    sub_with_videos = 0
    subs = await db.tutorial_subcategories.find({"category_id": cat_id}, {"_id": 0, "id": 1}).to_list(100)
    for sub in subs:
        vc = await db.tutorial_videos.count_documents({"subcategory_id": sub["id"]})
        if vc > 0:
            sub_with_videos += vc
    if sub_with_videos > 0:
        raise HTTPException(409, f"Las subcategorias tienen {sub_with_videos} video(s). Muevelos antes de eliminar.")
    await db.tutorial_subcategories.delete_many({"category_id": cat_id})
    await db.tutorial_categories.delete_one({"id": cat_id})
    return {"message": "Categoria eliminada"}

@router.put("/academia/categories/reorder")
async def reorder_categories(data: ReorderRequest, user=Depends(require_support_admin)):
    for i, cid in enumerate(data.ordered_ids):
        await db.tutorial_categories.update_one({"id": cid}, {"$set": {"sort_order": i}})
    return {"message": "Categorias reordenadas"}


# ═══════════════════════════════════════════════════════════
# SUBCATEGORIES
# ═══════════════════════════════════════════════════════════

@router.post("/academia/categories/{cat_id}/subcategories")
async def create_subcategory(cat_id: str, data: SubcategoryCreate, user=Depends(require_support_admin)):
    cat = await db.tutorial_categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Categoria no encontrada")
    now = datetime.now(timezone.utc).isoformat()
    sort_order = await get_next_sort_order("tutorial_subcategories", {"category_id": cat_id})
    sub = {
        "id": str(uuid.uuid4()),
        "category_id": cat_id,
        "name": data.name,
        "sort_order": sort_order,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.tutorial_subcategories.insert_one(sub)
    sub.pop("_id", None)
    return sub

@router.put("/academia/subcategories/{sub_id}")
async def update_subcategory(sub_id: str, data: SubcategoryUpdate, user=Depends(require_support_admin)):
    sub = await db.tutorial_subcategories.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Subcategoria no encontrada")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tutorial_subcategories.update_one({"id": sub_id}, {"$set": updates})
    return {**sub, **updates}

@router.delete("/academia/subcategories/{sub_id}")
async def delete_subcategory(sub_id: str, user=Depends(require_support_admin)):
    video_count = await db.tutorial_videos.count_documents({"subcategory_id": sub_id})
    if video_count > 0:
        raise HTTPException(409, f"Esta subcategoria tiene {video_count} video(s). Muevelos antes de eliminar.")
    await db.tutorial_subcategories.delete_one({"id": sub_id})
    return {"message": "Subcategoria eliminada"}


# ═══════════════════════════════════════════════════════════
# VIDEOS
# ═══════════════════════════════════════════════════════════

@router.get("/academia/videos")
async def get_videos(
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    is_published: Optional[bool] = None,
    search: Optional[str] = None,
    user=Depends(require_support_admin),
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if subcategory_id:
        query["subcategory_id"] = subcategory_id
    if is_published is not None:
        query["is_published"] = is_published
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
        ]
    videos = await db.tutorial_videos.find(query, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return videos

@router.get("/academia/videos/{video_id}")
async def get_video(video_id: str, user=Depends(require_support_admin)):
    video = await db.tutorial_videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(404, "Video no encontrado")
    return video

@router.post("/academia/videos")
async def create_video(data: VideoCreate, user=Depends(require_support_admin)):
    platform = data.platform or detect_platform(data.youtube_url) or "youtube"
    if platform == "vimeo":
        video_id = extract_vimeo_id(data.youtube_url)
        if not video_id:
            raise HTTPException(400, "URL de Vimeo no valida")
        thumbnail = get_vimeo_thumbnail_url(video_id)
    else:
        video_id = extract_youtube_id(data.youtube_url)
        if not video_id:
            raise HTTPException(400, "URL de YouTube no valida")
        thumbnail = get_thumbnail_url(video_id)
    dup = await db.tutorial_videos.find_one(
        {"youtube_video_id": video_id, "category_id": data.category_id}, {"_id": 0}
    )
    if dup:
        raise HTTPException(409, "Este video ya existe en esta categoria")
    cat = await db.tutorial_categories.find_one({"id": data.category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Categoria no encontrada")
    now = datetime.now(timezone.utc).isoformat()
    filter_q = {"category_id": data.category_id}
    if data.subcategory_id:
        filter_q["subcategory_id"] = data.subcategory_id
    sort_order = await get_next_sort_order("tutorial_videos", filter_q)
    video = {
        "id": str(uuid.uuid4()),
        "category_id": data.category_id,
        "subcategory_id": data.subcategory_id,
        "title": data.title,
        "description": data.description,
        "youtube_url": data.youtube_url,
        "youtube_video_id": video_id,
        "thumbnail_url": thumbnail,
        "platform": platform,
        "duration": data.duration,
        "sort_order": sort_order,
        "is_published": data.is_published,
        "created_at": now,
        "updated_at": now,
    }
    await db.tutorial_videos.insert_one(video)
    video.pop("_id", None)
    return video

@router.put("/academia/videos/{video_id}")
async def update_video(video_id: str, data: VideoUpdate, user=Depends(require_support_admin)):
    video = await db.tutorial_videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(404, "Video no encontrado")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if "youtube_url" in updates:
        platform = updates.get("platform") or detect_platform(updates["youtube_url"]) or video.get("platform", "youtube")
        if platform == "vimeo":
            vid = extract_vimeo_id(updates["youtube_url"])
            if not vid:
                raise HTTPException(400, "URL de Vimeo no valida")
            updates["youtube_video_id"] = vid
            updates["thumbnail_url"] = get_vimeo_thumbnail_url(vid)
        else:
            vid = extract_youtube_id(updates["youtube_url"])
            if not vid:
                raise HTTPException(400, "URL de YouTube no valida")
            updates["youtube_video_id"] = vid
            updates["thumbnail_url"] = get_thumbnail_url(vid)
        updates["platform"] = platform
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tutorial_videos.update_one({"id": video_id}, {"$set": updates})
    return {**video, **updates}

@router.delete("/academia/videos/{video_id}")
async def delete_video(video_id: str, user=Depends(require_support_admin)):
    result = await db.tutorial_videos.delete_one({"id": video_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Video no encontrado")
    return {"message": "Video eliminado"}

@router.put("/academia/videos/reorder")
async def reorder_videos(data: ReorderRequest, user=Depends(require_support_admin)):
    for i, vid in enumerate(data.ordered_ids):
        await db.tutorial_videos.update_one({"id": vid}, {"$set": {"sort_order": i}})
    return {"message": "Videos reordenados"}

@router.patch("/academia/videos/{video_id}/publish")
async def toggle_publish(video_id: str, user=Depends(require_support_admin)):
    video = await db.tutorial_videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(404, "Video no encontrado")
    new_state = not video.get("is_published", False)
    await db.tutorial_videos.update_one(
        {"id": video_id},
        {"$set": {"is_published": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"is_published": new_state}


# ═══════════════════════════════════════════════════════════
# YOUTUBE EXTRACT
# ═══════════════════════════════════════════════════════════

@router.post("/academia/youtube/extract")
async def extract_video_info(data: YouTubeExtractRequest, user=Depends(require_support_admin)):
    platform = detect_platform(data.url)

    if platform == "vimeo":
        vimeo_id = extract_vimeo_id(data.url)
        title = ""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"https://vimeo.com/api/oembed.json?url=https://vimeo.com/{vimeo_id}")
                if resp.status_code == 200:
                    title = resp.json().get("title", "")
        except Exception:
            pass
        return {
            "is_valid": True,
            "platform": "vimeo",
            "youtube_video_id": vimeo_id,
            "thumbnail_url": get_vimeo_thumbnail_url(vimeo_id),
            "title": title,
        }

    yt_id = extract_youtube_id(data.url)
    if not yt_id:
        return {"is_valid": False, "error": "URL no valida. Use una URL de YouTube o Vimeo."}
    title = ""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={yt_id}&format=json")
            if resp.status_code == 200:
                title = resp.json().get("title", "")
    except Exception:
        pass
    return {
        "is_valid": True,
        "platform": "youtube",
        "youtube_video_id": yt_id,
        "thumbnail_url": get_thumbnail_url(yt_id),
        "title": title,
    }


# ═══════════════════════════════════════════════════════════
# SEED
# ═══════════════════════════════════════════════════════════

async def seed_academia_categories():
    count = await db.tutorial_categories.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    categories = [
        {"name": "Primeros pasos", "description": "Configuracion inicial de la plataforma", "subs": ["Registro inicial", "Configuracion"]},
        {"name": "Gestion de alumnos", "description": "Matricula y datos de alumnos", "subs": ["Matricula", "Datos del alumno"]},
        {"name": "Contabilidad y pagos", "description": "Pensiones y configuracion financiera", "subs": ["Pensiones", "Configuracion financiera"]},
        {"name": "Notas y asistencia", "description": "Registro de notas y control de asistencia", "subs": ["Registro de notas", "Control de asistencia"]},
        {"name": "Gestion de docentes", "description": "Asignacion y gestion de profesores", "subs": []},
        {"name": "Reportes y estadisticas", "description": "Generacion de reportes del colegio", "subs": []},
    ]
    for i, cat_data in enumerate(categories):
        cat_id = str(uuid.uuid4())
        await db.tutorial_categories.insert_one({
            "id": cat_id, "name": cat_data["name"], "description": cat_data["description"],
            "icon": None, "sort_order": i, "is_active": True, "created_at": now, "updated_at": now,
        })
        for j, sub_name in enumerate(cat_data["subs"]):
            await db.tutorial_subcategories.insert_one({
                "id": str(uuid.uuid4()), "category_id": cat_id, "name": sub_name,
                "sort_order": j, "is_active": True, "created_at": now, "updated_at": now,
            })
    logger.info("[SEED] Created default academia categories")



# ═══════════════════════════════════════════════════════════
# PORTAL ENDPOINTS (Read-only — for school users)
# ═══════════════════════════════════════════════════════════

PORTAL_ROLES = ["owner", "admin", "director", "coordinator", "teacher"]

async def require_portal_user(current_user=Depends(get_current_user)):
    role = current_user.get("role", "")
    if current_user.get("is_owner") or current_user.get("is_super_admin"):
        return current_user
    if role in PORTAL_ROLES:
        return current_user
    raise HTTPException(403, "No tienes acceso a esta seccion")


@router.get("/academia/portal/stats")
async def portal_stats(user=Depends(require_portal_user)):
    total_videos = await db.tutorial_videos.count_documents({"is_published": True})
    # Only count active categories that have at least one published video
    cats = await db.tutorial_categories.find({"is_active": True}, {"_id": 0, "id": 1}).to_list(200)
    active_cats = 0
    for cat in cats:
        vc = await db.tutorial_videos.count_documents({"category_id": cat["id"], "is_published": True})
        if vc > 0:
            active_cats += 1
    return {"total_videos": total_videos, "total_categories": active_cats}


@router.get("/academia/portal/categories")
async def portal_categories(user=Depends(require_portal_user)):
    cats = await db.tutorial_categories.find(
        {"is_active": True}, {"_id": 0}
    ).sort("sort_order", 1).to_list(200)

    result = []
    for cat in cats:
        video_count = await db.tutorial_videos.count_documents({"category_id": cat["id"], "is_published": True})
        if video_count == 0:
            continue
        subs = await db.tutorial_subcategories.find(
            {"category_id": cat["id"], "is_active": True}, {"_id": 0}
        ).sort("sort_order", 1).to_list(100)
        filtered_subs = []
        for sub in subs:
            svc = await db.tutorial_videos.count_documents({"subcategory_id": sub["id"], "is_published": True})
            if svc > 0:
                filtered_subs.append({
                    "id": sub["id"], "name": sub["name"], "video_count": svc
                })
        result.append({
            "id": cat["id"], "name": cat["name"], "icon": cat.get("icon"),
            "sort_order": cat.get("sort_order", 0), "video_count": video_count,
            "subcategories": filtered_subs,
        })
    return result


@router.get("/academia/portal/videos")
async def portal_videos(
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(require_portal_user),
):
    query = {"is_published": True}
    if category_id:
        query["category_id"] = category_id
    if subcategory_id:
        query["subcategory_id"] = subcategory_id

    if search:
        # Build search across titles + descriptions
        search_conditions = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
        # Also search by category/subcategory names
        matching_cats = await db.tutorial_categories.find(
            {"name": {"$regex": search, "$options": "i"}, "is_active": True}, {"_id": 0, "id": 1}
        ).to_list(50)
        matching_subs = await db.tutorial_subcategories.find(
            {"name": {"$regex": search, "$options": "i"}, "is_active": True}, {"_id": 0, "id": 1}
        ).to_list(50)
        if matching_cats:
            search_conditions.append({"category_id": {"$in": [c["id"] for c in matching_cats]}})
        if matching_subs:
            search_conditions.append({"subcategory_id": {"$in": [s["id"] for s in matching_subs]}})
        # Override category filter when searching
        query.pop("category_id", None)
        query.pop("subcategory_id", None)
        query["$or"] = search_conditions

    videos = await db.tutorial_videos.find(query, {"_id": 0}).sort("sort_order", 1).to_list(500)

    # Enrich with category/subcategory names
    cat_cache = {}
    sub_cache = {}
    for v in videos:
        cid = v.get("category_id")
        if cid and cid not in cat_cache:
            c = await db.tutorial_categories.find_one({"id": cid}, {"_id": 0, "name": 1})
            cat_cache[cid] = c["name"] if c else ""
        sid = v.get("subcategory_id")
        if sid and sid not in sub_cache:
            s = await db.tutorial_subcategories.find_one({"id": sid}, {"_id": 0, "name": 1})
            sub_cache[sid] = s["name"] if s else ""
        v["category_name"] = cat_cache.get(cid, "")
        v["subcategory_name"] = sub_cache.get(sid, "")
    return videos


@router.get("/academia/portal/videos/{video_id}")
async def portal_video_detail(video_id: str, user=Depends(require_portal_user)):
    video = await db.tutorial_videos.find_one({"id": video_id, "is_published": True}, {"_id": 0})
    if not video:
        raise HTTPException(404, "Video no encontrado")
    if video.get("category_id"):
        cat = await db.tutorial_categories.find_one({"id": video["category_id"]}, {"_id": 0, "name": 1})
        video["category_name"] = cat["name"] if cat else ""
    if video.get("subcategory_id"):
        sub = await db.tutorial_subcategories.find_one({"id": video["subcategory_id"]}, {"_id": 0, "name": 1})
        video["subcategory_name"] = sub["name"] if sub else ""
    return video
