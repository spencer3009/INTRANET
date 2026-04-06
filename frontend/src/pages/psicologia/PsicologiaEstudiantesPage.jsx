import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import { Search, User, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaEstudiantesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  // Load academic structure once
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
        if (gradesRes.ok) {
          const gData = await gradesRes.json();
          setGrades(Array.isArray(gData) ? gData : gData.grades || []);
        }
        if (sectionsRes.ok) {
          const sData = await sectionsRes.json();
          setSections(Array.isArray(sData) ? sData : sData.sections || []);
        }
        if (shiftsRes.ok) {
          const shData = await shiftsRes.json();
          setShifts(Array.isArray(shData) ? shData : shData.shifts || []);
        }
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (nivelId) params.append("nivel_id", nivelId);
      if (gradoId) params.append("grado_id", gradoId);
      if (seccionId) params.append("seccion_id", seccionId);
      if (turnoId) params.append("turno_id", turnoId);
      const res = await fetch(`${API}/v1/psychology/students?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, nivelId, gradoId, seccionId, turnoId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Cascading: filter grades by selected level
  const filteredGrades = nivelId ? grades.filter(g => g.level_id === nivelId) : grades;
  // Cascading: filter sections by selected grade
  const filteredSections = gradoId ? sections.filter(s => s.grade_id === gradoId) : sections;

  const totalPages = Math.ceil(total / limit);

  // Resolve names
  const levelMap = Object.fromEntries(levels.map(l => [l.id, l.nombre]));
  const gradeMap = Object.fromEntries(grades.map(g => [g.id, g.nombre]));
  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s.nombre]));
  const shiftMap = Object.fromEntries(shifts.map(s => [s.id, s.nombre]));

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="estudiantes">
      <div data-testid="psicologia-estudiantes">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <h1 className="text-lg font-bold text-slate-800">Listado de Estudiantes</h1>
        <p className="text-xs text-slate-500">{total} estudiantes registrados</p>
      </div>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Search + Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o apellido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              data-testid="search-students"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={nivelId}
              onChange={(e) => { setNivelId(e.target.value); setGradoId(""); setSeccionId(""); setPage(1); }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-nivel"
            >
              <option value="">Todos los niveles</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <select
              value={gradoId}
              onChange={(e) => { setGradoId(e.target.value); setSeccionId(""); setPage(1); }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-grado"
            >
              <option value="">Todos los grados</option>
              {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <select
              value={seccionId}
              onChange={(e) => { setSeccionId(e.target.value); setPage(1); }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-seccion"
            >
              <option value="">Todas las secciones</option>
              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select
              value={turnoId}
              onChange={(e) => { setTurnoId(e.target.value); setPage(1); }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="filter-turno"
            >
              <option value="">Todos los turnos</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Students List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-20" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No se encontraron estudiantes</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${s.id}`))}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-slate-50/80 transition-colors text-left group"
                data-testid={`student-${s.id}`}
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-violet-100 flex-shrink-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-5 h-5 text-violet-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name} {s.last_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[levelMap[s.nivel_id], gradeMap[s.grado_id], sectionMap[s.seccion_id] ? `Sec. ${sectionMap[s.seccion_id]}` : null, shiftMap[s.turno_id]].filter(Boolean).join(" - ") || s.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.has_psychological_record && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-violet-100 text-violet-700">Ficha</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">Pagina {page} de {totalPages} ({total} estudiantes)</p>
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
