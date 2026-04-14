"""Migration: Add unique sparse index on payment_requests.operation_code.

Idempotent — safe to run multiple times.
If duplicates exist, logs them and aborts WITHOUT creating the index.
"""
import asyncio
import os
import motor.motor_asyncio

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "database")


async def run():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("[Migration] Checking for duplicate operation_codes in payment_requests...")

    pipeline = [
        {"$match": {"operation_code": {"$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$operation_code", "count": {"$sum": 1}, "school_ids": {"$push": "$school_id"}, "created_ats": {"$push": "$created_at"}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    duplicates = await db.payment_requests.aggregate(pipeline).to_list(100)

    if duplicates:
        print(f"[Migration] ABORTING: Found {len(duplicates)} duplicate operation_codes:")
        for d in duplicates:
            print(f"  operation_code={d['_id']}, count={d['count']}, schools={d['school_ids']}, dates={d['created_ats']}")
        print("[Migration] Please resolve duplicates manually before creating the unique index.")
        return

    print("[Migration] No duplicates found. Creating unique sparse index...")

    existing_indexes = await db.payment_requests.index_information()
    if "unique_operation_code" in existing_indexes:
        print("[Migration] Index 'unique_operation_code' already exists. Skipping.")
        return

    await db.payment_requests.create_index(
        "operation_code",
        unique=True,
        sparse=True,
        name="unique_operation_code"
    )
    print("[Migration] Index 'unique_operation_code' created successfully.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
