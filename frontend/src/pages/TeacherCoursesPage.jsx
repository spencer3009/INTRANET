import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import {
  BookOpen,
  Loader2,
  Search,
  Users,
  ClipboardList,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherCoursesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  const filteredCourses = courses.filter(course =>
    course.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.section_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <TeacherSidebar
        active="cursos"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

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

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar curso o sección..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {searchQuery ? "Sin resultados" : "Sin cursos asignados"}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                {searchQuery 
                  ? "No encontramos cursos que coincidan con tu búsqueda"
                  : "Contacta al coordinador para que te asigne cursos"
                }
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => (
                <div
                  key={`${course.id}-${course.section_id}`}
                  onClick={() => navigateTo(`/curso/${course.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer group"
                >
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
                      className="h-36 flex items-center justify-center"
                      style={{ backgroundColor: course.color || "#10b981" }}
                    >
                      <BookOpen className="w-16 h-16 text-white/80" />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-lg mb-1 line-clamp-2">
                      {course.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-3">
                      {course.grade_name && `${course.grade_name} - `}{course.section_name || "Sin sección"}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span>{course.students_count || 0} alumnos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-amber-500" />
                        <span>{course.tasks_count || 0} tareas</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between text-emerald-600 text-sm font-medium group-hover:text-emerald-700">
                      <span>Gestionar curso</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
