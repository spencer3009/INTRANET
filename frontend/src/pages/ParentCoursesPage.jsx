import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen,
  User,
  Loader2,
  ChevronRight,
  ClipboardList
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentCoursesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("cursos");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const init = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);
        
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          
          const coursesRes = await axios.get(`${API}/api/parent/courses?student_id=${childToSelect.id}`, { headers });
          setCourses(coursesRes.data.courses || []);
          localStorage.setItem('selected_child_id', childToSelect.id);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    const headers = { Authorization: `Bearer ${token}` };
    setSelectedChild(newChild);
    setLoading(true);
    try {
      const coursesRes = await axios.get(`${API}/api/parent/courses?student_id=${newChild.id}`, { headers });
      setCourses(coursesRes.data.courses || []);
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={handleChildChange}
      />

      {sidebarExpanded && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <BookOpen className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Cursos de {selectedChild?.name}
                </h1>
                <p className="text-emerald-100">Materias y asignaturas del estudiante</p>
              </div>
              <div className="bg-white/20 rounded-xl px-6 py-3 text-center">
                <p className="text-3xl font-bold">{courses.length}</p>
                <p className="text-xs text-emerald-100">Cursos</p>
              </div>
            </div>
          </div>

          {/* Courses Grid */}
          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin cursos asignados</h3>
              <p className="text-slate-500">{selectedChild?.name} no tiene cursos asignados actualmente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => navigateTo(`/parent/courses/${course.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                      style={{ backgroundColor: course.color || '#3B82F6' }}
                    >
                      {course.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                        {course.name}
                      </h4>
                      {course.teacher && (
                        <div className="flex items-center gap-2 mt-2">
                          {course.teacher.photo_url ? (
                            <img src={course.teacher.photo_url} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-3 h-3 text-slate-500" />
                            </div>
                          )}
                          <span className="text-sm text-slate-500">{course.teacher.name}</span>
                        </div>
                      )}
                      {course.pending_tasks > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-amber-600">
                          <ClipboardList className="w-4 h-4" />
                          <span className="text-sm font-medium">{course.pending_tasks} tarea(s) pendiente(s)</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
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
