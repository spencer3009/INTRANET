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
