import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import { Search, User, MapPin, Calendar, FileText, Tag, ChevronLeft, ChevronRight, Activity } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "activo", label: "Activo", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { value: "en_seguimiento", label: "En Seguimiento", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { value: "en_tratamiento", label: "En Tratamiento", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  { value: "de_alta", label: "De Alta", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  { value: "derivado", label: "Derivado", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
];

function getStatusStyle(status) {
  const s = STATUS_OPTIONS.find(o => o.value === status);
  return s || { label: status || "---", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
}

export default function PsicologiaFichasListPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [nivelId, setNivelId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [turnoId, setTurnoId] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [lR, gR, sR, shR] = await Promise.all([
          fetch(`${API}/academic/levels`, { headers }),
          fetch(`${API}/academic/grades`, { headers }),
          fetch(`${API}/academic/sections`, { headers }),
          fetch(`${API}/academic/shifts`, { headers }),
        ]);
        if (lR.ok) setLevels(await lR.json());
        if (gR.ok) { const d = await gR.json(); setGrades(Array.isArray(d) ? d : d.grades || []); }
        if (sR.ok) { const d = await sR.json(); setSections(Array.isArray(d) ? d : d.sections || []); }
        if (shR.ok) { const d = await shR.json(); setShifts(Array.isArray(d) ? d : d.shifts || []); }
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (nivelId) params.append("nivel_id", nivelId);
      if (gradoId) params.append("grado_id", gradoId);
      if (seccionId) params.append("seccion_id", seccionId);
      if (turnoId) params.append("turno_id", turnoId);
      const res = await fetch(`${API}/v1/psychology/records?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, nivelId, gradoId, seccionId, turnoId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filteredGrades = nivelId ? grades.filter(g => g.nivel_id === nivelId) : grades;
  const filteredSections = gradoId ? sections.filter(s => s.grado_id === gradoId) : sections;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (d) => {
    if (!d) return "---";
    const dt = new Date(d);
    return dt.toLocaleDateString("es-PE", { day: "numeric", month: "numeric", year: "numeric" });
  };

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="fichas">
      <div data-testid="psicologia-fichas-list">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Fichas Clinicas</h1>
            <p className="text-xs text-slate-500">{total} fichas registradas</p>
          </div>
          {totalPages > 1 && (
            <p className="text-xs text-slate-400">Página {page} de {totalPages}</p>
          )}
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="relative">
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <select value={nivelId} onChange={(e) => { setNivelId(e.target.value); setGradoId(""); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-nivel">
                <option value="">Todos los niveles</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              <select value={gradoId} onChange={(e) => { setGradoId(e.target.value); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-grado">
                <option value="">Todos los grados</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <select value={seccionId} onChange={(e) => { setSeccionId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-seccion">
                <option value="">Todas las secciones</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select value={turnoId} onChange={(e) => { setTurnoId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-turno">
                <option value="">Todos los turnos</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-status">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Record Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 h-72 animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No hay fichas clinicas registradas</p>
              <p className="text-xs text-slate-400 mt-1">Las fichas se crean desde el perfil de cada estudiante</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-start" data-testid="records-grid">
              {records.map(r => {
                const st = getStatusStyle(r.status);
                const academicInfo = [r.student_nivel, r.student_grado, r.student_seccion].filter(Boolean).join(" - ");
                const initials = (r.student_name || "").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${r.student_id}`))}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left group relative"
                    data-testid={`record-card-${r.id}`}
                  >
                    {/* Top accent bar */}
                    <div className="h-1.5 bg-gradient-to-r from-violet-400 to-purple-400" />

                    {/* Photo + Name + Status */}
                    <div className="flex flex-col items-center pt-5 pb-4 px-3">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 border-[3px] border-white shadow-md flex-shrink-0">
                        {r.student_photo ? (
                          <img src={r.student_photo} alt={r.student_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-100 to-violet-50">
                            <span className="text-xl font-bold text-violet-400">{initials}</span>
                          </div>
                        )}
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2 min-h-[2.5rem]">
                        {r.student_name}
                      </h3>
                      <span className={`mt-2 px-3 py-1 text-[11px] font-semibold rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="mx-4 border-t border-slate-100" />

                    {/* Info section */}
                    <div className="px-4 py-3 pb-5 space-y-1.5">
                      {academicInfo && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-slate-600 leading-tight">{academicInfo}</span>
                        </div>
                      )}
                      {r.reason_category && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-xs text-slate-600">{r.reason_category}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        <span className="text-xs text-slate-500">{r.total_sessions || 0} sesiones</span>
                      </div>
                      {r.last_session && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-xs text-slate-500">Última: {formatDate(r.last_session)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="prev-page">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">...</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                        p === page ? "bg-violet-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}>
                      {p}
                    </button>
                  )
                )}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="next-page">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </PsicologiaLayout>
  );
}
