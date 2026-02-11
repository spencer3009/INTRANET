import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { 
  BookOpen, ArrowLeft, Edit2, Users, Award, LayoutDashboard,
  ClipboardList, FolderOpen, FlaskConical, MessageCircle, Video,
  Trophy, Download, FileText, Calendar, Clock, Bell, ChevronRight,
  User, Mail, MoreVertical, Plus, Search, Filter, Paperclip,
  Play, ExternalLink, Loader2, BookMarked, Sparkles, Star,
  CheckCircle2, AlertCircle, X
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tab configuration
const COURSE_TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: ClipboardList },
  { id: "material", label: "Material", icon: FolderOpen },
  { id: "examenes", label: "Exámenes", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
  { id: "envivo", label: "En Vivo", icon: Video },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy },
];

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════════════════════════════════════════════════
function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HERO HEADER
// ══════════════════════════════════════════════════════════════════════════════
function CourseHeader({ subject, level, grade, section, period, onBack, onEdit }) {
  return (
    <div className="relative overflow-hidden rounded-3xl mb-6" style={{ background: `linear-gradient(135deg, ${subject.color}15, ${subject.color}30)` }}>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: subject.color }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-10 blur-2xl" style={{ background: subject.color }} />
      
      <div className="relative p-8">
        <div className="flex items-start justify-between">
          {/* Left side - Course info */}
          <div className="flex items-start gap-6">
            {/* Back button */}
            <button
              onClick={onBack}
              className="mt-1 p-3 bg-white/80 hover:bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            {/* Course icon */}
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}CC)` }}
            >
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            
            {/* Course details */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: subject.color }}
                >
                  {subject.code}
                </span>
                <span className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-600">
                  {level?.nombre}
                </span>
              </div>
              <h1 className="text-3xl font-black text-gray-800 mb-2">{subject.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4" />
                  {grade?.nombre} {section ? `- ${section}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {period || "2024-I"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {subject.weekly_hours}h semanales
                </span>
              </div>
            </div>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/80 hover:bg-white rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:shadow-md transition-all">
              <Users className="w-4 h-4" />
              Estudiantes
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/80 hover:bg-white rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:shadow-md transition-all">
              <Award className="w-4 h-4" />
              Calificaciones
            </button>
            <button 
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}CC)` }}
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM TABS
// ══════════════════════════════════════════════════════════════════════════════
function CourseTabs({ activeTab, onTabChange, color }) {
  return (
    <div className="bg-white rounded-2xl p-2 shadow-sm mb-6">
      <div className="flex items-center gap-1 overflow-x-auto">
        {COURSE_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                isActive 
                  ? "text-white shadow-lg" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              style={isActive ? { background: `linear-gradient(135deg, ${color}, ${color}CC)` } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEFT SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════
function CourseLeftSidebar({ subject, recentActivity }) {
  return (
    <div className="space-y-5">
      {/* Course card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div 
          className="w-full aspect-square rounded-xl flex items-center justify-center mb-4"
          style={{ background: `linear-gradient(135deg, ${subject.color}20, ${subject.color}40)` }}
        >
          <BookOpen className="w-16 h-16" style={{ color: subject.color }} />
        </div>
        <h3 className="font-bold text-gray-800 text-center mb-1">{subject.name}</h3>
        <p className="text-sm text-gray-500 text-center">{subject.code}</p>
      </div>
      
      {/* Recent activity */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: subject.color }} />
          Actividad reciente
        </h3>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin actividad reciente</p>
          ) : (
            recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Quick links */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">Accesos rápidos</h3>
        <div className="space-y-2">
          {[
            { label: "Nueva tarea", icon: Plus },
            { label: "Subir material", icon: FolderOpen },
            { label: "Crear examen", icon: FlaskConical },
          ].map((link, i) => {
            const Icon = link.icon;
            return (
              <button
                key={i}
                className="w-full flex items-center gap-3 p-3 text-left text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${subject.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: subject.color }} />
                </div>
                {link.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════
function CourseRightSidebar({ teacher, students, subject }) {
  return (
    <div className="space-y-5">
      {/* Teacher card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div 
          className="h-2"
          style={{ background: `linear-gradient(90deg, ${subject.color}, ${subject.color}99)` }}
        />
        <div className="p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: subject.color }} />
            Profesor del curso
          </h3>
          {teacher ? (
            <div className="flex items-center gap-4">
              {teacher.photo_url ? (
                <img src={teacher.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover shadow-md" />
              ) : (
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md"
                  style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}CC)` }}
                >
                  {teacher.name?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{teacher.name} {teacher.last_name}</p>
                <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {teacher.email}
                </p>
                <span 
                  className="inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: subject.color }}
                >
                  Profesor
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <User className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">Sin profesor asignado</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Students list */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div 
          className="h-2"
          style={{ background: `linear-gradient(90deg, ${subject.color}99, ${subject.color}66)` }}
        />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: subject.color }} />
              Estudiantes
            </h3>
            <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600">
              {students.length}
            </span>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {students.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin estudiantes</p>
              </div>
            ) : (
              students.slice(0, 10).map((student, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 text-sm font-semibold">
                      {student.name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{student.name} {student.last_name}</p>
                    <p className="text-xs text-gray-400">ID: {student.id?.slice(-6)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {students.length > 10 && (
            <button className="w-full mt-3 py-2 text-sm font-semibold text-center rounded-xl hover:bg-gray-50 transition-colors" style={{ color: subject.color }}>
              Ver todos ({students.length})
            </button>
          )}
        </div>
      </div>
      
      {/* Reminders */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: subject.color }} />
          Recordatorios
        </h3>
        <div className="space-y-2">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-sm font-medium text-amber-800">Examen parcial</p>
            <p className="text-xs text-amber-600">En 5 días</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-medium text-blue-800">Entrega de tareas</p>
            <p className="text-xs text-blue-600">Mañana</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB CONTENT COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// Dashboard/Tablero tab
function DashboardTab({ subject }) {
  const activities = [
    { type: "material", title: "Nuevo material: Guía de ejercicios", author: "Prof. García", time: "Hace 2 horas" },
    { type: "tarea", title: "Tarea: Práctica calificada 1", author: "Prof. García", time: "Ayer" },
    { type: "aviso", title: "Recordatorio: Examen parcial próxima semana", author: "Sistema", time: "Hace 2 días" },
  ];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-800">Últimas publicaciones</h2>
        <button className="text-sm font-semibold hover:underline" style={{ color: subject.color }}>
          Ver todo
        </button>
      </div>
      
      {activities.map((activity, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${subject.color}15` }}
            >
              {activity.type === "material" && <FolderOpen className="w-6 h-6" style={{ color: subject.color }} />}
              {activity.type === "tarea" && <ClipboardList className="w-6 h-6" style={{ color: subject.color }} />}
              {activity.type === "aviso" && <Bell className="w-6 h-6" style={{ color: subject.color }} />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 mb-1">{activity.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{activity.author} • {activity.time}</p>
              <div className="flex items-center gap-2">
                <button 
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: subject.color }}
                >
                  Ver detalles
                </button>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Material tab
function MaterialTab({ subject }) {
  const materials = [
    { title: "Guía de ejercicios - Unidad 1", description: "Ejercicios prácticos para reforzar los conceptos vistos en clase.", file: "guia_ejercicios_u1.pdf", size: "2.4 MB", date: "15 Nov 2024" },
    { title: "Presentación: Introducción al tema", description: "Slides de la clase introductoria.", file: "intro_tema.pptx", size: "5.1 MB", date: "10 Nov 2024" },
    { title: "Lectura complementaria", description: "Material adicional para profundizar en el tema.", file: "lectura_comp.pdf", size: "1.8 MB", date: "5 Nov 2024" },
  ];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-800">Material de estudio</h2>
        <button 
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: subject.color }}
        >
          <Plus className="w-4 h-4" />
          Subir material
        </button>
      </div>
      
      {materials.map((material, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-start gap-4">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${subject.color}15` }}
            >
              <FileText className="w-7 h-7" style={{ color: subject.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 mb-1">{material.title}</h3>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{material.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {material.file}
                </span>
                <span>{material.size}</span>
                <span>{material.date}</span>
              </div>
            </div>
            <button 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 hover:shadow-md transition-all"
              style={{ borderColor: subject.color, color: subject.color }}
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Tasks tab
function TareasTab({ subject }) {
  const tasks = [
    { title: "Práctica calificada 1", description: "Resolver los ejercicios del 1 al 10 de la guía.", dueDate: "20 Nov 2024", status: "pending" },
    { title: "Trabajo de investigación", description: "Investigar sobre el tema asignado y preparar informe.", dueDate: "25 Nov 2024", status: "pending" },
    { title: "Ejercicios de repaso", description: "Completar los ejercicios de repaso.", dueDate: "10 Nov 2024", status: "completed" },
  ];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-800">Tareas</h2>
        <button 
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: subject.color }}
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>
      
      {tasks.map((task, i) => (
        <div key={i} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${task.status === "completed" ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100 hover:shadow-md hover:border-gray-200"}`}>
          <div className="flex items-start gap-4">
            <div 
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                task.status === "completed" ? "bg-emerald-100" : ""
              }`}
              style={task.status !== "completed" ? { backgroundColor: `${subject.color}15` } : {}}
            >
              {task.status === "completed" ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <ClipboardList className="w-6 h-6" style={{ color: subject.color }} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-gray-800">{task.title}</h3>
                {task.status === "completed" && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    Completada
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">{task.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Entrega: {task.dueDate}
                </span>
              </div>
            </div>
            {task.status !== "completed" && (
              <button 
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: subject.color }}
              >
                Entregar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyTab({ title, description, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
      <div 
        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-10 h-10" style={{ color }} />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">{description}</p>
      <button 
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
        style={{ backgroundColor: color }}
      >
        <Plus className="w-4 h-4" />
        Crear nuevo
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SubjectDetailPage({ user, token, subdomain, onLogout, subjectId, onBack }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tablero");
  
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);
  const [grade, setGrade] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadSubjectData();
  }, [subjectId]);

  const loadSubjectData = async () => {
    setLoading(true);
    try {
      const [settingsRes, subjectsRes, levelsRes, gradesRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      
      const subjectData = subjectsRes.data.find(s => s.id === subjectId);
      if (subjectData) {
        setSubject(subjectData);
        setLevel(levelsRes.data.find(l => l.id === subjectData.level_id));
        setGrade(gradesRes.data.find(g => g.id === subjectData.grade_id));
        
        // Get teacher
        try {
          const teacherRes = await axios.get(`${API}/academic/subjects/${subjectId}/teachers`, { headers });
          if (teacherRes.data.teachers?.length > 0) {
            const teacherId = teacherRes.data.teachers[0].id;
            setTeacher(usersRes.data.find(u => u.id === teacherId));
          }
        } catch (err) {
          console.log("No teacher assigned");
        }
        
        // Get students for this grade
        const gradeStudents = usersRes.data.filter(u => 
          u.role === "student" && u.grado_id === subjectData.grade_id
        );
        setStudents(gradeStudents);
      }
    } catch (err) {
      console.error("Error loading subject:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    if (!subject) return null;
    
    switch (activeTab) {
      case "tablero":
        return <DashboardTab subject={subject} />;
      case "material":
        return <MaterialTab subject={subject} />;
      case "tareas":
        return <TareasTab subject={subject} />;
      case "examenes":
        return <EmptyTab title="Sin exámenes" description="Aún no hay exámenes programados para este curso" icon={FlaskConical} color={subject.color} />;
      case "foro":
        return <EmptyTab title="Foro vacío" description="Inicia una discusión con tus compañeros" icon={MessageCircle} color={subject.color} />;
      case "envivo":
        return <EmptyTab title="Sin clases en vivo" description="No hay clases en vivo programadas" icon={Video} color={subject.color} />;
      case "calificaciones":
        return <EmptyTab title="Sin calificaciones" description="Aún no hay calificaciones registradas" icon={Trophy} color={subject.color} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando curso...</p>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold mb-4">Curso no encontrado</p>
          <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const recentActivity = [
    { title: "Nuevo material subido", time: "Hace 2h" },
    { title: "Tarea calificada", time: "Ayer" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-indigo-100/50 flex">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl">
              <BookOpen className="w-5 h-5 text-gray-600" />
            </button>
            {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-9 w-auto" />}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{settings?.system_name || "Instituto"}</h1>
              <p className="text-xs text-gray-400">Aula Virtual</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg">
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Course Header */}
          <CourseHeader 
            subject={subject}
            level={level}
            grade={grade}
            onBack={onBack}
            onEdit={() => {}}
          />
          
          {/* Tabs */}
          <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} color={subject.color} />
          
          {/* 3-Column Layout */}
          <div className="grid lg:grid-cols-[280px_1fr_300px] gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block">
              <CourseLeftSidebar subject={subject} recentActivity={recentActivity} />
            </div>
            
            {/* Main Content */}
            <div className="min-w-0">
              {renderTabContent()}
            </div>
            
            {/* Right Sidebar */}
            <div className="hidden lg:block">
              <CourseRightSidebar subject={subject} teacher={teacher} students={students} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
