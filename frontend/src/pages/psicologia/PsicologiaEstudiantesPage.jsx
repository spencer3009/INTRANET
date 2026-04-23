import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import { Search, User, MapPin, Calendar, FileText, ChevronLeft, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_MAP = {
  active: { label: "Activo", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  inactive: { label: "Inactivo", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  transferred: { label: "Trasladado", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  graduated: { label: "Egresado", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

function getStatus(s) {
  return STATUS_MAP[s] || { label: s || "---", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
}

export default function PsicologiaEstudiantesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, nivelId, gradoId, seccionId, turnoId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filteredGrades = nivelId ? grades.filter(g => g.nivel_id === nivelId) : grades;
  const filteredSections = gradoId ? sections.filter(s => s.grado_id === gradoId) : sections;
  const totalPages = Math.ceil(total / limit);

  const levelMap = Object.fromEntries(levels.map(l => [l.id, l.nombre]));
  const gradeMap = Object.fromEntries(grades.map(g => [g.id, g.nombre]));
  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s.nombre]));
  const shiftMap = Object.fromEntries(shifts.map(s => [s.id, s.nombre]));

  const formatDate = (d) => {
    if (!d) return "---";
    const dt = new Date(d);
    return dt.toLocaleDateString("es-PE", { day: "numeric", month: "numeric", year: "numeric" });
  };

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="estudiantes">
      <div data-testid="psicologia-estudiantes">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Listado de Estudiantes</h1>
            <p className="text-xs text-slate-500">{total} estudiantes registrados</p>
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
                placeholder="Buscar por nombre o apellido..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                data-testid="search-students"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select value={nivelId} onChange={(e) => { setNivelId(e.target.value); setGradoId(""); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-nivel">
                <option value="">Todos los niveles</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              <select value={gradoId} onChange={(e) => { setGradoId(e.target.value); setSeccionId(""); setPage(1); }}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-grado">
                <option value="">Todos los grados</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <select value={seccionId} onChange={(e) => { setSeccionId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-seccion">
                <option value="">Todas las secciones</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select value={turnoId} onChange={(e) => { setTurnoId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="filter-turno">
                <option value="">Todos los turnos</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Student Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 h-64 animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No se encontraron estudiantes</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-start" data-testid="students-grid">
              {students.map(s => {
                const st = getStatus(s.student_status);
                const nivel = levelMap[s.nivel_id] || "";
                const grado = gradeMap[s.grado_id] || "";
                const seccion = sectionMap[s.seccion_id] || "";
                const initials = `${(s.name || "")[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();
                const academicInfo = [nivel, grado, sección].filter(Boolean).join(" - ");

                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${s.id}`))}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left group relative"
                    data-testid={`student-card-${s.id}`}
                  >
                    {/* Top accent bar */}
                    <div className="h-1.5 bg-gradient-to-r from-teal-400 to-emerald-400" />

                    {/* Photo + Name + Status */}
                    <div className="flex flex-col items-center pt-5 pb-4 px-3">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 border-[3px] border-white shadow-md flex-shrink-0">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-100 to-violet-50">
                            <span className="text-xl font-bold text-violet-400">{initials}</span>
                          </div>
                        )}
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2 min-h-[2.5rem]">
                        {s.name} {s.last_name}
                      </h3>
                      <span className={`mt-2 px-3 py-1 text-[11px] font-semibold rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                        {st.label}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 border-t border-slate-100" />

                    {/* Info section */}
                    <div className="px-4 py-3 pb-5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-slate-600 leading-tight">{academicInfo || "Sin asignar"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                        <span className="text-xs text-slate-500">Registrado: {formatDate(s.created_at)}</span>
                      </div>
                      {s.has_psychological_record && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                          <span className="text-xs text-violet-600 font-medium">{s.total_sessions || 0} sesiones</span>
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
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                data-testid="prev-page"
              >
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
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                        p === page
                          ? "bg-violet-600 text-white shadow-sm"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                data-testid="next-page"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </PsicologiaLayout>
  );
}
