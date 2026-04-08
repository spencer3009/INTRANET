import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  ClipboardList, AlertTriangle, Clock, CheckCircle, CalendarDays,
  ChevronRight, Search,
} from "lucide-react";

const SEVERITY_COLORS = {
  baja: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-800",
  alta: "bg-orange-100 text-orange-700",
  critica: "bg-red-100 text-red-700",
};

const STATUS_STYLES = {
  pendiente: { bg: "bg-blue-100 text-blue-800", label: "Pendiente" },
  vencido: { bg: "bg-red-100 text-red-700", label: "Vencido" },
  completado: { bg: "bg-green-100 text-green-700", label: "Completado" },
};

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

  const goToIncidencia = (incidenciaId) => {
    navigate(`${base}/coordinacion/incidencias/${incidenciaId}`);
  };

  const s = data.summary || {};

  const kpis = [
    { label: "Total", value: s.total ?? 0, icon: ClipboardList, color: "text-slate-600", bg: "bg-slate-50" },
    { label: "Pendientes", value: s.pendientes ?? 0, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Vencidos", value: s.vencidos ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Esta semana", value: s.esta_semana ?? 0, icon: CalendarDays, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  const filteredItems = filterStudent
    ? data.items.filter(i => (i.student_name || "").toLowerCase().includes(filterStudent.toLowerCase()))
    : data.items;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="seguimientos">
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="seguimientos-list-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          Seguimientos
        </h1>
        <p className="text-sm text-slate-500 mt-1">Vista cronologica de revisiones pendientes y completadas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-slate-100`} data-testid={`kpi-${k.label.toLowerCase().replace(" ", "-")}`}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1.5">
          {[
            { val: "", label: "Todos" },
            { val: "pendiente", label: "Pendientes" },
            { val: "vencido", label: "Vencidos" },
            { val: "completado", label: "Completados" },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => { setFilterStatus(opt.val); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === opt.val
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              data-testid={`filter-status-${opt.val || "all"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar estudiante..."
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white w-48"
            data-testid="search-student"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12" data-testid="seguimientos-empty">
          <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
          <p className="text-slate-400">No hay seguimientos pendientes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <div className="col-span-2">Estudiante</div>
            <div className="col-span-1">Grado</div>
            <div className="col-span-2">Incidencia</div>
            <div className="col-span-1">Severidad</div>
            <div className="col-span-2">Proxima revision</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-1">Observacion</div>
            <div className="col-span-1"></div>
          </div>

          {/* Rows */}
          {filteredItems.map((seg) => {
            const sts = STATUS_STYLES[seg.computed_status] || STATUS_STYLES.pendiente;
            return (
              <div
                key={seg.id}
                onClick={() => goToIncidencia(seg.incidencia_id)}
                className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors items-center ${
                  seg.is_overdue ? "bg-red-50/50" : ""
                }`}
                data-testid={`seguimiento-row-${seg.id}`}
              >
                <div className="col-span-2 text-sm font-medium text-slate-800">{seg.student_name}</div>
                <div className="col-span-1 text-xs text-slate-500">{seg.student_grade}</div>
                <div className="col-span-2 text-xs text-slate-600 truncate">{seg.incidencia_title}</div>
                <div className="col-span-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[seg.incidencia_severity] || ""}`}>
                    {seg.incidencia_severity}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-slate-600">
                  {seg.next_review_at ? new Date(seg.next_review_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                </div>
                <div className="col-span-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sts.bg}`}>
                    {sts.label}
                  </span>
                </div>
                <div className="col-span-1 text-xs text-slate-500 truncate">{(seg.observation || "").slice(0, 40)}</div>
                <div className="col-span-1 flex justify-end">
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data.total > 25 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Anterior</button>
          <span className="px-3 py-1.5 text-sm text-slate-600">Pagina {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={filteredItems.length < 25}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
