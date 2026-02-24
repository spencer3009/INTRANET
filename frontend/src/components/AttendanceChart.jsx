import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#001f4b] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-lg">
        <p>{label}: {payload[0].value}% asistencia</p>
      </div>
    );
  }
  return null;
};

export default function AttendanceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container p-6" data-testid="attendance-chart">
        <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Asistencia Promedio Mensual
        </h3>
        <p className="text-sm text-slate-500 mt-2">Cargando datos...</p>
      </div>
    );
  }

  // Filtrar solo meses con registros para la tendencia
  const withData = data.filter(d => d.total_records > 0);
  const current = withData[withData.length - 1]?.attendance || 0;
  const prev = withData[withData.length - 2]?.attendance || 0;
  const diff = prev > 0 ? (current - prev).toFixed(1) : 0;
  const isPositive = diff >= 0;

  return (
    <div className="chart-container p-6" data-testid="attendance-chart">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Asistencia Promedio Mensual
          </h3>
          <p className="text-xs text-slate-500 mt-1">Tendencia de asistencia institucional</p>
        </div>
        {withData.length >= 2 && (
          <div className={`flex items-center gap-1.5 ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"} px-3 py-1.5 rounded-lg`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-xs font-bold">{isPositive ? "+" : ""}{diff}%</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,31,75,0.04)" }} />
          <Bar
            dataKey="attendance"
            fill="#001f4b"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
