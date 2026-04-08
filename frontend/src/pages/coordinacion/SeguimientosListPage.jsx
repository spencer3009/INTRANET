import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  ClipboardList, AlertTriangle, Clock, CheckCircle, CalendarDays,
  ChevronRight, Search, Loader2, User
} from "lucide-react";

/* ─── Badge configs ─── */
const SEV_BADGE = {
  baja:    { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Baja", dot: "#10b981" },
  media:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Media", dot: "#f59e0b" },
  alta:    { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Alta", dot: "#ef4444" },
  critica: { cls: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200", label: "Crítica", dot: "#dc2626" },
};

const STS_BADGE = {
  pendiente:  { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Pendiente" },
  vencido:    { cls: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200", label: "Vencido" },
  completado: { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Completado" },
};

/* ─── KPI card config ─── */
const KPI_CONFIG = [
  { key: "total",       label: "Total",        icon: ClipboardList, from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241" },
  { key: "pendientes",  label: "Pendientes",   icon: Clock,         from: "#3b82f6", to: "#2563eb", rgb: "59, 130, 246" },
  { key: "vencidos",    label: "Vencidos",     icon: AlertTriangle, from: "#ef4444", to: "#dc2626", rgb: "239, 68, 68" },
  { key: "esta_semana", label: "Esta semana",  icon: CalendarDays,  from: "#10b981", to: "#059669", rgb: "16, 185, 129" },
];

export default function SeguimientosListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState({ items: [], summary: {}, total: 0 });
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "");
  const [filterStudent, setFilterStudent] = useState(searchParams.get("student") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));

  const base = subdomain ? `/${subdomain}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (filterStatus) params.status = filterStatus;
      const res = await coordinacionApi.listSeguimientosGlobal(token, params);
      setData(res);
    } catch (err) {
      console.error("Error loading seguimientos:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterStudent) params.student = filterStudent;
    if (page > 1) params.page = page.toString();
    setSearchParams(params, { replace: true });
  }, [filterStatus, filterStudent, page, setSearchParams]);

  const s = data.summary || {};

  const filteredItems = filterStudent
    ? data.items.filter(i => (i.student_name || "").toLowerCase().includes(filterStudent.toLowerCase()))
    : data.items;

  const totalPages = Math.ceil(data.total / 25) || 1;

  const TABS = [
    { val: "", label: "Todos" },
    { val: "pendiente", label: "Pendientes" },
    { val: "vencido", label: "Vencidos" },
    { val: "completado", label: "Completados" },
  ];

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="seguimientos">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="seguimientos-list-page">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Seguimientos</h1>
          <p className="text-sm text-slate-500 mt-1">Vista cronológica de revisiones pendientes y completadas</p>
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
              {/* Semi-circle deco */}
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
                {s[key] ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="flex gap-1.5">
            {TABS.map(opt => (
              <button
                key={opt.val}
                onClick={() => { setFilterStatus(opt.val); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  filterStatus === opt.val
                    ? "text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              data-testid="search-student"
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
              <ClipboardList className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Listado de seguimientos</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filterStatus ? TABS.find(t => t.val === filterStatus)?.label : "Todos"}
                {data.total > 0 && ` · Página ${page} de ${totalPages}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20" data-testid="seguimientos-empty">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-300" />
              </div>
              <p className="font-semibold text-slate-400 text-sm">No hay seguimientos pendientes</p>
              <p className="text-xs text-slate-300 mt-1">Ajusta los filtros o crea un nuevo seguimiento</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {filteredItems.map((seg) => {
                const sev = SEV_BADGE[seg.incidencia_severity] || SEV_BADGE.baja;
                const sts = STS_BADGE[seg.computed_status] || STS_BADGE.pendiente;
                const isOverdue = seg.is_overdue || seg.computed_status === "vencido";
                return (
                  <button
                    key={seg.id}
                    onClick={() => navigate(`${base}/coordinacion/incidencias/${seg.incidencia_id}`)}
                    className={`group w-full flex items-center gap-4 p-4 rounded-xl border hover:shadow-sm transition-all text-left ${
                      isOverdue ? "border-red-200 bg-red-50/30 hover:border-red-300" : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                    style={{ borderLeftWidth: "3px", borderLeftColor: sev.dot }}
                    data-testid={`seguimiento-row-${seg.id}`}
                  >
                    {/* Severity dot */}
                    <div className="flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sev.dot, boxShadow: `0 0 0 3px ${sev.dot}22` }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-slate-400" strokeWidth={2} />
                        </div>
                        <span className="text-[13px] font-semibold text-slate-900 truncate">{seg.student_name}</span>
                        <span className="text-[10px] text-slate-300">&bull;</span>
                        <span className="text-xs text-slate-400">{seg.student_grade}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{seg.incidencia_title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Clock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-400">
                          Próxima revisión: {seg.next_review_at ? new Date(seg.next_review_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Observation preview */}
                    {seg.observation && (
                      <p className="hidden lg:block max-w-[200px] text-xs text-slate-400 truncate flex-shrink-0">
                        {seg.observation}
                      </p>
                    )}

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
              <span className="text-xs text-slate-500 font-medium tabular-nums">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CoordinacionLayout>
  );
}
