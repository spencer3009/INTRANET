import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen, User, Loader2, FileText, ClipboardList, ChevronRight, Search, GraduationCap
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentCoursesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

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
          const res = await axios.get(`${API}/api/parent/courses?student_id=${child.id}`, { headers });
          setCourses(res.data.courses || []);
          localStorage.setItem('selected_child_id', child.id);
        }
      } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/courses?student_id=${newChild.id}`, { headers });
      setCourses(res.data.courses || []);
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;
  const navigateTo = (path) => navigate(subdomain ? `/school/${subdomain}${path}` : path);

  const filteredCourses = courses.filter(course =>
    course.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.teacher?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-courses-page">
      <ParentSidebar active="cursos" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-500" />
              Cursos de {selectedChild?.name || ""}
              <span className="text-sm font-normal text-slate-500">({courses.length} {courses.length === 1 ? "curso" : "cursos"})</span>
            </h2>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar curso..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition-colors" data-testid="search-courses" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><GraduationCap className="w-10 h-10 text-emerald-400" /></div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">{searchQuery ? "Sin resultados" : "Sin cursos asignados"}</h3>
              <p className="text-slate-500 max-w-sm mx-auto">{searchQuery ? "No encontramos cursos que coincidan con tu busqueda" : "Cuando se asignen cursos, los veras aqui"}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredCourses.map((course) => (
                <div key={course.id} onClick={() => navigateTo(`/parent/courses/${course.id}`)} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer group" data-testid={`course-card-${course.id}`}>
                  {course.image_url ? (
                    <div className="h-36 overflow-hidden relative">
                      <img src={course.image_url} alt={course.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="h-36 flex items-center justify-center relative" style={{ backgroundColor: course.color || "#10b981" }}>
                      <BookOpen className="w-16 h-16 text-white/80" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-lg mb-2 line-clamp-2">{course.name}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      {course.teacher?.photo_url ? (
                        <img src={course.teacher.photo_url} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center"><User className="w-4 h-4 text-slate-500" /></div>
                      )}
                      <span className="text-sm text-slate-600 truncate">{course.teacher?.name || "Sin profesor"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-500" /><span>{course.materials_count || 0} materiales</span></div>
                      <div className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-amber-500" /><span>{course.tasks_count || 0} tareas</span></div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between text-emerald-600 text-sm font-medium group-hover:text-emerald-700">
                      <span>Ver curso</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
