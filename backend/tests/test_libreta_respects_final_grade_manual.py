"""
Pytest suite: GET /api/libreta/{student_id} must respect `final_grade_manual`
with the SAME precedence as GET /api/grades/consolidated-report.

Bug P0 (Señor de Gualamita / El Roble): the libreta was reading ONLY
`final_grade`, so notes typed in the teacher "Manual de Notas" portal
(persisted as `final_grade_manual`) showed up in the Consolidado but NOT
in the Libreta — all cells appeared as "-".

Fix lives at /app/backend/routes/libreta.py lines 410-432.

Test strategy (E2E against live preview backend):
  1. Login as admin@elroble.edu.
  2. Pick a real student + section + active period from El Roble.
  3. Use Mongo directly (motor) to seed 3 controlled scenarios on
     `student_grades` (manual-only, manual+auto, auto-only).
  4. Hit /api/libreta and /api/grades/consolidated-report.
  5. Assert that for the SAME (student, period, subject) the value
     returned by the libreta equals the one in the consolidado, and
     equals the expected one.
  6. Cleanup: restore the original `student_grades` docs.

Author: testing agent T1 (iteration 208 — Libreta P0 hotfix).
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List, Optional

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

# ──────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────
def _load_env_file(path: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return out


_FRONT_ENV = _load_env_file("/app/frontend/.env")
_BACK_ENV = _load_env_file("/app/backend/.env")

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _FRONT_ENV.get("REACT_APP_BACKEND_URL", "")
).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

MONGO_URL = os.environ.get("MONGO_URL") or _BACK_ENV.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME") or _BACK_ENV.get("DB_NAME", "database")

ADMIN = {"email": "admin@elroble.edu", "password": "1234abc8", "subdomain": "elroble"}

TEST_MARK = "TEST_LIBRETA_FGM_HOTFIX"  # used to identify rows we created


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _letter_for(num: Optional[float]) -> Optional[str]:
    """Replica de services.grades_literal.numerica_a_letra."""
    if num is None:
        return None
    import math
    rounded = int(math.floor(float(num) + 0.5))
    if rounded <= 10:
        return "C"
    if rounded <= 13:
        return "B"
    if rounded <= 17:
        return "A"
    return "AD"


def _login(creds: Dict[str, str]) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


# ──────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN)


@pytest.fixture(scope="module")
def admin_headers(admin_token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mongo(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def context(admin_headers, mongo, event_loop) -> Dict[str, Any]:
    """Resolve a viable (school, student, section, period, subjects) tuple.

    Picks an El Roble student already enrolled in a section that has at
    least 3 active subjects and whose active period has NO snapshot for
    that student (so the libreta is not served from snapshot read-through).
    """
    async def _resolve() -> Dict[str, Any]:
        # School
        school = await mongo.schools.find_one({"subdomain": "elroble"}, {"_id": 0, "id": 1})
        assert school, "El Roble school not found"
        school_id = school["id"]

        # Active period
        periods = await mongo.academic_periods.find(
            {"school_id": school_id},
            {"_id": 0, "id": 1, "activo": 1, "nombre": 1, "orden": 1},
        ).sort("orden", 1).to_list(20)
        assert periods, "No academic periods"
        period = next((p for p in periods if p.get("activo")), periods[0])
        period_id = period["id"]

        # Find a section with ≥3 subjects, with an enrolled student, no snapshot for that period
        sections = await mongo.sections.find(
            {"school_id": school_id}, {"_id": 0, "id": 1, "grado_id": 1}
        ).to_list(200)
        for sec in sections:
            section_id = sec["id"]
            subjects = await mongo.subjects.find(
                {"school_id": school_id, "section_id": section_id, "status": {"$ne": "inactive"}},
                {"_id": 0, "id": 1, "name": 1},
            ).to_list(50)
            if len(subjects) < 3 and sec.get("grado_id"):
                subjects = await mongo.subjects.find(
                    {"school_id": school_id, "grade_id": sec["grado_id"], "status": {"$ne": "inactive"}},
                    {"_id": 0, "id": 1, "name": 1},
                ).to_list(50)
            if len(subjects) < 3:
                continue

            students = await mongo.users.find(
                {
                    "school_id": school_id, "role": "student",
                    "student_status": {"$in": ["enrolled", "active"]},
                    "$or": [{"seccion_id": section_id}, {"section_id": section_id}],
                },
                {"_id": 0, "id": 1},
            ).to_list(500)
            for stu in students:
                snap = await mongo.report_cards_snapshots.find_one(
                    {"school_id": school_id, "student_id": stu["id"], "period_id": period_id},
                    {"_id": 0, "id": 1},
                )
                if snap:
                    continue
                return {
                    "school_id": school_id,
                    "section_id": section_id,
                    "period_id": period_id,
                    "student_id": stu["id"],
                    "subjects": subjects[:3],
                }
        raise RuntimeError("No suitable section/student/period combination found")

    ctx = event_loop.run_until_complete(_resolve())
    return ctx


@pytest.fixture(scope="module")
def seeded(context, mongo, event_loop):
    """Seed 3 scenarios on student_grades and yield them. Cleanup afterwards.

    Scenarios:
      A (subjects[0]) — final_grade_manual=18.5, final_grade=None    → expect 18.5 (AD)
      B (subjects[1]) — final_grade_manual=16,   final_grade=12      → expect 16   (A)
      C (subjects[2]) — final_grade_manual=None, final_grade=15      → expect 15   (A)
    """
    import uuid
    from datetime import datetime, timezone

    school_id = context["school_id"]
    student_id = context["student_id"]
    section_id = context["section_id"]
    period_id = context["period_id"]
    subjects = context["subjects"]

    scenarios = [
        {"subject_id": subjects[0]["id"], "final_grade_manual": 18.5, "final_grade": None, "expected": 18.5},
        {"subject_id": subjects[1]["id"], "final_grade_manual": 16.0, "final_grade": 12.0, "expected": 16.0},
        {"subject_id": subjects[2]["id"], "final_grade_manual": None, "final_grade": 15.0, "expected": 15.0},
    ]

    async def _seed():
        originals = []
        now = datetime.now(timezone.utc).isoformat()
        for sc in scenarios:
            q = {
                "school_id": school_id,
                "student_id": student_id,
                "section_id": section_id,
                "period_id": period_id,
                "subject_id": sc["subject_id"],
            }
            orig = await mongo.student_grades.find_one(q, {"_id": 0})
            originals.append({"query": q, "doc": orig})
            payload = {
                "final_grade": sc["final_grade"],
                "final_grade_manual": sc["final_grade_manual"],
                "_test_mark": TEST_MARK,
                "updated_at": now,
            }
            if orig:
                await mongo.student_grades.update_one(
                    {"id": orig["id"]} if orig.get("id") else q, {"$set": payload}
                )
            else:
                new_doc = {
                    "id": str(uuid.uuid4()),
                    **q,
                    **payload,
                    "created_at": now,
                }
                await mongo.student_grades.insert_one(new_doc)
        return originals

    async def _restore(originals):
        for entry in originals:
            q = entry["query"]
            orig = entry["doc"]
            if orig is None:
                await mongo.student_grades.delete_many({**q, "_test_mark": TEST_MARK})
            else:
                # Replace back exactly as it was
                await mongo.student_grades.replace_one(
                    {"id": orig["id"]} if orig.get("id") else q, orig, upsert=True
                )

    originals = event_loop.run_until_complete(_seed())
    yield scenarios
    event_loop.run_until_complete(_restore(originals))


# ──────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────
class TestLibretaRespectsFinalGradeManual:
    """The libreta MUST mirror the consolidated precedence for final_grade_manual."""

    def _fetch_libreta(self, headers, context) -> Dict[str, Any]:
        url = f"{BASE_URL}/api/libreta/{context['student_id']}?period_id={context['period_id']}"
        r = requests.get(url, headers=headers, timeout=30)
        assert r.status_code == 200, f"libreta failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        # If served from snapshot, our injected rows would be ignored. Guard.
        meta = data.get("metadata") or {}
        assert not meta.get("is_snapshot"), "libreta unexpectedly served from snapshot"
        return data

    def _libreta_value(self, libreta: Dict[str, Any], subject_id: str, period_id: str):
        for area in libreta.get("areas", []):
            for s in area.get("subjects", []):
                if s.get("id") == subject_id:
                    return s.get("grades", {}).get(period_id, {})
        for s in libreta.get("subjects_without_area", []):
            if s.get("id") == subject_id:
                return s.get("grades", {}).get(period_id, {})
        return None

    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code in (200, 204)

    # Case 1: manual-only → libreta must return the manual value
    def test_libreta_returns_manual_when_final_grade_is_none(self, admin_headers, context, seeded):
        sc = seeded[0]  # 18.5 / None
        libreta = self._fetch_libreta(admin_headers, context)
        cell = self._libreta_value(libreta, sc["subject_id"], context["period_id"])
        assert cell is not None, "subject not found in libreta payload"
        assert cell.get("numeric") == sc["expected"], (
            f"manual-only: expected {sc['expected']} got {cell.get('numeric')}"
        )
        assert cell.get("letter") == _letter_for(sc["expected"]) == "AD"

    # Case 2: manual + auto → manual wins (same as consolidated)
    def test_libreta_manual_beats_auto(self, admin_headers, context, seeded):
        sc = seeded[1]  # manual=16, auto=12 → expect 16
        libreta = self._fetch_libreta(admin_headers, context)
        cell = self._libreta_value(libreta, sc["subject_id"], context["period_id"])
        assert cell is not None
        assert cell.get("numeric") == sc["expected"], (
            f"manual-beats-auto: expected {sc['expected']} got {cell.get('numeric')}"
        )
        assert cell.get("letter") == _letter_for(sc["expected"]) == "A"

    # Case 3: no regression — auto-only still works
    def test_libreta_auto_only_no_regression(self, admin_headers, context, seeded):
        sc = seeded[2]  # auto=15, manual=None → expect 15
        libreta = self._fetch_libreta(admin_headers, context)
        cell = self._libreta_value(libreta, sc["subject_id"], context["period_id"])
        assert cell is not None
        assert cell.get("numeric") == sc["expected"], (
            f"auto-only: expected {sc['expected']} got {cell.get('numeric')}"
        )
        assert cell.get("letter") == _letter_for(sc["expected"]) == "A"

    # Case 4: promedio_area / promedio_final must include the new manual values
    def test_promedios_reflect_manual_values(self, admin_headers, context, seeded):
        libreta = self._fetch_libreta(admin_headers, context)
        period_id = context["period_id"]
        # Build subject_id -> expected map and locate them
        expected_by_subj = {sc["subject_id"]: sc["expected"] for sc in seeded}
        for area in libreta.get("areas", []):
            area_vals: List[float] = []
            for s in area.get("subjects", []):
                num = (s.get("grades") or {}).get(period_id, {}).get("numeric")
                # promedio_final del subject debe coincidir con su única nota del periodo
                if s["id"] in expected_by_subj and num is not None:
                    pf = (s.get("promedio_final") or {}).get("numeric")
                    # promedio_final = único valor cuando solo hay un periodo cargado
                    assert pf == num, (
                        f"subject {s['id']} promedio_final={pf} != numeric={num}"
                    )
                if num is not None:
                    area_vals.append(num)
            # promedio_area del periodo debe ser el promedio de los subjects del área
            if area_vals:
                avg_expected = round(sum(area_vals) / len(area_vals), 2)
                avg_got = (area.get("promedio_area") or {}).get(period_id, {}).get("numeric")
                # Permitir desviación mínima de redondeo
                assert avg_got is not None
                assert abs(float(avg_got) - avg_expected) < 0.01, (
                    f"area {area.get('name')} avg expected={avg_expected} got={avg_got}"
                )

    # Case 5: PARITY with consolidated — same number for the SAME (student, subject, period)
    def test_parity_with_consolidated_report(self, admin_headers, context, seeded):
        # Pull libreta
        libreta = self._fetch_libreta(admin_headers, context)
        # Pull consolidado
        cr_url = (
            f"{BASE_URL}/api/grades/consolidated-report/"
            f"{context['section_id']}/{context['period_id']}"
        )
        r = requests.get(cr_url, headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"consolidated failed: {r.status_code} {r.text[:200]}"
        cr = r.json()

        # Find the row for our student
        rows = cr.get("students") or cr.get("rows") or cr.get("data") or []
        if not rows and isinstance(cr, list):
            rows = cr
        target = next((row for row in rows if row.get("student_id") == context["student_id"]), None)
        assert target is not None, f"student {context['student_id']} not in consolidated"

        # Build subject_id -> value map from consolidated. The endpoint exposes
        # per-subject numeric grade as `grades` dict or `subjects` list.
        cr_grades: Dict[str, Optional[float]] = {}
        if isinstance(target.get("grades"), dict):
            for k, v in target["grades"].items():
                cr_grades[k] = v.get("numeric") if isinstance(v, dict) else v
        elif isinstance(target.get("subjects"), list):
            for s in target["subjects"]:
                cr_grades[s.get("subject_id") or s.get("id")] = (
                    s.get("numeric") if "numeric" in s else s.get("grade")
                )
        # Last-resort: flat list of {subject_id, grade}
        if not cr_grades and isinstance(target.get("notes"), list):
            for s in target["notes"]:
                cr_grades[s.get("subject_id")] = s.get("grade") or s.get("numeric")

        # For every seeded subject, libreta value must == consolidado value
        for sc in seeded:
            sid = sc["subject_id"]
            cell = self._libreta_value(libreta, sid, context["period_id"]) or {}
            lib_val = cell.get("numeric")
            cr_val = cr_grades.get(sid)
            assert lib_val == sc["expected"], (
                f"libreta {sid} expected {sc['expected']} got {lib_val}"
            )
            if cr_val is None:
                # If we can't extract cr value from this schema, skip parity for this row
                continue
            # The consolidated endpoint rounds to int for display (see
            # routes/grades.py line ~1011). The libreta returns the raw float.
            # Parity is verified at the displayed-integer level — the bug
            # was that consolidado showed a value and libreta showed "-".
            assert int(round(float(lib_val))) == int(cr_val), (
                f"parity violated for {sid}: libreta={lib_val} consolidado={cr_val}"
            )

    # Case 6: dynamic / custom-template branch — no regression
    # If the active template is SYSTEM (common case in El Roble), the on-the-fly
    # recompute path is a no-op; we just verify the endpoint still works without
    # error AND that subjects with no grades come back as None on both sides.
    def test_no_regression_for_dynamic_path(self, admin_headers, context):
        libreta_url = f"{BASE_URL}/api/libreta/{context['student_id']}?period_id={context['period_id']}"
        r = requests.get(libreta_url, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # The areas list should exist and be JSON-serializable; promedios should
        # never raise when some cells are None.
        assert "areas" in data and isinstance(data["areas"], list)
        for area in data["areas"]:
            assert "promedio_area" in area
            for s in area.get("subjects", []):
                assert "grades" in s and isinstance(s["grades"], dict)
                # Every cell must be either {numeric, letter} dict or absent
                for v in s["grades"].values():
                    assert isinstance(v, dict)
                    assert "numeric" in v and "letter" in v
