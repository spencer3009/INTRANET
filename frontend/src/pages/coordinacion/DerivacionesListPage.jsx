import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  ArrowRightLeft, User, Clock, ChevronRight, ChevronLeft,
  Calendar, Loader2, AlertTriangle, UserX, CheckCircle2
} from "lucide-react";

/* ─── Badge configs (premium) ─── */
const STS_BADGE = {
  pendiente:  { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Pendiente", dot: "#f59e0b" },
  en_proceso: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "En proceso", dot: "#3b82f6" },
  resuelta:   { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Resuelta", dot: "#10b981" },
  cancelada:  { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Cancelada", dot: "#64748b" },
};

const PRIO_BADGE = {
  baja:    { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Baja", dot: "#10b981" },
  media:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Media", dot: "#f59e0b" },
  alta:    { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Alta", dot: "#ef4444" },
  urgente: { cls: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200", label: "Urgente", dot: "#dc2626" },
};

const AREA_LABELS = {
  psicologia: "Psicologia",
  direccion: "Dirección",
  tutoria: "Tutoria",
  orientacion_familiar: "Orientacion familiar",
  externa: "Derivación externa",
};

/* ─── KPI card config ─── */
const KPI_CONFIG = [
  { key: "total",       label: "Total",       icon: ArrowRightLeft, from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241" },
  { key: "pendientes",  label: "Pendientes",  icon: Clock,          from: "#f59e0b", to: "#d97706", rgb: "245, 158, 11" },
  { key: "en_proceso",  label: "En proceso",  icon: AlertTriangle,  from: "#3b82f6", to: "#2563eb", rgb: "59, 130, 246" },
  { key: "resueltas",   label: "Resueltas",   icon: CheckCircle2,   from: "#10b981", to: "#059669", rgb: "16, 185, 129" },
];

const TABS = [
  { val: "", label: "Todas" },
  { val: "pendiente", label: "Pendientes" },
  { val: "en_proceso", label: "En proceso" },
  { val: "resuelta", label: "Resueltas" },
  { val: "cancelada", label: "Canceladas" },
];

export default function DerivacionesListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [derivaciones, setDerivaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const filterStatus = searchParams.get("status") || "";
  const filterArea = searchParams.get("area") || "";
  const filterUnassigned = searchParams.get("unassigned") === "true";

  const [kpis, setKpis] = useState({ total: 0, pendientes: 0, en_proceso: 0, resueltas: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (filterStatus) params.status = filterStatus;
      if (filterArea) params.to_area = filterArea;
      if (filterUnassigned) params.unassigned = "true";
      const res = await coordinacionApi.listDerivaciones(token, params);
      setDerivaciones(res.items || []);
      setTotal(res.total || 0);

      if (!filterStatus && !filterArea && !filterUnassigned) {
        const items = res.items || [];
        setKpis({
          total: res.total || 0,
          pendientes: items.filter(d => d.status === "pendiente").length,
          en_proceso: items.filter(d => d.status === "en_proceso").length,
          resueltas: items.filter(d => d.status === "resuelta").length,
        });
      }
    } catch (err) {
      console.error("Error loading derivaciones:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus, filterArea, filterUnassigned]);

  useEffect(() => { load(); }, [load]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const toggleUnassigned = () => {
    const params = new URLSearchParams(searchParams);
    if (!filterUnassigned) params.set("unassigned", "true");
    else params.delete("unassigned");
    params.set("page", "1");
    setSearchParams(params);
  };

  const goToDetail = (id) => {
    const base = subdomain ? `/${subdomain}` : "";
    navigate(`${base}/coordinacion/derivaciones/${id}`);
  };

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="derivaciones-list-page">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Derivaciones</h1>
          <p className="text-sm text-slate-500 mt-1">{total} derivacion{total !== 1 ? "es" : ""} encontrada{total !== 1 ? "s" : ""}</p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {KPI_CONFIG.map(({ key, label, icon: Icon, from, to, rgb }) => (
            <div
              key={key}
              className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                boxShadow: `0 4px 16px rgba(${rgb}, 0.20)`,
              }}
              data-testid={`kpi-${key}`}
            >
              <div className="absolute pointer-events-none rounded-full" style={{ width: "140px", height: "140px", top: "-30px", right: "-40px", background: "rgba(255,255,255,0.12)" }} />
              <div className="absolute pointer-events-none rounded-full" style={{ width: "90px", height: "90px", bottom: "-30px", right: "-10px", background: "rgba(255,255,255,0.07)" }} />
              <div className="relative flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/20"
                     style={{ background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                  <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-semibold text-white/90">{label}</span>
              </div>
              <div className="relative text-[32px] font-bold text-white leading-none tabular-nums tracking-tight">
                {kpis[key] ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(opt => (
              <button
                key={opt.val}
                onClick={() => updateFilter("status", opt.val)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  filterStatus === opt.val ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={filterStatus === opt.val ? {
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.30)"
                } : {}}
                data-testid={`filter-status-${opt.val || "all"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={filterArea}
            onChange={(e) => updateFilter("area", e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
            data-testid="filter-deriv-area"
          >
            <option value="">Todas las areas</option>
            {Object.entries(AREA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={toggleUnassigned}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
              filterUnassigned
                ? "text-white border-red-400"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            }`}
            style={filterUnassigned ? {
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              boxShadow: "0 2px 8px rgba(239,68,68,0.30)"
            } : {}}
            data-testid="filter-unassigned"
          >
            <span className="flex items-center gap-1.5"><UserX className="w-3 h-3" /> Sin asignar</span>
          </button>
        </div>

        {/* ── List ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
              <ArrowRightLeft className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Listado de derivaciones</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filterStatus ? TABS.find(t => t.val === filterStatus)?.label : "Mostrando todas"}
                {total > 0 && ` · Página ${page} de ${totalPages}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            </div>
          ) : derivaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <ArrowRightLeft className="w-7 h-7 text-indigo-300" />
              </div>
              <p className="font-semibold text-slate-400 text-sm">No hay derivaciones registradas</p>
              <p className="text-xs text-slate-300 mt-1">Ajusta los filtros para buscar</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {derivaciones.map((d) => {
                const sts = STS_BADGE[d.status] || STS_BADGE.pendiente;
                const prio = PRIO_BADGE[d.priority] || PRIO_BADGE.media;
                return (
                  <button
                    key={d.id}
                    onClick={() => goToDetail(d.id)}
                    className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left bg-white"
                    style={{ borderLeftWidth: "3px", borderLeftColor: prio.dot }}
                    data-testid={`derivacion-row-${d.id}`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sts.dot, boxShadow: `0 0 0 3px ${sts.dot}22` }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>{sts.label}</span>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${prio.cls}`}>{prio.label}</span>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-gradient-to-br from-teal-100/70 to-teal-50/50 text-teal-700 border-teal-200/70">
                          {AREA_LABELS[d.to_area] || d.to_area}
                        </span>
                        {!d.to_user_id && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70">
                            Sin asignar
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                        {d.incidencia_title || "Incidencia"}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <User className="w-3 h-3" /> {d.student_name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <ArrowRightLeft className="w-3 h-3" /> {d.to_user_name || "Sin asignar"}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" /> {d.created_at ? new Date(d.created_at).toLocaleDateString("es-PE") : ""}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {total > 25 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium tabular-nums">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => updateFilter("page", String(page - 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="prev-page">
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button disabled={page >= totalPages} onClick={() => updateFilter("page", String(page + 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="next-page">
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
