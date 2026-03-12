import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, CreditCard, School, BarChart3, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || "";

export default function SupportFinancesPage({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/support/finances`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!data) return <div className="text-center py-12 text-slate-500">Error al cargar datos financieros</div>;

  const maxEarning = Math.max(...data.monthly_data.map(m => m.total), 1);

  return (
    <div className="space-y-6" data-testid="finances-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
        <p className="text-sm text-slate-500">Resumen de ganancias e ingresos mensuales</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Ganancia este mes" value={`S/ ${data.current_month.earnings.toFixed(2)}`} sub={`${data.current_month.payments} pagos`} color="emerald" />
        <StatCard icon={TrendingUp} label="Total acumulado" value={`S/ ${data.total_all_time.toFixed(2)}`} sub={`${data.total_confirmed_payments} pagos confirmados`} color="blue" />
        <StatCard icon={School} label="Colegios activos" value={data.active_schools} sub={`de ${data.total_schools} totales`} color="violet" />
        <StatCard icon={CreditCard} label="Precio base" value={`S/ ${data.base_price}`} sub="por estudiante/mes" color="amber" />
      </div>

      {/* Monthly Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">Ingresos mensuales</h2>
        </div>
        <div className="flex items-end gap-2 h-56 px-2">
          {data.monthly_data.map((m, i) => {
            const pct = maxEarning > 0 ? (m.total / maxEarning) * 100 : 0;
            const isCurrentMonth = m.month === new Date().toISOString().slice(0, 7);
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" data-testid={`bar-${m.month}`}>
                <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  S/{m.total.toFixed(0)}
                </span>
                <div className="w-full relative" style={{ height: "180px" }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-md transition-all duration-300 ${isCurrentMonth ? "bg-emerald-500" : "bg-slate-300 group-hover:bg-emerald-400"}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className={`text-[9px] ${isCurrentMonth ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                  {m.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Detalle mensual</h2>
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
              {[...data.monthly_data].reverse().map(m => (
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
    amber: "bg-amber-50 text-amber-600 border-amber-200",
  };
  const iconColors = {
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-blue-100 text-blue-600",
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
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
