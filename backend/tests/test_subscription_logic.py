"""
Tests for calculate_plan_state logic in subscription.py
Validates that the fix for P0 bug works:
- PAGO_EN_VERIFICACION only applies when dias_vencido < 3
- Date parsing failure returns PAGO_OBLIGATORIO (not ACTIVO)
- Schools with 3+ days overdue are ALWAYS blocked
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock db before importing
mock_db = MagicMock()
mock_payment_requests = AsyncMock()
mock_db.payment_requests = mock_payment_requests


def make_school(dias_vencido, school_id="test-school-1"):
    """Helper: create school doc with fecha_vencimiento set to N days ago"""
    exp = (datetime.now(timezone.utc) - timedelta(days=dias_vencido)).isoformat()
    return {"id": school_id, "fecha_vencimiento": exp}


async def run_tests():
    # Patch db in subscription module
    with patch('routes.subscription.db', mock_db):
        from routes.subscription import calculate_plan_state

        results = []

        # Test 1: School NOT overdue (active)
        mock_payment_requests.find_one = AsyncMock(return_value=None)
        state, days = await calculate_plan_state(make_school(-10))
        ok = state == "ACTIVO" and days < 0
        results.append(("Activo (no vencido)", ok, f"state={state}, days={days}"))

        # Test 2: School expired today
        state, days = await calculate_plan_state(make_school(0))
        ok = state == "AVISO_VENCIMIENTO"
        results.append(("Aviso vencimiento (dia 0)", ok, f"state={state}, days={days}"))

        # Test 3: School 1 day overdue -> RESTRICCION_PARCIAL
        state, days = await calculate_plan_state(make_school(1))
        ok = state == "RESTRICCION_PARCIAL"
        results.append(("Restriccion parcial (dia 1)", ok, f"state={state}, days={days}"))

        # Test 4: School 2 days overdue -> RESTRICCION_PARCIAL
        state, days = await calculate_plan_state(make_school(2))
        ok = state == "RESTRICCION_PARCIAL"
        results.append(("Restriccion parcial (dia 2)", ok, f"state={state}, days={days}"))

        # Test 5: School 3 days overdue -> PAGO_OBLIGATORIO
        state, days = await calculate_plan_state(make_school(3))
        ok = state == "PAGO_OBLIGATORIO" and days == 3
        results.append(("Pago obligatorio (dia 3)", ok, f"state={state}, days={days}"))

        # Test 6: School 5 days overdue -> PAGO_OBLIGATORIO
        state, days = await calculate_plan_state(make_school(5))
        ok = state == "PAGO_OBLIGATORIO" and days == 5
        results.append(("Pago obligatorio (dia 5)", ok, f"state={state}, days={days}"))

        # Test 7: School 7+ days -> SUSPENDIDO
        state, days = await calculate_plan_state(make_school(7))
        ok = state == "SUSPENDIDO" and days == 7
        results.append(("Suspendido (dia 7)", ok, f"state={state}, days={days}"))

        # ===== KEY BUG FIX TESTS =====

        # Test 8: School 5 days overdue WITH pending payment -> should STILL be PAGO_OBLIGATORIO
        mock_payment_requests.find_one = AsyncMock(return_value={"id": "fake-payment"})
        state, days = await calculate_plan_state(make_school(5))
        ok = state == "PAGO_OBLIGATORIO" and days == 5
        results.append(("BUG FIX: 5 dias + pago pendiente = PAGO_OBLIGATORIO", ok, f"state={state}, days={days}"))

        # Test 9: School 3 days overdue WITH pending payment -> should STILL be PAGO_OBLIGATORIO
        state, days = await calculate_plan_state(make_school(3))
        ok = state == "PAGO_OBLIGATORIO" and days == 3
        results.append(("BUG FIX: 3 dias + pago pendiente = PAGO_OBLIGATORIO", ok, f"state={state}, days={days}"))

        # Test 10: School 1 day overdue WITH pending payment -> PAGO_EN_VERIFICACION (ok, < 3 days)
        state, days = await calculate_plan_state(make_school(1))
        ok = state == "PAGO_EN_VERIFICACION"
        results.append(("Pago en verificacion (dia 1, pago pendiente)", ok, f"state={state}, days={days}"))

        # Test 11: Invalid date format -> PAGO_OBLIGATORIO (not ACTIVO!)
        mock_payment_requests.find_one = AsyncMock(return_value=None)
        state, days = await calculate_plan_state({"id": "bad-date", "fecha_vencimiento": "not-a-date"})
        ok = state == "PAGO_OBLIGATORIO"
        results.append(("BUG FIX: Fecha invalida = PAGO_OBLIGATORIO", ok, f"state={state}, days={days}"))

        # Test 12: No fecha_vencimiento -> ACTIVO (no expiration set)
        state, days = await calculate_plan_state({"id": "no-date"})
        ok = state == "ACTIVO"
        results.append(("Sin fecha = ACTIVO", ok, f"state={state}, days={days}"))

        # Print results
        print("\n" + "=" * 60)
        print("SUBSCRIPTION LOGIC TESTS")
        print("=" * 60)
        passed = 0
        failed = 0
        for name, ok, detail in results:
            status = "PASS" if ok else "FAIL"
            if ok:
                passed += 1
            else:
                failed += 1
            print(f"  [{status}] {name}: {detail}")
        print(f"\nTotal: {passed} passed, {failed} failed out of {len(results)}")
        print("=" * 60)
        return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
