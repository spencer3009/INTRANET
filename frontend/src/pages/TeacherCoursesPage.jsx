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
  ChevronRight,
  GraduationCap,
  BarChart3,
  TrendingUp,
  Calendar,
  Star,
  Layers,
  FileText
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

  const schoolName = settings?.system_name || user?.school_name || "Portal Docente";

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

  // Calculate stats
  const totalStudents = courses.reduce((sum, c) => sum + (c.students_count || 0), 0);
  const totalTasks = courses.reduce((sum, c) => sum + (c.tasks_count || 0), 0);
  const totalMaterials = courses.reduce((sum, c) => sum + (c.materials_count || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex" data-testid="teacher-courses-page">
      <TeacherSidebar
        active="cursos"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
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

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {/* Hero Section */}
          <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-8 text-white shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold">Mis Cursos</h1>
                    <p className="text-white/80 text-sm">Gestiona tus asignaturas</p>
                  </div>
                </div>
                <p className="text-white/90 max-w-xl">
                  Accede a tus cursos, revisa el progreso de tus estudiantes y administra el contenido académico.
                </p>
              </div>
              
              {/* Quick Stats in Hero */}
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center border border-white/20 min-w-[100px]">
                  <p className="text-3xl font-bold">{courses.length}</p>
                  <p className="text-white/80 text-xs mt-1">Cursos</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center border border-white/20 min-w-[100px]">
                  <p className="text-3xl font-bold">{totalStudents}</p>
                  <p className="text-white/80 text-xs mt-1">Estudiantes</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center border border-white/20 min-w-[100px]">
                  <p className="text-3xl font-bold">{totalTasks}</p>
                  <p className="text-white/80 text-xs mt-1">Tareas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{courses.length}</p>
                  <p className="text-sm text-slate-500">Cursos Activos</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalStudents}</p>
                  <p className="text-sm text-slate-500">Total Estudiantes</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalTasks}</p>
                  <p className="text-sm text-slate-500">Tareas Creadas</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalMaterials}</p>
                  <p className="text-sm text-slate-500">Materiales</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar curso o sección..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm"
                data-testid="course-search-input"
              />
            </div>
          </div>

          {/* Courses Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
              </div>
              <p className="text-slate-500">Cargando cursos...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-violet-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/10">
                <BookOpen className="w-12 h-12 text-violet-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {searchQuery ? "Sin resultados" : "Sin cursos asignados"}
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                {searchQuery 
                  ? "No encontramos cursos que coincidan con tu búsqueda"
                  : "Contacta al coordinador para que te asigne cursos"
                }
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCourses.map((course, index) => (
                <div
                  key={`${course.id}-${course.section_id}`}
                  onClick={() => navigateTo(`/curso/${course.id}`)}
                  className="group bg-white rounded-3xl border border-slate-200/80 overflow-hidden hover:shadow-2xl hover:border-violet-300 transition-all duration-500 cursor-pointer hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`course-card-${course.id}`}
                >
                  {/* Course Image/Banner */}
                  <div className="relative h-44 overflow-hidden">
                    {course.image_url ? (
                      <>
                        <img 
                          src={course.image_url} 
                          alt={course.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </>
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, ${course.color || '#8B5CF6'}, ${course.color ? adjustColor(course.color, -30) : '#6D28D9'})` }}
                      >
                        <div className="absolute inset-0 opacity-20">
                          <div className="absolute top-4 right-4 w-24 h-24 bg-white rounded-full blur-2xl" />
                          <div className="absolute bottom-4 left-4 w-16 h-16 bg-white rounded-full blur-xl" />
                        </div>
                        <BookOpen className="w-20 h-20 text-white/90 relative z-10" />
                      </div>
                    )}
                    
                    {/* Level Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-xs font-semibold text-slate-700 shadow-lg">
                        {course.level_name || "Curso"}
                      </span>
                    </div>
                    
                    {/* Course Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h3 className="font-bold text-white text-xl mb-1 line-clamp-2 drop-shadow-lg">
                        {course.name}
                      </h3>
                      <p className="text-white/90 text-sm">
                        {course.grade_name && `${course.grade_name} - `}{course.section_name || "Sin sección"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Course Stats */}
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                        <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-slate-800">{course.students_count || 0}</p>
                        <p className="text-xs text-slate-500">Alumnos</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                        <ClipboardList className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-slate-800">{course.tasks_count || 0}</p>
                        <p className="text-xs text-slate-500">Tareas</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                        <FileText className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-slate-800">{course.materials_count || 0}</p>
                        <p className="text-xs text-slate-500">Material</p>
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    <button className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40">
                      <span>Gestionar Curso</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
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

// Helper function to adjust color brightness
function adjustColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + 
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}
