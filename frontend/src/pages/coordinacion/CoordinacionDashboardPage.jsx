import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Users, Calendar, BookOpen, ArrowRightLeft,
  Loader2, AlertCircle, ChevronRight, Clock
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";

/* ─── Premium Severity Badge (dashboard-only, no dot) ─── */
const SEVERITY_STYLE = {
  baja:    { label: "Baja",    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" },
  media:   { label: "Media",   cls: "bg-amber-50 text-amber-700 border border-amber-200/60" },
  alta:    { label: "Alta",    cls: "bg-orange-50 text-orange-700 border border-orange-200/60" },
  critica: { label: "Crítica", cls: "bg-red-50 text-red-700 border border-red-200/60" },
};

function PremiumSeverityBadge({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.baja;
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-md ${s.cls}`} data-testid={`severity-badge-${severity}`}>
      {s.label}
    </span>
  );
}

/* ─── Premium Status Pill (dashboard-only) ─── */
const STATUS_STYLE = {
  nueva:               { label: "Nueva",               cls: "bg-blue-50 text-blue-700 border border-blue-200/60" },
  en_revision:         { label: "En revisión",         cls: "bg-indigo-50 text-indigo-700 border border-indigo-200/60" },
  en_seguimiento:      { label: "En seguimiento",      cls: "bg-violet-50 text-violet-700 border border-violet-200/60" },
  citacion_programada: { label: "Citación programada", cls: "bg-amber-50 text-amber-700 border border-amber-200/60" },
  derivada:            { label: "Derivada",            cls: "bg-cyan-50 text-cyan-700 border border-cyan-200/60" },
  resuelta:            { label: "Resuelta",            cls: "bg-slate-100 text-slate-600 border border-slate-200/60" },
  cerrada:             { label: "Cerrada",             cls: "bg-slate-100 text-slate-600 border border-slate-200/60" },
};

function PremiumStatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.nueva;
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-md ${s.cls}`} data-testid={`status-pill-${status}`}>
      {s.label}
    </span>
  );
}

/* ─── KPI card config ─── */
const KPI_CONFIG = [
  { key: "incidencias_activas",       label: "Incidencias activas",   icon: AlertTriangle,  color: "red",     path: "/coordinacion/incidencias?status=activas" },
  { key: "incidencias_nuevas_hoy",    label: "Nuevas hoy",            icon: Clock,          color: "amber",   path: "/coordinacion/incidencias?from=today" },
  { key: "estudiantes_en_seguimiento",label: "En seguimiento",        icon: Users,          color: "violet",  path: "/coordinacion/seguimientos" },
  { key: "reuniones_pendientes",      label: "Reuniones pendientes",  icon: Calendar,       color: "blue",    path: "/coordinacion/reuniones?status=pendientes" },
  { key: "charlas_proximas",          label: "Charlas próximas",      icon: BookOpen,       color: "emerald", path: "/coordinacion/charlas?status=programada" },
  { key: "derivaciones_pendientes",   label: "Derivaciones pendientes", icon: ArrowRightLeft, color: "indigo", path: "/coordinacion/derivaciones?status=pendiente" },
];

const KPI_COLORS = {
  red:     { iconBg: "bg-red-50",     iconText: "text-red-600" },
  amber:   { iconBg: "bg-amber-50",   iconText: "text-amber-600" },
  violet:  { iconBg: "bg-violet-50",  iconText: "text-violet-600" },
  blue:    { iconBg: "bg-blue-50",    iconText: "text-blue-600" },
  emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  indigo:  { iconBg: "bg-indigo-50",  iconText: "text-indigo-600" },
};

/* ─── Severity bar config (for distribution section) ─── */
const BAR_CONFIG = {
  baja:    { color: "bg-emerald-500", label: "Baja" },
  media:   { color: "bg-amber-500",   label: "Media" },
  alta:    { color: "bg-orange-500",  label: "Alta" },
  critica: { color: "bg-red-500",     label: "Crítica" },
};

/* ─── Main component ─── */
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
      <div className="px-6 md:px-8 py-8 space-y-8" data-testid="coordinacion-dashboard">
        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Panel de Coordinación
          </h1>
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
          <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpi-grid">
              {KPI_CONFIG.map(({ key, label, icon: Icon, color, path }) => {
                const c = KPI_COLORS[color];
                return (
                  <button
                    key={key}
                    onClick={() => go(path)}
                    className="group bg-white border border-slate-200/60 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer text-left"
                    data-testid={`kpi-${label}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${c.iconText}`} strokeWidth={2} />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>
                    <div className="text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
                      {data.kpis[key] ?? 0}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">{label}</div>
                  </button>
                );
              })}
            </div>

            {/* ── Two-column grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Incidencias recientes ── */}
              <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Incidencias recientes</h2>
                  <button
                    onClick={() => go("/coordinacion/incidencias")}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
                    data-testid="view-all-incidencias"
                  >
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  {data.recent_incidencias?.length > 0 ? data.recent_incidencias.map((inc, idx) => (
                    <button
                      key={inc.id}
                      onClick={() => go(`/coordinacion/incidencias/${inc.id}`)}
                      className={`w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left ${idx < data.recent_incidencias.length - 1 ? 'border-b border-slate-100' : ''}`}
                      data-testid={`recent-inc-${inc.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{inc.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{inc.student_name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PremiumSeverityBadge severity={inc.severity} />
                        <PremiumStatusPill status={inc.status} />
                      </div>
                    </button>
                  )) : (
                    <p className="px-5 py-10 text-center text-slate-400 text-sm">No hay incidencias registradas</p>
                  )}
                </div>
              </div>

              {/* ── Right column: Severity + Alerts + By Grade ── */}
              <div className="space-y-6">

                {/* Distribución por severidad */}
                <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                  <h2 className="text-base font-semibold text-slate-900 mb-4">Distribución por severidad</h2>
                  <div className="space-y-3">
                    {Object.entries(data.by_severity).map(([sev, count]) => {
                      const total = Object.values(data.by_severity).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / total) * 100);
                      const cfg = BAR_CONFIG[sev] || { color: "bg-slate-400", label: sev };
                      return (
                        <div key={sev} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-16">{cfg.label}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${cfg.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 w-8 text-right tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alertas activas */}
                <div
                  className={`rounded-xl p-5 ${
                    data.reincidentes?.length > 0
                      ? "border border-red-200/60 bg-gradient-to-br from-red-50/30 to-white"
                      : "bg-white border border-slate-200/60"
                  }`}
                  data-testid="alertas-widget"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className={`w-4.5 h-4.5 ${data.reincidentes?.length > 0 ? "text-red-600" : "text-slate-400"}`} />
                    <h2 className="text-base font-semibold text-slate-900">Alertas activas</h2>
                    {data.reincidentes?.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">
                        {data.reincidentes.length}
                      </span>
                    )}
                  </div>
                  {data.reincidentes?.length > 0 ? (
                    <div className="space-y-1">
                      {data.reincidentes.slice(0, 5).map(r => (
                        <button
                          key={r.student_id}
                          onClick={() => go(`/coordinacion/estudiantes/${r.student_id}`)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-red-50/40 transition-colors text-left"
                          data-testid={`alerta-${r.student_id}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{r.full_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{r.grade}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-200/60 tabular-nums">
                            {r.count} inc.
                          </span>
                        </button>
                      ))}
                      {data.reincidentes.length > 5 && (
                        <button
                          onClick={() => go("/coordinacion/reportes?tab=reincidentes")}
                          className="w-full text-center pt-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                          data-testid="ver-todos-reincidentes"
                        >
                          Ver todos ({data.reincidentes.length}) →
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sin alertas de reincidencia</p>
                  )}
                </div>

                {/* Incidencias por grado */}
                {data.by_grade?.length > 0 && (
                  <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Incidencias por grado</h2>
                    <div className="space-y-1">
                      {data.by_grade.map((g, idx) => (
                        <div
                          key={g.grade_id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50/50 transition-colors ${idx < data.by_grade.length - 1 ? '' : ''}`}
                        >
                          <span className="text-sm text-slate-600">{g.grade_name || "Sin grado"}</span>
                          <span className="text-sm font-medium text-slate-900 tabular-nums">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </CoordinacionLayout>
  );
}
