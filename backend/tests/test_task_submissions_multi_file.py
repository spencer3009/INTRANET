"""
Test Multi-File Task Submissions
=================================
Tests the new multi-file upload capability on POST /api/course/tasks/{task_id}/submit.

Covers:
- New `files` field (List[UploadFile]) with multiple files
- Legacy `file` field still works (backward compatibility)
- Validation: no text and no files -> 400
- Validation: more than 20 files -> 400
- Replacement of existing submission (replaced=true)
- GET submissions returns `attachments` array + legacy fields
- GET download supports attachment_index / attachment_id / fallback to first
- DELETE retract works for multi-file submissions
- Verify Cloudinary fallback (storage_type='cloudinary') when Drive not connected.
"""

import io
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def ctx():
    """Bootstrap using existing admin@elroble.edu; create only student + task."""
    data = {}
    uid = str(uuid.uuid4())[:8]

    # Login admin
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@elroble.edu", "password": "1234abc8",
    })
    assert r.status_code == 200, r.text
    data["admin_token"] = r.json()["token"]

    # Get academic level
    r = requests.get(
        f"{BASE_URL}/api/academic/levels",
        headers={"Authorization": f"Bearer {data['admin_token']}"},
    )
    assert r.status_code == 200, r.text
    levels = r.json() if isinstance(r.json(), list) else r.json().get("levels", [])
    assert levels
    data["level_id"] = levels[0]["id"]

    # Get any existing subject (admin has many)
    r = requests.get(
        f"{BASE_URL}/api/academic/subjects",
        headers={"Authorization": f"Bearer {data['admin_token']}"},
    )
    assert r.status_code == 200, r.text
    js = r.json()
    subs = js if isinstance(js, list) else js.get("subjects", [])
    assert subs, "no subjects"
    data["subject_id"] = subs[0]["id"]

    # Create a student (use admin/users endpoint)
    su = f"TEST_stu_multi_{uid}"
    r = requests.post(
        f"{BASE_URL}/api/users",
        json={"username": su, "name": "MultiStu", "last_name": "Test",
              "email": f"{su}@test.pe", "password": "test123456", "role": "student"},
        headers={"Authorization": f"Bearer {data['admin_token']}"},
    )
    assert r.status_code in (200, 201), r.text
    rj = r.json()
    data["student_id"] = (rj.get("user") or {}).get("id") or rj.get("id")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": su, "password": "test123456",
    })
    assert r.status_code == 200, r.text
    data["student_token"] = r.json()["token"]

    # Task with delivery_type allowing files
    due = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = requests.post(
        f"{BASE_URL}/api/course/{data['subject_id']}/posts",
        json={
            "subject_id": data["subject_id"],
            "title": "Multi File Task",
            "content": "Submit multiple files",
            "post_type": "task",
            "metadata": {
                "due_date": due,
                "points": 20,
                "allow_late_submissions": True,
                "delivery_type": "Texto y archivos",
            },
        },
        headers={"Authorization": f"Bearer {data['admin_token']}"},
    )
    assert r.status_code in (200, 201), r.text
    rj = r.json()
    data["task_id"] = (rj.get("post") or {}).get("id") or rj.get("id")
    # Use admin token for "teacher" view tests since admin can view too
    data["teacher_token"] = data["admin_token"]
    return data


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _mkfile(name, content=b"hello world", ctype="text/plain"):
    return (name, io.BytesIO(content), ctype)


# --- Validation tests ---

class TestValidation:
    def test_no_text_no_files_400(self, ctx):
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            data={}, headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 400, r.text

    def test_too_many_files_400(self, ctx):
        files = [("files", _mkfile(f"f{i}.txt")) for i in range(21)]
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            files=files, headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 400, r.text
        assert "20" in r.text or "más de" in r.text.lower()


# --- Single file via new `files` field ---

class TestSingleFileNewField:
    def test_submit_single_file_new_field(self, ctx):
        files = [("files", _mkfile("single.txt", b"single file content"))]
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            files=files, headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["attachments_count"] == 1
        assert body["replaced"] is False
        assert body.get("submission_id")
        ctx["sub_id_single"] = body["submission_id"]
        # Drive likely not connected -> should be cloudinary
        assert body.get("storage_type") in ("cloudinary", "google_drive"), body

    def test_get_submissions_after_single(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions",
            headers=_auth(ctx["admin_token"]),
        )
        assert r.status_code == 200, r.text
        subs = r.json().get("submissions", [])
        assert subs, "should have at least one submission"
        sub = next((s for s in subs if s.get("id") == ctx["sub_id_single"]), subs[0])
        assert "attachments" in sub
        assert isinstance(sub["attachments"], list)
        assert len(sub["attachments"]) == 1
        att = sub["attachments"][0]
        for k in ("id", "file_name", "file_type", "file_size", "storage_type"):
            assert k in att, f"missing {k} in attachment"
        # legacy fields populated from first attachment
        assert sub.get("file_name") == att.get("file_name")
        assert sub.get("storage_type") == att.get("storage_type")


# --- Multiple files (3) - replaces previous submission ---

class TestMultipleFiles:
    def test_submit_three_files_replaces(self, ctx):
        files = [
            ("files", _mkfile("doc1.txt", b"content one")),
            ("files", _mkfile("doc2.txt", b"content two two")),
            ("files", _mkfile("doc3.txt", b"content three three three")),
        ]
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            data={"text_content": "with three files"},
            files=files,
            headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["attachments_count"] == 3, body
        assert body["replaced"] is True, body
        # submission_id should remain the same as the prior single submission
        assert body["submission_id"] == ctx.get("sub_id_single"), (
            f"replaced submission should keep id; got {body['submission_id']} vs {ctx.get('sub_id_single')}"
        )
        ctx["sub_id"] = body["submission_id"]

    def test_get_submissions_three_files(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions",
            headers=_auth(ctx["admin_token"]),
        )
        assert r.status_code == 200, r.text
        subs = r.json()["submissions"]
        sub = next((s for s in subs if s.get("id") == ctx["sub_id"]), None)
        assert sub, "submission not found"
        assert len(sub["attachments"]) == 3
        names = [a["file_name"] for a in sub["attachments"]]
        assert names == ["doc1.txt", "doc2.txt", "doc3.txt"], names
        # Legacy fields point to first attachment
        assert sub["file_name"] == "doc1.txt"
        # store first att id for download by id
        ctx["att_first_id"] = sub["attachments"][0]["id"]
        ctx["att_third_id"] = sub["attachments"][2]["id"]


# --- Download endpoint ---

class TestDownload:
    def test_download_default_first(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions/{ctx['sub_id']}/download",
            headers=_auth(ctx["admin_token"]),
            allow_redirects=False,
        )
        # Could be 200 (stream) or 302/307 (redirect to cloudinary URL)
        assert r.status_code in (200, 302, 307), f"got {r.status_code}: {r.text[:200]}"

    def test_download_by_index_2(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions/{ctx['sub_id']}/download",
            params={"attachment_index": 2},
            headers=_auth(ctx["admin_token"]),
            allow_redirects=False,
        )
        assert r.status_code in (200, 302, 307), f"got {r.status_code}: {r.text[:200]}"

    def test_download_index_out_of_range_404(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions/{ctx['sub_id']}/download",
            params={"attachment_index": 99},
            headers=_auth(ctx["admin_token"]),
            allow_redirects=False,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"

    def test_download_by_id(self, ctx):
        r = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions/{ctx['sub_id']}/download",
            params={"attachment_id": ctx["att_third_id"]},
            headers=_auth(ctx["admin_token"]),
            allow_redirects=False,
        )
        assert r.status_code in (200, 302, 307), f"got {r.status_code}: {r.text[:200]}"


# --- Legacy single-file field still works ---

class TestLegacyFileField:
    def test_legacy_file_field(self, ctx):
        # First retract to allow a fresh submission via legacy field
        rdel = requests.delete(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submission",
            headers=_auth(ctx["student_token"]),
        )
        assert rdel.status_code in (200, 204), rdel.text

        # Now submit with legacy `file` field
        files = {"file": _mkfile("legacy.txt", b"legacy single")}
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            files=files,
            headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["attachments_count"] == 1
        # not replaced because we retracted first
        assert body["replaced"] is False

        # verify GET shows it as attachment
        rg = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions",
            headers=_auth(ctx["admin_token"]),
        )
        subs = rg.json()["submissions"]
        # find our student's submission
        sub = next((s for s in subs if s.get("id") == body["submission_id"]), None)
        assert sub is not None
        assert len(sub["attachments"]) == 1
        assert sub["attachments"][0]["file_name"] == "legacy.txt"
        assert sub["file_name"] == "legacy.txt"  # legacy field populated


# --- Retract ---

class TestRetract:
    def test_retract_multi_file_submission(self, ctx):
        # Replace with multi-files first
        files = [
            ("files", _mkfile("a.txt", b"a")),
            ("files", _mkfile("b.txt", b"b")),
        ]
        r = requests.post(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submit",
            files=files, headers=_auth(ctx["student_token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["attachments_count"] == 2

        rdel = requests.delete(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submission",
            headers=_auth(ctx["student_token"]),
        )
        assert rdel.status_code in (200, 204), rdel.text

        # Verify removed
        rg = requests.get(
            f"{BASE_URL}/api/course/tasks/{ctx['task_id']}/submissions",
            headers=_auth(ctx["admin_token"]),
        )
        subs = rg.json()["submissions"]
        own = [s for s in subs if s.get("student_id") == ctx["student_id"]]
        assert not own, f"submission still present after retract: {own}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
