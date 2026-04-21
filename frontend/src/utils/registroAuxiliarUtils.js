/**
 * registroAuxiliarUtils.js — Utilidades para el Registro Auxiliar Dinámico (Fase 4)
 *
 * Pool de field keys compatibles con GRADE_SUB_FIELDS del backend (routes/grades.py).
 * NO modificar sin sincronizar con el backend.
 */

export const GRADE_FIELD_POOL = [
  "act_co", "act_re",
  "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
  "comp_c1", "comp_c2",
  "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
  "exam_mensual", "exam_bimestral",
];

/**
 * Plantilla fallback que replica la estructura hardcodeada original.
 * Usada cuando no hay plantilla activa en el colegio.
 * Los field_key de cada subcolumna coinciden con GRADE_SUB_FIELDS.
 */
export const PLANTILLA_SISTEMA_FALLBACK = {
  id: "fallback_local",
  nombre: "Plantilla por defecto",
  es_sistema: true,
  criterios: [
    {
      id: "actitudinal", nombre: "ACTITUDINAL", porcentaje: 10, color: "#FFD700", orden: 0,
      subcolumnas: [
        { id: "act_co", label: "CO", tipo: "input", orden: 0, field_key: "act_co" },
        { id: "act_re", label: "RE", tipo: "input", orden: 1, field_key: "act_re" },
        { id: "p_actitudinal", label: "PROMEDIO", tipo: "promedio_auto", orden: 2 },
      ],
    },
    {
      id: "rev_fichas", nombre: "REVISION FICHAS", porcentaje: 25, color: "#FFD700", orden: 1,
      subcolumnas: [
        { id: "rf_r1", label: "R1", tipo: "input", orden: 0, field_key: "rf_r1" },
        { id: "rf_r2", label: "R2", tipo: "input", orden: 1, field_key: "rf_r2" },
        { id: "rf_r3", label: "R3", tipo: "input", orden: 2, field_key: "rf_r3" },
        { id: "rf_r4", label: "R4", tipo: "input", orden: 3, field_key: "rf_r4" },
        { id: "rf_r5", label: "R5", tipo: "input", orden: 4, field_key: "rf_r5" },
        { id: "p_rev_fichas", label: "PROMEDIO", tipo: "promedio_auto", orden: 5 },
      ],
    },
    {
      id: "competencia", nombre: "COMPETENCIA", porcentaje: 5, color: "#FFD700", orden: 2,
      subcolumnas: [
        { id: "comp_c1", label: "C1", tipo: "input", orden: 0, field_key: "comp_c1" },
        { id: "comp_c2", label: "C2", tipo: "input", orden: 1, field_key: "comp_c2" },
        { id: "p_competencia", label: "PROMEDIO", tipo: "promedio_auto", orden: 2 },
      ],
    },
    {
      id: "participaciones", nombre: "PARTICIPACIONES", porcentaje: 25, color: "#FFD700", orden: 3,
      subcolumnas: [
        { id: "part_p1", label: "P1", tipo: "input", orden: 0, field_key: "part_p1" },
        { id: "part_p2", label: "P2", tipo: "input", orden: 1, field_key: "part_p2" },
        { id: "part_p3", label: "P3", tipo: "input", orden: 2, field_key: "part_p3" },
        { id: "part_exp", label: "EXP", tipo: "input", orden: 3, field_key: "part_exp" },
        { id: "part_tg", label: "TG", tipo: "input", orden: 4, field_key: "part_tg" },
        { id: "part_p", label: "P", tipo: "input", orden: 5, field_key: "part_p" },
        { id: "p_participaciones", label: "PROMEDIO", tipo: "promedio_auto", orden: 6 },
      ],
    },
  ],
  columnas_finales: [
    { id: "exam_mensual", label: "EXAMEN MENSUAL", label_corto: "EM", porcentaje: 15, orden: 0, field_key: "exam_mensual" },
    { id: "exam_bimestral", label: "EXAMEN BIMESTRAL", label_corto: "EB", porcentaje: 20, orden: 1, field_key: "exam_bimestral" },
  ],
  label_promedio_final: "PROM. BIMESTRAL",
  escala_minima: 0,
  escala_maxima: 20,
};

/**
 * Read a grade cell value for a student given the subcolumna definition.
 *
 * Priority:
 *   1. `student[sub.field_key]` — legacy static field (CO/RE/R1/…)
 *      for subcolumnas that were mapped to a fixed slot in
 *      `GRADE_SUB_FIELDS`.
 *   2. `student.grades_dynamic[sub.id]` — Phase 5 dynamic storage,
 *      used by any subcolumna of a custom template (UUID-style ids
 *      with no `field_key`).
 *
 * Returns `undefined` when neither path has a value, so the caller
 * can coerce to "" for inputs.
 */
export function getGradeValue(student, sub) {
  if (!student || !sub) return undefined;
  if (sub.field_key && student[sub.field_key] !== undefined && student[sub.field_key] !== null) {
    return student[sub.field_key];
  }
  return student.grades_dynamic?.[sub.id];
}

/** Promedio de valores no-null. Retorna null si todos son null/undefined/"". */
export function calcularPromedioInput(values) {
  const nums = values.filter(v => v !== null && v !== undefined && v !== "");
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + Number(b), 0) / nums.length) * 10) / 10;
}

/** Verifica si un valor esta fuera del rango permitido. */
export function valorFueraDeRango(val, min = 0, max = 20) {
  if (val === null || val === undefined || val === "") return false;
  const n = Number(val);
  return isNaN(n) || n < min || n > max;
}

/**
 * Asigna field_keys del GRADE_FIELD_POOL a subcolumnas de tipo "input"
 * y a columnas_finales que aun no tengan field_key.
 * Retorna una copia profunda con los field_keys asignados.
 */
export function assignFieldKeys(plantilla) {
  const p = JSON.parse(JSON.stringify(plantilla));

  const hasFieldKeys = p.criterios.some(c =>
    c.subcolumnas.some(s => s.tipo === "input" && s.field_key)
  );
  if (hasFieldKeys) return p;

  let poolIdx = 0;
  for (const criterio of p.criterios) {
    for (const sub of criterio.subcolumnas) {
      if (sub.tipo === "input" && poolIdx < GRADE_FIELD_POOL.length) {
        sub.field_key = GRADE_FIELD_POOL[poolIdx++];
      }
    }
  }
  for (const col of p.columnas_finales) {
    if (poolIdx < GRADE_FIELD_POOL.length) {
      col.field_key = GRADE_FIELD_POOL[poolIdx++];
    }
  }
  return p;
}

/** Promedio ponderado de un criterio para un alumno. */
export function calcularPromedioCriterio(student, criterio) {
  const inputSubs = criterio.subcolumnas.filter(s => s.tipo === "input");
  return calcularPromedioInput(inputSubs.map(s => getGradeValue(student, s)));
}

/**
 * Calcula el promedio bimestral (nota final) usando los pesos de la plantilla.
 * Replica la logica de calculate_final_grade del backend.
 */
export function calcularPromedioBimestral(student, plantilla) {
  if (!plantilla) return null;
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const criterio of plantilla.criterios) {
    const avg = calcularPromedioCriterio(student, criterio);
    if (avg !== null) {
      const w = (criterio.porcentaje || 0) / 100;
      totalWeighted += avg * w;
      totalWeight += w;
    }
  }

  for (const col of plantilla.columnas_finales) {
    const val = getGradeValue(student, col);
    if (val !== null && val !== undefined) {
      const w = (col.porcentaje || 0) / 100;
      totalWeighted += Number(val) * w;
      totalWeight += w;
    }
  }

  if (totalWeight === 0) return null;
  const result = totalWeight < 1 ? totalWeighted / totalWeight : totalWeighted;
  return Math.round(result * 10) / 10;
}
