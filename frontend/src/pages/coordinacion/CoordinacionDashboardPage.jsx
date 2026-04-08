import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Clock, Users, Calendar, BookOpen, ArrowRightLeft,
  ChevronRight, BarChart3, School, User, Lock, Loader2, AlertCircle
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";

/* ─── Helpers ─── */

function formatRelativeTime(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatStatus(status) {
  const map = {
    nueva: "Nueva",
    en_revision: "En revisión",
    en_seguimiento: "En seguimiento",
    citacion_programada: "Citación programada",
    derivada: "Derivada",
    resuelta: "Resuelta",
    cerrada: "Cerrada",
  };
  return map[status] || capitalize(status);
}

function stripConfidentialPrefix(title) {
  if (!title) return "";
  return title.replace(/^CONFIDENCIAL\s*/i, "");
}

/* ─── KPI Card Config ─── */

const KPI_CARDS = [
  {
    key: "incidencias_activas", titleShort: "Incidencias", subtitle: "Activas",
    icon: AlertTriangle, from: "#ef4444", to: "#dc2626", rgb: "239, 68, 68",
    path: "/coordinacion/incidencias?status=activas",
  },
  {
    key: "incidencias_nuevas_hoy", titleShort: "Hoy", subtitle: "Nuevas",
    icon: Clock, from: "#f59e0b", to: "#d97706", rgb: "245, 158, 11",
    path: "/coordinacion/incidencias?from=today",
  },
  {
    key: "estudiantes_en_seguimiento", titleShort: "Seguimiento", subtitle: "Estudiantes",
    icon: Users, from: "#8b5cf6", to: "#7c3aed", rgb: "139, 92, 246",
    path: "/coordinacion/seguimientos",
  },
  {
    key: "reuniones_pendientes", titleShort: "Reuniones", subtitle: "Pendientes",
    icon: Calendar, from: "#3b82f6", to: "#2563eb", rgb: "59, 130, 246",
    path: "/coordinacion/reuniones?status=pendientes",
  },
  {
    key: "charlas_proximas", titleShort: "Charlas", subtitle: "Próximas",
    icon: BookOpen, from: "#10b981", to: "#059669", rgb: "16, 185, 129",
    path: "/coordinacion/charlas?status=programada",
  },
  {
    key: "derivaciones_pendientes", titleShort: "Derivaciones", subtitle: "Pendientes",
    icon: ArrowRightLeft, from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241",
    path: "/coordinacion/derivaciones?status=pendiente",
  },
];

/* ─── Severity / Status Configs ─── */

const SEV_CFG = {
  critica: { color: "#dc2626", borderRGB: "220, 38, 38", label: "Crítica" },
  alta:    { color: "#ef4444", borderRGB: "239, 68, 68", label: "Alta" },
  media:   { color: "#f59e0b", borderRGB: "245, 158, 11", label: "Media" },
  baja:    { color: "#10b981", borderRGB: "16, 185, 129", label: "Baja" },
};

const SEV_BADGE = {
  critica: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200",
  alta:    "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70",
  media:   "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70",
  baja:    "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70",
};

const STS_BADGE = {
  nueva:               "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70",
  en_revision:         "bg-gradient-to-br from-indigo-100/70 to-indigo-50/50 text-indigo-700 border-indigo-200/70",
  en_seguimiento:      "bg-gradient-to-br from-violet-100/70 to-violet-50/50 text-violet-700 border-violet-200/70",
  citacion_programada: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70",
  derivada:            "bg-gradient-to-br from-cyan-100/70 to-cyan-50/50 text-cyan-700 border-cyan-200/70",
  resuelta:            "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200",
  cerrada:             "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200",
};

const BAR_SEV = [
  { key: "baja",    label: "Baja",    grad: "from-emerald-500 to-emerald-600" },
  { key: "media",   label: "Media",   grad: "from-amber-500 to-amber-600" },
  { key: "alta",    label: "Alta",    grad: "from-orange-500 to-orange-600" },
  { key: "critica", label: "Crítica", grad: "from-red-500 to-red-600" },
];

/* ─── Main Component ─── */

export default function CoordinacionDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sub = user?.subdomain;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    coordinacionApi.getDashboard(token)
      .then(setData)
      .catch(e => setError(e.response?.data?.detail || "Error al cargar dashboard"))
      .finally(() => setLoading(false));
  }, [token]);

  const go = (path) => navigate(`/${sub}${path}`);

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="inicio">
      <div className="px-6 md:px-8 py-8 min-h-full" data-testid="coordinacion-dashboard">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Panel de Coordinación</h1>
          <p className="text-sm text-slate-500 mt-1">Bienvenido/a, {user?.name}</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex items-center gap-3 mb-8">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ══════════ KPI CARDS ══════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-8" data-testid="kpi-grid">
              {KPI_CARDS.map(({ key, titleShort, subtitle, icon: Icon, from, to, rgb, path }) => (
                <button
                  key={key}
                  onClick={() => go(path)}
                  className="group relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] text-left"
                  style={{
                    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                    boxShadow: `0 4px 16px rgba(${rgb}, 0.20)`,
                  }}
                  data-testid={`kpi-${key}`}
                >
                  {/* Semi-círculo decorativo grande (derecha) */}
                  <div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      width: "180px",
                      height: "180px",
                      top: "-30px",
                      right: "-60px",
                      background: "rgba(255,255,255,0.12)",
                    }}
                  />
                  {/* Semi-círculo secundario (inferior derecho, más sutil) */}
                  <div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      width: "120px",
                      height: "120px",
                      bottom: "-40px",
                      right: "-20px",
                      background: "rgba(255,255,255,0.07)",
                    }}
                  />

                  {/* Header: ícono glassmorphism + título */}
                  <div className="relative flex items-center gap-2.5 mb-4">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/20"
                      style={{ background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                    >
                      <Icon className="w-[18px] h-[18px] text-white/90" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-semibold text-white">{titleShort}</span>
                  </div>

                  {/* Número grande */}
                  <div className="relative text-[38px] font-bold text-white leading-none mb-1.5 tabular-nums tracking-tight">
                    {data.kpis[key] ?? 0}
                  </div>

                  {/* Subtítulo + chevron */}
                  <div className="relative flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">{subtitle}</span>
                    <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
                  </div>
                </button>
              ))}
            </div>

            {/* ══════════ TWO-COLUMN LAYOUT ══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

              {/* ── Incidencias recientes (2 cols) ── */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                {/* Header */}
                <div
                  className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
                  style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
                      }}
                    >
                      <AlertTriangle className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Incidencias recientes</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Últimas 5 registradas</p>
                    </div>
                  </div>
                  <button
                    onClick={() => go("/coordinacion/incidencias")}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                    data-testid="view-all-incidencias"
                  >
                    Ver todas
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                {/* List — mini-card per row */}
                <div className="p-4 space-y-2.5">
                  {data.recent_incidencias?.length > 0 ? data.recent_incidencias.map(inc => {
                    const sev = SEV_CFG[inc.severity] || SEV_CFG.baja;
                    const dateField = inc.occurred_at || inc.created_at;
                    const isConfidential = inc.confidential === true;
                    const cleanTitle = stripConfidentialPrefix(inc.title);
                    return (
                      <div
                        key={inc.id}
                        onClick={() => go(`/coordinacion/incidencias/${inc.id}`)}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all bg-white"
                        data-testid={`recent-inc-${inc.id}`}
                      >
                        {/* Severity color indicator */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: sev.color, boxShadow: `0 0 0 3px rgba(${sev.borderRGB}, 0.15)` }}
                          />
                          <div className="w-0.5 flex-1 rounded-full bg-slate-100" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {isConfidential && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-100 mb-1.5">
                              <Lock className="w-2.5 h-2.5 text-red-500" strokeWidth={2.5} />
                              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Confidencial</span>
                            </span>
                          )}
                          <div className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-slate-700">{cleanTitle}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3 text-slate-400" strokeWidth={2} />
                            </div>
                            <span className="text-xs text-slate-500 truncate">{inc.student_name}</span>
                            <span className="text-slate-300 text-[10px]">&bull;</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(dateField)}</span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${SEV_BADGE[inc.severity] || SEV_BADGE.baja}`}
                            data-testid={`severity-badge-${inc.severity}`}
                          >
                            {sev.label}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${STS_BADGE[inc.status] || STS_BADGE.nueva}`}
                            data-testid={`status-pill-${inc.status}`}
                          >
                            {formatStatus(inc.status)}
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                      </div>
                    );
                  }) : (
                    <p className="px-6 py-10 text-center text-slate-400 text-sm">No hay incidencias registradas</p>
                  )}
                </div>
              </div>

              {/* ── Right sidebar (1 col) ── */}
              <div className="space-y-5">

                {/* Distribución por severidad */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)",
                      }}
                    >
                      <BarChart3 className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Distribución por severidad</h2>
                  </div>
                  <div className="space-y-3">
                    {BAR_SEV.map(s => {
                      const total = Object.values(data.by_severity).reduce((a, b) => a + b, 0) || 1;
                      const val = data.by_severity[s.key] || 0;
                      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                      return (
                        <div key={s.key} className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${s.grad}`} />
                              <span className="text-[13px] text-slate-700 font-medium">{s.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-medium tabular-nums">{pct}%</span>
                              <span className="text-[15px] text-slate-900 font-bold tabular-nums">{val}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${s.grad} transition-all duration-700`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alertas activas */}
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: data.reincidentes?.length > 0 ? "rgba(239,68,68,0.18)" : "rgb(226,232,240)",
                  }}
                  data-testid="alertas-widget"
                >
                  {/* Alert header with gradient */}
                  <div
                    className="px-5 py-4 flex items-center gap-2.5"
                    style={{
                      background: data.reincidentes?.length > 0
                        ? "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.03) 100%)"
                        : "linear-gradient(180deg, #fafbfc 0%, white 100%)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: data.reincidentes?.length > 0
                          ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                          : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                        boxShadow: data.reincidentes?.length > 0
                          ? "0 4px 12px rgba(239, 68, 68, 0.25)"
                          : "0 4px 12px rgba(100, 116, 139, 0.15)",
                      }}
                    >
                      <AlertTriangle className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-900 flex-1">Alertas activas</h2>
                    {data.reincidentes?.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                        style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 2px 6px rgba(239,68,68,0.30)" }}>
                        {data.reincidentes.length}
                      </span>
                    )}
                  </div>

                  <div className="p-4 bg-white">
                    {data.reincidentes?.length > 0 ? (
                      <div className="space-y-2.5">
                        {data.reincidentes.slice(0, 5).map(a => (
                          <div
                            key={a.student_id}
                            onClick={() => go(`/coordinacion/estudiantes/${a.student_id}`)}
                            className="group flex items-center gap-3 p-3 rounded-xl border border-red-100 cursor-pointer hover:border-red-200 hover:shadow-sm transition-all bg-gradient-to-r from-red-50/40 to-white"
                            data-testid={`alerta-${a.student_id}`}
                          >
                            {/* Avatar circle with initial */}
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 border border-red-200/50">
                              <span className="text-xs font-bold text-red-700">{a.full_name?.charAt(0) || "?"}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-semibold text-slate-900 truncate">{a.full_name}</div>
                              <div className="text-[11px] text-slate-400">{a.grade}</div>
                            </div>
                            <span
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border tabular-nums flex-shrink-0"
                              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)", color: "#dc2626" }}
                            >
                              {a.count} inc.
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                          </div>
                        ))}
                        {data.reincidentes.length > 5 && (
                          <button
                            onClick={() => go("/coordinacion/reportes?tab=reincidentes")}
                            className="w-full mt-2 text-[12px] text-red-600 font-semibold hover:text-red-700 transition-colors flex items-center justify-center gap-1"
                            data-testid="ver-todos-reincidentes"
                          >
                            Ver todos los reincidentes <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">Sin alertas de reincidencia</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════ INCIDENCIAS POR GRADO (full width) ══════════ */}
            {data.by_grade?.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                <div
                  className="px-6 py-5 border-b border-slate-100 flex items-center gap-3"
                  style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                    }}
                  >
                    <School className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Incidencias por grado</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Distribución por nivel educativo</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {data.by_grade.map((g, idx) => {
                    const maxCount = Math.max(...data.by_grade.map(x => x.count), 1);
                    const pct = Math.round((g.count / maxCount) * 100);
                    const rankColors = ["bg-indigo-500 text-white", "bg-indigo-400 text-white", "bg-indigo-300 text-white"];
                    const rankCls = idx < 3 ? rankColors[idx] : "bg-slate-200 text-slate-600";
                    return (
                      <div key={g.grade_id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100 hover:border-slate-200 transition-colors">
                        {/* Rank badge */}
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${rankCls}`}>
                          {idx + 1}
                        </span>
                        <span className="text-[13px] text-slate-700 font-medium min-w-[100px] truncate">{g.grade_name || "Sin grado"}</span>
                        <div className="flex-1 h-2.5 bg-slate-200/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(pct, 4)}%`,
                              background: `linear-gradient(90deg, #6366f1 0%, #818cf8 100%)`,
                            }}
                          />
                        </div>
                        <span className="text-[15px] font-bold text-slate-900 tabular-nums w-8 text-right">{g.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CoordinacionLayout>
  );
}
