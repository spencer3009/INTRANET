import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import {
  Search, User, ChevronRight, FileText, AlertTriangle, CheckCircle2, Clock, Tag
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "en_seguimiento", label: "En Seguimiento", color: "bg-blue-100 text-blue-700" },
  { value: "en_tratamiento", label: "En Tratamiento", color: "bg-amber-100 text-amber-700" },
  { value: "de_alta", label: "De Alta", color: "bg-green-100 text-green-700" },
  { value: "derivado", label: "Derivado", color: "bg-violet-100 text-violet-700" },
];

const REASON_CATEGORIES = [
  "", "Conductual", "Emocional", "Academico", "Familiar",
  "Social", "Adaptacion", "Orientacion Vocacional", "Otro"
];

function getStatusStyle(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || "bg-slate-100 text-slate-700";
}
function getStatusLabel(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

export default function PsicologiaFichasListPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const headers = { Authorization: `Bearer ${token}` };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("reason_category", categoryFilter);
      const res = await fetch(`${API}/v1/psychology/records?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const totalPages = Math.ceil(total / limit);

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="fichas">
      <div data-testid="psicologia-fichas-list">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
          <h1 className="text-lg font-bold text-slate-800">Fichas Clinicas</h1>
          <p className="text-xs text-slate-500">{total} fichas registradas</p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre de estudiante..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="search-records"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-status"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-category"
            >
              <option value="">Todas las categorias</option>
              {REASON_CATEGORIES.filter(Boolean).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Records List */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-20" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No hay fichas clinicas registradas</p>
              <p className="text-xs text-slate-400 mt-1">Las fichas se crean desde el perfil de cada estudiante</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${r.student_id}`))}
                  className="w-full bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-md transition-all text-left flex items-center gap-4 group"
                  data-testid={`record-${r.id}`}
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-violet-100 flex-shrink-0">
                    {r.student_photo ? (
                      <img src={r.student_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-5 h-5 text-violet-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.student_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.student_grade && (
                        <span className="text-xs text-slate-400">{r.student_grade} {r.student_section}</span>
                      )}
                      {r.reason_category && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Tag className="w-3 h-3" />{r.reason_category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">{r.total_sessions} sesiones</p>
                      {r.last_session && (
                        <p className="text-[10px] text-slate-400">Ultima: {r.last_session.slice(0, 10)}</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${getStatusStyle(r.status)}`}>
                      {getStatusLabel(r.status)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Pagina {page} de {totalPages} ({total} fichas)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  data-testid="prev-page"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  data-testid="next-page"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PsicologiaLayout>
  );
}
