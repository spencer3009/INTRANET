# -*- coding: utf-8 -*-
"""
Helper de formateo "4TO AÑO A SECUNDARIA" para la cabecera de la libreta.

Inputs:
    grade_doc   = { nombre: "4°" | "1°" | "5 años" | ... , ... }
    section_doc = { nombre: "A" | "B" | ... , ... }
    level_doc   = { nombre: "Secundaria" | "Primaria" | "Inicial" }

Salida (uppercase, sin acentos en la palabra "AÑO"/"GRADO"/"AÑOS" — sí en el
nivel "SECUNDARIA"):
    Secundaria   → "{ORDINAL} AÑO {SECCION} SECUNDARIA"     e.g. "4TO AÑO A SECUNDARIA"
    Primaria     → "{ORDINAL} GRADO {SECCION} PRIMARIA"     e.g. "6TO GRADO A PRIMARIA"
    Inicial      → "{N} AÑOS {SECCION} INICIAL"             e.g. "5 AÑOS A INICIAL"
                  (cuando grade.nombre = "3 años"/"4 años"/"5 años")
    Otro / fallback → "{grade_nombre} {section_nombre} {level_nombre}".upper()
"""
import re
from typing import Optional


ORDINALES_ES = {1: "1ER", 2: "2DO", 3: "3ER", 4: "4TO", 5: "5TO", 6: "6TO"}


def _parse_grade_number(nombre: str) -> Optional[int]:
    """Extrae el número del grado ("4°" → 4, "1ro" → 1, "3" → 3)."""
    if not nombre:
        return None
    m = re.search(r"(\d+)", nombre)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _normalize_level(level_nombre: str) -> str:
    """'Secundaria' → 'secundaria' (sin acentos)."""
    return (level_nombre or "").strip().lower()


def format_section_libreta(
    grade_doc: Optional[dict],
    section_doc: Optional[dict],
    level_doc: Optional[dict],
) -> str:
    """Devuelve el display string para la cabecera de la libreta."""
    g_nombre = (grade_doc or {}).get("nombre", "") or ""
    s_nombre = (section_doc or {}).get("nombre", "") or ""
    l_nombre = (level_doc or {}).get("nombre", "") or ""

    level_key = _normalize_level(l_nombre)
    section_letter = s_nombre.strip().upper()

    # Caso INICIAL: el grade.nombre es "3 años" / "4 años" / "5 años"
    if "inicial" in level_key:
        n = _parse_grade_number(g_nombre)
        if n is not None:
            return f"{n} AÑOS {section_letter} INICIAL".strip()
        return f"{g_nombre.upper()} {section_letter} INICIAL".strip()

    # Caso SECUNDARIA / PRIMARIA: usar ordinales
    n = _parse_grade_number(g_nombre)
    if "secundaria" in level_key and n in ORDINALES_ES:
        return f"{ORDINALES_ES[n]} AÑO {section_letter} SECUNDARIA".strip()
    if "primaria" in level_key and n in ORDINALES_ES:
        return f"{ORDINALES_ES[n]} GRADO {section_letter} PRIMARIA".strip()

    # Fallback genérico (otros niveles o nº fuera de 1-6)
    return f"{g_nombre} {section_letter} {l_nombre}".strip().upper()
