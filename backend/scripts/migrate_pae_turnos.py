"""
One-time migration: Seed default PAE turnos for all existing schools.
Idempotent — safe to run multiple times.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "edunet")

DEFAULT_TURNOS = [
    {"nombre": "Desayuno Escolar", "hora_inicio": "07:00", "hora_fin": "08:30", "orden": 1, "activo": False},
    {"nombre": "Almuerzo", "hora_inicio": "12:00", "hora_fin": "13:30", "orden": 2, "activo": True},
]

async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    schools = await db.schools.find({}, {"_id": 0, "id": 1, "school_name": 1}).to_list(length=10000)
    print(f"Found {len(schools)} schools total")

    migrated = 0
    skipped = 0

    for school in schools:
        sid = school["id"]
        name = school.get("school_name", sid)

        existing_count = await db.pae_turnos.count_documents({"school_id": sid})
        if existing_count > 0:
            print(f"  SKIP: {name} (already has {existing_count} turnos)")
            skipped += 1
            continue

        now = datetime.now(timezone.utc).isoformat()
        for t in DEFAULT_TURNOS:
            await db.pae_turnos.insert_one({
                "id": str(uuid.uuid4()),
                "school_id": sid,
                "nombre": t["nombre"],
                "hora_inicio": t["hora_inicio"],
                "hora_fin": t["hora_fin"],
                "orden": t["orden"],
                "activo": t["activo"],
                "created_at": now,
                "updated_at": now,
            })

        print(f"  MIGRATED: {name}")
        migrated += 1

    print(f"\n=== RESULT ===")
    print(f"Migrated: {migrated}")
    print(f"Skipped:  {skipped}")
    print(f"Total:    {len(schools)}")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
