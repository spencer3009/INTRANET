import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Users, Calendar, BookOpen, ArrowRightLeft,
  Loader2, AlertCircle, ChevronRight, Clock
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { KpiCard, SeverityBadge, StatusPill } from "@/components/coordinacion/SharedBadges";
import { coordinacionApi } from "@/api/coordinacion";

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

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="inicio">
      <div className="space-y-6" data-testid="coordinacion-dashboard">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Coordinacion</h1>
          <p className="text-slate-500 mt-1">Bienvenido/a, {user?.name}</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpi-grid">
              <KpiCard title="Incidencias activas" value={data.kpis.incidencias_activas} icon={AlertTriangle} color="red" />
              <KpiCard title="Nuevas hoy" value={data.kpis.incidencias_nuevas_hoy} icon={Clock} color="amber" />
              <KpiCard title="En seguimiento" value={data.kpis.estudiantes_en_seguimiento} icon={Users} color="purple" />
              <KpiCard title="Reuniones pendientes" value={data.kpis.reuniones_pendientes} icon={Calendar} color="blue" />
              <KpiCard title="Charlas proximas" value={data.kpis.charlas_proximas} icon={BookOpen} color="emerald" />
              <KpiCard title="Derivaciones pendientes" value={data.kpis.derivaciones_pendientes} icon={ArrowRightLeft} color="indigo" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Incidencias */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800">Incidencias recientes</h2>
                  <button
                    onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    data-testid="view-all-incidencias"
                  >
                    Ver todas <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.recent_incidencias?.length > 0 ? data.recent_incidencias.map(inc => (
                    <button
                      key={inc.id}
                      onClick={() => navigate(`/${sub}/coordinacion/incidencias/${inc.id}`)}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                      data-testid={`recent-inc-${inc.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{inc.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{inc.student_name}</p>
                      </div>
                      <SeverityBadge severity={inc.severity} />
                      <StatusPill status={inc.status} />
                    </button>
                  )) : (
                    <p className="px-5 py-8 text-center text-slate-400 text-sm">No hay incidencias registradas</p>
                  )}
                </div>
              </div>

              {/* Severity Distribution + Alerts */}
              <div className="space-y-6">
                {/* By Severity */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <h2 className="font-bold text-slate-800 mb-4">Distribucion por severidad</h2>
                  <div className="space-y-3">
                    {Object.entries(data.by_severity).map(([sev, count]) => {
                      const total = Object.values(data.by_severity).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / total) * 100);
                      const colors = { baja: "bg-emerald-500", media: "bg-amber-500", alta: "bg-orange-500", critica: "bg-red-500" };
                      return (
                        <div key={sev} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-600 w-16 capitalize">{sev}</span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors[sev] || "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alerts */}
                {data.alertas?.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                    <h2 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Alertas de reincidencia
                    </h2>
                    <div className="space-y-2">
                      {data.alertas.map((a, i) => (
                        <p key={i} className="text-sm text-red-600">{a.message}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* By Grade */}
                {data.by_grade?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <h2 className="font-bold text-slate-800 mb-3">Incidencias por grado</h2>
                    <div className="space-y-2">
                      {data.by_grade.map(g => (
                        <div key={g.grade_id} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{g.grade_name || "Sin grado"}</span>
                          <span className="text-sm font-bold text-slate-800">{g.count}</span>
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
