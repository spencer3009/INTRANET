import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen, Users, GraduationCap, Clock, User, ChevronRight,
  Loader2, Sparkles, ClipboardList
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentCoursesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadCoursesForChild = async (childId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/courses?student_id=${childId}`, { headers });
      setCourses(res.data.courses || []);
    } catch (err) {
      console.error("Error loading courses:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
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
          await loadCoursesForChild(child.id);
        } else { setLoading(false); }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadCoursesForChild(newChild.id);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-courses-page">
      <ParentSidebar active="cursos" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                Cursos de {selectedChild?.name || ""}
              </h1>
              <p className="text-sm text-slate-500">{courses.length} cursos matriculados</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-cyan-50 rounded-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin cursos asignados</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Aun no hay cursos asignados para este estudiante.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => navigate(`/school/${subdomain}/parent/courses/${course.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-cyan-300 hover:shadow-lg transition-all cursor-pointer group"
                  data-testid={`parent-course-${course.id}`}
                >
                  {/* Course Image/Color Header */}
                  {course.image_url ? (
                    <div className="h-36 overflow-hidden relative">
                      <img
                        src={course.image_url}
                        alt={course.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="h-36 flex items-center justify-center relative"
                      style={{ backgroundColor: course.color || "#06b6d4" }}
                    >
                      <BookOpen className="w-16 h-16 text-white/80" />
                    </div>
                  )}

                  {/* Course Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-lg mb-2 line-clamp-2">
                      {course.name}
                    </h3>

                    {/* Teacher */}
                    <div className="flex items-center gap-2 mb-3">
                      {course.teacher?.photo_url ? (
                        <img
                          src={course.teacher.photo_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <span className="text-sm text-slate-600 truncate">
                        {course.teacher?.name || "Sin profesor"}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-slate-500 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-amber-500" />
                        <span>{course.pending_tasks || 0} tareas pend.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
    </div>
  );
}
