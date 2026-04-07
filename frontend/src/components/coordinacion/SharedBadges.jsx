const SEVERITY_CONFIG = {
  baja: { label: "Baja", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
  media: { label: "Media", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500" },
  alta: { label: "Alta", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dot: "bg-orange-500" },
  critica: { label: "Critica", bg: "bg-red-100", text: "text-red-700", border: "border-red-300", dot: "bg-red-500" },
};

export function SeverityBadge({ severity }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.baja;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`} data-testid={`severity-badge-${severity}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

const STATUS_CONFIG = {
  nueva: { label: "Nueva", bg: "bg-blue-100", text: "text-blue-700" },
  en_revision: { label: "En revision", bg: "bg-indigo-100", text: "text-indigo-700" },
  en_seguimiento: { label: "En seguimiento", bg: "bg-purple-100", text: "text-purple-700" },
  citacion_programada: { label: "Citacion programada", bg: "bg-amber-100", text: "text-amber-700" },
  derivada: { label: "Derivada", bg: "bg-cyan-100", text: "text-cyan-700" },
  resuelta: { label: "Resuelta", bg: "bg-emerald-100", text: "text-emerald-700" },
  cerrada: { label: "Cerrada", bg: "bg-slate-200", text: "text-slate-600" },
};

export function StatusPill({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.nueva;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`} data-testid={`status-pill-${status}`}>
      {config.label}
    </span>
  );
}

export function KpiCard({ title, value, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "from-blue-500 to-blue-600",
    red: "from-red-500 to-red-600",
    amber: "from-amber-500 to-amber-600",
    emerald: "from-emerald-500 to-emerald-600",
    purple: "from-purple-500 to-purple-600",
    indigo: "from-indigo-500 to-indigo-600",
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow" data-testid={`kpi-${title}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color] || colors.blue} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{title}</p>
    </div>
  );
}
