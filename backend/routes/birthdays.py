"""
Birthdays API — Student (active enrollment only) + Teacher birthdays for:
  * /calendar  → list of birthdays to paint on the Actividades calendar
  * /today     → ordered list of today's birthdays for the welcome popup

Parents and any other role are intentionally excluded.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, List, Dict, Any
import logging

from .core import db, get_current_user, resolve_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/birthdays", tags=["birthdays"])


# Peru local timezone — "today" should match Peru's local date, not UTC.
PERU_TZ = timezone(timedelta(hours=-5))


def _parse_birthday(raw) -> Optional[Tuple[int, int, int]]:
    """Parse a birthday field (various historical formats) into (year, month, day).

    Accepts ISO ("2010-06-15", "2010-06-15T00:00:00Z"), dd/mm/yyyy,
    yyyy/mm/dd, and naive date strings. Returns None when invalid.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    # Normalize common variants
    if "T" in s:
        s = s.split("T", 1)[0]
    if " " in s:
        s = s.split(" ", 1)[0]

    # yyyy-mm-dd
    if "-" in s:
        try:
            parts = s.split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                if 1 <= m <= 12 and 1 <= d <= 31:
                    return y, m, d
        except (ValueError, TypeError):
            pass

    # dd/mm/yyyy  OR  yyyy/mm/dd
    if "/" in s:
        try:
            parts = s.split("/")
            if len(parts) == 3:
                if len(parts[2]) == 4:
                    d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                elif len(parts[0]) == 4:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                else:
                    return None
                if 1 <= m <= 12 and 1 <= d <= 31:
                    return y, m, d
        except (ValueError, TypeError):
            pass

    return None


async def _current_academic_year(school_id: str) -> str:
    """Return the active academic year as a string (for comparison with
    `anio_escolar` which is historically stored as a string). Falls back to
    the current calendar year when no active year is configured."""
    doc = await db.academic_years.find_one(
        {"school_id": school_id, "is_active": True},
        {"_id": 0, "year": 1},
    )
    if doc and doc.get("year"):
        return str(doc["year"])
    return str(datetime.now(PERU_TZ).year)


async def _get_birthday_people(school_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (students, teachers) each as a list of raw user dicts with a
    `person_type` field attached. Students are filtered by active enrollment
    in the current school_year. Teachers include role 'teacher' OR anyone
    with 'teacher' in additional_roles. Parents are never included.
    """
    active_year = await _current_academic_year(school_id)

    # Students: active enrollment, not deleted, and (if anio_escolar is set)
    # it must match the current school year. Legacy docs without the field
    # are also considered active to avoid excluding everyone after a migration.
    student_query = {
        "school_id": school_id,
        "role": {"$in": ["student", "estudiante"]},
        "enrollment_status": {"$in": ["active", None]},
        "student_status": {"$nin": ["deleted", "inactive"]},
        "birthday": {"$exists": True, "$nin": [None, ""]},
        "$or": [
            {"anio_escolar": active_year},
            {"anio_escolar": {"$exists": False}},
            {"anio_escolar": None},
            {"anio_escolar": ""},
        ],
    }
    students_cursor = db.users.find(
        student_query,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "birthday": 1, "photo_url": 1},
    )
    students = await students_cursor.to_list(length=None)
    for s in students:
        s["person_type"] = "student"

    # Teachers: primary role OR additional role
    teacher_query = {
        "school_id": school_id,
        "$or": [
            {"role": {"$in": ["teacher", "profesor"]}},
            {"additional_roles": {"$in": ["teacher", "profesor"]}},
        ],
        "birthday": {"$exists": True, "$nin": [None, ""]},
    }
    teachers_cursor = db.users.find(
        teacher_query,
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "birthday": 1, "photo_url": 1},
    )
    teachers = await teachers_cursor.to_list(length=None)
    for t in teachers:
        t["person_type"] = "teacher"

    return students, teachers


def _format_entry(person: Dict[str, Any], current_year: int) -> Optional[Dict[str, Any]]:
    parsed = _parse_birthday(person.get("birthday"))
    if not parsed:
        return None
    birth_year, m, d = parsed
    full_name = f"{(person.get('name') or '').strip()} {(person.get('last_name') or '').strip()}".strip()
    return {
        "id": f"{person['person_type']}_{person.get('id', '')}",
        "type": "birthday",
        "person_type": person["person_type"],
        "name": full_name or "—",
        "avatar_url": person.get("photo_url"),
        "birth_date": f"{birth_year:04d}-{m:02d}-{d:02d}",
        "calendar_date": f"{current_year:04d}-{m:02d}-{d:02d}",
        "day": d,
        "month": m,
    }


def _sort_key(person: Dict[str, Any]) -> str:
    return f"{(person.get('name') or '').strip()} {(person.get('last_name') or '').strip()}".strip().lower()


@router.get("/calendar")
async def birthdays_calendar(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1900, le=2100),
    from_day: Optional[int] = Query(None, ge=1, le=31, description="Return only birthdays on/after this day within the given month"),
    current_user=Depends(get_current_user),
):
    """List of birthday events to overlay on the Actividades calendar.

    Each event is projected onto `year` (defaults to current calendar year).
    Optional `month` further restricts the response to a single month.
    Optional `from_day` (requires `month`) returns only birthdays whose day
    is >= from_day within that month — useful for "remaining this month"
    widgets on dashboards.
    Parents are never included.
    """
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]
    current_year = year or datetime.now(PERU_TZ).year

    students, teachers = await _get_birthday_people(school_id)
    result: List[Dict[str, Any]] = []
    for person in students + teachers:
        entry = _format_entry(person, current_year)
        if not entry:
            continue
        if month is not None and entry["month"] != month:
            continue
        if from_day is not None and entry["month"] == month and entry["day"] < from_day:
            continue
        result.append(entry)
    return result


@router.get("/today")
async def birthdays_today(current_user=Depends(get_current_user)):
    """Ordered list of today's birthdays (students alphabetical first, then
    teachers alphabetical). Returns [] when nobody is celebrating today."""
    user = await resolve_user_from_token(current_user)
    if not user or not user.get("school_id"):
        raise HTTPException(status_code=403, detail="No tienes un colegio asociado")

    school_id = user["school_id"]
    now_local = datetime.now(PERU_TZ)
    today_m, today_d = now_local.month, now_local.day
    current_year = now_local.year

    students, teachers = await _get_birthday_people(school_id)

    def is_today(person):
        p = _parse_birthday(person.get("birthday"))
        return bool(p and p[1] == today_m and p[2] == today_d)

    today_students = sorted([p for p in students if is_today(p)], key=_sort_key)
    today_teachers = sorted([p for p in teachers if is_today(p)], key=_sort_key)

    result: List[Dict[str, Any]] = []
    for p in today_students + today_teachers:
        entry = _format_entry(p, current_year)
        if entry:
            result.append(entry)
    return result
