"""
Unit tests for Phase 5 of the Registro Auxiliar: dynamic storage of
grades via the `grades_dynamic` subdocument.

Covers the routing rules that decide whether a grade goes to a legacy
top-level field (static) or to `grades_dynamic.<column_id>` (dynamic).

Usage:
    cd /app/backend && python -m pytest tests/test_register_sync_dynamic.py -v
"""
import asyncio
import pytest

from services.register_sync import (
    COLUMN_FIELD_MAP,
    _build_grade_update,
    get_storage_field,
)


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def __aiter__(self):
        self._i = 0
        return self

    async def __anext__(self):
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._i]
        self._i += 1
        return doc


class _FakeCollection:
    def __init__(self, docs):
        self._docs = docs

    def find(self, *args, **kwargs):
        return _FakeCursor(self._docs)

    async def find_one(self, query, *args, **kwargs):
        if query.get("es_sistema") is True:
            for d in self._docs:
                if d.get("es_sistema"):
                    return d
        return None


class _FakeDB:
    def __init__(self, templates):
        self.registro_auxiliar_plantillas = _FakeCollection(templates)


# ──────────────────────────────────────────────────────────────────────
# _build_grade_update
# ──────────────────────────────────────────────────────────────────────


def test_build_grade_update_static():
    assert _build_grade_update("static", "act_co", 18) == {"act_co": 18}


def test_build_grade_update_dynamic():
    assert _build_grade_update("dynamic", "col_xyz", 16) == {
        "grades_dynamic.col_xyz": 16
    }


def test_build_grade_update_none_returns_empty():
    assert _build_grade_update(None, None, 10) == {}


def test_build_grade_update_preserves_null_value():
    """Needed for `delete` action (sets field to None)."""
    assert _build_grade_update("static", "rf_r1", None) == {"rf_r1": None}
    assert _build_grade_update("dynamic", "col_z", None) == {
        "grades_dynamic.col_z": None
    }


# ──────────────────────────────────────────────────────────────────────
# get_storage_field — static path
# ──────────────────────────────────────────────────────────────────────


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_static_column_routes_to_static():
    """Every key of COLUMN_FIELD_MAP must route to static."""
    db = _FakeDB(templates=[])
    for column_id, expected_field in COLUMN_FIELD_MAP.items():
        field_type, field_key = _run(get_storage_field(db, column_id, "school_1"))
        assert field_type == "static"
        assert field_key == expected_field


def test_legacy_io_column_still_static():
    db = _FakeDB(templates=[])
    field_type, field_key = _run(get_storage_field(db, "IO", "school_1"))
    assert field_type == "static"
    assert field_key == "act_co"


# ──────────────────────────────────────────────────────────────────────
# get_storage_field — dynamic path
# ──────────────────────────────────────────────────────────────────────


def _custom_plantilla(school_id, custom_id, label="PASITOS 1"):
    return {
        "school_id": school_id,
        "estado": "activa",
        "criterios": [
            {
                "subcolumnas": [
                    {
                        "id": custom_id,
                        "field_key": custom_id,
                        "label": label,
                        "tipo": "input",
                    }
                ]
            }
        ],
    }


def test_custom_column_from_school_template_routes_dynamic():
    school_id = "school_abc"
    custom_id = "criterio_mo361cxa_sub_1776445948431"
    db = _FakeDB(templates=[_custom_plantilla(school_id, custom_id)])

    field_type, field_key = _run(get_storage_field(db, custom_id, school_id))
    assert field_type == "dynamic"
    assert field_key == custom_id


def test_dynamic_storage_key_is_not_translated():
    """We keep the column_id verbatim under grades_dynamic — the frontend
    roundtrips the same id."""
    school_id = "school_abc"
    custom_id = "some-uuid-123-abc"
    db = _FakeDB(templates=[_custom_plantilla(school_id, custom_id)])

    _, field_key = _run(get_storage_field(db, custom_id, school_id))
    assert field_key == custom_id  # verbatim


def test_unknown_column_returns_none_none():
    """If the column doesn't exist anywhere, we refuse to save silently
    and return (None, None) — the caller must skip the write."""
    db = _FakeDB(templates=[])  # No templates at all
    field_type, field_key = _run(get_storage_field(db, "criterio_ghost_404", "school_x"))
    assert field_type is None
    assert field_key is None


def test_empty_column_id_returns_none():
    db = _FakeDB(templates=[])
    field_type, field_key = _run(get_storage_field(db, "", "school_x"))
    assert field_type is None


def test_deleted_template_is_ignored():
    """A column only present in a deleted template must NOT be accepted
    as dynamic — we don't want zombie columns."""
    school_id = "school_abc"
    custom_id = "deleted_col_id"
    plantilla = _custom_plantilla(school_id, custom_id)
    plantilla["estado"] = "eliminada"

    db = _FakeDB(templates=[plantilla])
    field_type, _ = _run(get_storage_field(db, custom_id, school_id))
    assert field_type is None


def test_system_template_fallback_for_dynamic():
    """System-wide template (es_sistema=True) should also be considered
    when the school has no custom template of its own."""
    system_col = "sys_criterio_999"
    system_tpl = {
        "es_sistema": True,
        "school_id": None,
        "estado": "activa",
        "criterios": [
            {
                "subcolumnas": [
                    {"id": system_col, "label": "SYS1", "tipo": "input"}
                ]
            }
        ],
    }
    db = _FakeDB(templates=[system_tpl])

    field_type, field_key = _run(get_storage_field(db, system_col, "school_new"))
    assert field_type == "dynamic"
    assert field_key == system_col
