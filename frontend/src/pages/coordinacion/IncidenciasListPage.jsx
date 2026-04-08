import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Search, Loader2, ChevronLeft, ChevronRight, AlertTriangle,
  Lock, User, Clock, FileWarning
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";

/* ─── Badge configs (premium, matching dashboard) ─── */
const SEV_BADGE = {
  critica: { cls: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200", label: "Crítica", dot: "#dc2626" },
  alta:    { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Alta", dot: "#ef4444" },
  media:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Media", dot: "#f59e0b" },
  baja:    { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Baja", dot: "#10b981" },
};

const STS_BADGE = {
  nueva:               { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Nueva" },
  en_revision:         { cls: "bg-gradient-to-br from-indigo-100/70 to-indigo-50/50 text-indigo-700 border-indigo-200/70", label: "En revisión" },
  en_seguimiento:      { cls: "bg-gradient-to-br from-violet-100/70 to-violet-50/50 text-violet-700 border-violet-200/70", label: "En seguimiento" },
  citacion_programada: { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Citación programada" },
  derivada:            { cls: "bg-gradient-to-br from-cyan-100/70 to-cyan-50/50 text-cyan-700 border-cyan-200/70", label: "Derivada" },
  resuelta:            { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Resuelta" },
  cerrada:             { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Cerrada" },
};

function formatRelativeTime(date) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function stripConfidentialPrefix(title) {
  if (!title) return "";
  return title.replace(/^CONFIDENCIAL\s*/i, "");
}

export default function IncidenciasListPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sub = user?.subdomain;

  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [enums, setEnums] = useState(null);

  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const severity = searchParams.get("severity") || "";
  const q = searchParams.get("q") || "";

  useEffect(() => {
    if (!token) return;
    coordinacionApi.getEnums(token).then(setEnums).catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (q) params.q = q;
      const res = await coordinacionApi.listIncidencias(token, params);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, page, status, severity, q]);

  useEffect(() => { load(); }, [load]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const totalPages = Math.ceil(data.total / 25) || 1;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="incidencias-list-page">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Incidencias</h1>
            <p className="text-sm text-slate-500 mt-1">{data.total} registro{data.total !== 1 ? "s" : ""}</p>
          </div>
          {(user?.role === "coordinator" || user?.role === "admin") && (
            <button
              onClick={() => navigate(`/${sub}/coordinacion/incidencias/nueva`)}
              className="group flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.30)",
              }}
              data-testid="new-incidencia-btn"
            >
              <Plus className="w-4 h-4" />
              Nueva incidencia
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por título o descripción..."
                value={q}
                onChange={(e) => updateFilter("q", e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                data-testid="search-input"
              />
            </div>
            <select
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              data-testid="filter-status"
            >
              <option value="">Todos los estados</option>
              {enums?.statuses?.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => updateFilter("severity", e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              data-testid="filter-severity"
            >
              <option value="">Todas las severidades</option>
              {enums?.severities?.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── List ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {/* List header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 4px 12px rgba(239,68,68,0.25)" }}
            >
              <FileWarning className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Listado de incidencias</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {status || severity || q ? "Filtros aplicados" : "Mostrando todas"}
                {data.total > 0 && ` \u00B7 Página ${page} de ${totalPages}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-400 text-sm">No se encontraron incidencias</p>
              <p className="text-xs text-slate-300 mt-1">Ajusta los filtros o crea una nueva</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {data.items.map(inc => {
                const sev = SEV_BADGE[inc.severity] || SEV_BADGE.baja;
                const sts = STS_BADGE[inc.status] || STS_BADGE.nueva;
                const isConfidential = inc.confidential || inc.title?.startsWith("CONFIDENCIAL");
                const cleanTitle = stripConfidentialPrefix(inc.title);
                return (
                  <button
                    key={inc.id}
                    onClick={() => navigate(`/${sub}/coordinacion/incidencias/${inc.id}`)}
                    className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left bg-white"
                    style={{ borderLeftWidth: "3px", borderLeftColor: sev.dot }}
                    data-testid={`incidencia-row-${inc.id}`}
                  >
                    {/* Severity dot */}
                    <div className="flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sev.dot, boxShadow: `0 0 0 3px ${sev.dot}22` }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isConfidential && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-100 mb-1.5">
                          <Lock className="w-2.5 h-2.5 text-red-500" strokeWidth={2.5} />
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Confidencial</span>
                        </span>
                      )}
                      <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{cleanTitle}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-slate-400" strokeWidth={2} />
                        </div>
                        <span className="text-xs text-slate-500 truncate">{inc.student_name}</span>
                        <span className="text-slate-300 text-[10px]">&bull;</span>
                        <Clock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(inc.occurred_at)}</span>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sev.cls}`}>
                        {sev.label}
                      </span>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>
                        {sts.label}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data.total > 25 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", String(page - 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  data-testid="prev-page"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter("page", String(page + 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  data-testid="next-page"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CoordinacionLayout>
  );
}
