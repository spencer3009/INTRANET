import asyncio, os, sys
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()
import routes.attendance as att
from routes.attendance import _handle_double_turno_scan, _double_turno_sessions

SCHOOL = "b9f27249-6568-49ae-94d3-e1f16750d7d9"
LEVEL = "72e2d6ba-cc32-47dc-afc9-0935a5f9a46d"  # SECUNDARIA
MANANA = "8e1f4e98-37fa-40e3-a49d-a4ac08179262"
TARDE = "TESTTARDE-4f04e0"

LEVEL_CFG = {
    "level_id": LEVEL, "entry_time": "07:45", "exit_time": "16:30",
    "doble_turno": True,
    "turnos": [
        {"turno_id": MANANA, "entry_time": "07:45", "exit_time": "13:30"},
        {"turno_id": TARDE, "entry_time": "15:00", "exit_time": "16:30"},
    ],
}
ATT_CFG = {"auto_late_enabled": True, "tolerance_minutes": 5, "mark_absent_after_minutes": 30, "levels": [LEVEL_CFG]}


async def scan(db, stu, hhmm):
    # Build now from a Peru-local HH:MM today
    now = datetime.now(timezone.utc)
    now_iso = (now.replace(microsecond=0)).isoformat()
    ui = {"id": stu["id"], "full_name": stu.get("name", "Test"), "name": stu.get("name")}
    return await _handle_double_turno_scan(
        stu, stu["id"], SCHOOL, {"sub": "tester"}, "auto", ui,
        LEVEL_CFG, ATT_CFG, "2099-12-31", now, hhmm, now_iso)


async def main():
    db = att.db
    stu = await db.users.find_one({"school_id": SCHOOL, "role": "student", "nivel_id": LEVEL}, {"_id": 0})
    if not stu:
        stu = await db.users.find_one({"school_id": SCHOOL, "role": "student"}, {"_id": 0})
        stu["nivel_id"] = LEVEL
    print("Student:", stu["id"], stu.get("name"))
    day_filter = {"school_id": SCHOOL, "type": "student", "user_id": stu["id"], "date": "2099-12-31"}
    await db.attendances.delete_many(day_filter)

    print("\n-- Marca 1: 07:55 (entrada mañana, tras tolerancia 5min => late) --")
    r = await scan(db, stu, "07:55"); print(r["action"], "|", r["message"], "| status:", r["attendance"]["status"])
    print("\n-- Marca 2: 13:20 (salida mañana) --")
    r = await scan(db, stu, "13:20"); print(r["action"], "|", r["message"])
    print("\n-- Marca 3: 15:02 (entrada tarde, dentro tolerancia => present) --")
    r = await scan(db, stu, "15:02"); print(r["action"], "|", r["message"], "| status:", r["attendance"]["status"])
    print("\n-- Marca 4: 16:20 (salida tarde) --")
    r = await scan(db, stu, "16:20"); print(r["action"], "|", r["message"])
    print("\n-- Marca 5: 16:25 (ya ambas de tarde) --")
    r = await scan(db, stu, "16:25"); print(r["action"], "|", r["message"])

    doc = await db.attendances.find_one(day_filter, {"_id": 0})
    print("\n== DOC RESULTANTE ==")
    print("top status:", doc.get("status"), "| entry_time set:", bool(doc.get("entry_time")), "| exit_time set:", bool(doc.get("exit_time")))
    for tid, s in doc.get("sessions", {}).items():
        print(f"  turno {s.get('turno_name')}: entry_status={s.get('entry_status')} in={s.get('check_in_time')} exit={bool(s.get('exit_time'))} total={s.get('total_minutes')}")
    assert len(doc.get("sessions", {})) == 2, "Debe haber 2 sesiones"
    assert doc["sessions"][MANANA]["entry_status"] == "late", "Mañana debe ser tardanza"
    assert doc["sessions"][TARDE]["entry_status"] == "present", "Tarde debe ser present"
    assert doc["sessions"][MANANA]["exit_time"] and doc["sessions"][TARDE]["exit_time"], "Ambas salidas registradas"
    print("\nALL ASSERTIONS PASSED")

    await db.attendances.delete_many(day_filter)
    print("cleanup done")

asyncio.run(main())
