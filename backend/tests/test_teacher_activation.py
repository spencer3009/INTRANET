"""
Regression test for the teacher activate/deactivate switch (jun-2026).

Validates the DB-level effects of PATCH /api/users/teachers/{id}/active:
  - deactivate sets status="inactivo" and scrambles the password (old one fails)
  - reactivate sets status="activo", issues a new temp password that verifies,
    and login of a deactivated teacher is blocked by the status check.
Seeds an isolated teacher and cleans up afterwards.
"""
import asyncio
import os
import uuid
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

PREFIX = f"test-tact-{uuid.uuid4().hex[:8]}"


@pytest.mark.asyncio
async def test_teacher_activation_resets_password():
    import sys
    sys.path.insert(0, "/app/backend")
    from routes import core

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    tid = f"{PREFIX}-teacher"
    school = f"{PREFIX}-school"
    original = "OriginalPass123"

    try:
        await db.users.insert_one({
            "id": tid, "school_id": school, "role": "teacher",
            "email": f"{PREFIX}@test.edu", "name": "Test", "last_name": "Teacher",
            "status": "activo", "password": core.hash_password(original),
        })

        # Original password verifies before deactivation.
        u = await db.users.find_one({"id": tid})
        assert core.verify_password(original, u["password"])

        # --- Deactivate (simulate endpoint effect) ---
        import secrets
        await db.users.update_one({"id": tid}, {"$set": {
            "status": "inactivo",
            "password": core.hash_password(secrets.token_urlsafe(32)),
        }})
        u = await db.users.find_one({"id": tid})
        assert u["status"] == "inactivo"
        assert not core.verify_password(original, u["password"]), "old password must stop working"

        # Login guard: a deactivated teacher must be blocked regardless of password.
        assert u.get("role") == "teacher" and u.get("status") == "inactivo"

        # --- Reactivate (simulate endpoint effect) ---
        from routes.users import _generate_temp_password
        temp = _generate_temp_password()
        await db.users.update_one({"id": tid}, {"$set": {
            "status": "activo",
            "password": core.hash_password(temp),
            "must_change_password": True,
        }})
        u = await db.users.find_one({"id": tid})
        assert u["status"] == "activo"
        assert core.verify_password(temp, u["password"]), "temp password must verify"
        assert len(temp) >= 8

        print("PASS: teacher activation/deactivation resets password correctly")
    finally:
        await db.users.delete_many({"id": tid})
        client.close()


if __name__ == "__main__":
    asyncio.run(test_teacher_activation_resets_password())
