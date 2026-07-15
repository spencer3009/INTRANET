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
/**
 * Set de field_keys "estáticos" — campos top-level del documento
 * `student_grades` que existen como columnas fijas en el modelo legacy.
 *
 * Cualquier `field_key` que NO esté aquí es tratado como columna dinámica
 * (plantilla personalizada) y su valor vive en `grades_dynamic[<field_key|id>]`.
 *
 * Debe mantenerse sincronizado con `GRADE_SUB_FIELDS` en
 * `/app/backend/routes/grades.py`.
 */
export const STATIC_GRADE_FIELDS = new Set([
  "act_co", "act_re",
  "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
  "comp_c1", "comp_c2",
  "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
  "exam_mensual", "exam_bimestral",
]);

/** True si la subcolumna se almacena top-level; false si va a grades_dynamic. */
export function isStaticSubcolumn(sub) {
  // Defensive: treat the python-stringified "None" as null. Some legacy
  // templates serialized `field_key: None` as the literal string "None"
  // when stored in MongoDB, which causes truthy checks to pass and the
  // gradebook to read from the wrong key.
  const fk = sub && sub.field_key;
  const realFk = fk && fk !== "None" && fk !== "" ? fk : null;
  return !!(realFk && STATIC_GRADE_FIELDS.has(realFk));
}

/**
 * Resolve the effective storage location for a subcolumna, **without**
 * mutating the plantilla.
 *
 * Three cases, evaluated in order:
 *   1. `sub.field_key` is truthy → keep the legacy behaviour: if the key
 *      lives in STATIC_GRADE_FIELDS it's a top-level cell, otherwise
 *      it's a dynamic key. This path is taken by `PLANTILLA_SISTEMA_FALLBACK`
 *      and any plantilla that explicitly persisted its `field_key`.
 *   2. `sub.field_key` is falsy AND `sub.id` is a key in `legacyMap`
 *      (the Plantilla del Sistema uses `sub.id = "io"` / "re" / "t1"…)
 *      → map it to the static top-level field (`act_co` / `act_re`…).
 *      This preserves the Plantilla del Sistema behaviour after we stop
 *      mutating the plantilla via assignFieldKeys.
 *   3. Otherwise → modern custom plantilla; read/write from
 *      `grades_dynamic[sub.id]`.
 *
 * @param sub        — subcolumna definition from the plantilla
 * @param legacyMap  — `legacy_field_map` returned by the backend
 *                     (e.g. {"io":"act_co","re":"act_re","t1":"rf_r1"…}).
 *                     Pass `{}` or `undefined` to disable the legacy path.
 * @returns {kind: "static" | "dynamic", key: string}
 */
export function resolveSubLocation(sub, legacyMap) {
  if (!sub) return { kind: "dynamic", key: undefined };
  const rawFk = sub.field_key;
  const fk = rawFk && rawFk !== "None" && rawFk !== "" ? rawFk : null;

  if (fk) {
    if (STATIC_GRADE_FIELDS.has(fk)) return { kind: "static", key: fk };
    return { kind: "dynamic", key: fk };
  }
  if (legacyMap && sub.id && Object.prototype.hasOwnProperty.call(legacyMap, sub.id)) {
    return { kind: "static", key: legacyMap[sub.id] };
  }
  return { kind: "dynamic", key: sub.id };
}

export function getGradeValue(student, sub, legacyMap) {
  if (!student || !sub) return undefined;
  const loc = resolveSubLocation(sub, legacyMap);
  if (loc.kind === "static") {
    const v = student[loc.key];
    return v !== undefined && v !== null ? v : undefined;
  }
  if (!loc.key) return undefined;
  return student.grades_dynamic?.[loc.key];
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
export function calcularPromedioCriterio(student, criterio, legacyMap) {
  const inputSubs = criterio.subcolumnas.filter(s => s.tipo === "input");
  return calcularPromedioInput(inputSubs.map(s => getGradeValue(student, s, legacyMap)));
}

/**
 * Promedio de un criterio replicando EXACTAMENTE el backend
 * (`_criterio_avg` en grades.py): promedia todas las subcolumnas que NO son de
 * tipo promedio/auto y REDONDEA a 1 decimal. Se usa para la nota final
 * (`calcularPromedioBimestral`) para que el TOTAL del Registro Auxiliar coincida
 * con el `final_grade` (Consolidado, Libreta, ranking).
 */
const _PROMEDIO_TIPOS = new Set(["promedio_auto", "promedio", "promedio_manual", "auto"]);
export function calcularPromedioCriterioBackend(student, criterio, legacyMap) {
  const subs = (criterio.subcolumnas || []).filter(
    s => !_PROMEDIO_TIPOS.has((s.tipo || "input").toLowerCase())
  );
  const vals = subs
    .map(s => getGradeValue(student, s, legacyMap))
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/**
 * Calcula el promedio bimestral (nota final) usando los pesos de la plantilla.
 * Replica la logica de calculate_final_grade del backend.
 */
export function calcularPromedioBimestral(student, plantilla, legacyMap) {
  if (!plantilla) return null;

  // ── Modo grupo: cada grupo pondera el promedio SIMPLE de sus miembros ──
  const modo = plantilla.modo_ponderacion || "criterio";
  if (modo === "grupo" && Array.isArray(plantilla.grupos) && plantilla.grupos.length) {
    const criteriosById = {};
    (plantilla.criterios || []).forEach(c => { criteriosById[c.id] = c; });
    const finalesById = {};
    (plantilla.columnas_finales || []).forEach(c => { finalesById[c.id] = c; });

    let tw = 0, twt = 0;
    for (const g of plantilla.grupos) {
      const w = (g.porcentaje || 0) / 100;
      if (w <= 0) continue;
      const vals = [];
      for (const mid of (g.miembro_ids || [])) {
        let v = null;
        if (criteriosById[mid]) {
          v = calcularPromedioCriterioBackend(student, criteriosById[mid], legacyMap);
        } else if (finalesById[mid]) {
          const raw = getGradeValue(student, finalesById[mid], legacyMap);
          v = (raw !== null && raw !== undefined && raw !== "") ? Number(raw) : null;
        }
        if (v !== null && v !== undefined && !isNaN(v)) vals.push(Number(v));
      }
      if (!vals.length) continue;
      const gAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
      tw += gAvg * w;
      twt += w;
    }
    if (twt === 0) return null;
    const result = twt < 1 ? tw / twt : tw;
    return Math.round(result * 10) / 10;
  }

  let totalWeighted = 0;
  let totalWeight = 0;

  for (const criterio of plantilla.criterios) {
    const avg = calcularPromedioCriterioBackend(student, criterio, legacyMap);
    if (avg !== null) {
      const w = (criterio.porcentaje || 0) / 100;
      totalWeighted += avg * w;
      totalWeight += w;
    }
  }

  for (const col of plantilla.columnas_finales) {
    const val = getGradeValue(student, col, legacyMap);
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
