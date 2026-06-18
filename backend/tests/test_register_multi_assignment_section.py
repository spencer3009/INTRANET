"""Reproduce the Eusebio Arróniz / Diana bug: a teacher has the SAME subject
assigned to TWO sections (3 años · ÚNICA and 4 años · ÚNICA). The Registro
Auxiliar must resolve to the section the teacher OPENED (requested), not an
arbitrary one picked by find_one.

Tests `_resolve_effective_section_id` directly (no HTTP) with seeded data,
then cleans up.
"""
import os
import asyncio
import uuid
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    import routes.core as core
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    core.db = db  # ensure module uses this connection
    from routes.grades import _resolve_effective_section_id

    school_id = f"TEST-SCHOOL-{uuid.uuid4().hex[:6]}"
    teacher_id = f"TEST-DIANA-{uuid.uuid4().hex[:6]}"
    subject_id = f"TEST-SUBJ-{uuid.uuid4().hex[:6]}"
    sec_3 = f"TEST-SEC3-{uuid.uuid4().hex[:6]}"  # 3 años ÚNICA (requested/correct)
    sec_4 = f"TEST-SEC4-{uuid.uuid4().hex[:6]}"  # 4 años ÚNICA (wrong)

    # Insert the 4-años assignment FIRST so a naive find_one returns it.
    await db.academic_assignments.insert_one({
        "id": str(uuid.uuid4()), "school_id": school_id, "teacher_id": teacher_id,
        "subject_id": subject_id, "section_id": sec_4, "status": "activo",
    })
    await db.academic_assignments.insert_one({
        "id": str(uuid.uuid4()), "school_id": school_id, "teacher_id": teacher_id,
        "subject_id": subject_id, "section_id": sec_3, "status": "activo",
    })

    try:
        # Teacher opens the register for the 3-años section → must stay on 3 años.
        eff = await _resolve_effective_section_id(
            school_id, subject_id, sec_3, role="teacher", teacher_id=teacher_id
        )
        assert eff == sec_3, f"Expected requested section honored, got {eff}"
        print("MULTI-ASSIGNMENT OK: register honors requested section (3 años)")

        # Teacher opens the 4-años section → must stay on 4 años.
        eff4 = await _resolve_effective_section_id(
            school_id, subject_id, sec_4, role="teacher", teacher_id=teacher_id
        )
        assert eff4 == sec_4, f"Expected 4 años honored, got {eff4}"
        print("MULTI-ASSIGNMENT OK: register honors requested section (4 años)")

        # Swap case: requested section has NO assignment → fall back to an
        # assignment section (the original swap-correction behavior).
        ghost = f"GHOST-{uuid.uuid4().hex[:6]}"
        eff_swap = await _resolve_effective_section_id(
            school_id, subject_id, ghost, role="teacher", teacher_id=teacher_id
        )
        assert eff_swap in (sec_3, sec_4), f"Expected fallback to an assignment, got {eff_swap}"
        print("SWAP FALLBACK OK:", eff_swap)
    finally:
        await db.academic_assignments.delete_many({"school_id": school_id})

    print("ALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
