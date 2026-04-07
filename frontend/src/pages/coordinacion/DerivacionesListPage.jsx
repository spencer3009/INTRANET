import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { ArrowRightLeft, Search, Filter, Plus, User, AlertTriangle, Clock, ChevronRight } from "lucide-react";

const STATUS_COLORS = {
  pendiente: "bg-yellow-100 text-yellow-800",
  en_proceso: "bg-blue-100 text-blue-800",
  resuelta: "bg-green-100 text-green-800",
  cancelada: "bg-slate-100 text-slate-600",
};

const PRIORITY_COLORS = {
  baja: "bg-slate-100 text-slate-600",
  media: "bg-yellow-100 text-yellow-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

const AREA_LABELS = {
  psicologia: "Psicologia",
  direccion: "Direccion",
  tutoria: "Tutoria",
  orientacion_familiar: "Orientacion familiar",
  externa: "Derivacion externa",
};

export default function DerivacionesListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [derivaciones, setDerivaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterArea) params.to_area = filterArea;
      if (filterUnassigned) params.unassigned = "true";
      const res = await coordinacionApi.listDerivaciones(token, params);
      setDerivaciones(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Error loading derivaciones:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus, filterArea, filterUnassigned]);

  useEffect(() => { load(); }, [load]);

  const goToDetail = (id) => {
    const base = subdomain ? `/${subdomain}` : "";
    navigate(`${base}/coordinacion/derivaciones/${id}`);
  };

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="derivaciones">
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="derivaciones-list-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-teal-600" />
            Derivaciones
          </h1>
          <p className="text-sm text-slate-500 mt-1">{total} derivacion(es) encontrada(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5" data-testid="derivaciones-filters">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          data-testid="filter-deriv-status"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="resuelta">Resuelta</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          value={filterArea}
          onChange={(e) => { setFilterArea(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          data-testid="filter-deriv-area"
        >
          <option value="">Todas las areas</option>
          {Object.entries(AREA_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnassigned}
            onChange={(e) => { setFilterUnassigned(e.target.checked); setPage(1); }}
            className="rounded border-slate-300"
            data-testid="filter-unassigned"
          />
          Solo sin asignar
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : derivaciones.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No hay derivaciones registradas</div>
      ) : (
        <div className="space-y-3">
          {derivaciones.map((d) => (
            <div
              key={d.id}
              onClick={() => goToDetail(d.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer"
              data-testid={`derivacion-row-${d.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || ""}`}>
                      {d.status?.replace("_", " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[d.priority] || ""}`}>
                      {d.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                      {AREA_LABELS[d.to_area] || d.to_area}
                    </span>
                    {!d.to_user_id && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                        Sin asignar
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {d.incidencia_title || "Incidencia"}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {d.student_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" /> {d.to_user_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {d.created_at ? new Date(d.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-slate-600">
            Pagina {page} de {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
