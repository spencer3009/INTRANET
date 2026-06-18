"""Verify the topico 'Información Paciente' permission toggle + gated contact endpoint."""
import os, asyncio, uuid, jwt, httpx, datetime
from motor.motor_asyncio import AsyncIOMotorClient

db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
API = os.environ["REACT_APP_BACKEND_URL"] + "/api"
SCHOOL = "b9f27249-6568-49ae-94d3-e1f16750d7d9"


def jwt_for(uid, role):
    return jwt.encode({"sub": uid, "id": uid, "role": role,
                       "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600},
                      JWT_SECRET, algorithm="HS256")


async def main():
    tag = uuid.uuid4().hex[:6]
    admin_id = f"ADMIN-{tag}"
    topico_id = f"TOPICO-{tag}"
    parent_id = f"PARENT-{tag}"
    student_id = f"STU-{tag}"

    await db.users.insert_many([
        {"id": admin_id, "school_id": SCHOOL, "role": "admin", "name": "Admin", "last_name": "T", "email": f"a{tag}@t.test"},
        {"id": topico_id, "school_id": SCHOOL, "role": "auxiliar_topico", "name": "Dunia", "last_name": "Rous", "email": f"n{tag}@t.test"},
        {"id": parent_id, "school_id": SCHOOL, "role": "parent", "name": "Maria", "last_name": "Perez", "phone": "999111222", "children": [student_id]},
        {"id": student_id, "school_id": SCHOOL, "role": "student", "name": "Niño", "last_name": "Test", "phone": "988777666", "padre_id": parent_id},
    ])
    admin_h = {"Authorization": "Bearer " + jwt_for(admin_id, "admin")}
    topico_h = {"Authorization": "Bearer " + jwt_for(topico_id, "auxiliar_topico")}

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            # By default permission OFF -> contact-access false, endpoint 403
            acc = (await c.get(f"{API}/health/contact-access", headers=topico_h)).json()
            assert acc["can_view"] is False, acc
            r = await c.get(f"{API}/health/topico/student/{student_id}/contact", headers=topico_h)
            assert r.status_code == 403, r.text
            print("DEFAULT OFF: access false + endpoint 403 OK")

            # Admin enables permission
            up = await c.patch(f"{API}/users/topico/{topico_id}/contact-permission", headers=admin_h, json={"can_view": True})
            assert up.status_code == 200 and up.json()["can_view_patient_contact"] is True, up.text

            # Now access true + endpoint returns data
            acc2 = (await c.get(f"{API}/health/contact-access", headers=topico_h)).json()
            assert acc2["can_view"] is True, acc2
            data = (await c.get(f"{API}/health/topico/student/{student_id}/contact", headers=topico_h)).json()
            assert data["student_phone"] == "988777666", data
            assert any(p["phone"] == "999111222" and "Maria" in p["name"] for p in data["parents"]), data
            print("ENABLED: access true + contact data OK", data)

            # Disable again -> 403
            await c.patch(f"{API}/users/topico/{topico_id}/contact-permission", headers=admin_h, json={"can_view": False})
            r2 = await c.get(f"{API}/health/topico/student/{student_id}/contact", headers=topico_h)
            assert r2.status_code == 403, r2.text
            print("DISABLED AGAIN: endpoint 403 OK")
        print("ALL PASS")
    finally:
        await db.users.delete_many({"id": {"$in": [admin_id, topico_id, parent_id, student_id]}})


if __name__ == "__main__":
    asyncio.run(main())
