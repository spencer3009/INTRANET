import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen,
  ClipboardList,
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  GraduationCap,
  User,
  Users,
  TrendingUp,
  CalendarCheck,
  UserCheck
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Child Profile Card Component (similar to StudentProfileCard)
function ChildProfileCard({ student, dashboardData, academic }) {
  const userPhoto = student?.photo_url;
  const userName = student?.name || "Estudiante";
  const userLastName = student?.last_name || "";
  const fullName = userLastName ? `${userName} ${userLastName}` : userName;
  
  // Get academic info
  const gradeName = academic?.grado?.nombre || dashboardData?.academic?.grado?.nombre || "";
  const sectionName = academic?.seccion?.nombre || dashboardData?.academic?.seccion?.nombre || "";
  const levelName = academic?.nivel?.nombre || dashboardData?.academic?.nivel?.nombre || "";
  const academicInfo = [gradeName, sectionName].filter(Boolean).join(" – ");
  
  // Get stats from dashboard data
  const coursesCount = dashboardData?.stats?.courses_count || 0;
  const pendingTasks = dashboardData?.stats?.pending_tasks || 0;
  const unreadMessages = dashboardData?.stats?.unread_messages || 0;
  const attendanceRate = dashboardData?.stats?.attendance_rate || 0;
  
  // Get initials for default avatar
  const getInitials = (name) => {
    if (!name) return "E";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center" data-testid="child-profile-card">
      {/* Avatar */}
      <div className="relative w-20 h-20 mx-auto mb-3">
        {userPhoto ? (
          <img
            src={userPhoto}
            alt={fullName}
            className="w-full h-full object-cover rounded-full border-3 border-white shadow-md"
            onError={(e) => { 
              e.target.style.display = 'none';
              e.target.nextSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl border-3 border-white shadow-md ${userPhoto ? 'hidden' : ''}`}>
          {getInitials(fullName)}
        </div>
      </div>

      {/* Role Badge */}
      <div className="mb-2 flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border bg-emerald-100 text-emerald-700 border-emerald-200">
          <GraduationCap className="w-3 h-3" />
          ESTUDIANTE
        </span>
      </div>
      
      {/* Name */}
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {fullName}
      </h4>
      
      {/* Academic Info */}
      {academicInfo && (
        <p className="text-sm text-slate-600 mt-1 font-medium">{academicInfo}</p>
      )}
      {levelName && (
        <p className="text-xs text-slate-400 mt-0.5">{levelName}</p>
      )}

      {/* Stats Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{coursesCount}</p>
          <p className="text-[11px] text-slate-500">Cursos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{pendingTasks}</p>
          <p className="text-[11px] text-slate-500">Tareas Pend.</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarCheck className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{attendanceRate}%</p>
          <p className="text-[11px] text-slate-500">Asistencia</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Bell className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{unreadMessages}</p>
          <p className="text-[11px] text-slate-500">Mensajes</p>
        </div>
      </div>
    </div>
  );
}

// Task Card (same as student)
function TaskCard({ task, onViewTask }) {
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date();
  const isUrgent = dueDate && (dueDate - new Date()) / (1000 * 60 * 60 * 24) <= 2;
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onViewTask(task)}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: task.subject_color || '#3B82F6' }}
            />
            <span className="text-xs text-slate-500 truncate">{task.subject_name}</span>
          </div>
          <h4 className="font-medium text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
            {task.title}
          </h4>
          {dueDate && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`}>
              <Clock className="w-3 h-3" />
              {isOverdue ? 'Vencida: ' : 'Entrega: '}
              {dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {task.status === 'graded' ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              Calificada: {task.submission?.grade}
            </span>
          ) : task.status === 'submitted' ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              Entregada
            </span>
          ) : isOverdue ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Vencida
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Pendiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Attendance Summary Card
function AttendanceSummaryCard({ stats }) {
  const total = stats?.total || 0;
  const present = stats?.present || 0;
  const absent = stats?.absent || 0;
  const late = stats?.late || 0;
  const justified = stats?.justified || 0;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4" data-testid="attendance-summary-card">
      <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-emerald-500" />
        Resumen de Asistencia
      </h4>
      
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-lg font-bold text-emerald-600">{present}</p>
          <p className="text-[10px] text-slate-500">Presente</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-lg font-bold text-red-600">{absent}</p>
          <p className="text-[10px] text-slate-500">Ausente</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-lg font-bold text-amber-600">{late}</p>
          <p className="text-[10px] text-slate-500">Tardanza</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-lg font-bold text-blue-600">{justified}</p>
          <p className="text-[10px] text-slate-500">Justificado</p>
        </div>
      </div>
      
      {total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Total de días:</span>
            <span className="font-medium text-slate-700">{total}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentDashboardPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("inicio");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Parent-specific state
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [settings, setSettings] = useState(null);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        setParentProfile(profileRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        
        if (settingsRes.data) {
          setSettings(settingsRes.data);
        }
        
        // Auto-select first child or restore from localStorage
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          
          // Load child data immediately
          const [dashboardRes, coursesRes, tasksRes] = await Promise.all([
            axios.get(`${API}/api/parent/dashboard?student_id=${childToSelect.id}`, { headers }),
            axios.get(`${API}/api/parent/courses?student_id=${childToSelect.id}`, { headers }),
            axios.get(`${API}/api/parent/tasks?student_id=${childToSelect.id}`, { headers })
          ]);
          
          setDashboardData(dashboardRes.data);
          setCourses(coursesRes.data.courses || []);
          setTasks(tasksRes.data.tasks || []);
          localStorage.setItem('selected_child_id', childToSelect.id);
        }
      } catch (err) {
        console.error("Error loading parent data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [token]);

  // Handle child selection change (after initial load)
  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    
    const headers = { Authorization: `Bearer ${token}` };
    setSelectedChild(newChild);
    setLoading(true);
    
    try {
      const [dashboardRes, coursesRes, tasksRes] = await Promise.all([
        axios.get(`${API}/api/parent/dashboard?student_id=${newChild.id}`, { headers }),
        axios.get(`${API}/api/parent/courses?student_id=${newChild.id}`, { headers }),
        axios.get(`${API}/api/parent/tasks?student_id=${newChild.id}`, { headers })
      ]);
      
      setDashboardData(dashboardRes.data);
      setCourses(coursesRes.data.courses || []);
      setTasks(tasksRes.data.tasks || []);
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) {
      console.error("Error loading child data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get display values from settings
  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  const handleViewTask = (task) => {
    // Navigate to course detail with task highlighted
    navigateTo(`/parent/courses/${task.subject_id}?task=${task.id}`);
  };

  // No children state
  if (!loading && children.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ParentSidebar
          active={activeSection}
          onNavigate={setActiveSection}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          schoolName={schoolName}
          subdomain={subdomain}
          user={user}
          children={[]}
          selectedChild={null}
          onSelectChild={() => {}}
        />
        <div className="flex-1 flex flex-col lg:ml-16">
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
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Sin estudiantes vinculados
              </h2>
              <p className="text-slate-500">
                No tienes estudiantes vinculados a tu cuenta. Contacta al administrador del colegio para vincular a tu hijo/a.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando portal de padres...</p>
        </div>
      </div>
    );
  }

  // Pending tasks (max 5)
  const pendingTasks = tasks.filter(t => t.status === 'pending').slice(0, 5);
  
  // Upcoming exams (if available)
  const upcomingExams = dashboardData?.upcoming_exams || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-16">
        {/* Header */}
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

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  ¡Bienvenido/a, {user?.name}!
                </h1>
                <p className="text-emerald-100">
                  Estás viendo la información de <span className="font-semibold text-white">{selectedChild?.name} {selectedChild?.last_name}</span>
                </p>
              </div>
              {children.length > 1 && (
                <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
                  <UserCheck className="w-5 h-5" />
                  <span className="text-sm">{children.length} estudiantes vinculados</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Child Profile & Attendance */}
            <div className="lg:col-span-3 space-y-6">
              <ChildProfileCard 
                student={selectedChild}
                dashboardData={dashboardData}
                academic={dashboardData?.academic}
              />
              <AttendanceSummaryCard stats={dashboardData?.attendance_summary} />
            </div>

            {/* Center Column - Tasks & Recent Grades */}
            <div className="lg:col-span-6 space-y-6">
              {/* Pending Tasks */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                    Tareas Pendientes de {selectedChild?.name}
                  </h3>
                  <button
                    onClick={() => navigateTo('/parent/tasks')}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    data-testid="view-all-tasks"
                  >
                    Ver todas <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                    <p className="text-slate-500">¡Sin tareas pendientes!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onViewTask={handleViewTask} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Grades */}
              {dashboardData?.recent_grades && dashboardData.recent_grades.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Últimas Calificaciones
                    </h3>
                    <button
                      onClick={() => navigateTo('/parent/grades')}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      Ver todas <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {dashboardData.recent_grades.slice(0, 5).map((grade, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800 text-sm">{grade.subject_name}</p>
                          <p className="text-xs text-slate-500">{grade.evaluation_name}</p>
                        </div>
                        <div className={`text-lg font-bold ${parseFloat(grade.grade) >= 11 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {grade.grade}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Courses & Quick Actions */}
            <div className="lg:col-span-3 space-y-6">
              {/* Courses */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-500" />
                    Cursos
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    {courses.length}
                  </span>
                </div>
                
                {courses.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">Sin cursos asignados</p>
                ) : (
                  <div className="space-y-2">
                    {courses.slice(0, 6).map((course) => (
                      <button
                        key={course.id}
                        onClick={() => navigateTo(`/parent/courses/${course.id}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                        data-testid={`course-${course.id}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: course.color || '#3B82F6' }}
                        >
                          {course.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{course.name}</p>
                          {course.pending_tasks > 0 && (
                            <p className="text-xs text-amber-500">{course.pending_tasks} tarea(s)</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {courses.length > 6 && (
                  <button
                    onClick={() => navigateTo('/parent/courses')}
                    className="w-full mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center justify-center gap-1"
                  >
                    Ver todos <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-4">Acciones Rápidas</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigateTo('/parent/attendance')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    data-testid="quick-action-attendance"
                  >
                    <CalendarCheck className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Ver Asistencia</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/parent/grades')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                    data-testid="quick-action-grades"
                  >
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Ver Calificaciones</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/parent/schedule')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
                    data-testid="quick-action-schedule"
                  >
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Ver Horario</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/parent/messages')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                    data-testid="quick-action-messages"
                  >
                    <Bell className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Ver Mensajes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Message Center Widget */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
