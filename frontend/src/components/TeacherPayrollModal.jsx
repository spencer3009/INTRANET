import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  X, Loader2, Users, Save, CheckCircle2, Settings, DollarSign,
  Trash2, Lock, AlertCircle, Wallet,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_TYPES = [
  { value: "sueldo", label: "Sueldo" },
  { value: "bono", label: "Bono" },
  { value: "gratificacion", label: "Gratificación" },
  { value: "cts", label: "CTS" },
  { value: "otro", label: "Otro" },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const formatSoles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export default function TeacherPayrollModal({ token, onClose, onPaymentConfirmed }) {
  const headers = { Authorization: `Bearer ${token}` };
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [paymentType, setPaymentType] = useState("sueldo");
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [summary, setSummary] = useState({ total_pendiente: 0, total_pagado: 0, count_pendiente: 0, count_pagado: 0 });
  const [amountDraft, setAmountDraft] = useState({}); // teacher_id -> string amount
  const [rowBusy, setRowBusy] = useState({}); // teacher_id -> boolean
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/contabilidad/teacher-payments/planilla`,
        { headers, params: { year, month, payment_type: paymentType } }
      );
      setTeachers(res.data.teachers || []);
      setSummary(res.data.summary || { total_pendiente: 0, total_pagado: 0, count_pendiente: 0, count_pagado: 0 });
      // Precarga drafts
      const draft = {};
      for (const t of res.data.teachers || []) {
        draft[t.teacher_id] = String(t.payment?.amount ?? 0);
      }
      setAmountDraft(draft);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al cargar planilla");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, paymentType]);

  useEffect(() => { load(); }, [load]);

  const handleChangeAmount = (teacherId, value) => {
    setAmountDraft(prev => ({ ...prev, [teacherId]: value }));
  };

  const setRowLoading = (teacherId, v) => setRowBusy(prev => ({ ...prev, [teacherId]: v }));

  const saveDraft = async (row) => {
    const amount = parseFloat(amountDraft[row.teacher_id] || 0);
    if (isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return; }
    setRowLoading(row.teacher_id, true);
    try {
      await axios.post(
        `${API}/contabilidad/teacher-payments`,
        {
          teacher_id: row.teacher_id,
          period_year: year,
          period_month: month,
          payment_type: paymentType,
          amount,
          notes: null,
        },
        { headers }
      );
      toast.success("Monto guardado");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    } finally {
      setRowLoading(row.teacher_id, false);
    }
  };

  const confirmPayment = async (row) => {
    const amount = parseFloat(amountDraft[row.teacher_id] || 0);
    if (isNaN(amount) || amount <= 0) { toast.error("El monto debe ser mayor a cero"); return; }
    if (!window.confirm(`¿Confirmar pago de ${formatSoles(amount)} a ${row.teacher_name}? Se generará un egreso automáticamente.`)) return;
    setRowLoading(row.teacher_id, true);
    try {
      // Ensure pending record exists / up to date first
      const createRes = await axios.post(
        `${API}/contabilidad/teacher-payments`,
        {
          teacher_id: row.teacher_id,
          period_year: year,
          period_month: month,
          payment_type: paymentType,
          amount,
          notes: null,
        },
        { headers }
      );
      const paymentId = createRes.data.payment.id;
      await axios.post(
        `${API}/contabilidad/teacher-payments/${paymentId}/confirm`,
        {},
        { headers }
      );
      toast.success(`Pago a ${row.teacher_name} confirmado`);
      await load();
      if (onPaymentConfirmed) onPaymentConfirmed();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al confirmar pago");
    } finally {
      setRowLoading(row.teacher_id, false);
    }
  };

  const deleteDraft = async (row) => {
    if (!row.payment?.id) return;
    if (!window.confirm("¿Eliminar este pago pendiente?")) return;
    setRowLoading(row.teacher_id, true);
    try {
      await axios.delete(`${API}/contabilidad/teacher-payments/${row.payment.id}`, { headers });
      toast.success("Pago pendiente eliminado");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al eliminar");
    } finally {
      setRowLoading(row.teacher_id, false);
    }
  };

  const payAllPending = async () => {
    const eligible = teachers.filter(t =>
      t.payment?.status !== "pagado" &&
      parseFloat(amountDraft[t.teacher_id] || 0) > 0
    );
    if (eligible.length === 0) { toast.error("No hay pendientes con monto válido"); return; }
    if (!window.confirm(`¿Pagar ${eligible.length} profesores por un total de ${formatSoles(eligible.reduce((s, t) => s + parseFloat(amountDraft[t.teacher_id] || 0), 0))}? Se generarán ${eligible.length} egresos.`)) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const row of eligible) {
      try {
        const amount = parseFloat(amountDraft[row.teacher_id]);
        const createRes = await axios.post(
          `${API}/contabilidad/teacher-payments`,
          {
            teacher_id: row.teacher_id,
            period_year: year,
            period_month: month,
            payment_type: paymentType,
            amount,
            notes: null,
          },
          { headers }
        );
        await axios.post(
          `${API}/contabilidad/teacher-payments/${createRes.data.payment.id}/confirm`,
          {},
          { headers }
        );
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    toast.success(`${ok} pagos confirmados${fail ? ` · ${fail} errores` : ""}`);
    await load();
    if (onPaymentConfirmed) onPaymentConfirmed();
  };

  return (
    <>
      <div className="fixed inset-0 z-[180] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6 flex flex-col max-h-[92vh]" data-testid="teacher-payroll-modal">
          {/* Header */}
          <div className="px-6 py-5 rounded-t-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Planilla Docente</h2>
                  <p className="text-xs text-white/80">Gestión del pago mensual de profesores</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" data-testid="close-payroll-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selectors */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-lg bg-white/15 backdrop-blur-md text-white text-sm font-semibold border border-white/20 focus:outline-none"
                data-testid="payroll-month-select"
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1} className="text-slate-800">{m}</option>)}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg bg-white/15 backdrop-blur-md text-white text-sm font-semibold border border-white/20 focus:outline-none"
                data-testid="payroll-year-select"
              >
                {[...Array(5)].map((_, i) => {
                  const y = now.getFullYear() - 2 + i;
                  return <option key={y} value={y} className="text-slate-800">{y}</option>;
                })}
              </select>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/15 backdrop-blur-md text-white text-sm font-semibold border border-white/20 focus:outline-none"
                data-testid="payroll-type-select"
              >
                {PAYMENT_TYPES.map(p => <option key={p.value} value={p.value} className="text-slate-800">{p.label}</option>)}
              </select>
            </div>

            {/* Summary pills */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur-md p-3 border border-white/20">
                <p className="text-xs text-white/80 font-medium">Pendiente</p>
                <p className="text-lg font-bold" data-testid="payroll-total-pendiente">{formatSoles(summary.total_pendiente)}</p>
                <p className="text-[10px] text-white/70">{summary.count_pendiente} profesor{summary.count_pendiente !== 1 ? "es" : ""}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/30 backdrop-blur-md p-3 border border-white/20">
                <p className="text-xs text-white/90 font-medium">Pagado</p>
                <p className="text-lg font-bold" data-testid="payroll-total-pagado">{formatSoles(summary.total_pagado)}</p>
                <p className="text-[10px] text-white/80">{summary.count_pagado} profesor{summary.count_pagado !== 1 ? "es" : ""}</p>
              </div>
              <div className="rounded-xl bg-white/25 backdrop-blur-md p-3 border border-white/20 col-span-2 sm:col-span-1">
                <p className="text-xs text-white/80 font-medium">Total mes</p>
                <p className="text-lg font-bold">{formatSoles(summary.total_pendiente + summary.total_pagado)}</p>
                <p className="text-[10px] text-white/70">{summary.count_pendiente + summary.count_pagado} registros</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : teachers.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">No hay profesores activos en este colegio.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Profesor</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Sueldo base</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Monto a pagar</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((row) => {
                      const isPaid = row.payment?.status === "pagado";
                      const busy = !!rowBusy[row.teacher_id];
                      return (
                        <tr key={row.teacher_id} className={isPaid ? "bg-emerald-50/40" : ""} data-testid={`payroll-row-${row.teacher_id}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {row.avatar_url
                                ? <img src={row.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-white text-xs font-bold flex items-center justify-center">
                                    {(row.teacher_name || "?").trim().charAt(0).toUpperCase()}
                                  </div>}
                              <span className="text-sm font-semibold text-slate-800 truncate">{row.teacher_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {row.salary_base != null
                              ? <span className="font-semibold text-slate-700">{formatSoles(row.salary_base)}</span>
                              : <span className="text-slate-400 italic text-xs">No configurado</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-slate-400">S/</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={isPaid}
                                value={amountDraft[row.teacher_id] ?? "0"}
                                onChange={(e) => handleChangeAmount(row.teacher_id, e.target.value)}
                                className={`w-28 px-2 py-1.5 border rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 ${isPaid ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" : "border-slate-300"}`}
                                data-testid={`payroll-amount-${row.teacher_id}`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isPaid ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold">Pagado</span>
                                {row.payment?.paid_at && <span className="text-[10px] text-emerald-600">{row.payment.paid_at.slice(0, 10)}</span>}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold">Pendiente</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px]">
                                  <Lock className="w-3 h-3" /> Confirmado
                                </span>
                              ) : (
                                <>
                                  <button
                                    disabled={busy}
                                    onClick={() => saveDraft(row)}
                                    className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50 flex items-center gap-1"
                                    data-testid={`payroll-save-${row.teacher_id}`}
                                  >
                                    <Save className="w-3 h-3" /> Guardar
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={() => confirmPayment(row)}
                                    className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                    data-testid={`payroll-pay-${row.teacher_id}`}
                                  >
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                    Pagar
                                  </button>
                                  {row.payment?.id && (
                                    <button
                                      disabled={busy}
                                      onClick={() => deleteDraft(row)}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                                      title="Eliminar pendiente"
                                      data-testid={`payroll-delete-${row.teacher_id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowSalaryModal(true)}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center gap-2"
                data-testid="open-salary-config-btn"
              >
                <Settings className="w-4 h-4" /> Configurar sueldos base
              </button>
              <button
                onClick={payAllPending}
                disabled={bulkBusy || summary.count_pendiente === 0}
                className="px-3 py-2 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-lg text-sm font-semibold hover:shadow-md disabled:opacity-40 flex items-center gap-2"
                data-testid="payroll-pay-all-btn"
              >
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Pagar todos los pendientes
              </button>
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {showSalaryModal && (
        <SalaryConfigModal
          token={token}
          teachers={teachers}
          onClose={() => setShowSalaryModal(false)}
          onSaved={load}
        />
      )}
    </>
  );
}


function SalaryConfigModal({ token, teachers, onClose, onSaved }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [draft, setDraft] = useState(() => {
    const d = {};
    for (const t of teachers) d[t.teacher_id] = t.salary_base != null ? String(t.salary_base) : "";
    return d;
  });
  const [saving, setSaving] = useState(false);

  const saveAll = async () => {
    setSaving(true);
    let ok = 0, fail = 0;
    for (const t of teachers) {
      const newVal = draft[t.teacher_id];
      const parsed = newVal === "" ? null : parseFloat(newVal);
      const original = t.salary_base;
      const changed = (parsed === null && original != null) || (parsed !== null && parsed !== original);
      if (!changed) continue;
      try {
        await axios.patch(
          `${API}/users/teachers/${t.teacher_id}/salary`,
          { salary_base: parsed },
          { headers }
        );
        ok++;
      } catch {
        fail++;
      }
    }
    setSaving(false);
    toast.success(`${ok} sueldos actualizados${fail ? ` · ${fail} errores` : ""}`);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" data-testid="salary-config-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Configurar sueldos base</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {teachers.map(t => (
              <div key={t.teacher_id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3" data-testid={`salary-row-${t.teacher_id}`}>
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{t.teacher_name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">S/</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft[t.teacher_id] ?? ""}
                    onChange={(e) => setDraft(p => ({ ...p, [t.teacher_id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400"
                    data-testid={`salary-input-${t.teacher_id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">Cancelar</button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2"
            data-testid="salary-save-all-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar todos
          </button>
        </div>
      </div>
    </div>
  );
}
