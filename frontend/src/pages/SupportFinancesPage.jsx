import { useState, useEffect, useCallback } from "react";
import { DollarSign, TrendingUp, School, BarChart3, Loader2, Calendar, CalendarRange, CalendarDays, Filter, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || "";

export default function SupportFinancesPage({ token }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("year");
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterFrom, setFilterFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const loadSummary = () => {
    fetch(`${API}/api/support/finances`, { headers })
      .then(r => r.json())
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); }, [token]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    const params = new URLSearchParams({ filter_type: filterType });
    if (filterType === "month") params.set("month", filterMonth);
    if (filterType === "day") params.set("date", filterDate);
    if (filterType === "range") { params.set("date_from", filterFrom); params.set("date_to", filterTo); }
    try {
      const res = await fetch(`${API}/api/support/finances/transactions?${params}`, { headers });
      setTransactions(await res.json());
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, [filterType, filterMonth, filterDate, filterFrom, filterTo, token]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDeletePayment = async (entryId) => {
    if (!window.confirm("¿Eliminar este pago? Esta accion no se puede deshacer.")) return;
    try {
      await fetch(`${API}/api/support/finances/${entryId}`, { method: "DELETE", headers });
      toast.success("Pago eliminado");
      fetchTransactions();
      loadSummary();
    } catch { toast.error("Error al eliminar"); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!summary) return <div className="text-center py-12 text-slate-500">Error al cargar datos financieros</div>;

  const maxEarning = Math.max(...summary.monthly_data.map(m => m.total), 1);
  const filters = [
    { id: "year", label: "Anual", icon: BarChart3 },
    { id: "month", label: "Por Mes", icon: Calendar },
    { id: "day", label: "Por Dia", icon: CalendarDays },
    { id: "range", label: "Rango", icon: CalendarRange },
  ];

  return (
    <div className="space-y-6" data-testid="finances-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
        <p className="text-sm text-slate-500">Resumen de ganancias e ingresos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={DollarSign} label="Ganancia este mes" value={`S/ ${summary.current_month.earnings.toFixed(2)}`} sub={`${summary.current_month.payments} pagos`} color="emerald" />
        <StatCard icon={TrendingUp} label="Total acumulado" value={`S/ ${summary.total_all_time.toFixed(2)}`} sub={`${summary.total_confirmed_payments} pagos confirmados`} color="blue" />
        <StatCard icon={School} label="Colegios activos" value={summary.active_schools} sub={`de ${summary.total_schools} totales`} color="violet" />
      </div>

      {/* Monthly Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">Ingresos mensuales</h2>
        </div>
        <div className="flex items-end gap-2 h-56 px-2">
          {summary.monthly_data.map((m) => {
            const pct = maxEarning > 0 ? (m.total / maxEarning) * 100 : 0;
            const isCurrent = m.month === new Date().toISOString().slice(0, 7);
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" data-testid={`bar-${m.month}`}>
                <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  S/{m.total.toFixed(0)}
                </span>
                <div className="w-full relative" style={{ height: "180px" }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-md transition-all duration-300 ${isCurrent ? "bg-emerald-500" : "bg-slate-300 group-hover:bg-emerald-400"}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className={`text-[9px] ${isCurrent ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                  {m.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ FILTER SECTION ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Reporte de Pagos</h2>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2" data-testid="filter-tabs">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                data-testid={`filter-${f.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === f.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            ))}
          </div>

          {/* Filter inputs */}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {filterType === "month" && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Mes</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  data-testid="filter-month-input"
                />
              </div>
            )}
            {filterType === "day" && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Fecha</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  data-testid="filter-date-input"
                />
              </div>
            )}
            {filterType === "range" && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Desde</label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    data-testid="filter-from-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Hasta</label>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    data-testid="filter-to-input"
                  />
                </div>
              </>
            )}
            {filterType === "year" && (
              <p className="text-xs text-slate-400 py-1.5">Mostrando todos los pagos del año {new Date().getFullYear()}</p>
            )}
          </div>
        </div>

        {/* Results summary */}
        {transactions && !txLoading && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{transactions.count} pago{transactions.count !== 1 ? "s" : ""} encontrado{transactions.count !== 1 ? "s" : ""}</span>
            <span className="text-sm font-bold text-emerald-600">Total: S/ {transactions.total.toFixed(2)}</span>
          </div>
        )}

        {/* Transactions table */}
        <div className="overflow-x-auto">
          {txLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : transactions?.transactions?.length > 0 ? (
            <table className="w-full text-sm" data-testid="transactions-table">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Fecha</th>
                  <th className="px-5 py-2.5 font-medium">Colegio</th>
                  <th className="px-5 py-2.5 font-medium">Descripcion</th>
                  <th className="px-5 py-2.5 font-medium">Metodo</th>
                  <th className="px-5 py-2.5 font-medium">Cod. Operacion</th>
                  <th className="px-5 py-2.5 font-medium">Confirmado por</th>
                  <th className="px-5 py-2.5 font-medium text-right">Monto</th>
                  <th className="px-3 py-2.5 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.transactions.map(tx => (
                  <tr key={tx.id} className="border-t border-slate-50 hover:bg-slate-50/50" data-testid={`tx-row-${tx.id}`}>
                    <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">
                      {tx.confirmed_at ? new Date(tx.confirmed_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-slate-800 font-medium">{tx.school_name || "—"}</td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs">{tx.description || "—"}</td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 capitalize">
                        {tx.payment_method || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 font-mono text-xs">{tx.operation_code || "—"}</td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs">{tx.confirmed_by_name || "—"}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-emerald-600">S/ {tx.amount.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleDeletePayment(tx.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        title="Eliminar pago"
                        data-testid={`delete-tx-${tx.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileText className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No hay pagos en este periodo</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Resumen mensual (ultimos 12 meses)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">Mes</th>
                <th className="px-5 py-2.5 font-medium text-right">Pagos</th>
                <th className="px-5 py-2.5 font-medium text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.monthly_data].reverse().map(m => (
                <tr key={m.month} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-2.5 text-slate-700 font-medium">{m.label}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{m.payments}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-slate-800">S/ {m.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    violet: "bg-violet-50 text-violet-600 border-violet-200",
  };
  const iconColors = {
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-blue-100 text-blue-600",
    violet: "bg-violet-100 text-violet-600",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`} data-testid={`stat-${color}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs opacity-70">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-[10px] opacity-60">{sub}</p>
        </div>
      </div>
    </div>
  );
}
