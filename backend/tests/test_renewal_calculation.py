"""
Unit tests for subscription renewal date calculation logic.
Tests the 4 scenarios from the bug report.
"""
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
import pytest


def calcular_nuevo_vencimiento(fecha_vencimiento_actual, fecha_pago, meses=1):
    """
    Replica the logic from support.py renew_membership endpoint.
    - If pays before/on expiration: extend from current expiration
    - If pays after expiration: extend from payment date
    """
    if fecha_vencimiento_actual and fecha_vencimiento_actual >= fecha_pago:
        base_date = fecha_vencimiento_actual
    else:
        base_date = fecha_pago
    return base_date + relativedelta(months=meses)


class TestRenewalCalculation:
    """Test cases from user's bug report table."""

    def test_pago_anticipado(self):
        """Pago anticipado: vence 22 abr, paga 14 abr -> nuevo 22 may"""
        vence = datetime(2026, 4, 22, tzinfo=timezone.utc)
        pago = datetime(2026, 4, 14, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago)
        assert nuevo == datetime(2026, 5, 22, tzinfo=timezone.utc), f"Expected 2026-05-22, got {nuevo}"

    def test_pago_dia_exacto(self):
        """Pago el dia exacto: vence 22 abr, paga 22 abr -> nuevo 22 may"""
        vence = datetime(2026, 4, 22, tzinfo=timezone.utc)
        pago = datetime(2026, 4, 22, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago)
        assert nuevo == datetime(2026, 5, 22, tzinfo=timezone.utc), f"Expected 2026-05-22, got {nuevo}"

    def test_pago_tardio(self):
        """Pago tardio: vence 22 abr, paga 30 abr -> nuevo 30 may"""
        vence = datetime(2026, 4, 22, tzinfo=timezone.utc)
        pago = datetime(2026, 4, 30, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago)
        assert nuevo == datetime(2026, 5, 30, tzinfo=timezone.utc), f"Expected 2026-05-30, got {nuevo}"

    def test_pago_muy_tardio(self):
        """Pago muy tardio: vence 22 abr, paga 15 may -> nuevo 15 jun"""
        vence = datetime(2026, 4, 22, tzinfo=timezone.utc)
        pago = datetime(2026, 5, 15, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago)
        assert nuevo == datetime(2026, 6, 15, tzinfo=timezone.utc), f"Expected 2026-06-15, got {nuevo}"

    def test_sin_vencimiento_previo(self):
        """Sin fecha de vencimiento: paga 14 abr -> nuevo 14 may"""
        pago = datetime(2026, 4, 14, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(None, pago)
        assert nuevo == datetime(2026, 5, 14, tzinfo=timezone.utc), f"Expected 2026-05-14, got {nuevo}"

    def test_renovacion_multiple_3_meses(self):
        """Renovacion 3 meses: vence 22 abr, paga 14 abr -> nuevo 22 jul"""
        vence = datetime(2026, 4, 22, tzinfo=timezone.utc)
        pago = datetime(2026, 4, 14, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago, meses=3)
        assert nuevo == datetime(2026, 7, 22, tzinfo=timezone.utc), f"Expected 2026-07-22, got {nuevo}"

    def test_fin_de_mes_enero_a_febrero(self):
        """Edge case: 31 enero + 1 mes = 28 febrero (relativedelta handles this)"""
        vence = datetime(2026, 1, 31, tzinfo=timezone.utc)
        pago = datetime(2026, 1, 20, tzinfo=timezone.utc)
        nuevo = calcular_nuevo_vencimiento(vence, pago)
        assert nuevo == datetime(2026, 2, 28, tzinfo=timezone.utc), f"Expected 2026-02-28, got {nuevo}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
