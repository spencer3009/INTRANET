import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = {
  paid: "#10b981",
  pending: "#f59e0b",
  overdue: "#ef4444",
};

const LABELS = {
  paid: "Cobrado",
  pending: "Pendiente",
  overdue: "Vencido",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0a1628] text-white px-4 py-3 rounded-xl text-xs shadow-xl border border-white/10">
      <p className="font-bold mb-1.5 text-slate-300">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
            {LABELS[entry.dataKey]}
          </span>
          <span className="font-bold">S/ {entry.value.toLocaleString("es-PE")}</span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div className="flex items-center justify-center gap-5 mt-2">
    {payload?.map((entry) => (
      <span key={entry.dataKey} className="flex items-center gap-1.5 text-xs text-slate-600">
        <span className="w-3 h-3 rounded" style={{ background: entry.color }} />
        <span className="font-medium">{LABELS[entry.dataKey] || entry.value}</span>
      </span>
    ))}
  </div>
);

export default function PaymentsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container p-6" data-testid="payments-chart">
        <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Ingresos Mensuales
        </h3>
        <p className="text-sm text-slate-500 mt-2">Cargando datos...</p>
      </div>
    );
  }

  // Totales para el resumen
  const totalPaid = data.reduce((s, d) => s + (d.paid || 0), 0);
  const totalPending = data.reduce((s, d) => s + (d.pending || 0), 0);
  const totalOverdue = data.reduce((s, d) => s + (d.overdue || 0), 0);

  return (
    <div className="chart-container p-6" data-testid="payments-chart">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Ingresos Mensuales
          </h3>
          <p className="text-xs text-slate-500 mt-1">Cobros registrados durante el ano academico</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400">Cobrado</p>
            <p className="text-sm font-bold text-emerald-600">S/ {totalPaid.toLocaleString("es-PE")}</p>
          </div>
          {totalOverdue > 0 && (
            <div className="text-right border-l border-slate-200 pl-3">
              <p className="text-xs text-slate-400">Vencido</p>
              <p className="text-sm font-bold text-red-500">S/ {totalOverdue.toLocaleString("es-PE")}</p>
            </div>
          )}
          {totalPending > 0 && (
            <div className="text-right border-l border-slate-200 pl-3">
              <p className="text-xs text-slate-400">Pendiente</p>
              <p className="text-sm font-bold text-amber-500">S/ {totalPending.toLocaleString("es-PE")}</p>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={(v) => v >= 1000 ? `S/${(v / 1000).toFixed(0)}k` : `S/${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,31,75,0.03)" }} />
          <Legend content={<CustomLegend />} />
          <Bar dataKey="paid" name="Cobrado" stackId="stack" fill={COLORS.paid} radius={[0, 0, 0, 0]} maxBarSize={28} />
          <Bar dataKey="pending" name="Pendiente" stackId="stack" fill={COLORS.pending} radius={[0, 0, 0, 0]} maxBarSize={28} />
          <Bar dataKey="overdue" name="Vencido" stackId="stack" fill={COLORS.overdue} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
