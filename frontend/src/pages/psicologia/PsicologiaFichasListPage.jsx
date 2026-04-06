import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import { Search, User, ChevronRight, FileText, Tag } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "activo", label: "Activo", color: "bg-blue-100 text-blue-700" },
  { value: "en_seguimiento", label: "En Seguimiento", color: "bg-amber-100 text-amber-700" },
  { value: "en_tratamiento", label: "En Tratamiento", color: "bg-orange-100 text-orange-700" },
  { value: "de_alta", label: "De Alta", color: "bg-green-100 text-green-700" },
  { value: "derivado", label: "Derivado", color: "bg-violet-100 text-violet-700" },
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Academic structure
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Filters
  const [nivelId, setNivelId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [turnoId, setTurnoId] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [levelsRes, gradesRes, sectionsRes, shiftsRes] = await Promise.all([
          fetch(`${API}/academic/levels`, { headers }),
          fetch(`${API}/academic/grades`, { headers }),
          fetch(`${API}/academic/sections`, { headers }),
          fetch(`${API}/academic/shifts`, { headers }),
        ]);
        if (levelsRes.ok) setLevels(await levelsRes.json());
        if (gradesRes.ok) { const d = await gradesRes.json(); setGrades(Array.isArray(d) ? d : d.grades || []); }
        if (sectionsRes.ok) { const d = await sectionsRes.json(); setSections(Array.isArray(d) ? d : d.sections || []); }
        if (shiftsRes.ok) { const d = await shiftsRes.json(); setShifts(Array.isArray(d) ? d : d.shifts || []); }
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
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, nivelId, gradoId, seccionId, turnoId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filteredGrades = nivelId ? grades.filter(g => g.nivel_id === nivelId) : grades;
  const filteredSections = gradoId ? sections.filter(s => s.grado_id === gradoId) : sections;
  const totalPages = Math.ceil(total / limit);

  const levelMap = Object.fromEntries(levels.map(l => [l.id, l.nombre]));
  const gradeMap = Object.fromEntries(grades.map(g => [g.id, g.nombre]));
  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s.nombre]));

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="fichas">
      <div data-testid="psicologia-fichas-list">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
          <h1 className="text-lg font-bold text-slate-800">Fichas Clinicas</h1>
          <p className="text-xs text-slate-500">{total} fichas registradas</p>
        </div>

        <div className="px-4 sm:px-6 py-6 space-y-4">
          {/* Search + Filters */}
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
              <select
                value={nivelId}
                onChange={(e) => { setNivelId(e.target.value); setGradoId(""); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="filter-nivel"
              >
                <option value="">Todos los niveles</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              <select
                value={gradoId}
                onChange={(e) => { setGradoId(e.target.value); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="filter-grado"
              >
                <option value="">Todos los grados</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <select
                value={seccionId}
                onChange={(e) => { setSeccionId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="filter-seccion"
              >
                <option value="">Todas las secciones</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select
                value={turnoId}
                onChange={(e) => { setTurnoId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="filter-turno"
              >
                <option value="">Todos los turnos</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="filter-status"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Records List */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-20" />)}
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No hay fichas clinicas registradas</p>
              <p className="text-xs text-slate-400 mt-1">Las fichas se crean desde el perfil de cada estudiante</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {records.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${r.student_id}`))}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-slate-50/80 transition-colors text-left group"
                  data-testid={`record-${r.id}`}
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-violet-100 flex-shrink-0">
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
                      {r.student_nivel && <span className="text-xs text-slate-400">{r.student_nivel}</span>}
                      {r.student_grado && <span className="text-xs text-slate-400">{r.student_grado}</span>}
                      {r.student_seccion && <span className="text-xs text-slate-400">Sec. {r.student_seccion}</span>}
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
                      {r.last_session && <p className="text-[10px] text-slate-400">Ultima: {r.last_session.slice(0, 10)}</p>}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">Pagina {page} de {totalPages} ({total} fichas)</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" data-testid="prev-page">
                  Anterior
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" data-testid="next-page">
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
