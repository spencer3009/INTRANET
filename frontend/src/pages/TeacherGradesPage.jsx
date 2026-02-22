import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import TeacherFooter from "../components/TeacherFooter";
import {
  BarChart3,
  Search,
  Filter,
  Loader2,
  Users,
  BookOpen,
  Save,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle
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
  const [grades, setGrades] = useState({});
  const [editedGrades, setEditedGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [coursesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/courses`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      setCourses(coursesRes.data.courses || []);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading courses:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const loadCourseData = async (course) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      // Load students and grades for this course/section
      const [studentsRes, gradesRes] = await Promise.all([
        axios.get(`${API}/api/teacher/students?section_id=${course.section_id}`, { headers }),
        axios.get(`${API}/api/teacher/grades?subject_id=${course.id}&section_id=${course.section_id}`, { headers })
      ]);
      
      setStudents(studentsRes.data.students || []);
      
      // Build grades map
      const gradesMap = {};
      (gradesRes.data.grades || []).forEach(g => {
        gradesMap[g.student_id] = g.grade;
      });
      setGrades(gradesMap);
      setEditedGrades({});
    } catch (err) {
      console.error("Error loading course data:", err);
      setStudents([]);
      setGrades({});
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (studentId, value) => {
    // Allow empty, numbers 0-20, and decimals
    if (value === "" || (/^\d*\.?\d*$/.test(value) && (value === "" || parseFloat(value) <= 20))) {
      setEditedGrades(prev => ({
        ...prev,
        [studentId]: value
      }));
    }
  };

  const getDisplayGrade = (studentId) => {
    if (editedGrades.hasOwnProperty(studentId)) {
      return editedGrades[studentId];
    }
    return grades[studentId] !== undefined ? grades[studentId].toString() : "";
  };

  const hasChanges = () => {
    return Object.keys(editedGrades).some(studentId => {
      const originalGrade = grades[studentId] !== undefined ? grades[studentId].toString() : "";
      return editedGrades[studentId] !== originalGrade;
    });
  };

  const saveGrades = async () => {
    if (!hasChanges()) return;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      // Prepare grades to save
      const gradesToSave = Object.entries(editedGrades)
        .filter(([studentId, value]) => {
          const originalGrade = grades[studentId] !== undefined ? grades[studentId].toString() : "";
          return value !== originalGrade;
        })
        .map(([studentId, value]) => ({
          student_id: studentId,
          grade: value === "" ? null : parseFloat(value)
        }));
      
      await axios.post(`${API}/api/teacher/grades`, {
        subject_id: selectedCourse.id,
        section_id: selectedCourse.section_id,
        grades: gradesToSave
      }, { headers });
      
      // Update local state
      const newGrades = { ...grades };
      gradesToSave.forEach(g => {
        if (g.grade === null) {
          delete newGrades[g.student_id];
        } else {
          newGrades[g.student_id] = g.grade;
        }
      });
      setGrades(newGrades);
      setEditedGrades({});
      
      setSaveMessage({ type: "success", text: "Notas guardadas correctamente" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving grades:", err);
      setSaveMessage({ type: "error", text: "Error al guardar las notas" });
    } finally {
      setSaving(false);
    }
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
      {/* Teacher Sidebar */}
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

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Notas</h1>
                <p className="text-sm text-slate-500">
                  {selectedCourse 
                    ? `${selectedCourse.name} - ${selectedCourse.section_name}`
                    : "Selecciona un curso para gestionar notas"
                  }
                </p>
              </div>
            </div>
            
            {selectedCourse && hasChanges() && (
              <button
                onClick={saveGrades}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                data-testid="save-grades-btn"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Guardar Cambios</span>
              </button>
            )}
          </div>
          
          {/* Save message */}
          {saveMessage && (
            <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
              saveMessage.type === "success" 
                ? "bg-emerald-50 text-emerald-700" 
                : "bg-red-50 text-red-700"
            }`}>
              {saveMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {saveMessage.text}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {!selectedCourse ? (
            /* Course Selection */
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Selecciona un curso</h2>
              
              {courses.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course) => (
                    <button
                      key={`${course.id}-${course.section_id}`}
                      onClick={() => loadCourseData(course)}
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
            /* Grades Table */
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => {
                  setSelectedCourse(null);
                  setStudents([]);
                  setGrades({});
                  setEditedGrades({});
                }}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
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
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-32">Nota (0-20)</th>
                          <th className="text-center px-5 py-3 font-semibold text-slate-700 w-24">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((student) => {
                          const displayGrade = getDisplayGrade(student.id);
                          const numGrade = parseFloat(displayGrade);
                          const hasValue = displayGrade !== "";
                          const isModified = editedGrades.hasOwnProperty(student.id);
                          
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
                                  placeholder="-"
                                  className={`w-full text-center px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                                    isModified 
                                      ? "border-amber-400 bg-amber-50" 
                                      : "border-slate-200"
                                  }`}
                                  data-testid={`grade-input-${student.id}`}
                                />
                              </td>
                              <td className="px-5 py-3 text-center">
                                {hasValue ? (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    numGrade >= 11 
                                      ? "bg-emerald-100 text-emerald-700" 
                                      : "bg-red-100 text-red-700"
                                  }`}>
                                    {numGrade >= 11 ? "Aprobado" : "Desaprobado"}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-sm">Sin nota</span>
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

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
