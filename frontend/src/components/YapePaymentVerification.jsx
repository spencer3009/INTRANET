import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, Loader2, Search, ChevronLeft, ChevronRight,
  Clock, Eye, Filter, AlertTriangle, User, CreditCard, Calendar,
  Hash, X
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pendiente_verificacion: { label: "Pendiente", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  verificado: { label: "Verificado", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  rechazado: { label: "Rechazado", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(amount || 0);

const formatDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function YapePaymentVerification({ token }) {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pendiente_verificacion");
  const [searchName, setSearchName] = useState("");
  const [processing, setProcessing] = useState(null);

  // Modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, payment: null, action: null });
  const [rejectReason, setRejectReason] = useState("");

  const headers = { Authorization: `Bearer ${token}` };
  const LIMIT = 20;

  useEffect(() => {
    loadPayments();
  }, [page, filterStatus]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterStatus) params.append("status", filterStatus);
      if (searchName.trim()) params.append("student_name", searchName.trim());

      const res = await axios.get(`${API}/accounting/yape-payments?${params}`, { headers });
      setPayments(res.data.payments || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Error loading yape payments:", err);
      toast.error("Error al cargar pagos Yape");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadPayments();
  };

  const openConfirm = (payment, action) => {
    setConfirmModal({ open: true, payment, action });
    setRejectReason("");
  };

  const closeConfirm = () => {
    setConfirmModal({ open: false, payment: null, action: null });
    setRejectReason("");
  };

  const handleVerifyOrReject = async () => {
    const { payment, action } = confirmModal;
    if (!payment || !action) return;

    if (action === "rechazar" && !rejectReason.trim()) {
      toast.error("Debe indicar la razon del rechazo");
      return;
    }

    setProcessing(payment.id);
    try {
      const body = { action };
      if (action === "rechazar") body.rejection_reason = rejectReason.trim();

      await axios.put(`${API}/accounting/yape-payments/${payment.id}/verify`, body, { headers });

      if (action === "verificar") {
        toast.success("Pago verificado y registrado en contabilidad");
      } else {
        toast.success("Pago rechazado. El padre sera notificado.");
      }
      closeConfirm();
      loadPayments();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al procesar el pago";
      toast.error(msg);
    } finally {
      setProcessing(null);
    }
  };

  const statusTabs = [
    { key: "pendiente_verificacion", label: "Pendientes" },
    { key: "verificado", label: "Verificados" },
    { key: "rechazado", label: "Rechazados" },
    { key: "", label: "Todos" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6" data-testid="yape-verification-panel">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Verificacion de Pagos Yape</h3>
            <p className="text-sm text-gray-500">
              {total} {total === 1 ? "pago" : "pagos"} {filterStatus === "pendiente_verificacion" ? "pendientes de verificacion" : "encontrados"}
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar alumno..."
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none w-56"
                data-testid="yape-search-input"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-600 transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mt-4 bg-gray-50 rounded-xl p-1 w-fit">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilterStatus(tab.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === tab.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`yape-filter-${tab.key || "all"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Cargando pagos...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16" data-testid="yape-empty-state">
            <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay pagos {filterStatus === "pendiente_verificacion" ? "pendientes de verificacion" : "en esta categoria"}</p>
          </div>
        ) : (
          <table className="w-full" data-testid="yape-payments-table">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Alumno</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Padre</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cod. Yape</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p) => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendiente_verificacion;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors" data-testid={`yape-payment-row-${p.id}`}>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-800">{p.student_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{p.parent_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{p.concept}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-800">{formatCurrency(p.amount)}</span>
                      {p.is_pronto_pago && (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">PRONTO PAGO</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">{p.yape_operation_code}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDate(p.payment_date)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text} border ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.status === "pendiente_verificacion" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openConfirm(p, "verificar")}
                            disabled={processing === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200"
                            data-testid={`yape-verify-btn-${p.id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verificar
                          </button>
                          <button
                            onClick={() => openConfirm(p, "rechazar")}
                            disabled={processing === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-100 transition-colors border border-rose-200"
                            data-testid={`yape-reject-btn-${p.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </div>
                      ) : p.status === "rechazado" ? (
                        <span className="text-xs text-gray-400 italic" title={p.rejection_reason}>
                          {p.rejection_reason ? `Razon: ${p.rejection_reason.substring(0, 40)}...` : "Rechazado"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {p.verified_by_name ? `Por: ${p.verified_by_name}` : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages} ({total} pagos)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm/Reject Modal */}
      {confirmModal.open && confirmModal.payment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" data-testid="yape-confirm-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className={`px-6 py-4 ${confirmModal.action === "verificar" ? "bg-emerald-50" : "bg-rose-50"}`}>
              <div className="flex items-center justify-between">
                <h4 className={`text-lg font-semibold ${confirmModal.action === "verificar" ? "text-emerald-800" : "text-rose-800"}`}>
                  {confirmModal.action === "verificar" ? "Verificar Pago" : "Rechazar Pago"}
                </h4>
                <button onClick={closeConfirm} className="p-1 hover:bg-white/50 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Alumno:</span>
                  <span className="font-medium text-gray-800">{confirmModal.payment.student_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Padre:</span>
                  <span className="text-gray-700">{confirmModal.payment.parent_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Concepto:</span>
                  <span className="text-gray-700">{confirmModal.payment.concept}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monto:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(confirmModal.payment.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cod. Yape:</span>
                  <code className="bg-white px-2 py-0.5 rounded font-mono text-gray-700">{confirmModal.payment.yape_operation_code}</code>
                </div>
              </div>

              {confirmModal.action === "verificar" ? (
                <p className="text-sm text-gray-600">
                  Al verificar, este pago se registrara como ingreso en Contabilidad con metodo "Yape".
                </p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Razon del rechazo *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ej: El codigo de operacion no coincide con los registros de Yape"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none resize-none"
                    data-testid="yape-reject-reason-input"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleVerifyOrReject}
                disabled={processing}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-50 ${
                  confirmModal.action === "verificar"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
                data-testid="yape-confirm-action-btn"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {confirmModal.action === "verificar" ? "Confirmar Verificacion" : "Confirmar Rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
