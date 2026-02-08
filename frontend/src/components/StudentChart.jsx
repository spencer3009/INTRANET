import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#001f4b] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-lg">
        <p>{label}: {payload[0].value} alumnos</p>
      </div>
    );
  }
  return null;
};

export default function StudentChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container p-6" data-testid="student-chart">
        <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Alumnos Inscritos
        </h3>
        <p className="text-sm text-slate-500 mt-2">Cargando datos...</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.students));
  const current = data[data.length - 1]?.students || 0;
  const prev = data[data.length - 2]?.students || 0;
  const trend = prev > 0 ? (((current - prev) / prev) * 100).toFixed(1) : 0;

  return (
    <div className="chart-container p-6" data-testid="student-chart">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Alumnos Inscritos
          </h3>
          <p className="text-xs text-slate-500 mt-1">Tendencia mensual del periodo actual</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-bold">{trend > 0 ? "+" : ""}{trend}%</span>
        </div>
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
            domain={[0, maxVal + 50]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,31,75,0.04)" }} />
          <Bar
            dataKey="students"
            fill="#001f4b"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
