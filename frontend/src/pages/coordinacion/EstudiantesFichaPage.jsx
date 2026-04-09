import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  Users, Search, AlertTriangle, ArrowRightLeft, MessageSquare,
  ClipboardList, ChevronRight, Clock, Shield, CalendarCheck,
  FileWarning, Loader2, X, GraduationCap
} from "lucide-react";

const EVENT_CONFIG = {
  incidencia: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Incidencia" },
  seguimiento: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: ClipboardList, label: "Seguimiento" },
  derivacion: { color: "bg-teal-100 text-teal-700 border-teal-200", icon: ArrowRightLeft, label: "Derivación" },
  reunion: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: MessageSquare, label: "Reunión" },
};

const SUMMARY_CARDS = [
  {
    key: "total_incidencias", label: "Incidencias", icon: FileWarning,
    from: "#ef4444", to: "#dc2626", rgb: "239, 68, 68",
  },
  {
    key: "incidencias_abiertas", label: "Abiertas", icon: AlertTriangle,
    from: "#f59e0b", to: "#d97706", rgb: "245, 158, 11",
  },
  {
    key: "total_derivaciones", label: "Derivaciones", icon: ArrowRightLeft,
    from: "#10b981", to: "#059669", rgb: "16, 185, 129",
  },
  {
    key: "total_reuniones", label: "Reuniones", icon: CalendarCheck,
    from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241",
  },
];

export default function EstudiantesFichaPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const { studentId: urlStudentId } = useParams();
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [ficha, setFicha] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  /* Autocomplete state */
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const base = subdomain ? `/${subdomain}` : "";
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetch(`${API_URL}/api/coordinacion/grades`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setGrades(d.grades || d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (urlStudentId && token) {
      setSelectedStudent(urlStudentId);
      loadFicha(urlStudentId, 1);
    }
  }, [urlStudentId, token]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadSections = async (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSection(""); setSelectedStudent(""); setFicha(null);
    setSections([]); setStudents([]); setSearchText("");
    if (!gradeId) return;
    const res = await fetch(`${API_URL}/api/coordinacion/sections?grade_id=${gradeId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setSections(data.sections || data || []);
  };

  const loadStudents = async (sectionId) => {
    setSelectedSection(sectionId);
    setSelectedStudent(""); setFicha(null); setStudents([]); setSearchText("");
    if (!sectionId) return;
    const res = await fetch(`${API_URL}/api/coordinacion/students?section_id=${sectionId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setStudents(data.students || data || []);
  };

  const loadFicha = useCallback(async (studentId, p = 1) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const data = await coordinacionApi.getStudentFicha(token, studentId, { page: p, page_size: 20 });
      setFicha(data);
    } catch (err) {
      console.error("Error loading ficha:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student.id);
    setSearchText(`${student.name} ${student.last_name}`);
    setShowDropdown(false);
    setPage(1);
    loadFicha(student.id, 1);
  };

  const handleClearStudent = () => {
    setSelectedStudent("");
    setSearchText("");
    setFicha(null);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadFicha(selectedStudent, newPage);
  };

  /* Filtered students for autocomplete */
  const filteredStudents = students.filter(s => {
    const full = `${s.name} ${s.last_name}`.toLowerCase();
    return full.includes(searchText.toLowerCase());
  });

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="estudiantes">
      <div className="px-6 md:px-8 py-8 min-h-full" data-testid="estudiantes-ficha-page">

        {/* ── Page header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Ficha del Estudiante</h1>
          <p className="text-sm text-slate-500 mt-1">Busca un alumno para ver su historial completo</p>
        </div>

        {/* ── Selector filters ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Grade select */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Grado</label>
              <select
                value={selectedGrade}
                onChange={(e) => loadSections(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                data-testid="ficha-grade"
              >
                <option value="">Seleccionar grado</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>

            {/* Section select */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Sección</label>
              <select
                value={selectedSection}
                onChange={(e) => loadStudents(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                data-testid="ficha-section"
              >
                <option value="">Seleccionar sección</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            {/* Student autocomplete */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Alumno</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { if (students.length > 0) setShowDropdown(true); }}
                  placeholder={students.length > 0 ? "Buscar alumno..." : "Primero selecciona grado y sección"}
                  disabled={students.length === 0}
                  className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="ficha-student-search"
                />
                {searchText && (
                  <button onClick={handleClearStudent} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showDropdown && students.length > 0 && (
                <div className="absolute z-[200] left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto"
                     style={{ boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}>
                  {filteredStudents.length > 0 ? filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleStudentSelect(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/60 transition-colors text-left border-b border-slate-50 last:border-0"
                      data-testid={`student-option-${s.id}`}
                    >
                      {s.photo_url ? (
                        <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }} />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                             style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                          <span className="text-xs font-bold text-white">{(s.name || "?").charAt(0)}{(s.last_name || "").charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{s.name} {s.last_name}</div>
                      </div>
                    </button>
                  )) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">No se encontraron alumnos</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          </div>
        )}

        {ficha && !loading && (
          <>
            {/* ══════════ Student Profile Card ══════════ */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
              {/* Gradient banner */}
              <div className="h-28 relative" style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)" }}>
                <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="absolute -top-5 -left-5 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              <div className="px-6 pb-6">
                {/* Avatar overlapping banner */}
                <div className="-mt-10 mb-3">
                  {ficha.student.photo_url ? (
                    <img src={ficha.student.photo_url} alt="" className="w-20 h-20 rounded-2xl object-cover border-4 border-white relative z-10" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }} />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center border-4 border-white relative z-10"
                         style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                      <Users className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
                {/* Name + grade below avatar, fully on white bg */}
                <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1" data-testid="ficha-student-name">{ficha.student.full_name}</h2>
                <div className="flex items-center gap-2 mb-5">
                  <GraduationCap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-500">{ficha.student.grade} - {ficha.student.section}</span>
                </div>

                {/* Reincidencia alert */}
                {ficha.summary.reincidencia_30d && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 border border-red-200"
                       style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(220,38,38,0.02) 100%)" }}
                       data-testid="reincidencia-alert">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 2px 8px rgba(239,68,68,0.25)" }}>
                      <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-semibold text-red-700">Alerta de reincidencia (3+ incidencias en 30 días)</span>
                  </div>
                )}

                {/* Summary KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SUMMARY_CARDS.map(({ key, label, icon: Icon, from, to, rgb }) => (
                    <div
                      key={key}
                      className="relative overflow-hidden rounded-xl p-4 text-center"
                      style={{
                        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                        boxShadow: `0 4px 14px rgba(${rgb}, 0.22)`,
                      }}
                    >
                      {/* Semi-circle deco */}
                      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.12)" }} />
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center border border-white/20"
                             style={{ background: "rgba(255,255,255,0.20)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
                          <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                        </div>
                        <p className="text-3xl font-bold text-white tabular-nums">{ficha.summary[key] ?? 0}</p>
                        <p className="text-xs font-medium text-white/80 mt-0.5">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══════════ Timeline ══════════ */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3"
                   style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 4px 12px rgba(59,130,246,0.25)" }}>
                  <Clock className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Cronología</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{ficha.total} evento{ficha.total !== 1 ? "s" : ""} registrado{ficha.total !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="p-4">
                {ficha.timeline.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <ClipboardList className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">Sin eventos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {ficha.timeline.map((event, idx) => {
                      const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.incidencia;
                      const Icon = config.icon;
                      return (
                        <div
                          key={`${event.event_type}-${event.id}-${idx}`}
                          className="group flex items-center gap-3.5 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer bg-white"
                          onClick={() => {
                            if (event.event_type === "incidencia") navigate(`${base}/coordinacion/incidencias/${event.id}`);
                            else if (event.event_type === "derivacion") navigate(`${base}/coordinacion/derivaciones/${event.id}`);
                            else if (event.event_type === "reunion") navigate(`${base}/coordinacion/reuniones/${event.id}`);
                          }}
                          data-testid={`timeline-event-${event.event_type}-${event.id}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${config.color}`}>
                                {config.label}
                              </span>
                              {event.severity && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {event.severity}
                                </span>
                              )}
                              {event.status && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {event.status.replace("_", " ")}
                                </span>
                              )}
                              {event.confidential && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                                  <Shield className="w-3 h-3" /> Confidencial
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] font-medium text-slate-800 truncate">{event.title}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {event.occurred_at ? new Date(event.occurred_at).toLocaleString("es-PE") : ""}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {ficha.total > 20 && (
                  <div className="flex justify-center items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handlePageChange(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium"
                    >
                      Anterior
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-500 font-medium tabular-nums">
                      Página {page} de {Math.ceil(ficha.total / 20)}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= Math.ceil(ficha.total / 20)}
                      className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors font-medium"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!ficha && !loading && !selectedStudent && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.05) 100%)" }}>
              <Search className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-lg font-semibold text-slate-400">Selecciona un alumno para ver su ficha</p>
            <p className="text-sm text-slate-300 mt-1">Elige grado, sección y busca por nombre</p>
          </div>
        )}

        {!ficha && !loading && selectedStudent && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">No se pudo cargar la ficha del estudiante</p>
          </div>
        )}
      </div>
    </CoordinacionLayout>
  );
}
