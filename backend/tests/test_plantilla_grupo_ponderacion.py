"""
Regression for the Registro Auxiliar template weighting modes:
- modo 'criterio' (legacy): each criterio carries its own porcentaje.
- modo 'grupo' (new): criterios + columnas finales are bundled into grupos,
  each grupo carries a shared porcentaje; grupo value = simple mean of members.
"""
from routes.grades import calculate_final_grade_from_template


def _base_grade():
    return {"grades_dynamic": {"s1": 10, "s2": 20, "s3": 18, "f1": 16}}


CRITERIOS = [
    {"id": "A", "nombre": "A", "porcentaje": 60, "subcolumnas": [
        {"id": "s1", "tipo": "input"}, {"id": "s2", "tipo": "input"},
        {"id": "pa", "tipo": "promedio_auto"},
    ]},
    {"id": "B", "nombre": "B", "porcentaje": 40, "subcolumnas": [
        {"id": "s3", "tipo": "input"}, {"id": "pb", "tipo": "promedio_auto"},
    ]},
]
COLUMNAS_FINALES = [{"id": "f1", "label": "EXAMEN", "porcentaje": 0}]


def test_criterio_mode_unchanged():
    tpl = {"modo_ponderacion": "criterio", "criterios": CRITERIOS,
           "columnas_finales": COLUMNAS_FINALES}
    # A avg=(10+20)/2=15, B avg=18 -> 15*0.6 + 18*0.4 = 16.2
    assert calculate_final_grade_from_template(_base_grade(), tpl) == 16.2


def test_criterio_mode_default_when_no_modo():
    tpl = {"criterios": CRITERIOS, "columnas_finales": COLUMNAS_FINALES}
    assert calculate_final_grade_from_template(_base_grade(), tpl) == 16.2


def test_grupo_mode_criterios_and_columna_final():
    tpl = {
        "modo_ponderacion": "grupo",
        "criterios": CRITERIOS,
        "columnas_finales": COLUMNAS_FINALES,
        "grupos": [
            {"id": "g1", "nombre": "G1", "porcentaje": 50, "miembro_ids": ["A", "B"]},
            {"id": "g2", "nombre": "G2", "porcentaje": 50, "miembro_ids": ["f1"]},
        ],
    }
    # G1 = mean(A=15, B=18) = 16.5 ; G2 = mean(f1=16) = 16
    # final = 16.5*0.5 + 16*0.5 = 16.25 -> round(,1)
    expected = round(16.5 * 0.5 + 16 * 0.5, 1)
    assert calculate_final_grade_from_template(_base_grade(), tpl) == expected


def test_grupo_mode_partial_normalizes():
    # Only G1 has data; G2 member has no value -> normalize to G1's avg
    grade = {"grades_dynamic": {"s1": 10, "s2": 20, "s3": 18}}  # no f1
    tpl = {
        "modo_ponderacion": "grupo",
        "criterios": CRITERIOS,
        "columnas_finales": COLUMNAS_FINALES,
        "grupos": [
            {"id": "g1", "nombre": "G1", "porcentaje": 50, "miembro_ids": ["A", "B"]},
            {"id": "g2", "nombre": "G2", "porcentaje": 50, "miembro_ids": ["f1"]},
        ],
    }
    # Only G1 contributes (weight 0.5 < 0.999) -> normalized to 16.5
    assert calculate_final_grade_from_template(grade, tpl) == 16.5


def test_grupo_mode_falls_back_to_criterio_when_no_grupos():
    tpl = {"modo_ponderacion": "grupo", "criterios": CRITERIOS,
           "columnas_finales": COLUMNAS_FINALES, "grupos": []}
    assert calculate_final_grade_from_template(_base_grade(), tpl) == 16.2


if __name__ == "__main__":
    test_criterio_mode_unchanged()
    test_criterio_mode_default_when_no_modo()
    test_grupo_mode_criterios_and_columna_final()
    test_grupo_mode_partial_normalizes()
    test_grupo_mode_falls_back_to_criterio_when_no_grupos()
    print("PASS: all weighting-mode tests")
