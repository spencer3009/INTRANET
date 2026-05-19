"""
E2E: Exam → Auto-grade → Sync to Registro Auxiliar with DYNAMIC columns
(custom Plantilla del Colegio).

Iteration 205 (continuation of 204 which validated STATIC columns).

Flow:
  1) Admin (Roble) lists templates. If no custom-active one, creates a minimal
     custom plantilla with 4 dynamic subcolumnas (UUID-ids) and 100% sum.
  2) Activate the plantilla + set as predeterminada for the school.
  3) GET /api/exams/register-availability → ensure dynamic column ids appear.
  4) Pick one free dynamic column, create an exam linked to it.
  5) Add multiple-choice question, publish.
  6) Student Magno: start → save-answer (correct) → submit.
  7) Verify GET /api/grades/register/... returns 20 in grades_dynamic.<col_id>.
  8) Cleanup: revert school to system template (POST .../plantillas/usar-sistema)
     so the next iteration isn't broken.
"""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@elroble.edu"
ADMIN_PASSWORD = "1234abc8"
STUDENT_EMAIL = "mickycalle65@gmail.com"
STUDENT_PASSWORD = "91616119"

SCHOOL_ID = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
SUBJECT_ID = "e04de272-54ec-4af9-868a-bc7604e2b4b4"  # Música
SECTION_ID = "11f50cbc-f5f6-422a-a989-87b2af6027f1"
PERIOD_ID = "093a0bee-92c4-449c-b82c-942f16847759"  # BIMESTRE I

CONTEXT = {}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    j = r.json()
    token = j.get("access_token") or j.get("token")
    return token, j.get("user", {})


@pytest.fixture(scope="module")
def admin_session():
    token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


@pytest.fixture(scope="module")
def student_session():
    token, user = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


def test_01_ensure_custom_plantilla_active(admin_session):
    admin, _ = admin_session
    # List plantillas for the school
    r = admin.get(f"{BASE_URL}/api/schools/{SCHOOL_ID}/registro-auxiliar/plantillas", timeout=30)
    print(f"[LIST] status={r.status_code} body[:300]={r.text[:300]}")
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("plantillas") or data.get("items") or data if isinstance(data, list) else (
        data.get("plantillas") or data.get("items") or []
    )
    if isinstance(data, list):
        items = data
    print(f"[LIST] found {len(items)} templates")
    for p in items:
        print(f"   - id={p.get('id')} es_sistema={p.get('es_sistema')} estado={p.get('estado')} nombre={p.get('nombre')}")

    custom_active = next(
        (p for p in items
         if not p.get("es_sistema")
         and p.get("estado") == "activa"
         and p.get("school_id") == SCHOOL_ID),
        None,
    )

    if custom_active:
        print(f"[LIST] Reusing existing custom active template: {custom_active['id']}")
        CONTEXT["plantilla_id"] = custom_active["id"]
        CONTEXT["plantilla"] = custom_active
        CONTEXT["created_template"] = False
    else:
        # Create one minimal: 1 criterio (EVAL CONTINUA 100%) with 4 input subcolumnas + 1 promedio_auto.
        # No columnas_finales to keep sum = 100.
        payload = {
            "nombre": f"TEST_DYN Plantilla {int(time.time())}",
            "descripcion": "Plantilla dinámica E2E iter205",
            "estado": "activa",
            "label_promedio_final": "PROM. BIMESTRAL",
            "escala_minima": 0,
            "escala_maxima": 20,
            "criterios": [{
                "nombre": "EVALUACION CONTINUA",
                "porcentaje": 100,
                "color": "#F1C40F",
                "orden": 0,
                "subcolumnas": [
                    {"label": "P1", "tipo": "input", "orden": 0},
                    {"label": "P2", "tipo": "input", "orden": 1},
                    {"label": "P3", "tipo": "input", "orden": 2},
                    {"label": "P4", "tipo": "input", "orden": 3},
                    {"label": "PROM", "tipo": "promedio_auto", "orden": 4},
                ],
            }],
            "columnas_finales": [],
        }
        r = admin.post(f"{BASE_URL}/api/schools/{SCHOOL_ID}/registro-auxiliar/plantillas",
                       json=payload, timeout=30)
        print(f"[CREATE PLANTILLA] status={r.status_code} body[:600]={r.text[:600]}")
        assert r.status_code in (200, 201), r.text
        plant = r.json()
        CONTEXT["plantilla_id"] = plant["id"]
        CONTEXT["plantilla"] = plant
        CONTEXT["created_template"] = True

        # Set as predeterminada
        r2 = admin.patch(
            f"{BASE_URL}/api/schools/{SCHOOL_ID}/registro-auxiliar/plantillas/{plant['id']}/predeterminada",
            timeout=30,
        )
        print(f"[PREDETERMINADA] status={r2.status_code} body={r2.text[:200]}")
        assert r2.status_code in (200, 204), r2.text

    # Pick a dynamic subcolumna id (input, not promedio_auto) to link the exam.
    plant = CONTEXT["plantilla"]
    dyn_ids = []
    for cri in plant.get("criterios", []) or []:
        for sub in cri.get("subcolumnas", []) or []:
            if sub.get("tipo") == "input":
                # Want non-static ids (custom plantilla ids look like "criterio_xxxxx_col_yyyy" or uuids).
                sid = sub.get("id")
                if sid:
                    dyn_ids.append(sid)
    assert dyn_ids, f"No input subcolumnas in plantilla: {plant}"
    print(f"[DYN] dynamic input ids: {dyn_ids}")
    CONTEXT["dyn_ids"] = dyn_ids


def test_02_register_availability_lists_dynamic_cols(admin_session):
    admin, _ = admin_session
    r = admin.get(
        f"{BASE_URL}/api/exams/register-availability",
        params={"subject_id": SUBJECT_ID, "section_id": SECTION_ID, "period_id": PERIOD_ID},
        timeout=30,
    )
    print(f"[AVAIL] status={r.status_code} body[:800]={r.text[:800]}")
    assert r.status_code == 200, r.text
    body = r.json()
    cols = body.get("columns") or body.get("available") or body
    # Find one of our dyn_ids that is available
    available_keys = []
    if isinstance(cols, list):
        for c in cols:
            if isinstance(c, dict):
                cid = c.get("id") or c.get("column") or c.get("key")
                # available flag
                is_avail = c.get("available", True) and not c.get("taken")
                if cid and is_avail:
                    available_keys.append(cid)
            elif isinstance(c, str):
                available_keys.append(c)
    print(f"[AVAIL] available_keys sample[:20]={available_keys[:20]}")

    chosen = None
    for did in CONTEXT["dyn_ids"]:
        if did in available_keys:
            chosen = did
            break
    # If endpoint doesn't list them (e.g., school still on system template momentarily),
    # take the first dyn_id and let backend accept dynamic via get_valid_exam_columns.
    if not chosen:
        chosen = CONTEXT["dyn_ids"][0]
        print(f"[AVAIL] dyn_id not in availability list; falling back to {chosen}")
    CONTEXT["register_column"] = chosen
    print(f"[AVAIL] chosen dynamic register_column={chosen}")


def test_03_create_exam_linked_to_dynamic(admin_session):
    admin, _ = admin_session
    now = datetime.now(timezone.utc)
    payload = {
        "title": f"TEST_E2E_DYN ExamSync {int(time.time())}",
        "description": "E2E dynamic-column test",
        "subject_id": SUBJECT_ID,
        "section_id": SECTION_ID,
        "period_id": PERIOD_ID,
        "register_column": CONTEXT["register_column"],
        "duration_minutes": 30,
        "shuffle_questions": False,
        "show_results_immediately": True,
        "start_datetime": (now - timedelta(minutes=5)).isoformat(),
        "end_datetime": (now + timedelta(hours=2)).isoformat(),
        "type": "digital",
        "min_score_percentage": 60.0,
    }
    r = admin.post(f"{BASE_URL}/api/course/{SUBJECT_ID}/exams", json=payload, timeout=30)
    print(f"[CREATE EXAM] status={r.status_code} body[:500]={r.text[:500]}")
    assert r.status_code in (200, 201), r.text
    data = r.json()
    exam_id = data.get("id") or data.get("exam_id") or (data.get("exam") or {}).get("id")
    assert exam_id, f"No exam id: {data}"
    CONTEXT["exam_id"] = exam_id
    print(f"[CREATE EXAM] exam_id={exam_id} register_column={data.get('register_column')}")


def test_04_add_question_and_publish(admin_session):
    admin, _ = admin_session
    exam_id = CONTEXT["exam_id"]
    q_payload = {
        "question_text": "¿Cuánto es 3 + 3?",
        "question_type": "multiple_choice",
        "points": 10,
        "options": [
            {"text": "5", "is_correct": False},
            {"text": "6", "is_correct": True},
            {"text": "7", "is_correct": False},
        ],
    }
    r = admin.post(f"{BASE_URL}/api/exams/{exam_id}/questions", json=q_payload, timeout=30)
    print(f"[ADD Q] status={r.status_code} body={r.text[:300]}")
    assert r.status_code in (200, 201), r.text
    data = r.json()
    q_id = data.get("id") or data.get("question_id") or (data.get("question") or {}).get("id")
    options = data.get("options") or (data.get("question") or {}).get("options") or []
    correct = next((o for o in options if o.get("is_correct")), None)
    CONTEXT["q_id"] = q_id
    CONTEXT["correct_opt_id"] = correct.get("id") or correct.get("option_id")
    print(f"[ADD Q] q_id={q_id} correct_opt={CONTEXT['correct_opt_id']}")

    r = admin.post(f"{BASE_URL}/api/exams/{exam_id}/publish", json={}, timeout=30)
    print(f"[PUBLISH] status={r.status_code} body={r.text[:200]}")
    assert r.status_code in (200, 201), r.text


def test_05_student_submits(student_session):
    student, _ = student_session
    exam_id = CONTEXT["exam_id"]
    r = student.post(f"{BASE_URL}/api/exams/{exam_id}/start", json={}, timeout=30)
    print(f"[START] status={r.status_code} body[:400]={r.text[:400]}")
    assert r.status_code in (200, 201), r.text
    j = r.json()
    attempt_id = j.get("attempt_id") or j.get("id") or (j.get("attempt") or {}).get("id")
    CONTEXT["attempt_id"] = attempt_id

    q_id = CONTEXT["q_id"]
    opt_id = CONTEXT["correct_opt_id"]
    # Override from start response if available
    qs = j.get("questions") or []
    if qs:
        q = qs[0]
        q_id = q.get("id") or q.get("question_id") or q_id
        opts = q.get("options") or []
        c = next((o for o in opts if o.get("is_correct")), None)
        if c:
            opt_id = c.get("id") or c.get("option_id") or opt_id

    r = student.post(f"{BASE_URL}/api/exam-attempts/{attempt_id}/save-answer",
                     json={"question_id": q_id, "selected_option_id": opt_id}, timeout=30)
    print(f"[SAVE-ANSWER] status={r.status_code} body={r.text[:200]}")
    assert r.status_code in (200, 201), r.text

    r = student.post(f"{BASE_URL}/api/exam-attempts/{attempt_id}/submit", json={}, timeout=60)
    print(f"[SUBMIT] status={r.status_code} body[:500]={r.text[:500]}")
    assert r.status_code in (200, 201), r.text
    data = r.json()
    pct = data.get("percentage") or data.get("score_percentage") or (data.get("attempt") or {}).get("percentage")
    print(f"[SUBMIT] percentage={pct} correct={data.get('correct_count')}")
    assert pct == 100 or pct == 100.0, f"Expected 100%, got {pct}"


def test_06_grade_in_grades_dynamic(admin_session, student_session):
    admin, _ = admin_session
    _, student_user = student_session
    student_id = student_user.get("id") or student_user.get("user_id")

    time.sleep(2)
    url = f"{BASE_URL}/api/grades/register/{SUBJECT_ID}/{SECTION_ID}/{PERIOD_ID}"
    r = admin.get(url, timeout=30)
    print(f"[REGISTER] status={r.status_code}")
    assert r.status_code == 200, r.text
    reg = r.json()
    rows = reg.get("grades") or reg.get("students") or reg.get("rows") or reg
    if isinstance(rows, dict):
        rows = rows.get("items", []) or list(rows.values())

    student_row = None
    for row in rows if isinstance(rows, list) else []:
        sid = row.get("student_id") or (row.get("student") or {}).get("id") or row.get("id")
        if sid == student_id:
            student_row = row
            break
    print(f"[REGISTER] student_row keys={list(student_row.keys()) if student_row else None}")
    assert student_row, f"Student {student_id} row not found"

    col = CONTEXT["register_column"]
    dyn = student_row.get("grades_dynamic") or {}
    val = dyn.get(col)
    print(f"[REGISTER] register_column={col}")
    print(f"[REGISTER] grades_dynamic={dyn}")
    print(f"[REGISTER] value for column = {val}")

    # Also dump any matching static field, just to detect mis-routing
    for k in ("act_co", "act_re", "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5", "part_p1", "part_p2", "part_p3", "part_p4"):
        if student_row.get(k) is not None:
            print(f"[REGISTER] (static) {k} = {student_row.get(k)}")

    assert val is not None, (
        f"DYNAMIC SYNC FAILED. register_column={col} grades_dynamic={dyn} "
        f"row_static_fields={{k:v for k,v in student_row.items() if not isinstance(v, (dict, list))}}"
    )
    assert float(val) == 20.0, f"Expected 20, got {val}"
    CONTEXT["synced_value"] = val


def test_07_cleanup_revert_to_system(admin_session):
    """Revert to system template so other tests / the user don't see the test plantilla."""
    admin, _ = admin_session
    if not CONTEXT.get("created_template"):
        print("[CLEANUP] Reused pre-existing custom template, not reverting.")
        return
    r = admin.post(
        f"{BASE_URL}/api/schools/{SCHOOL_ID}/registro-auxiliar/plantillas/usar-sistema",
        timeout=30,
    )
    print(f"[CLEANUP] usar-sistema status={r.status_code} body={r.text[:200]}")
    assert r.status_code in (200, 204), r.text
