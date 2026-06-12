"""
Unified Register Sync Service.
Handles ALL sync between exams/tasks and the Registro Auxiliar (student_grades).
Central, IDEMPOTENT function — safe to call multiple times.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Maps register_column value to the student_grades field name.
# Covers:
#   - columnas_finales (exámenes mensual/bimestral) in both canonical and legacy keys
#   - every "input" subcolumn of the SYSTEM template (IO/RE, T1-T5, C1-C2, P1-P6)
# Keys are stored in both lower- and upper-case because the frontend historically
# sent the subcolumna `id` in lower-case (e.g. "p2") while some older endpoints
# and imports still use upper-case (e.g. "P2").
# Fields part_p4/p5/p6 do not exist yet in student_grades documents — Mongo will
# auto-create them on the first sync (schema-less).
COLUMN_FIELD_MAP = {
    # Exámenes (columnas_finales)
    "EM": "exam_mensual",
    "EB": "exam_bimestral",
    "examen_mensual": "exam_mensual",
    "examen_bimestral": "exam_bimestral",
    # Actitudinal
    "io": "act_co",
    "IO": "act_co",
    "re": "act_re",
    "RE": "act_re",
    # Tareas
    "t1": "rf_r1",
    "T1": "rf_r1",
    "t2": "rf_r2",
    "T2": "rf_r2",
    "t3": "rf_r3",
    "T3": "rf_r3",
    "t4": "rf_r4",
    "T4": "rf_r4",
    "t5": "rf_r5",
    "T5": "rf_r5",
    # Competencia
    "c1": "comp_c1",
    "C1": "comp_c1",
    "c2": "comp_c2",
    "C2": "comp_c2",
    # Pasitos / Participación
    "p1": "part_p1",
    "P1": "part_p1",
    "p2": "part_p2",
    "P2": "part_p2",
    "p3": "part_p3",
    "P3": "part_p3",
    "p4": "part_p4",
    "P4": "part_p4",
    "p5": "part_p5",
    "P5": "part_p5",
    "p6": "part_p6",
    "P6": "part_p6",
    # Frontend PLANTILLA_SISTEMA_FALLBACK — the subcolumn `field_key`/`id`
    # already matches the real column name in `student_grades`, so it's an
    # identity mapping. Needed because the frontend fallback is what shows
    # in the modal when a school has no custom template (CO/RE, R1-R5, C1-C2,
    # P1-P3, EXP, TG, P).
    "act_co": "act_co",
    "act_re": "act_re",
    "rf_r1": "rf_r1",
    "rf_r2": "rf_r2",
    "rf_r3": "rf_r3",
    "rf_r4": "rf_r4",
    "rf_r5": "rf_r5",
    "comp_c1": "comp_c1",
    "comp_c2": "comp_c2",
    "part_p1": "part_p1",
    "part_p2": "part_p2",
    "part_p3": "part_p3",
    "part_exp": "part_exp",
    "part_tg": "part_tg",
    "part_p": "part_p",
    "exam_mensual": "exam_mensual",
    "exam_bimestral": "exam_bimestral",
}

VALID_COLUMNS = set(COLUMN_FIELD_MAP.keys())


async def get_storage_field(db, column_id: str, school_id: str) -> tuple:
    """
    Decide where a grade for `column_id` should be stored in
    `student_grades`. The register supports two coexisting storage
    modes:

    - **static**: legacy fields hard-coded in `COLUMN_FIELD_MAP` (the
      system template that every school inherits by default). Kept as
      top-level fields (`act_co`, `rf_r1`, …) for full backward-
      compatibility with old documents, reports and indexes.
    - **dynamic**: any column that belongs to a school's custom
      template. These columns have UUID-style ids that cannot be
      predicted at boot time, so they are stored under the
      schemaless subdocument `grades_dynamic.<column_id>`.

    Routing rules (in order):
      1. If `column_id` is already known in the static map → static.
      2. Otherwise, verify the id belongs to some (non-deleted)
         template of this school or to the SYSTEM template. If it
         does → dynamic, using `column_id` verbatim as the key.
      3. If neither, log a warning and return (None, None) so the
         caller skips the write instead of guessing.

    Returns:
        (field_type, field_key):
            - field_type: "static" | "dynamic" | None
            - field_key: MongoDB field name (e.g. "act_co") or the
              column id to use under `grades_dynamic.<id>`.
    """
    if not column_id:
        return (None, None)

    # 1. Legacy / system template → single top-level field.
    if column_id in COLUMN_FIELD_MAP:
        return ("static", COLUMN_FIELD_MAP[column_id])

    # 2. Column belongs to a custom template? Reuse the same tolerant
    # extractor used everywhere else so "label" (e.g. "R2") and casing
    # drift keep working.
    def _matches(value) -> bool:
        if not value:
            return False
        return (
            str(value) == str(column_id)
            or str(value).lower() == str(column_id).lower()
        )

    def _column_exists_in(plantilla) -> bool:
        # 1. Input subcolumnas inside criterios.
        for cri in (plantilla or {}).get("criterios", []) or []:
            for sub in cri.get("subcolumnas", []) or []:
                for c in (sub.get("id"), sub.get("field_key"), sub.get("label")):
                    if _matches(c):
                        return True
        # 2. Final columns (columnas_finales) — exams can target these (e.g.
        # custom "PARCIALES"). They live OUTSIDE `criterios`, so they must be
        # checked here too; mirrors get_valid_exam_columns_for_school. Without
        # this, a custom final column passes link-time validation but fails at
        # sync time with a false "la columna ya no existe".
        for col in (plantilla or {}).get("columnas_finales", []) or []:
            for c in (
                col.get("id"),
                col.get("field_key"),
                col.get("label"),
                col.get("label_corto"),
            ):
                if _matches(c):
                    return True
        return False

    try:
        async for p in db.registro_auxiliar_plantillas.find(
            {"school_id": school_id},
            {"_id": 0, "criterios": 1, "columnas_finales": 1, "estado": 1},
        ):
            if p.get("estado") == "eliminada":
                continue
            if _column_exists_in(p):
                return ("dynamic", column_id)

        system = await db.registro_auxiliar_plantillas.find_one(
            {"es_sistema": True}, {"_id": 0, "criterios": 1, "columnas_finales": 1}
        )
        if system and _column_exists_in(system):
            return ("dynamic", column_id)
    except Exception as e:
        logger.warning(
            f"[SYNC] dynamic column lookup failed for school={school_id} "
            f"column={column_id}: {e}"
        )

    logger.warning(
        f"[SYNC] column_id '{column_id}' not found in static map nor in any "
        f"template for school {school_id}. Grade NOT saved."
    )
    return (None, None)


def _build_grade_update(field_type: str, field_key: str, value):
    """Build the `$set` payload for update_one depending on storage mode."""
    if field_type == "static":
        return {field_key: value}
    if field_type == "dynamic":
        return {f"grades_dynamic.{field_key}": value}
    return {}


async def _resolve_student_section(db, source_section_id, student_id):
    """Return the section_id to key a student's `student_grades` document on.

    Falls back to the student's own enrollment (`seccion_id`/`section_id`)
    when the source exam/task has no `section_id`. Without this, a sync would
    upsert a `student_grades` doc WITHOUT a `section_id` field, and the
    Registro Auxiliar — which queries strictly by `section_id` — could never
    surface the grade (root cause of "el modal muestra notas pero el Registro
    Auxiliar sale vacío"). Subjects created at grade level (no section) are a
    common trigger: the exam inherits `subject.section_id = None`.
    """
    if source_section_id:
        return source_section_id
    if not student_id:
        return None
    st = await db.users.find_one(
        {"id": student_id}, {"_id": 0, "seccion_id": 1, "section_id": 1}
    )
    if not st:
        return None
    return st.get("seccion_id") or st.get("section_id")

# Legacy + frontend-fallback whitelist. Used as:
#   (a) a safety-net when `get_valid_task_columns_for_school` can't resolve
#       any template at all (new school / missing seed).
#   (b) the base layer in the union returned by
#       `get_valid_task_columns_for_school`.
# Includes every task-linkable subcolumna of the frontend
# `PLANTILLA_SISTEMA_FALLBACK` so the Nueva Tarea modal works out of the box
# for schools without a custom template.
TASK_VALID_COLUMNS = {
    "P1", "P2", "P3",
    "act_co", "act_re",
    "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
    "comp_c1", "comp_c2",
    "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
    "exam_mensual", "exam_bimestral",
}


async def get_valid_task_columns_for_school(db, school_id: str) -> set:
    """
    Return the set of register columns a TASK may be linked to, resolved
    dynamically from the school's Registro Auxiliar templates.

    Rule of thumb (mirrors the frontend modal `taskSubcolumnasVinculables`):
      - Every subcolumna of every criterio that has `tipo == "input"` is
        valid for tasks.
      - `columnas_finales` are reserved for EXAMS (EM, EB and similar) and
        are excluded from tasks.

    Resolution order (tolerant):
      1. The school's ACTIVE template (estado == "activa")
      2. Any other template belonging to the school (estado != deleted)
      3. The SYSTEM template (es_sistema: True)
      4. Legacy hard-coded {P1, P2, P3}

    We union (1)+(2)+(3) so older schools whose template was seeded but
    not explicitly marked "activa" keep working. Normalized keys are also
    stored in both lower-case and upper-case to tolerate casing drift.
    """
    def _extract(plantilla) -> set:
        out = set()
        for cri in (plantilla or {}).get("criterios", []) or []:
            for sub in cri.get("subcolumnas", []) or []:
                if sub.get("tipo") != "input":
                    continue
                # Defensive: ignore the python-stringified "None" / empty
                # field_keys that some legacy plantillas leaked. Treat them
                # as absent so we fall back to `sub.id` (always unique).
                fk = sub.get("field_key")
                if fk in (None, "", "None"):
                    fk = None
                key = fk or sub.get("id")
                if key:
                    out.add(key)
                    out.add(str(key).upper())
                    out.add(str(key).lower())
                # Also accept the visible label (frontend occasionally sends
                # `label` instead of `id` as register_column — e.g. "R2", "CO").
                label = sub.get("label")
                if label:
                    out.add(label)
                    out.add(str(label).upper())
                    out.add(str(label).lower())
        return out

    try:
        cols: set = set()
        # 1. Any template that belongs to this school (regardless of state)
        async for p in db.registro_auxiliar_plantillas.find(
            {"school_id": school_id},
            {"_id": 0, "criterios": 1, "estado": 1},
        ):
            if p.get("estado") == "eliminada":
                continue
            cols |= _extract(p)

        # 2. System template (always accepted as safety net)
        system = await db.registro_auxiliar_plantillas.find_one(
            {"es_sistema": True}, {"_id": 0, "criterios": 1}
        )
        if system:
            cols |= _extract(system)

        # 3. Legacy slots — so a freshly-created school with no templates
        #    at all still accepts the historic P1/P2/P3.
        cols |= set(TASK_VALID_COLUMNS)

        return cols
    except Exception as e:
        logger.warning(f"[register] dynamic task-columns lookup failed for {school_id}: {e}")
        return set(TASK_VALID_COLUMNS)


async def get_active_template_for_school(db, school_id: str) -> dict:
    """
    Resolve the ACTIVE Registro Auxiliar template for a school using the same
    priority order the frontend uses:
      1. School's `es_predeterminada` (and not system)
      2. School's `estado == "activa"` (and not system)
      3. The system template (`es_sistema: True`)
      4. None — caller must fallback (legacy)

    Also normalizes legacy `field_key: "None"` (string) into a real Python
    `None`, so every downstream caller sees a consistent shape regardless
    of how the doc was serialized on disk.
    """
    def _normalize(p):
        if not p:
            return p
        for cri in p.get("criterios", []) or []:
            for sub in cri.get("subcolumnas", []) or []:
                fk = sub.get("field_key")
                if isinstance(fk, str) and fk.strip() in ("", "None", "null", "NULL", "undefined"):
                    sub["field_key"] = None
        for col in p.get("columnas_finales", []) or []:
            fk = col.get("field_key")
            if isinstance(fk, str) and fk.strip() in ("", "None", "null", "NULL", "undefined"):
                col["field_key"] = None
        return p

    try:
        plantillas = await db.registro_auxiliar_plantillas.find(
            {"$or": [{"school_id": school_id}, {"es_sistema": True}]},
            {"_id": 0},
        ).to_list(50)

        predeterminada = next(
            (p for p in plantillas
             if p.get("school_id") == school_id
             and p.get("es_predeterminada")
             and not p.get("es_sistema")
             and p.get("estado") != "eliminada"),
            None,
        )
        if predeterminada:
            return _normalize(predeterminada)

        activa = next(
            (p for p in plantillas
             if p.get("school_id") == school_id
             and not p.get("es_sistema")
             and p.get("estado") == "activa"),
            None,
        )
        if activa:
            return _normalize(activa)

        sistema = next((p for p in plantillas if p.get("es_sistema")), None)
        if sistema:
            return _normalize(sistema)
    except Exception as e:
        logger.warning(f"[register] active-template lookup failed for {school_id}: {e}")

    return None


async def get_valid_exam_columns_for_school(db, school_id: str) -> set:
    """
    Return the set of register columns an EXAM may be linked to.

    Exams can target ANY input subcolumna (same as tasks) AND additionally the
    `columnas_finales` (EM/EB and similar — these are reserved for exams from
    the original system template, but custom templates may add more).

    Mirrors `get_valid_task_columns_for_school` but unions in the
    `columnas_finales` ids/labels too.
    """
    def _extract_with_finales(plantilla) -> set:
        out = set()
        for cri in (plantilla or {}).get("criterios", []) or []:
            for sub in cri.get("subcolumnas", []) or []:
                if sub.get("tipo") != "input":
                    continue
                # Defensive: same "None" string handling as _extract above.
                fk = sub.get("field_key")
                if fk in (None, "", "None"):
                    fk = None
                key = fk or sub.get("id")
                if key:
                    out.add(key)
                    out.add(str(key).upper())
                    out.add(str(key).lower())
                label = sub.get("label")
                if label:
                    out.add(label)
                    out.add(str(label).upper())
                    out.add(str(label).lower())
        # columnas_finales: implicit input (no `tipo` field) — always include
        for col in (plantilla or {}).get("columnas_finales", []) or []:
            fk = col.get("field_key")
            if fk in (None, "", "None"):
                fk = None
            key = fk or col.get("id")
            if key:
                out.add(key)
                out.add(str(key).upper())
                out.add(str(key).lower())
            for label_field in ("label", "label_corto"):
                label = col.get(label_field)
                if label:
                    out.add(label)
                    out.add(str(label).upper())
                    out.add(str(label).lower())
        return out

    try:
        cols: set = set()
        async for p in db.registro_auxiliar_plantillas.find(
            {"school_id": school_id},
            {"_id": 0, "criterios": 1, "columnas_finales": 1, "estado": 1},
        ):
            if p.get("estado") == "eliminada":
                continue
            cols |= _extract_with_finales(p)

        system = await db.registro_auxiliar_plantillas.find_one(
            {"es_sistema": True},
            {"_id": 0, "criterios": 1, "columnas_finales": 1},
        )
        if system:
            cols |= _extract_with_finales(system)

        # Legacy: keep the historic VALID_COLUMNS (EM, EB, P1, P2, P3, etc.)
        cols |= set(VALID_COLUMNS)
        return cols
    except Exception as e:
        logger.warning(f"[register] dynamic exam-columns lookup failed for {school_id}: {e}")
        return set(VALID_COLUMNS)



def exam_score_to_vigesimal(percentage: float) -> int:
    """Convert exam percentage (0-100) to vigesimal scale (0-20), integer."""
    if percentage is None:
        return 0
    return round(percentage * 20 / 100)


def task_score_to_vigesimal(score: float) -> float:
    """Copy the teacher-entered task grade AS-IS to the Registro Auxiliar.

    No rescaling: the grade the teacher types is exactly what shows in the
    register (e.g. 18 -> 18). The only safeguard is clamping to the valid
    vigesimal range [0, 20] so the register stays consistent. Whole numbers
    stay whole (18.0 -> 18); decimals are preserved up to 2 places (17.5).
    """
    if score is None:
        return 0
    try:
        v = float(score)
    except (TypeError, ValueError):
        return 0
    if v < 0:
        v = 0.0
    elif v > 20:
        v = 20.0
    return int(v) if float(v).is_integer() else round(v, 2)


async def sync_to_register(db, source_id: str, source_type: str, action: str):
    """
    Central sync function for both exams and tasks.
    
    Args:
        db: Motor database instance
        source_id: The exam or task document ID
        source_type: "exam" | "task"
        action: "create" | "update" | "delete" | "regrade" | "retry" | "close_exam"
    """
    if source_type == "exam":
        source = await db.online_exams.find_one({"id": source_id}, {"_id": 0})
        collection = db.online_exams
    elif source_type == "task":
        source = await db.course_posts.find_one({"id": source_id}, {"_id": 0})
        collection = db.course_posts
    else:
        logger.error(f"[SYNC] Invalid source_type: {source_type}")
        return

    if not source:
        logger.warning(f"[SYNC] {source_type} {source_id} not found")
        return

    register_column = source.get("register_column")

    if not register_column:
        await collection.update_one(
            {"id": source_id},
            {"$set": {"sync_status": "not_linked"}}
        )
        return

    grade_field = COLUMN_FIELD_MAP.get(register_column)
    school_id = source.get("school_id")
    if grade_field:
        field_type = "static"
        field_key = grade_field
    else:
        # Dynamic column (custom template): resolve by asking the school's
        # templates; fall back to "not saved" if unknown.
        field_type, field_key = await get_storage_field(
            db, register_column, school_id
        )
        if not field_type:
            await collection.update_one(
                {"id": source_id},
                {"$set": {"sync_status": "column_unknown"}}
            )
            return

    period_id = source.get("period_id")
    subject_id = source.get("subject_id")
    section_id = source.get("section_id")

    if not all([period_id, subject_id, school_id]):
        logger.error(f"[SYNC] {source_type} {source_id} missing required fields for sync")
        return

    # Check if the register is locked
    lock_query = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
    }
    if section_id:
        lock_query["section_id"] = section_id

    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked") and action != "retry":
        await collection.update_one(
            {"id": source_id},
            {"$set": {"sync_status": "pending"}}
        )
        logger.info(f"[SYNC] Register locked for {source_type} {source_id}, marking pending")
        return

    grade_filter_base = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
    }
    if section_id:
        grade_filter_base["section_id"] = section_id

    if source_type == "exam":
        await _sync_exam_grades(db, source, source_id, field_type, field_key, grade_filter_base, action, section_id)
    elif source_type == "task":
        await _sync_task_grades(db, source, source_id, field_type, field_key, grade_filter_base, action, section_id)

    new_status = "synced" if action != "delete" else "not_linked"
    await collection.update_one(
        {"id": source_id},
        {"$set": {"sync_status": new_status}}
    )

    logger.info(
        f"[SYNC] {source_type} {source_id} action={action} "
        f"(column={register_column} -> type={field_type} key={field_key})"
    )


async def _sync_exam_grades(db, exam, exam_id, field_type, field_key, grade_filter_base, action, source_section_id=None):
    """Sync exam grades to student_grades (static or dynamic storage)."""
    attempts = await db.exam_attempts.find(
        {"exam_id": exam_id, "status": "completed"},
        {"_id": 0, "student_id": 1, "percentage": 1}
    ).to_list(500)

    for attempt in attempts:
        student_id = attempt["student_id"]
        value = None if action == "delete" else exam_score_to_vigesimal(attempt.get("percentage", 0))
        update_fields = _build_grade_update(field_type, field_key, value)
        if not update_fields:
            continue

        student_filter = {**grade_filter_base, "student_id": student_id}
        sec = await _resolve_student_section(db, source_section_id, student_id)
        if sec:
            student_filter["section_id"] = sec

        await db.student_grades.update_one(
            student_filter,
            {"$set": update_fields},
            upsert=True,
        )


async def _sync_task_grades(db, task, task_id, field_type, field_key, grade_filter_base, action, source_section_id=None):
    """Sync task grades to student_grades (static or dynamic storage).

    The teacher-entered grade is copied AS-IS to the register (no rescaling),
    only clamped to the vigesimal range [0, 20].
    """
    submissions = task.get("submissions", [])
    
    # Re-fetch task to get latest submissions (especially after cron adds auto-zero)
    fresh_task = await db.course_posts.find_one({"id": task_id}, {"_id": 0, "submissions": 1})
    if fresh_task and fresh_task.get("submissions"):
        submissions = fresh_task["submissions"]

    for sub in submissions:
        student_id = sub.get("student_id")
        grade = sub.get("grade")
        if not student_id:
            continue

        if action == "delete":
            value = None
        elif grade is not None:
            value = task_score_to_vigesimal(grade)
        else:
            continue  # No grade yet, skip

        update_fields = _build_grade_update(field_type, field_key, value)
        if not update_fields:
            continue

        student_filter = {**grade_filter_base, "student_id": student_id}
        sec = await _resolve_student_section(db, source_section_id, student_id)
        if sec:
            student_filter["section_id"] = sec

        await db.student_grades.update_one(
            student_filter,
            {"$set": update_fields},
            upsert=True,
        )


async def sync_single_student_exam(db, exam_id: str, student_id: str, percentage: float):
    """
    Sync a single student's exam grade after submission.
    Called from submit_exam_attempt for immediate feedback.
    """
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam or not exam.get("register_column"):
        return

    school_id = exam.get("school_id")
    register_column = exam["register_column"]
    grade_field = COLUMN_FIELD_MAP.get(register_column)
    if grade_field:
        field_type, field_key = "static", grade_field
    else:
        field_type, field_key = await get_storage_field(db, register_column, school_id)
        if not field_type:
            return

    period_id = exam.get("period_id")
    subject_id = exam.get("subject_id")
    section_id = exam.get("section_id")

    if not all([period_id, subject_id, school_id]):
        return

    # Check lock
    lock_query = {"school_id": school_id, "subject_id": subject_id, "period_id": period_id}
    if section_id:
        lock_query["section_id"] = section_id
    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked"):
        await db.online_exams.update_one(
            {"id": exam_id},
            {"$set": {"sync_status": "pending"}}
        )
        return

    grade_value = exam_score_to_vigesimal(percentage)
    grade_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "student_id": student_id,
    }
    resolved_section_id = await _resolve_student_section(db, section_id, student_id)
    if resolved_section_id:
        grade_filter["section_id"] = resolved_section_id

    update_fields = _build_grade_update(field_type, field_key, grade_value)
    await db.student_grades.update_one(
        grade_filter,
        {"$set": update_fields},
        upsert=True,
    )
    logger.info(f"[SYNC] Student {student_id} exam grade synced: type={field_type} key={field_key} value={grade_value}")


async def clear_single_student_exam(db, exam_id: str, student_id: str):
    """Clear (set to None) a single student's exam grade in the Registro Auxiliar.
    Used when a teacher BLOCKS/annuls a student's attempt (e.g. inasistencia).
    Mirrors `sync_single_student_exam` but writes a null value."""
    exam = await db.online_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam or not exam.get("register_column"):
        return

    school_id = exam.get("school_id")
    register_column = exam["register_column"]
    grade_field = COLUMN_FIELD_MAP.get(register_column)
    if grade_field:
        field_type, field_key = "static", grade_field
    else:
        field_type, field_key = await get_storage_field(db, register_column, school_id)
        if not field_type:
            return

    period_id = exam.get("period_id")
    subject_id = exam.get("subject_id")
    section_id = exam.get("section_id")
    if not all([period_id, subject_id, school_id]):
        return

    grade_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "student_id": student_id,
    }
    resolved_section_id = await _resolve_student_section(db, section_id, student_id)
    if resolved_section_id:
        grade_filter["section_id"] = resolved_section_id

    update_fields = _build_grade_update(field_type, field_key, None)
    if update_fields:
        await db.student_grades.update_one(grade_filter, {"$set": update_fields})
        logger.info(f"[SYNC] Student {student_id} exam grade CLEARED (blocked): key={field_key}")



async def sync_single_student_task(db, task_id: str, student_id: str, grade: float):
    """
    Sync a single student's task grade after grading.
    Called from grade_task_submission for immediate feedback.
    When `grade is None` the register cell is CLEARED (deleted grade).
    """
    task = await db.course_posts.find_one({"id": task_id}, {"_id": 0})
    if not task or not task.get("register_column"):
        return

    school_id = task.get("school_id")
    register_column = task["register_column"]
    grade_field = COLUMN_FIELD_MAP.get(register_column)
    if grade_field:
        field_type, field_key = "static", grade_field
    else:
        field_type, field_key = await get_storage_field(db, register_column, school_id)
        if not field_type:
            return

    period_id = task.get("period_id")
    subject_id = task.get("subject_id")
    section_id = task.get("section_id")

    if not all([period_id, subject_id, school_id]):
        return

    # Check lock
    lock_query = {"school_id": school_id, "subject_id": subject_id, "period_id": period_id}
    if section_id:
        lock_query["section_id"] = section_id
    lock = await db.grade_locks.find_one(lock_query, {"_id": 0})

    if lock and lock.get("locked"):
        await db.course_posts.update_one(
            {"id": task_id},
            {"$set": {"sync_status": "pending"}}
        )
        return

    grade_value = None if grade is None else task_score_to_vigesimal(grade)
    grade_filter = {
        "school_id": school_id,
        "subject_id": subject_id,
        "period_id": period_id,
        "student_id": student_id,
    }
    resolved_section_id = await _resolve_student_section(db, section_id, student_id)
    if resolved_section_id:
        grade_filter["section_id"] = resolved_section_id

    update_fields = _build_grade_update(field_type, field_key, grade_value)
    await db.student_grades.update_one(
        grade_filter,
        {"$set": update_fields},
        upsert=True,
    )
    logger.info(f"[SYNC] Student {student_id} task grade synced: type={field_type} key={field_key} value={grade_value}")


async def retry_pending_syncs(db, school_id: str, subject_id: str, section_id: str, period_id: str):
    """
    Retry all pending syncs when a register is reopened.
    Handles both exams and tasks.
    """
    # Retry pending exams
    pending_exams = await db.online_exams.find(
        {
            "school_id": school_id,
            "subject_id": subject_id,
            "section_id": section_id,
            "period_id": period_id,
            "sync_status": "pending",
        },
        {"_id": 0, "id": 1}
    ).to_list(50)

    for exam in pending_exams:
        await sync_to_register(db, exam["id"], "exam", "retry")

    # Retry pending tasks
    pending_tasks = await db.course_posts.find(
        {
            "school_id": school_id,
            "subject_id": subject_id,
            "section_id": section_id,
            "period_id": period_id,
            "sync_status": "pending",
            "$or": [{"post_type": "task"}, {"type": "task"}],
        },
        {"_id": 0, "id": 1}
    ).to_list(50)

    for task in pending_tasks:
        await sync_to_register(db, task["id"], "task", "retry")

    total = len(pending_exams) + len(pending_tasks)
    if total:
        logger.info(f"[SYNC] Retried {total} pending syncs ({len(pending_exams)} exams, {len(pending_tasks)} tasks) for period {period_id}")


# Backward-compatible aliases
async def sync_exam_to_register(db, exam_id: str, action: str):
    """Backward-compatible wrapper."""
    await sync_to_register(db, exam_id, "exam", action)


async def sync_single_student(db, exam_id: str, student_id: str, percentage: float):
    """Backward-compatible wrapper."""
    await sync_single_student_exam(db, exam_id, student_id, percentage)
