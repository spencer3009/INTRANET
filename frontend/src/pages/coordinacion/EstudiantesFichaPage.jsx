import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { Users, Search, AlertTriangle, ArrowRightLeft, MessageSquare, ClipboardList, ChevronRight, Clock, Shield, CalendarCheck } from "lucide-react";

const EVENT_CONFIG = {
  incidencia: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Incidencia" },
  seguimiento: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: ClipboardList, label: "Seguimiento" },
  derivacion: { color: "bg-teal-100 text-teal-700 border-teal-200", icon: ArrowRightLeft, label: "Derivacion" },
  reunion: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: MessageSquare, label: "Reunion" },
};

export default function EstudiantesFichaPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [ficha, setFicha] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const base = subdomain ? `/${subdomain}` : "";
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetch(`${API_URL}/api/coordinacion/grades`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setGrades(d.grades || d || [])).catch(() => {});
  }, []);

  const loadSections = async (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSection(""); setSelectedStudent(""); setFicha(null);
    setSections([]); setStudents([]);
    if (!gradeId) return;
    const res = await fetch(`${API_URL}/api/coordinacion/sections?grade_id=${gradeId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setSections(data.sections || data || []);
  };

  const loadStudents = async (sectionId) => {
    setSelectedSection(sectionId);
    setSelectedStudent(""); setFicha(null); setStudents([]);
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

  const handleStudentSelect = (id) => {
    setSelectedStudent(id);
    setPage(1);
    loadFicha(id, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadFicha(selectedStudent, newPage);
  };

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="estudiantes">
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="estudiantes-ficha-page">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-teal-600" /> Ficha del Estudiante
      </h1>

      {/* Student selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={selectedGrade} onChange={(e) => loadSections(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ficha-grade">
            <option value="">Seleccionar grado</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <select value={selectedSection} onChange={(e) => loadStudents(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ficha-section">
            <option value="">Seleccionar seccion</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select value={selectedStudent} onChange={(e) => handleStudentSelect(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="ficha-student">
            <option value="">Seleccionar estudiante</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-slate-400">Cargando ficha...</div>}

      {ficha && !loading && (
        <>
          {/* Student header + summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
            <div className="flex items-center gap-4 mb-4">
              {ficha.student.photo_url ? (
                <img src={ficha.student.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-teal-600" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-800" data-testid="ficha-student-name">{ficha.student.full_name}</h2>
                <p className="text-sm text-slate-500">{ficha.student.grade} - {ficha.student.section}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{ficha.summary.total_incidencias}</p>
                <p className="text-xs text-slate-500">Incidencias</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{ficha.summary.incidencias_abiertas}</p>
                <p className="text-xs text-slate-500">Abiertas</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-teal-600">{ficha.summary.total_derivaciones}</p>
                <p className="text-xs text-slate-500">Derivaciones</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">{ficha.summary.total_reuniones}</p>
                <p className="text-xs text-slate-500">Reuniones</p>
              </div>
            </div>
            {ficha.summary.reincidencia_30d && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm font-medium" data-testid="reincidencia-alert">
                <AlertTriangle className="w-4 h-4" /> Alerta de reincidencia (3+ incidencias en 30 dias)
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4">Cronologia ({ficha.total} eventos)</h3>
            {ficha.timeline.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin eventos registrados</p>
            ) : (
              <div className="space-y-3">
                {ficha.timeline.map((event, idx) => {
                  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.incidencia;
                  const Icon = config.icon;
                  return (
                    <div key={`${event.event_type}-${event.id}-${idx}`}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => {
                        if (event.event_type === "incidencia") navigate(`${base}/coordinacion/incidencias/${event.id}`);
                        else if (event.event_type === "derivacion") navigate(`${base}/coordinacion/derivaciones/${event.id}`);
                        else if (event.event_type === "reunion") navigate(`${base}/coordinacion/reuniones/${event.id}`);
                      }}
                      data-testid={`timeline-event-${event.event_type}-${event.id}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.color}`}>
                            {config.label}
                          </span>
                          {event.severity && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                              {event.severity}
                            </span>
                          )}
                          {event.status && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                              {event.status.replace("_", " ")}
                            </span>
                          )}
                          {event.confidential && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex items-center gap-0.5">
                              <Shield className="w-3 h-3" /> Confidencial
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 truncate">{event.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {event.occurred_at ? new Date(event.occurred_at).toLocaleString("es-PE") : ""}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {ficha.total > 20 && (
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page <= 1}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-50">Anterior</button>
                <span className="px-4 py-2 text-sm text-slate-600">Pagina {page} de {Math.ceil(ficha.total / 20)}</span>
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(ficha.total / 20)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-50">Siguiente</button>
              </div>
            )}
          </div>
        </>
      )}

      {!ficha && !loading && selectedStudent && (
        <div className="text-center py-12 text-slate-400">No se pudo cargar la ficha</div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
