import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BarChart3, Loader2, BookOpen, Award, Target
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentGradesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadGradesForChild = async (childId) => {
    setLoading(true);
    try {
      const coursesRes = await axios.get(`${API}/api/parent/courses?student_id=${childId}`, { headers });
      const studentCourses = coursesRes.data.courses || [];
      setCourses(studentCourses);

      const allGrades = [];
      for (const course of studentCourses) {
        try {
          const tasksRes = await axios.get(`${API}/api/course/${course.id}/posts?post_type=task`, { headers });
          const courseTasks = tasksRes.data?.posts || tasksRes.data || [];
          for (const task of courseTasks) {
            const submission = task.submissions?.find(s => s.student_id === childId);
            if (submission && submission.grade !== null && submission.grade !== undefined) {
              allGrades.push({
                id: task.id, task_title: task.title, course_id: course.id,
                course_name: course.name, course_color: course.color,
                grade: submission.grade, max_grade: task.max_grade || 20,
                graded_at: submission.graded_at, feedback: submission.feedback
              });
            }
          }
        } catch (err) { console.error(`Error loading grades for course ${course.id}:`, err); }
      }
      setGrades(allGrades);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem('selected_child_id');
          const child = childrenList.find(c => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem('selected_child_id', child.id);
          await loadGradesForChild(child.id);
        }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadGradesForChild(newChild.id);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const courseAverages = courses.map(course => {
    const courseGrades = grades.filter(g => g.course_id === course.id);
    if (courseGrades.length === 0) return { ...course, average: null, grades_count: 0 };
    const totalPercent = courseGrades.reduce((sum, g) => sum + (g.grade / g.max_grade), 0);
    return { ...course, average: Math.round((totalPercent / courseGrades.length) * 20 * 10) / 10, grades_count: courseGrades.length };
  });

  const overallAverage = grades.length > 0
    ? Math.round((grades.reduce((sum, g) => sum + (g.grade / g.max_grade), 0) / grades.length) * 20 * 10) / 10
    : null;

  const getGradeColor = (grade, max = 20) => {
    const percent = (grade / max) * 100;
    if (percent >= 80) return "text-emerald-600 bg-emerald-100";
    if (percent >= 60) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-grades-page">
      <ParentSidebar active="calificaciones" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-800">Notas de {selectedChild?.name || ""}</h2>
            <span className="text-sm text-slate-500">({grades.length} calificaciones)</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 mb-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm mb-1">Promedio General</p>
                    <p className="text-4xl font-bold">{overallAverage !== null ? overallAverage.toFixed(1) : "--"}</p>
                    <p className="text-white/60 text-sm mt-1">de {grades.length} calificaciones</p>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center"><Award className="w-8 h-8 text-white" /></div>
                </div>
              </div>

              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" />Promedio por Curso</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {courseAverages.map((course) => (
                  <div key={course.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: course.color || "#6366f1" }}><BookOpen className="w-5 h-5 text-white" /></div>
                      <div className="flex-1 min-w-0"><p className="font-medium text-slate-800 truncate">{course.name}</p><p className="text-xs text-slate-500">{course.grades_count} notas</p></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Promedio</span>
                      {course.average !== null ? <span className={`text-lg font-bold px-3 py-1 rounded-lg ${getGradeColor(course.average)}`}>{course.average.toFixed(1)}</span> : <span className="text-sm text-slate-400">Sin notas</span>}
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" />Historial de Calificaciones</h2>
              {grades.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><BarChart3 className="w-8 h-8 text-indigo-400" /></div>
                  <h3 className="font-semibold text-slate-700 mb-2">Sin calificaciones aun</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">Cuando se califiquen las tareas, veras las notas aqui</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Evaluacion</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Curso</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Nota</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 hidden sm:table-cell">Fecha</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {grades.map((grade) => (
                          <tr key={grade.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3"><p className="font-medium text-slate-800">{grade.task_title}</p>{grade.feedback && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{grade.feedback}</p>}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: grade.course_color || "#6366f1" }} /><span className="text-sm text-slate-600">{grade.course_name}</span></div></td>
                            <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-bold ${getGradeColor(grade.grade, grade.max_grade)}`}>{grade.grade}/{grade.max_grade}</span></td>
                            <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{grade.graded_at ? new Date(grade.graded_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
    </div>
  );
}
