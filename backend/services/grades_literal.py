# -*- coding: utf-8 -*-
"""
Conversión nota numérica (0-20) → letra literal MINEDU.

Escala oficial (Perú):
    0 – 10   → C   (desaprobado)
    11 – 13  → B
    14 – 17  → A
    18 – 20  → AD

Regla de redondeo: 0.5 redondea HACIA ARRIBA (round half up, MINEDU).
Orden de operaciones: SIEMPRE promediar valores numéricos primero y luego
convertir el promedio a letra; nunca promediar letras.
"""
import math
from typing import Iterable, Optional, Union

Number = Union[int, float]


def round_half_up(n: Number) -> int:
    """Redondea 0.5 hacia arriba (ej. 13.5 → 14, no 14 hacia par)."""
    return int(math.floor(float(n) + 0.5))


def numerica_a_letra(value: Optional[Number]) -> Optional[str]:
    """Convierte una nota numérica al literal MINEDU.

    Devuelve None si la entrada es None/NaN.
    """
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(num):
        return None
    rounded = round_half_up(num)
    if rounded <= 10:
        return "C"
    if rounded <= 13:
        return "B"
    if rounded <= 17:
        return "A"
    return "AD"


# Escala MINEDU por defecto como lista de rangos (para el editor por colegio).
DEFAULT_MINEDU_SCALE = [
    {"letter": "AD", "min": 18, "max": 20},
    {"letter": "A", "min": 14, "max": 17},
    {"letter": "B", "min": 11, "max": 13},
    {"letter": "C", "min": 0, "max": 10},
]


def normalizar_escala(scale) -> Optional[list]:
    """Valida y normaliza una escala personalizada (lista de {letter,min,max}).

    Reglas: enteros 0-20, min<=max, cobertura contigua y completa de 0..20 sin
    huecos ni solapamientos. Devuelve la lista ordenada (min asc) o None si es
    inválida (en cuyo caso el llamador debe usar la escala por defecto).
    """
    if not isinstance(scale, list) or not scale:
        return None
    rows = []
    for r in scale:
        if not isinstance(r, dict):
            return None
        letter = str(r.get("letter", "")).strip()
        if not letter:
            return None
        try:
            lo = int(r.get("min"))
            hi = int(r.get("max"))
        except (TypeError, ValueError):
            return None
        if lo < 0 or hi > 20 or lo > hi:
            return None
        rows.append({"letter": letter, "min": lo, "max": hi})
    rows.sort(key=lambda x: x["min"])
    # Cobertura contigua y completa 0..20
    if rows[0]["min"] != 0 or rows[-1]["max"] != 20:
        return None
    for i in range(1, len(rows)):
        if rows[i]["min"] != rows[i - 1]["max"] + 1:
            return None
    return rows


def numerica_a_letra_escala(value: Optional[Number], scale) -> Optional[str]:
    """Convierte una nota numérica a letra usando una escala personalizada.

    Si la escala es inválida/None, cae a la escala MINEDU por defecto.
    """
    norm = normalizar_escala(scale)
    if norm is None:
        return numerica_a_letra(value)
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(num):
        return None
    rounded = round_half_up(num)
    for r in norm:
        if r["min"] <= rounded <= r["max"]:
            return r["letter"]
    # Por seguridad: si quedara fuera de rango, usa el extremo más cercano.
    if rounded < norm[0]["min"]:
        return norm[0]["letter"]
    return norm[-1]["letter"]


def promedio_numerico(values: Iterable[Optional[Number]]) -> Optional[float]:
    """Promedio de notas numéricas (ignora None/NaN). 2 decimales.

    Devuelve None si no hay ningún valor válido.
    """
    nums = []
    for v in values:
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if math.isnan(f):
            continue
        nums.append(f)
    if not nums:
        return None
    return round(sum(nums) / len(nums), 2)


def promedio_letra(values: Iterable[Optional[Number]]) -> Optional[str]:
    """Atajo: promedia números y devuelve la letra MINEDU del resultado."""
    avg = promedio_numerico(values)
    return numerica_a_letra(avg)
