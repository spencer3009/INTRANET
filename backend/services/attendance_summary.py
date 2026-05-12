# -*- coding: utf-8 -*-
"""
Resumen de asistencia por bimestre (período académico).

Colecciones consultadas:
    `attendances` con `type: "student"` (102 docs de muestra en preview).
    Schema:
        { school_id, type, user_id (=student_id), date (str YYYY-MM-DD),
          status: "present"|"absent"|"late"|"justified"|"anulado"|"entrada_anulada",
          ... }

Estado → bucket de la libreta:
    "present"   → presente
    "late"      → tardanza
    "absent"    → falta
    "justified" → justificada
    (otros → ignorados)
"""
from typing import Dict, Optional


def _normalize_date(d) -> Optional[str]:
    """Devuelve 'YYYY-MM-DD' a partir de string, datetime o date."""
    if d is None:
        return None
    if hasattr(d, "isoformat"):
        try:
            return d.isoformat()[:10]
        except Exception:
            pass
    s = str(d)
    return s[:10] if len(s) >= 10 else s


async def summary_by_period(
    db,
    school_id: str,
    student_id: str,
    period_id: str,
) -> Dict[str, int]:
    """Devuelve {presente, tardanza, falta, justificada} para el período.

    Si el período no existe o no tiene fechas, devuelve todos en 0.
    Si no hay asistencias registradas, devuelve todos en 0.
    """
    zero = {"presente": 0, "tardanza": 0, "falta": 0, "justificada": 0}

    period = await db.academic_periods.find_one(
        {"id": period_id, "school_id": school_id},
        {"_id": 0, "fecha_inicio": 1, "fecha_fin": 1},
    )
    if not period:
        return zero
    f_ini = _normalize_date(period.get("fecha_inicio"))
    f_fin = _normalize_date(period.get("fecha_fin"))
    if not f_ini or not f_fin:
        return zero

    docs = await db.attendances.find(
        {
            "school_id": school_id,
            "type": "student",
            "user_id": student_id,
            "date": {"$gte": f_ini, "$lte": f_fin},
        },
        {"_id": 0, "status": 1},
    ).to_list(2000)

    out = dict(zero)
    for d in docs:
        status = (d.get("status") or "").lower()
        if status == "present":
            out["presente"] += 1
        elif status == "late":
            out["tardanza"] += 1
        elif status == "absent":
            out["falta"] += 1
        elif status == "justified":
            out["justificada"] += 1
        # "anulado" / "entrada_anulada" se ignoran
    return out
