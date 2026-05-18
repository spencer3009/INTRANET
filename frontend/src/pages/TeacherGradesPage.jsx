import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import {
  Loader2,
  Users,
  BookOpen,
  Save,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Info,
  RotateCcw,
  Calendar,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherGradesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  // gradesMap: { [studentId]: { grade, manual_grade, computed_grade, source } }
  const [gradesMap, setGradesMap] = useState({});
  const [editedGrades, setEditedGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [settings, setSettings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || "elroble";
      const [coursesRes, settingsRes, periodsRes, activeRes] = await Promise.all([
        axios.get(`${API}/api/teacher/courses`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null })),
        axios.get(`${API}/api/academic/periods`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/academic/periods/active`, { headers }).catch(() => ({ data: { active_period: null } })),
      ]);
      setCourses(coursesRes.data.courses || []);
      setSettings(settingsRes.data);
      const allPeriods = Array.isArray(periodsRes.data) ? periodsRes.data : [];
      setPeriods(allPeriods);
      const active = activeRes.data?.active_period;
      if (active?.id) {
        setSelectedPeriodId(active.id);
      } else if (allPeriods.length > 0) {
        setSelectedPeriodId(allPeriods[0].id);
      }
    } catch (err) {
      console.error("Error loading courses:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const loadCourseData = useCallback(async (course, periodId) => {
    if (!course || !periodId) return;
    setSelectedCourse(course);
    setLoading(true);
    try {
      const [studentsRes, gradesRes] = await Promise.all([
        axios.get(`${API}/api/teacher/students?section_id=${course.section_id}`, { headers }),
        axios.get(
          `${API}/api/teacher/grades?subject_id=${course.id}&section_id=${course.section_id}&period_id=${periodId}`,
          { headers }
        ),
      ]);

      setStudents(studentsRes.data.students || []);

      const map = {};
      (gradesRes.data.grades || []).forEach((g) => {
        map[g.student_id] = {
          grade: g.grade,
          manual_grade: g.manual_grade,
          computed_grade: g.computed_grade,
          source: g.source,
        };
      });
      setGradesMap(map);
      setEditedGrades({});
    } catch (err) {
      console.error("Error loading course data:", err);
      setStudents([]);
      setGradesMap({});
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // When period changes while a course is selected, reload grades for that period
  useEffect(() => {
    if (selectedCourse && selectedPeriodId) {
      loadCourseData(selectedCourse, selectedPeriodId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId]);

  const handleGradeChange = (studentId, value) => {
    if (value === "" || (/^\d*\.?\d*$/.test(value) && parseFloat(value || 0) <= 20)) {
      setEditedGrades((prev) => ({ ...prev, [studentId]: value }));
    }
  };

  const getDisplayGrade = (studentId) => {
    if (Object.prototype.hasOwnProperty.call(editedGrades, studentId)) {
      return editedGrades[studentId];
    }
    const m = gradesMap[studentId];
    // Show ONLY the manual override in the input (so the teacher knows what they're editing)
    if (m && m.manual_grade !== null && m.manual_grade !== undefined) {
      return m.manual_grade.toString();
    }
    return "";
  };

  const hasChanges = () => {
    return Object.keys(editedGrades).some((studentId) => {
      const m = gradesMap[studentId];
      const original = m && m.manual_grade != null ? m.manual_grade.toString() : "";
      return editedGrades[studentId] !== original;
    });
  };

  const saveGrades = async () => {
    if (!hasChanges()) return;
    if (!selectedPeriodId) {
      setSaveMessage({ type: "error", text: "Selecciona un bimestre antes de guardar." });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const gradesToSave = Object.entries(editedGrades)
        .filter(([studentId, value]) => {
          const m = gradesMap[studentId];
          const original = m && m.manual_grade != null ? m.manual_grade.toString() : "";
          return value !== original;
        })
        .map(([studentId, value]) => ({
          student_id: studentId,
          grade: value === "" ? null : parseFloat(value),
        }));

      await axios.post(
        `${API}/api/teacher/grades`,
        {
          subject_id: selectedCourse.id,
          section_id: selectedCourse.section_id,
          period_id: selectedPeriodId,
          grades: gradesToSave,
        },
        { headers }
      );

      // Refresh from server to get fresh computed_grade / source info
      await loadCourseData(selectedCourse, selectedPeriodId);

      setSaveMessage({ type: "success", text: "Notas guardadas correctamente. El consolidado mostrará tu promedio manual." });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      console.error("Error saving grades:", err);
      const detail = err?.response?.data?.detail || "Error al guardar las notas";
      setSaveMessage({ type: "error", text: detail });
    } finally {
      setSaving(false);
    }
  };

  const clearGrade = (studentId) => {
    setEditedGrades((prev) => ({ ...prev, [studentId]: "" }));
  };

  if (loading && !selectedCourse) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-grades-page">
      <TeacherSidebar
        active="notas"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />

        {/* Sticky bar: title + bimestre + save */}
        <div className="sticky top-[72px] z-10 bg-white border-b border-slate-200 px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                {selectedCourse
                  ? `${selectedCourse.name} · ${selectedCourse.section_name}`
                  : "Selecciona un curso para gestionar el promedio bimestral"}
              </p>

              {/* Bimestre selector — required */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  data-testid="teacher-grades-period-select"
                >
                  <option value="">— Bimestre —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.name || "Bimestre"}
                      {p.year ? ` · ${p.year}` : ""}
                      {p.activo ? " (activo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCourse && hasChanges() && (
              <button
                onClick={saveGrades}
                disabled={saving || !selectedPeriodId}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                data-testid="save-grades-btn"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span className="hidden sm:inline">Guardar Cambios</span>
              </button>
            )}
          </div>

          {saveMessage && (
            <div
              className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
                saveMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
              data-testid="teacher-grades-save-message"
            >
              {saveMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {saveMessage.text}
            </div>
          )}
        </div>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {!selectedCourse ? (
            <div className="space-y-4">
              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3" data-testid="teacher-grades-info">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Promedio bimestral del profesor</p>
                  <p>
                    Las notas que pongas aquí <strong>sobrescriben</strong> el promedio calculado por el Registro Auxiliar
                    y aparecen directamente en el Consolidado del bimestre seleccionado. Si dejas la nota vacía, se
                    vuelve a usar el promedio auto-calculado del Registro Auxiliar.
                  </p>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-slate-800 mb-4">Selecciona un curso</h2>

              {courses.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course) => (
                    <button
                      key={`${course.id}-${course.section_id}`}
                      onClick={() => {
                        if (!selectedPeriodId) {
                          setSaveMessage({ type: "error", text: "Primero selecciona un bimestre." });
                          setTimeout(() => setSaveMessage(null), 3000);
                          return;
                        }
                        loadCourseData(course, selectedPeriodId);
                      }}
                      className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
                      data-testid={`grade-course-${course.id}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: course.color || "#10b981" }}
                        >
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                            {course.name}
                          </h3>
                          <p className="text-sm text-slate-500">{course.section_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Users className="w-4 h-4" />
                        <span>{course.students_count || 0} estudiantes</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin cursos asignados</h3>
                  <p className="text-slate-500">Contacta a coordinación para asignaciones.</p>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedCourse(null);
                  setStudents([]);
                  setGradesMap({});
                  setEditedGrades({});
                }}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
                data-testid="teacher-grades-back-btn"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
                <span>Volver a cursos</span>
              </button>

              {students.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-5 py-3 font-semibold text-slate-700">Estudiante</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-32">
                            Promedio (0-20)
                          </th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-32">
                            Registro Auxiliar
                          </th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-28">Fuente</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((student) => {
                          const displayGrade = getDisplayGrade(student.id);
                          const isModified = Object.prototype.hasOwnProperty.call(editedGrades, student.id);
                          const m = gradesMap[student.id] || {};
                          const computed = m.computed_grade;
                          const manual = m.manual_grade;
                          // Effective source after edits not yet saved: if user typed a value -> manual, else use server source
                          let effectiveSource = m.source || null;
                          if (isModified) {
                            effectiveSource = displayGrade === "" ? (computed != null ? "computed" : null) : "manual";
                          }

                          return (
                            <tr
                              key={student.id}
                              className={`hover:bg-slate-50 ${isModified ? "bg-amber-50/50" : ""}`}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  {student.photo_url ? (
                                    <img
                                      src={student.photo_url}
                                      alt=""
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                      <Users className="w-4 h-4 text-slate-500" />
                                    </div>
                                  )}
                                  <span className="font-medium text-slate-800">
                                    {student.name} {student.last_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <input
                                  type="text"
                                  value={displayGrade}
                                  onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                  placeholder={manual != null ? "" : "—"}
                                  className={`w-full text-center px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                                    isModified ? "border-amber-400 bg-amber-50" : "border-slate-200"
                                  }`}
                                  data-testid={`grade-input-${student.id}`}
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                {computed != null ? (
                                  <span className="text-slate-600 font-medium">{computed}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-center">
                                {effectiveSource === "manual" ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                    Manual
                                  </span>
                                ) : effectiveSource === "computed" ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                    Auxiliar
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">Sin nota</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-center">
                                {(manual != null || (isModified && displayGrade !== "")) && (
                                  <button
                                    onClick={() => clearGrade(student.id)}
                                    title="Quitar nota manual (volver al promedio del Registro Auxiliar)"
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    data-testid={`grade-clear-${student.id}`}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin estudiantes</h3>
                  <p className="text-slate-500">No hay estudiantes en esta sección.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="teacher" />
    </div>
  );
}
