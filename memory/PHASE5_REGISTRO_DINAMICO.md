# Phase 5 — Dynamic Grade Storage

**Date**: 2026-04-21
**Scope**: Backend-only. Frontend rendering of dynamic columns in the
Registro Auxiliar UI remains a follow-up.

## Problem
Grades for columns that live in a custom (school-specific) template
were silently dropped by `register_sync`: the routing map
(`COLUMN_FIELD_MAP`) only knew about the legacy/system subcolumns
(`act_co`, `rf_r1`, …). A task linked to a custom column (e.g.
`criterio_mo361cxa_sub_1776445948431`) would grade successfully inside
the task document, but the corresponding cell in the Registro
Auxiliar stayed empty.

## Solution
Added a second storage mode for `student_grades` documents via a
schemaless subdocument named `grades_dynamic`:

```json
{
  "student_id": "…",
  "period_id": "…",
  "act_co": 15,              // static (legacy) — unchanged
  "rf_r1": 14,
  "grades_dynamic": {        // NEW — free-form map
    "<column_uuid>": 18,
    "<another_uuid>": 16
  }
}
```

Legacy fields stay 100% untouched. Only writes for columns NOT in the
static map are redirected to `grades_dynamic.<column_id>`.

## Files modified
| File | Purpose | Approx. lines changed |
|---|---|---|
| `backend/services/register_sync.py` | `get_storage_field()` + `_build_grade_update()` + routing in 3 sync paths | +100 |
| `backend/routes/grades.py` | `GradeEntry.grades_dynamic` + `save_grades` dotted-key merge | +25 |
| `backend/tests/test_register_sync_dynamic.py` | 12 unit tests for routing | +200 |
| MongoDB index | `school_id_1_period_id_1_student_id_1` composite | — |

## Key routing rule (`get_storage_field`)
1. `column_id in COLUMN_FIELD_MAP` → `("static", field_name)`.
2. `column_id` exists in any non-deleted template of the school (or in
   the system template) → `("dynamic", column_id)`.
3. Otherwise → `(None, None)` and a WARNING log. The caller skips the
   write; no silent zombie data.

## Verification
- **Unit tests**: 12/12 passing (`pytest tests/test_register_sync_dynamic.py -v`).
- **Legacy static path**: `POST /api/grades/save {rf_r1: 14, comp_c1: 17}`
  → `student_grades.rf_r1 == 14.0` (top-level). ✅
- **Dynamic path from task sync**: regrading the "pasito a pasito"
  task (column `criterio_mo361cxa_sub_1776445948431`) writes
  `grades_dynamic.criterio_mo361cxa_sub_1776445948431`. ✅
- **Mixed path**: one POST that carries both static and dynamic keys
  produces the expected doc — static fields top-level and dynamic keys
  merged (never replaced) under `grades_dynamic`. ✅
- **No migration needed**: the only production school with a custom
  template had zero grades entered there yet.

## Not touched (by design)
- Legacy top-level fields in `student_grades` (read/write as before).
- `COLUMN_FIELD_MAP` (only a fallback was added around it).
- Exams / Tasks models.
- Reports / consolidados (they read the full doc so `grades_dynamic`
  is already available; adapting each report is a separate task).

## Follow-ups (out of scope)
- Front-end: make the Registro Auxiliar table read custom columns
  from `student_grades.grades_dynamic[column_id]` instead of falling
  back to empty.
- Reports that aggregate grades by criterio: teach them about
  `grades_dynamic`.
- Optional one-shot script to re-sync historical task grades that had
  a custom column and failed silently before this fix.
