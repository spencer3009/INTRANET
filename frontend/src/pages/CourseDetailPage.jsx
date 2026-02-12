import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import CourseRemindersPanel from "../components/CourseRemindersPanel";
import {
  BookOpen, Users, Edit3, ChevronRight, Clock, 
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Trophy, Download, Upload, 
  Calendar, Bell, Mail, Phone, MoreVertical, Plus,
  ArrowLeft, AlertCircle, File as FileIcon, Image as ImageIcon, 
  FileVideo, Heart, MessageSquare, 
  ChevronDown, ChevronUp, User, GraduationCap,
  PenTool, Search, Send, X, Loader2, Trash2, Edit2, Paperclip,
  Activity, Megaphone, CheckCircle, Check, Lock, Play
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ══════════════════════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: PenTool },
  { id: "material", label: "Material de estudio", icon: FolderOpen },
  { id: "examenes", label: "Exámenes en Línea", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
  { id: "recordatorios", label: "Recordatorios", icon: Bell },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy },
];

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function HeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-3xl" />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="h-5 bg-gray-200 rounded-lg w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-20 bg-gray-50 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-20 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="h-4 bg-gray-100 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-100">
      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <button 
          onClick={onAction}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {action}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HERO HEADER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function CourseHeroHeader({ subject, level, grade, academicPeriod, onEdit, onViewStudents, onViewGrades, onBack }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Generate a gradient based on the subject color
  const baseColor = subject?.color || "#6366F1";
  
  return (
    <div 
      className="relative rounded-3xl overflow-hidden shadow-xl"
      style={{ 
        background: `linear-gradient(135deg, ${baseColor}DD 0%, ${baseColor}99 50%, ${baseColor}66 100%)`
      }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />
      
      {/* Content */}
      <div className="relative z-10 p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Back button, Icon and Title */}
          <div className="flex items-center gap-5 flex-1">
            {/* Back button */}
            <button
              onClick={onBack}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl flex items-center justify-center transition-all duration-200 border border-white/30 shadow-lg"
              data-testid="back-to-subjects-btn"
              title="Volver a asignaturas"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            
            {/* Subject icon in header */}
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl border border-white/30">
              <BookOpen className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight">
                {subject?.name || "Asignatura"}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                {level && (
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/30">
                    {level}
                  </span>
                )}
                {grade && (
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/30">
                    {grade}
                  </span>
                )}
                {academicPeriod && (
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/30 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {academicPeriod}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="px-5 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-white/30"
              data-testid="edit-course-btn"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Editar curso</span>
            </button>
            <button
              onClick={onViewStudents}
              className="px-5 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-white/30"
              data-testid="view-students-btn"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Estudiantes</span>
            </button>
            <button
              onClick={onViewGrades}
              className="px-5 py-3 bg-white text-gray-700 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02]"
              data-testid="view-grades-btn"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Calificaciones</span>
            </button>
          </div>
        </div>
        
        {/* Subject Code Badge */}
        {subject?.code && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-sm rounded-xl text-white/90 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Código: {subject.code}
            {subject.weekly_hours && (
              <span className="ml-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {subject.weekly_hours}h semanales
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM TABS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function PremiumTabs({ activeTab, onTabChange }) {
  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 p-3">
      <div className="flex items-center justify-start overflow-x-auto hide-scrollbar gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium text-xs whitespace-nowrap transition-all duration-300 min-w-[100px] ${
                isActive
                  ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className={`w-7 h-7 ${isActive ? "text-white" : "text-gray-400"}`} strokeWidth={1.5} />
              <span className="uppercase tracking-wider font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEFT SIDEBAR - COURSE INFO
// ══════════════════════════════════════════════════════════════════════════════
function CourseInfoSidebar({ subject, subjectId, token }) {
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [sidebarData, setSidebarData] = useState({ news: [], quick_access: [], stats: {} });
  const [loadingSidebar, setLoadingSidebar] = useState(true);

  // Load activities from API
  useEffect(() => {
    const loadActivities = async () => {
      if (!subjectId || !token) return;
      
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/api/course/${subjectId}/activities?limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setActivities(res.data.activities || []);
      } catch (err) {
        console.error("Error loading activities:", err);
      } finally {
        setLoadingActivities(false);
      }
    };
    
    loadActivities();
  }, [subjectId, token]);

  // Load sidebar summary (news + quick access)
  useEffect(() => {
    const loadSidebarData = async () => {
      if (!subjectId || !token) return;
      
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/api/course/${subjectId}/sidebar-summary`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSidebarData(res.data);
      } catch (err) {
        console.error("Error loading sidebar data:", err);
      } finally {
        setLoadingSidebar(false);
      }
    };
    
    loadSidebarData();
  }, [subjectId, token]);

  // Format relative time
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  // Format future date
  const formatFutureDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Vencido";
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Mañana";
    if (diffDays <= 7) return `En ${diffDays} días`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  // Get activity icon and color based on type
  const getActivityStyle = (type) => {
    const styles = {
      post_created: { icon: MessageSquare, color: "from-indigo-400 to-purple-500" },
      material_uploaded: { icon: FolderOpen, color: "from-blue-400 to-cyan-500" },
      task_assigned: { icon: PenTool, color: "from-amber-400 to-orange-500" },
      task_submitted: { icon: CheckCircle, color: "from-emerald-400 to-green-500" },
      comment_added: { icon: MessageCircle, color: "from-violet-400 to-purple-500" },
      reminder_created: { icon: Bell, color: "from-rose-400 to-pink-500" },
      announcement: { icon: Megaphone, color: "from-amber-500 to-orange-500" },
      exam_scheduled: { icon: BookOpen, color: "from-red-400 to-rose-500" }
    };
    return styles[type] || { icon: Activity, color: "from-gray-400 to-gray-500" };
  };

  // Get news item icon
  const getNewsIcon = (iconType) => {
    const icons = {
      exam: { icon: BookOpen, color: "from-red-400 to-rose-500", bg: "bg-red-100", text: "text-red-600" },
      task: { icon: PenTool, color: "from-amber-400 to-orange-500", bg: "bg-amber-100", text: "text-amber-600" },
      notice: { icon: Bell, color: "from-violet-400 to-purple-500", bg: "bg-violet-100", text: "text-violet-600" },
      announcement: { icon: Megaphone, color: "from-blue-400 to-cyan-500", bg: "bg-blue-100", text: "text-blue-600" }
    };
    return icons[iconType] || icons.notice;
  };

  // Get quick access icon
  const getQuickAccessIcon = (iconType) => {
    const icons = {
      folder: FolderOpen,
      task: PenTool,
      video: FileVideo,
      forum: MessageSquare
    };
    return icons[iconType] || FolderOpen;
  };

  const getQuickAccessColor = (color) => {
    const colors = {
      blue: "from-blue-400 to-blue-600",
      amber: "from-amber-400 to-orange-500",
      rose: "from-rose-400 to-pink-500",
      violet: "from-violet-400 to-purple-500"
    };
    return colors[color] || "from-gray-400 to-gray-500";
  };

  return (
    <div className="space-y-5">
      {/* Course Card with Image - Elegant Design */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-violet-50/30 rounded-2xl p-5 border border-indigo-200/40 shadow-sm">
        {subject?.image_url ? (
          <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg ring-2 ring-white">
            <img 
              src={subject.image_url} 
              alt={subject.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div 
            className="w-full aspect-square rounded-2xl flex items-center justify-center mb-4 shadow-inner ring-2 ring-white/50"
            style={{ 
              background: `linear-gradient(135deg, ${subject?.color || '#6366F1'}15, ${subject?.color || '#6366F1'}30)`,
              border: `2px solid ${subject?.color || '#6366F1'}25`
            }}
          >
            <BookOpen className="w-16 h-16" style={{ color: subject?.color || '#6366F1' }} />
          </div>
        )}
        <h3 className="font-bold text-slate-800 text-center text-lg">{subject?.name}</h3>
        {subject?.description && (
          <p className="text-sm text-slate-500 text-center mt-2 line-clamp-3">{subject.description}</p>
        )}
      </div>
      
      {/* Activity Feed - Real-time from API - Elegant Design */}
      <div className="bg-gradient-to-br from-emerald-50/40 to-teal-50/20 rounded-2xl p-5 border border-emerald-200/40 shadow-sm">
        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm relative">
            <Activity className="w-3.5 h-3.5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white animate-pulse" />
          </div>
          Actividad del curso
        </h4>
        {loadingActivities ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 bg-white/60 rounded-xl border border-emerald-100/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Sin actividad reciente</p>
            <p className="text-xs text-slate-400 mt-1">Las acciones en el curso aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activities.slice(0, 6).map((activity) => {
              const style = getActivityStyle(activity.activity_type);
              const IconComponent = style.icon;
              return (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 bg-white/80 border border-slate-200/50 rounded-xl hover:bg-white hover:border-slate-300/60 hover:shadow-sm transition-all cursor-pointer group"
                >
                  {activity.user_photo ? (
                    <img 
                      src={activity.user_photo} 
                      alt={activity.user_name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${style.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md`}>
                      {activity.user_name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-clamp-2">
                      <span className="font-semibold text-slate-800">{activity.user_name}</span>{" "}
                      <span className="text-slate-500">{activity.title}</span>
                    </p>
                    {activity.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic bg-slate-50/80 px-2 py-1 rounded">"{activity.description}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className={`w-5 h-5 rounded bg-gradient-to-br ${style.color} flex items-center justify-center`}>
                        <IconComponent className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{formatTimeAgo(activity.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Latest News - Dynamic from API - Elegant Design */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Bell className="w-3.5 h-3.5 text-white" />
          </div>
          Últimas noticias
        </h4>
        {loadingSidebar ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          </div>
        ) : sidebarData.news.length === 0 ? (
          <div className="text-center py-6 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-xl border border-amber-100/50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Sin novedades</p>
            <p className="text-xs text-slate-400 mt-1">Los eventos próximos aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sidebarData.news.map((item) => {
              const newsStyle = getNewsIcon(item.icon);
              const NewsIcon = newsStyle.icon;
              const isUpcoming = new Date(item.date) > new Date();
              return (
                <div 
                  key={item.id} 
                  className={`p-3.5 rounded-xl transition-all cursor-pointer group ${
                    item.is_important 
                      ? "bg-gradient-to-r from-amber-50 to-orange-50/50 border-l-4 border-l-amber-400 border border-amber-200/50 hover:shadow-md hover:border-amber-300/60" 
                      : "bg-white border border-slate-200/60 hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br ${newsStyle.color}`}>
                      <NewsIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 line-clamp-2 group-hover:text-slate-800">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className={`text-xs font-medium ${
                            isUpcoming ? "text-slate-600" : "text-slate-400"
                          }`}>
                            {isUpcoming ? formatFutureDate(item.date) : formatTimeAgo(item.date)}
                          </span>
                        </div>
                        {item.is_important && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full shadow-sm">
                            IMPORTANTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT SIDEBAR - TEACHER & STUDENTS
// ══════════════════════════════════════════════════════════════════════════════
function CourseRightSidebar({ teacher, students, subjectId, token, userRole }) {
  const [showAllStudents, setShowAllStudents] = useState(false);
  const displayedStudents = showAllStudents ? students : students.slice(0, 6);
  
  return (
    <div className="space-y-5 lg:sticky lg:top-4">
      {/* Teacher Card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl overflow-hidden border border-amber-100 shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500">
          <h4 className="font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Profesor del curso
          </h4>
        </div>
        <div className="p-5">
          {teacher ? (
            <div className="text-center">
              {teacher.photo_url ? (
                <img
                  src={teacher.photo_url}
                  alt={teacher.name}
                  className="w-24 h-24 rounded-2xl object-cover mx-auto mb-4 shadow-lg ring-4 ring-white"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-white text-white text-3xl font-bold">
                  {teacher.name?.charAt(0)}
                </div>
              )}
              <h5 className="font-bold text-gray-800 text-lg">
                {teacher.name} {teacher.last_name}
              </h5>
              <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full mt-2">
                Profesor
              </span>
              {teacher.email && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{teacher.email}</span>
                </div>
              )}
              {teacher.phone && (
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{teacher.phone}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">Sin profesor asignado</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Students List */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl overflow-hidden border border-emerald-100 shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between">
          <h4 className="font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4" />
            Estudiantes
          </h4>
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
            {students.length}
          </span>
        </div>
        <div className="p-4">
          {students.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Sin estudiantes matriculados</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scroll">
                {displayedStudents.map((student, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-2.5 bg-white rounded-xl hover:bg-emerald-100/50 transition-colors cursor-pointer"
                  >
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-emerald-200">
                        {student.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {student.name} {student.last_name?.charAt(0)}.
                      </p>
                      {student.username && (
                        <p className="text-xs text-gray-400">@{student.username}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {students.length > 6 && (
                <button
                  onClick={() => setShowAllStudents(!showAllStudents)}
                  className="w-full mt-3 py-2.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
                >
                  {showAllStudents ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Ver todos ({students.length})
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Reminders - Premium Component */}
      <CourseRemindersPanel 
        subjectId={subjectId} 
        token={token} 
        userRole={userRole}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB CONTENT (TIMELINE FEED) - FUNCTIONAL
// ══════════════════════════════════════════════════════════════════════════════

// Pagination constant
const POSTS_PER_PAGE = 4;

// Helper to compress image to WebP (max 500px width)
const compressImageForPost = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 500;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const webpFile = new File([blob], 'post-image.webp', { type: 'image/webp' });
              resolve(webpFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

function DashboardContent({ subjectId, token, user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const loadPosts = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      }
      
      const currentOffset = loadMore ? offset : 0;
      const res = await axios.get(
        `${API}/course/${subjectId}/posts?limit=${POSTS_PER_PAGE}&offset=${currentOffset}`, 
        { headers }
      );
      
      const newPosts = res.data.posts || [];
      setTotal(res.data.total || 0);
      
      if (loadMore) {
        setPosts(prev => [...prev, ...newPosts]);
        setOffset(currentOffset + POSTS_PER_PAGE);
      } else {
        setPosts(newPosts);
        setOffset(POSTS_PER_PAGE);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [subjectId, token, offset]);
  
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setOffset(0);
    loadPosts(false);
  }, [subjectId]);
  
  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
    setTotal(prev => prev + 1);
  };
  
  const handlePostDeleted = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
    setTotal(prev => prev - 1);
  };
  
  const handleLikeToggle = (postId, liked, likesCount) => {
    setPosts(posts.map(p => 
      p.id === postId ? { ...p, user_liked: liked, likes_count: likesCount } : p
    ));
  };
  
  const handleCommentAdded = (postId) => {
    setPosts(posts.map(p => 
      p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
    ));
  };

  const hasMore = posts.length < total;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Create Post Input */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 px-5 py-3.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-left text-gray-500 font-medium transition-colors"
          >
            Comparte algo con tu clase...
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="p-3 hover:bg-indigo-50 rounded-xl transition-colors group"
          >
            <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="p-3 hover:bg-indigo-50 rounded-xl transition-colors group"
          >
            <Paperclip className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
          </button>
        </div>
      </div>
      
      {/* Posts Feed */}
      {posts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin publicaciones"
          description="Aún no hay publicaciones en este curso. ¡Sé el primero en compartir algo!"
          action="Crear publicación"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <>
          {posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              token={token}
              currentUserId={user?.id}
              onDelete={handlePostDeleted}
              onLikeToggle={handleLikeToggle}
              onCommentAdded={handleCommentAdded}
            />
          ))}
          
          {/* Pagination - Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => loadPosts(true)}
                disabled={loadingMore}
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 disabled:opacity-50"
                data-testid="load-more-dashboard-btn"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    Cargar más ({total - posts.length} restantes)
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Posts count indicator */}
          <div className="text-center text-sm text-gray-400 pt-2">
            Mostrando {posts.length} de {total} publicaciones
          </div>
        </>
      )}
      
      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        subjectId={subjectId}
        token={token}
        user={user}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}

// Post type configuration
const POST_TYPE_CONFIG = {
  announcement: {
    label: "Publicación",
    icon: MessageSquare,
    color: "from-indigo-500 to-purple-600",
    requiresTitle: false,
    placeholder: "¿Qué quieres compartir con tu clase?"
  },
  task: {
    label: "Tarea",
    icon: PenTool,
    color: "from-amber-500 to-orange-500",
    requiresTitle: true,
    placeholder: "Describe la tarea..."
  },
  material: {
    label: "Material de estudio",
    icon: FolderOpen,
    color: "from-blue-500 to-cyan-500",
    requiresTitle: true,
    placeholder: "Describe el material..."
  },
  forum: {
    label: "Foro",
    icon: MessageCircle,
    color: "from-emerald-500 to-teal-500",
    requiresTitle: true,
    placeholder: "Describe el tema de discusión..."
  }
};

// Create Post Modal - Enhanced with title and type support
function CreatePostModal({ isOpen, onClose, subjectId, token, user, onPostCreated, postType = "announcement" }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const config = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.announcement;
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      setFile(null);
      setError("");
      setUploadProgress(0);
    }
  }, [isOpen]);
  
  const handleImageSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.type.startsWith('image/')) {
      setError('Selecciona una imagen válida');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('La imagen no debe superar 10MB');
      return;
    }
    
    setImageFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    setError("");
  };
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('El archivo no debe superar 25MB');
      return;
    }
    
    setFile(selectedFile);
    setError("");
  };
  
  const uploadToCloudinary = async (fileToUpload, folder, isRawFile = false) => {
    // Determine resource type based on file
    const resourceType = isRawFile ? 'raw' : 'auto';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder, access_mode } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    // For raw files, add access_mode to make them publicly accessible
    if (access_mode) {
      formData.append('access_mode', access_mode);
    }
    
    // Use raw endpoint for non-image files, auto for others
    const uploadEndpoint = isRawFile ? 'raw' : 'auto';
    
    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloud_name}/${uploadEndpoint}/upload`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      }
    );
    
    return uploadRes.data.secure_url;
  };
  
  const handleSubmit = async () => {
    // Validate title for types that require it
    if (config.requiresTitle && !title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    
    if (!content.trim() && !imageFile && !file) {
      setError('Agrega texto, imagen o archivo');
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let imageUrl = null;
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      
      // Upload image if present
      if (imageFile) {
        const compressedImage = await compressImageForPost(imageFile);
        imageUrl = await uploadToCloudinary(compressedImage, 'edunet/posts', false);
      }
      
      // Upload file if present (use raw for non-image files like PDF, DOC, etc.)
      if (file) {
        const isRawFile = !file.type.startsWith('image/');
        fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
        fileName = file.name;
        fileType = file.type;
      }
      
      // Create post with type and title
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: title.trim() || null,
        content: content.trim(),
        post_type: postType,
        image_url: imageUrl,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType
      }, { headers });
      
      onPostCreated(res.data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al publicar');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen) return null;
  
  const Icon = config.icon;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header with type indicator */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r ${config.color}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {postType === "announcement" ? "Nueva publicación" : `Nueva ${config.label.toLowerCase()}`}
              </h3>
              <p className="text-xs text-white/70">{config.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-white font-bold text-sm`}>
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-gray-400">Publicando en el curso</p>
            </div>
          </div>
          
          {/* Title input (for task, material, forum) */}
          {config.requiresTitle && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título *"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              data-testid="post-title-input"
            />
          )}
          
          {/* Text input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={config.placeholder}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
            data-testid="post-content-input"
          />
          
          {/* Image Preview */}
          {imagePreview && (
            <div className="mt-4 relative">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* File Preview */}
          {file && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
              <FileIcon className="w-8 h-8 text-indigo-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setFile(null)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          
          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                <span>Subiendo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="p-2 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
              <ImageIcon className="w-5 h-5 text-green-600" />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
            <label className="p-2 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
              <Paperclip className="w-5 h-5 text-blue-600" />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || (config.requiresTitle && !title.trim()) || (!content.trim() && !imageFile && !file)}
            className={`px-6 py-2.5 bg-gradient-to-r ${config.color} hover:opacity-90 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2`}
            data-testid="submit-post-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to get correct download URL for files
// For files uploaded as 'raw', Cloudinary returns the correct URL automatically
// This function adds download attribute support
const getFileDownloadUrl = (url) => {
  if (!url) return url;
  return url;
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL - Professional confirmation dialog
// ══════════════════════════════════════════════════════════════════════════════
function DeleteConfirmModal({ isOpen, onClose, onConfirm, loading, title = "Eliminar publicación", message = "¿Estás seguro de que deseas eliminar esta publicación? Esta acción no se puede deshacer." }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header with warning icon */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-500">{message}</p>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            data-testid="cancel-delete-btn"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            data-testid="confirm-delete-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Eliminar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({ post, token, currentUserId, onDelete, onLikeToggle, onCommentAdded }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAuthor = post.author_id === currentUserId;
  const config = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.announcement;
  const TypeIcon = config.icon;
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  };
  
  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await axios.post(`${API}/course/posts/${post.id}/like`, {}, { headers });
      onLikeToggle(post.id, res.data.liked, res.data.likes_count);
    } catch (err) {
      console.error('Error liking:', err);
    } finally {
      setLiking(false);
    }
  };
  
  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${post.id}`, { headers });
      onDelete(post.id);
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Error al eliminar:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/course/posts/${post.id}/comments`, { headers });
      setComments(res.data);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(!showComments);
  };
  
  const handleSubmitComment = async () => {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await axios.post(`${API}/course/posts/${post.id}/comments`, {
        content: newComment.trim()
      }, { headers });
      setComments([...comments, res.data.comment]);
      setNewComment("");
      onCommentAdded(post.id);
    } catch (err) {
      console.error('Error commenting:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Author Header */}
        <div className="flex items-center gap-4 mb-4">
          {post.author?.photo_url ? (
            <img
              src={post.author.photo_url}
              alt={post.author.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-white font-bold`}>
              {post.author?.name?.charAt(0) || "U"}
            </div>
          )}
          <div className="flex-1">
            <p className="font-bold text-gray-800">{post.author?.name} {post.author?.last_name}</p>
            <p className="text-sm text-gray-400">{formatDate(post.created_at)}</p>
          </div>
          
          {/* Menu */}
          {isAuthor && (
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-xl"
                data-testid="post-menu-btn"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border py-2 min-w-[140px] z-20">
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      data-testid="delete-post-menu-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Type Badge (small, always blue, above title) */}
        {post.post_type && post.post_type !== "announcement" && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
              <TypeIcon className="w-3.5 h-3.5" />
              {config.label}
            </span>
          </div>
        )}
        
        {/* Title (for task, material, forum) */}
        {post.title && (
          <h3 className="text-lg font-bold text-gray-800 mb-2">{post.title}</h3>
        )}
        
        {/* Content */}
        {post.content && (
          <p className="text-gray-700 mb-4 whitespace-pre-wrap">{post.content}</p>
        )}
        
        {/* Image */}
        {post.image_url && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img 
              src={post.image_url} 
              alt="Post" 
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}
        
        {/* File Attachment */}
        {post.file_url && (
          <a 
            href={getFileDownloadUrl(post.file_url)} 
            target="_blank" 
            rel="noopener noreferrer"
            download={post.file_name}
            className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4 hover:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-700 truncate">{post.file_name || "Archivo adjunto"}</p>
              <p className="text-sm text-gray-400">Clic para descargar</p>
            </div>
            <Download className="w-5 h-5 text-gray-400" />
          </a>
        )}
      </div>
      
      {/* Actions */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6">
        <button 
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-2 transition-colors ${
            post.user_liked ? 'text-rose-500' : 'text-gray-500 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-5 h-5 ${post.user_liked ? 'fill-current' : ''}`} />
          <span className="text-sm font-medium">{post.likes_count || 0}</span>
        </button>
        <button 
          onClick={handleToggleComments}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium">{post.comments_count || 0}</span>
        </button>
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Comments List */}
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-2">Sin comentarios aún</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      {comment.author?.photo_url ? (
                        <img src={comment.author.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold">
                          {comment.author?.name?.charAt(0) || "U"}
                        </div>
                      )}
                      <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800">{comment.author?.name}</p>
                        <p className="text-sm text-gray-600">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Add Comment */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
                  placeholder="Escribe un comentario..."
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl transition-colors"
                >
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Eliminar publicación"
        message={post.title 
          ? `¿Estás seguro de que deseas eliminar "${post.title}"? Esta acción eliminará también las imágenes y archivos adjuntos.`
          : "¿Estás seguro de que deseas eliminar esta publicación? Esta acción eliminará también las imágenes y archivos adjuntos."
        }
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED CONTENT FEED - For Tasks, Materials, Forum
// ══════════════════════════════════════════════════════════════════════════════

function UnifiedContentFeed({ subjectId, token, user, postType }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  
  const config = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.announcement;
  const headers = { Authorization: `Bearer ${token}` };
  
  const loadPosts = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      }
      
      const currentOffset = loadMore ? offset : 0;
      const res = await axios.get(
        `${API}/course/${subjectId}/posts?post_type=${postType}&limit=${POSTS_PER_PAGE}&offset=${currentOffset}`, 
        { headers }
      );
      
      const newPosts = res.data.posts || [];
      setTotal(res.data.total || 0);
      
      if (loadMore) {
        setPosts(prev => [...prev, ...newPosts]);
        setOffset(currentOffset + POSTS_PER_PAGE);
      } else {
        setPosts(newPosts);
        setOffset(POSTS_PER_PAGE);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [subjectId, token, postType, offset]);
  
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setOffset(0);
    loadPosts(false);
  }, [subjectId, postType]);
  
  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
    setTotal(prev => prev + 1);
  };
  
  const handlePostDeleted = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
    setTotal(prev => prev - 1);
  };
  
  const handleLikeToggle = (postId, liked, likesCount) => {
    setPosts(posts.map(p => 
      p.id === postId ? { ...p, user_liked: liked, likes_count: likesCount } : p
    ));
  };
  
  const handleCommentAdded = (postId) => {
    setPosts(posts.map(p => 
      p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
    ));
  };
  
  const hasMore = posts.length < total;
  const Icon = config.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const getEmptyMessage = () => {
    switch (postType) {
      case "task":
        return {
          title: "Sin tareas",
          description: "No hay tareas asignadas para este curso. Crea la primera tarea para tus estudiantes.",
          action: "Nueva tarea"
        };
      case "material":
        return {
          title: "Sin material de estudio",
          description: "Aún no hay materiales disponibles para este curso. Sube el primer archivo para tus estudiantes.",
          action: "Subir material"
        };
      case "forum":
        return {
          title: "Sin discusiones",
          description: "El foro está vacío. Inicia una discusión para interactuar con la clase.",
          action: "Nueva discusión"
        };
      default:
        return {
          title: "Sin publicaciones",
          description: "Aún no hay publicaciones en este curso.",
          action: "Nueva publicación"
        };
    }
  };
  
  const emptyMsg = getEmptyMessage();

  return (
    <div className="space-y-5">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className={`px-5 py-3 bg-gradient-to-r ${config.color} text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2`}
          data-testid={`create-${postType}-btn`}
        >
          <Plus className="w-5 h-5" />
          {emptyMsg.action}
        </button>
      </div>
      
      {/* Posts Feed */}
      {posts.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          action={emptyMsg.action}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <>
          {posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              token={token}
              currentUserId={user?.id}
              onDelete={handlePostDeleted}
              onLikeToggle={handleLikeToggle}
              onCommentAdded={handleCommentAdded}
            />
          ))}
          
          {/* Pagination - Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => loadPosts(true)}
                disabled={loadingMore}
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 disabled:opacity-50"
                data-testid="load-more-btn"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    Cargar más ({total - posts.length} restantes)
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Posts count indicator */}
          <div className="text-center text-sm text-gray-400 pt-2">
            Mostrando {posts.length} de {total} publicaciones
          </div>
        </>
      )}
      
      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        subjectId={subjectId}
        token={token}
        user={user}
        onPostCreated={handlePostCreated}
        postType={postType}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MATERIAL TAB CONTENT (Legacy - keeping for reference but unused)
// ══════════════════════════════════════════════════════════════════════════════
function MaterialContent({ materials, onUpload }) {
  return (
    <div className="space-y-5">
      {/* Upload Button */}
      <div className="flex justify-end">
        <button
          onClick={onUpload}
          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
          data-testid="upload-material-btn"
        >
          <Upload className="w-5 h-5" />
          Subir material
        </button>
      </div>
      
      {materials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin material de estudio"
          description="Aún no hay materiales disponibles para este curso. Sube el primer archivo para tus estudiantes."
          action="Subir material"
          onAction={onUpload}
        />
      ) : (
        <div className="grid gap-4">
          {materials.map((material, idx) => (
            <MaterialCard key={idx} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialCard({ material }) {
  const getFileIcon = (type) => {
    switch (type) {
      case "pdf": return <FileText className="w-6 h-6 text-red-500" />;
      case "video": return <FileVideo className="w-6 h-6 text-purple-500" />;
      case "image": return <ImageIcon className="w-6 h-6 text-green-500" />;
      default: return <FileIcon className="w-6 h-6 text-blue-500" />;
    }
  };
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      <div className="p-5 flex items-start gap-5">
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
          {getFileIcon(material.type)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 text-lg mb-1">{material.title}</h4>
          {material.description && (
            <p className="text-gray-500 text-sm mb-3 line-clamp-2">{material.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {material.date}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {material.author}
            </span>
            {material.size && (
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                {material.size}
              </span>
            )}
          </div>
        </div>
        <button className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-600 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASKS TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
function TasksContent({ tasks, onCreateTask }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={onCreateTask}
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nueva tarea
        </button>
      </div>
      
      {tasks.length === 0 ? (
        <EmptyState
          icon={PenTool}
          title="Sin tareas"
          description="No hay tareas asignadas para este curso. Crea la primera tarea para tus estudiantes."
          action="Crear tarea"
          onAction={onCreateTask}
        />
      ) : (
        <div className="space-y-4">
          {tasks.map((task, idx) => (
            <TaskCard key={idx} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }) {
  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    submitted: "bg-blue-100 text-blue-700",
    graded: "bg-green-100 text-green-700",
    late: "bg-red-100 text-red-700"
  };
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
          <PenTool className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-bold text-gray-800 text-lg">{task.title}</h4>
            {task.status && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[task.status] || statusColors.pending}`}>
                {task.status === "pending" ? "Pendiente" : 
                 task.status === "submitted" ? "Entregada" :
                 task.status === "graded" ? "Calificada" : "Atrasada"}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-gray-500 text-sm mb-3">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Entrega: {task.dueDate}
            </span>
            {task.points && (
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                {task.points} pts
              </span>
            )}
          </div>
        </div>
        <button className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl font-medium transition-colors">
          Ver detalles
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMS TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ONLINE EXAMS TAB CONTENT - Premium Implementation
// ══════════════════════════════════════════════════════════════════════════════

// Exam status configuration
const EXAM_STATUS_CONFIG = {
  draft: { 
    label: "Borrador", 
    color: "bg-gray-100 text-gray-600",
    icon: Edit3,
    description: "Solo visible para el profesor"
  },
  scheduled: { 
    label: "Programado", 
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
    description: "Programado, no visible para estudiantes"
  },
  published: { 
    label: "Publicado", 
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle,
    description: "Visible para estudiantes"
  },
  closed: { 
    label: "Cerrado", 
    color: "bg-red-100 text-red-700",
    icon: X,
    description: "Examen finalizado"
  }
};

// Time picker component with circular dial
function TimePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(value ? parseInt(value.split(':')[0]) : 9);
  const [minutes, setMinutes] = useState(value ? parseInt(value.split(':')[1]) : 0);
  const [selectingHours, setSelectingHours] = useState(true);
  const dialRef = useRef(null);
  
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(parseInt(h));
      setMinutes(parseInt(m));
    }
  }, [value]);
  
  const handleDialClick = (e) => {
    if (!dialRef.current) return;
    
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    
    if (selectingHours) {
      const hour = Math.round(angle / 30) % 12 || 12;
      setHours(hour > 12 ? hour - 12 : hour);
    } else {
      const minute = Math.round(angle / 6) % 60;
      setMinutes(minute);
    }
  };
  
  const confirmTime = () => {
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };
  
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-left flex items-center gap-3 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      >
        <Clock className="w-5 h-5 text-gray-400" />
        <span className="text-gray-700 font-medium">
          {value || "Seleccionar hora"}
        </span>
      </button>
      
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-[320px]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
              <p className="text-indigo-200 text-sm mb-1">Seleccionar hora</p>
              <div className="flex items-baseline gap-1">
                <button
                  onClick={() => setSelectingHours(true)}
                  className={`text-5xl font-light transition-colors ${selectingHours ? 'text-white' : 'text-white/50'}`}
                >
                  {hours.toString().padStart(2, '0')}
                </button>
                <span className="text-5xl font-light text-white/50">:</span>
                <button
                  onClick={() => setSelectingHours(false)}
                  className={`text-5xl font-light transition-colors ${!selectingHours ? 'text-white' : 'text-white/50'}`}
                >
                  {minutes.toString().padStart(2, '0')}
                </button>
              </div>
            </div>
            
            {/* Clock Dial */}
            <div className="p-6">
              <div 
                ref={dialRef}
                onClick={handleDialClick}
                className="relative w-[240px] h-[240px] mx-auto rounded-full bg-gray-100 cursor-pointer"
              >
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full z-10" />
                
                {/* Hand */}
                <div 
                  className="absolute top-1/2 left-1/2 origin-bottom bg-indigo-600 rounded-full z-5"
                  style={{
                    width: '2px',
                    height: '80px',
                    transform: `translateX(-50%) rotate(${selectingHours ? (hours % 12) * 30 : minutes * 6}deg)`,
                    transformOrigin: 'center bottom'
                  }}
                />
                
                {/* Numbers */}
                {(selectingHours ? hourNumbers : minuteNumbers).map((num, idx) => {
                  const angle = (idx * 30 - 90) * (Math.PI / 180);
                  const radius = 90;
                  const x = 120 + radius * Math.cos(angle);
                  const y = 120 + radius * Math.sin(angle);
                  const isSelected = selectingHours ? num === hours : num === minutes;
                  
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectingHours) {
                          setHours(num);
                        } else {
                          setMinutes(num);
                        }
                      }}
                      className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 text-white' 
                          : 'hover:bg-indigo-100 text-gray-700'
                      }`}
                      style={{ left: x, top: y }}
                    >
                      {selectingHours ? num : num.toString().padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Actions */}
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmTime}
                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Exam Modal for Create/Edit
function ExamModal({ isOpen, onClose, onSave, exam, subjectId }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [minScore, setMinScore] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (exam) {
      setTitle(exam.title || "");
      setDescription(exam.description || "");
      if (exam.start_datetime) {
        const startDt = new Date(exam.start_datetime);
        setDate(startDt.toISOString().split('T')[0]);
        setStartTime(`${startDt.getHours().toString().padStart(2, '0')}:${startDt.getMinutes().toString().padStart(2, '0')}`);
      }
      if (exam.end_datetime) {
        const endDt = new Date(exam.end_datetime);
        setEndTime(`${endDt.getHours().toString().padStart(2, '0')}:${endDt.getMinutes().toString().padStart(2, '0')}`);
      }
      setMinScore(exam.min_score_percentage || 60);
    } else {
      setTitle("");
      setDescription("");
      setDate("");
      setStartTime("09:00");
      setEndTime("11:00");
      setMinScore(60);
    }
    setError("");
  }, [exam, isOpen]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!date) {
      setError("La fecha es requerida");
      return;
    }
    if (!startTime || !endTime) {
      setError("Las horas de inicio y fin son requeridas");
      return;
    }
    
    // Combine date and time
    const startDatetime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDatetime = new Date(`${date}T${endTime}:00`).toISOString();
    
    // Validate end > start
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      setError("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        min_score_percentage: minScore
      }, exam?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {exam ? "Editar Examen" : "Nuevo Examen"}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Título del examen *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Examen Trimestral - Unidad 1"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              required
            />
          </div>
          
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              required
            />
          </div>
          
          {/* Time pickers */}
          <div className="grid grid-cols-2 gap-4">
            <TimePicker 
              label="Hora de inicio *"
              value={startTime}
              onChange={setStartTime}
            />
            <TimePicker 
              label="Hora límite *"
              value={endTime}
              onChange={setEndTime}
            />
          </div>
          
          {/* Min Score */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Porcentaje mínimo de aprobación
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <span className="w-16 px-3 py-2 bg-purple-100 text-purple-700 font-bold rounded-lg text-center">
                {minScore}%
              </span>
            </div>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instrucciones o detalles del examen..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all resize-none"
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {exam ? "Guardar cambios" : "Crear examen"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Confirm Modal Component
function ConfirmExamModal({ isOpen, onClose, onConfirm, title, message, confirmText, confirmColor = "red" }) {
  if (!isOpen) return null;
  
  const colorClasses = {
    red: "bg-red-500 hover:bg-red-600",
    green: "bg-emerald-500 hover:bg-emerald-600",
    amber: "bg-amber-500 hover:bg-amber-600",
    purple: "bg-purple-500 hover:bg-purple-600"
  };
  
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM DETAIL VIEW - With Questions Management
// ══════════════════════════════════════════════════════════════════════════════

// Question type configuration
const QUESTION_TYPES = {
  multiple_choice: { 
    label: "Opción múltiple", 
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-700"
  },
  true_false: { 
    label: "Verdadero / Falso", 
    icon: Check,
    color: "bg-emerald-100 text-emerald-700"
  },
  fill_blanks: { 
    label: "Espacios en blanco", 
    icon: Edit3,
    color: "bg-amber-100 text-amber-700"
  }
};

// Question Form Modal
function QuestionFormModal({ isOpen, onClose, onSave, question }) {
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [questionText, setQuestionText] = useState("");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState([
    { id: "1", text: "", is_correct: false },
    { id: "2", text: "", is_correct: false }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (question) {
      setQuestionType(question.question_type || "multiple_choice");
      setQuestionText(question.question_text || "");
      setPoints(question.points || 1);
      if (question.options) {
        setOptions(question.options);
      }
      setCorrectAnswer(question.correct_answer || "");
    } else {
      setQuestionType("multiple_choice");
      setQuestionText("");
      setPoints(1);
      setOptions([
        { id: "1", text: "", is_correct: false },
        { id: "2", text: "", is_correct: false }
      ]);
      setCorrectAnswer("");
    }
    setError("");
  }, [question, isOpen]);
  
  const addOption = () => {
    setOptions([...options, { id: String(Date.now()), text: "", is_correct: false }]);
  };
  
  const removeOption = (id) => {
    if (options.length > 2) {
      setOptions(options.filter(o => o.id !== id));
    }
  };
  
  const updateOption = (id, field, value) => {
    setOptions(options.map(o => {
      if (o.id === id) {
        if (field === "is_correct" && value === true) {
          // Unmark others if single correct answer
          return { ...o, is_correct: true };
        }
        return { ...o, [field]: value };
      }
      // If marking this one correct, unmark others (for single answer)
      if (field === "is_correct" && value === true) {
        return { ...o, is_correct: false };
      }
      return o;
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!questionText.trim()) {
      setError("La pregunta es requerida");
      return;
    }
    
    // Validate based on type
    if (questionType === "multiple_choice") {
      const validOptions = options.filter(o => o.text.trim());
      if (validOptions.length < 2) {
        setError("Se requieren al menos 2 opciones");
        return;
      }
      if (!options.some(o => o.is_correct)) {
        setError("Debe marcar una respuesta correcta");
        return;
      }
    }
    
    if (questionType === "true_false" && !correctAnswer) {
      setError("Debe seleccionar Verdadero o Falso");
      return;
    }
    
    if (questionType === "fill_blanks") {
      if (!questionText.includes("_")) {
        setError("La pregunta debe contener '_' para marcar los espacios en blanco");
        return;
      }
      if (!correctAnswer.trim()) {
        setError("Debe proporcionar las palabras correctas");
        return;
      }
    }
    
    setSaving(true);
    try {
      const data = {
        question_type: questionType,
        question_text: questionText.trim(),
        points: parseFloat(points),
        options: questionType === "multiple_choice" ? options.filter(o => o.text.trim()) : null,
        correct_answer: questionType !== "multiple_choice" ? correctAnswer : null
      };
      
      await onSave(data, question?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };
  
  // Preview for fill_blanks
  const renderFillBlanksPreview = () => {
    if (questionType !== "fill_blanks" || !questionText.includes("_")) return null;
    
    const parts = questionText.split("_");
    const answers = correctAnswer.split(",").map(a => a.trim());
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Vista previa</p>
        <p className="text-gray-700">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span className="inline-block min-w-[80px] px-2 py-1 mx-1 bg-amber-100 text-amber-700 rounded font-medium text-center">
                  {answers[i] || "___"}
                </span>
              )}
            </span>
          ))}
        </p>
      </div>
    );
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {question ? "Editar Pregunta" : "Nueva Pregunta"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {/* Question Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tipo de pregunta</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(QUESTION_TYPES).map(([type, config]) => {
                const Icon = config.icon;
                const isSelected = questionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuestionType(type)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      isSelected 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? "text-indigo-600" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${isSelected ? "text-indigo-700" : "text-gray-600"}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Question Text */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pregunta *
              {questionType === "fill_blanks" && (
                <span className="font-normal text-gray-500 ml-2">(usa _ para espacios en blanco)</span>
              )}
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={questionType === "fill_blanks" 
                ? "Ej: La capital de Perú es _ y su moneda es el _" 
                : "Escribe la pregunta aquí..."
              }
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
              required
            />
          </div>
          
          {/* Points */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Puntaje</label>
            <input
              type="number"
              min="0.5"
              max="100"
              step="0.5"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Multiple Choice Options */}
          {questionType === "multiple_choice" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Opciones de respuesta</label>
              <div className="space-y-3">
                {options.map((option, idx) => (
                  <div key={option.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateOption(option.id, "is_correct", !option.is_correct)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        option.is_correct 
                          ? "border-emerald-500 bg-emerald-500 text-white" 
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {option.is_correct && <Check className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(option.id, "text", e.target.value)}
                      placeholder={`Opción ${idx + 1}`}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(option.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar opción
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Haz clic en el círculo para marcar la respuesta correcta</p>
            </div>
          )}
          
          {/* True/False */}
          {questionType === "true_false" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Respuesta correcta</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCorrectAnswer("true")}
                  className={`flex-1 py-4 rounded-xl border-2 font-semibold transition-all ${
                    correctAnswer === "true"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  ✓ Verdadero
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectAnswer("false")}
                  className={`flex-1 py-4 rounded-xl border-2 font-semibold transition-all ${
                    correctAnswer === "false"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  ✗ Falso
                </button>
              </div>
            </div>
          )}
          
          {/* Fill Blanks */}
          {questionType === "fill_blanks" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Palabras correctas <span className="font-normal text-gray-500">(separadas por coma)</span>
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Lima, nuevo sol"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {renderFillBlanksPreview()}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {question ? "Guardar cambios" : "Agregar pregunta"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Main Exam Detail View Component
function ExamDetailView({ examId, token, userRole, onBack }) {
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const canEdit = ["teacher", "admin", "owner", "director", "coordinator"].includes(userRole);
  
  useEffect(() => {
    loadExamData();
  }, [examId]);
  
  const loadExamData = async () => {
    setLoading(true);
    try {
      const [examRes, questionsRes] = await Promise.all([
        axios.get(`${API}/exams/${examId}/full`, { headers }),
        axios.get(`${API}/exams/${examId}/questions`, { headers })
      ]);
      setExam(examRes.data);
      setQuestions(questionsRes.data);
    } catch (err) {
      console.error("Error loading exam:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveQuestion = async (data, questionId) => {
    if (questionId) {
      await axios.put(`${API}/exams/questions/${questionId}`, data, { headers });
    } else {
      await axios.post(`${API}/exams/${examId}/questions`, data, { headers });
    }
    loadExamData();
  };
  
  const handleDeleteQuestion = async (questionId) => {
    try {
      await axios.delete(`${API}/exams/questions/${questionId}`, { headers });
      setDeleteConfirm(null);
      loadExamData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: "", time: "" };
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    };
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }
  
  if (!exam) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Examen no encontrado</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 hover:underline">
          Volver a la lista
        </button>
      </div>
    );
  }
  
  const start = formatDateTime(exam.start_datetime);
  const end = formatDateTime(exam.end_datetime);
  const statusConfig = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  
  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800">{exam.title}</h2>
          <p className="text-sm text-gray-500">Gestión de preguntas del examen</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${statusConfig.color}`}>
          <StatusIcon className="w-4 h-4" />
          {statusConfig.label.toUpperCase()}
        </span>
      </div>
      
      {/* Exam Details Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Detalles del Examen
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Curso</p>
              <p className="font-semibold text-gray-800">{exam.subject_name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Grado</p>
              <p className="font-semibold text-gray-800">{exam.grade_name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fecha</p>
              <p className="font-semibold text-gray-800">{start.date}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Horario</p>
              <p className="font-semibold text-gray-800">{start.time} - {end.time}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Nota mínima</p>
              <p className="font-semibold text-gray-800">{exam.min_score_percentage}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total preguntas</p>
              <p className="font-semibold text-gray-800">{questions.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Puntaje total</p>
              <p className="font-semibold text-gray-800">{exam.total_points || 0} pts</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estado</p>
              <p className={`font-semibold ${statusConfig.color.replace('bg-', 'text-').split(' ')[1]}`}>
                {statusConfig.label}
              </p>
            </div>
          </div>
          {exam.description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descripción</p>
              <p className="text-gray-700">{exam.description}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Questions Management */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Gestión de Preguntas
          </h3>
          {canEdit && exam.status !== "closed" && (
            <button
              onClick={() => { setEditingQuestion(null); setShowQuestionModal(true); }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Pregunta
            </button>
          )}
        </div>
        
        <div className="p-6">
          {questions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-1">Sin preguntas</h4>
              <p className="text-sm text-gray-500 mb-4">Agrega preguntas para completar este examen</p>
              {canEdit && exam.status !== "closed" && (
                <button
                  onClick={() => { setEditingQuestion(null); setShowQuestionModal(true); }}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold inline-flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar primera pregunta
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-12">#</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Tipo</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Pregunta</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Nota</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Opciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {questions.map((q, idx) => {
                    const typeConfig = QUESTION_TYPES[q.question_type] || QUESTION_TYPES.multiple_choice;
                    const TypeIcon = typeConfig.icon;
                    
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${typeConfig.color}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-800 line-clamp-2">{q.question_text}</p>
                          {q.question_type === "multiple_choice" && q.options && (
                            <p className="text-xs text-gray-500 mt-1">
                              {q.options.length} opciones • Correcta: {q.options.find(o => o.is_correct)?.text || "—"}
                            </p>
                          )}
                          {q.question_type === "true_false" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Correcta: {q.correct_answer === "true" ? "Verdadero" : "Falso"}
                            </p>
                          )}
                          {q.question_type === "fill_blanks" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Respuestas: {q.correct_answer}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-indigo-600">{q.points}</span>
                          <span className="text-gray-400 text-sm ml-1">pts</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {canEdit && exam.status !== "closed" && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingQuestion(q); setShowQuestionModal(true); }}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(q)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Question Modal */}
      <QuestionFormModal
        isOpen={showQuestionModal}
        onClose={() => { setShowQuestionModal(false); setEditingQuestion(null); }}
        onSave={handleSaveQuestion}
        question={editingQuestion}
      />
      
      {/* Delete Confirmation */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar pregunta?</h3>
            <p className="text-gray-600 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteQuestion(deleteConfirm.id)}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Main Exams Content Component
function ExamsContent({ subjectId, token, userRole }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedExam, setExpandedExam] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState(null); // For detail view
  
  const headers = { Authorization: `Bearer ${token}` };
  const canEdit = ["teacher", "admin", "owner", "director", "coordinator"].includes(userRole);
  
  useEffect(() => {
    loadExams();
  }, [subjectId]);
  
  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/course/${subjectId}/exams`, { headers });
      setExams(res.data);
    } catch (err) {
      console.error("Error loading exams:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async (data, examId) => {
    if (examId) {
      await axios.put(`${API}/exams/${examId}`, data, { headers });
    } else {
      await axios.post(`${API}/course/${subjectId}/exams`, data, { headers });
    }
    loadExams();
  };
  
  const handlePublish = async (exam) => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/exams/${exam.id}/publish`, {}, { headers });
      loadExams();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al publicar");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };
  
  const handleClose = async (exam) => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/exams/${exam.id}/close`, {}, { headers });
      loadExams();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cerrar");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };
  
  const handleDelete = async (exam) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API}/exams/${exam.id}`, { headers });
      loadExams();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };
  
  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    };
  };
  
  // If an exam is selected, show its detail view
  if (selectedExamId) {
    return (
      <ExamDetailView 
        examId={selectedExamId}
        token={token}
        userRole={userRole}
        onBack={() => { setSelectedExamId(null); loadExams(); }}
      />
    );
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Exámenes en Línea</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona las evaluaciones del curso</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditingExam(null); setShowModal(true); }}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo examen
          </button>
        )}
      </div>
      
      {/* Exams List */}
      {exams.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Sin exámenes"
          description="No hay exámenes programados para este curso. Crea un examen para evaluar a tus estudiantes."
          action={canEdit ? "Crear examen" : null}
          onAction={() => { setEditingExam(null); setShowModal(true); }}
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const statusConfig = EXAM_STATUS_CONFIG[exam.status] || EXAM_STATUS_CONFIG.draft;
            const StatusIcon = statusConfig.icon;
            const start = formatDateTime(exam.start_datetime);
            const end = formatDateTime(exam.end_datetime);
            const isExpanded = expandedExam === exam.id;
            
            return (
              <div 
                key={exam.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                {/* Main Row */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                      <FlaskConical className="w-7 h-7 text-white" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusConfig.label.toUpperCase()}
                            </span>
                            {exam.has_attempts && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {exam.attempts_count} intentos
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-800">{exam.title}</h3>
                          {exam.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{exam.description}</p>
                          )}
                        </div>
                        
                        {/* Date/Time Badge */}
                        <div className="text-right flex-shrink-0">
                          <div className="px-3 py-2 bg-gray-50 rounded-xl">
                            <p className="text-sm font-semibold text-gray-700">{start.date}</p>
                            <p className="text-xs text-gray-500">{start.time} - {end.time}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      {canEdit && (
                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                          <button
                            onClick={() => setSelectedExamId(exam.id)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all flex items-center gap-1.5"
                          >
                            <Edit3 className="w-4 h-4" />
                            GESTIONAR PREGUNTAS
                          </button>
                          
                          <button
                            onClick={() => setExpandedExam(isExpanded ? null : exam.id)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                          >
                            <FileText className="w-4 h-4" />
                            DETALLES
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          
                          {(exam.status === 'draft' || exam.status === 'scheduled') && (
                            <button
                              onClick={() => setConfirmAction({ type: 'publish', exam })}
                              className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-4 h-4" />
                              PUBLICAR EXAMEN
                            </button>
                          )}
                          
                          {exam.status === 'published' && (
                            <button
                              onClick={() => setConfirmAction({ type: 'close', exam })}
                              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              CERRAR EXAMEN
                            </button>
                          )}
                          
                          {!exam.has_attempts && exam.status !== 'closed' && (
                            <button
                              onClick={() => setConfirmAction({ type: 'delete', exam })}
                              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-1.5"
                            >
                              <Trash2 className="w-4 h-4" />
                              ELIMINAR
                            </button>
                          )}
                          
                          {(exam.has_attempts || exam.status === 'closed') && (
                            <span className="px-3 py-2 text-gray-400 text-xs italic">
                              {exam.status === 'closed' ? 'Examen cerrado - Solo lectura' : 'No se puede eliminar (tiene intentos)'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Estado</p>
                          <p className="font-semibold text-gray-800">{statusConfig.label}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Fecha</p>
                          <p className="font-semibold text-gray-800">{start.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Horario</p>
                          <p className="font-semibold text-gray-800">{start.time} - {end.time}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Nota mínima</p>
                          <p className="font-semibold text-gray-800">{exam.min_score_percentage}%</p>
                        </div>
                      </div>
                      {exam.description && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descripción</p>
                          <p className="text-gray-700">{exam.description}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => { setEditingExam(exam); setShowModal(true); }}
                          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Exam Modal */}
      <ExamModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingExam(null); }}
        onSave={handleSave}
        exam={editingExam}
        subjectId={subjectId}
      />
      
      {/* Confirm Modals */}
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'publish'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handlePublish(confirmAction?.exam)}
        title="¿Publicar examen?"
        message="El examen será visible para todos los estudiantes del curso. Podrán acceder durante el horario programado."
        confirmText="Publicar"
        confirmColor="green"
      />
      
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'close'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleClose(confirmAction?.exam)}
        title="¿Cerrar examen?"
        message="Los estudiantes ya no podrán acceder al examen. Esta acción no se puede deshacer."
        confirmText="Cerrar examen"
        confirmColor="amber"
      />
      
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleDelete(confirmAction?.exam)}
        title="¿Eliminar examen?"
        message="Esta acción eliminará permanentemente el examen. No se puede deshacer."
        confirmText="Eliminar"
        confirmColor="red"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORUM TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
function ForumContent({ threads, onCreateThread }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar en el foro..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={onCreateThread}
          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nueva discusión
        </button>
      </div>
      
      {threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Sin discusiones"
          description="El foro está vacío. Inicia una discusión para interactuar con la clase."
          action="Crear discusión"
          onAction={onCreateThread}
        />
      ) : (
        <div className="space-y-3">
          {threads.map((thread, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {thread.author?.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 mb-1">{thread.title}</h4>
                  <p className="text-sm text-gray-500 line-clamp-2">{thread.preview}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                    <span>{thread.author}</span>
                    <span>{thread.date}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {thread.replies} respuestas
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRADES TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
function GradesContent({ grades }) {
  return (
    <div className="space-y-5">
      {grades.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sin calificaciones"
          description="Aún no hay calificaciones registradas para este curso."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-bold text-gray-700">Estudiante</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-700">Tarea 1</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-700">Tarea 2</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-700">Examen</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-700">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((student, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                          {student.name?.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-800">{student.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-4 font-medium text-gray-600">{student.task1 || "-"}</td>
                    <td className="text-center px-4 py-4 font-medium text-gray-600">{student.task2 || "-"}</td>
                    <td className="text-center px-4 py-4 font-medium text-gray-600">{student.exam || "-"}</td>
                    <td className="text-center px-4 py-4">
                      <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                        student.average >= 15 ? "bg-green-100 text-green-700" :
                        student.average >= 11 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {student.average || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDERS TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
function RemindersTabContent({ subjectId, token, userRole }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Recordatorios del Curso</h2>
            <p className="text-sm text-gray-500">Gestiona tareas, exámenes y avisos importantes</p>
          </div>
        </div>
        
        {/* Embedded Reminders Panel - Full width version */}
        <CourseRemindersPanel 
          subjectId={subjectId} 
          token={token} 
          userRole={userRole}
          isFullWidth={true}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function CourseDetailPage({ user, token, subdomain, onLogout }) {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [subject, setSubject] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [levelName, setLevelName] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [academicPeriodName, setAcademicPeriodName] = useState("");
  
  const [activeTab, setActiveTab] = useState("tablero");
  
  // Mock data - empty, will be loaded from API
  // (Keeping this for backwards compatibility if needed)
  
  const [posts] = useState([
    {
      author: { name: "Prof. García", photo_url: null },
      date: "25 Nov, 19:55 PM",
      type: "Material de estudio",
      title: "Cuadro Mensual de Actividades",
      content: "Les comparto el cuadro de actividades para este mes. Revisen las fechas importantes.",
      attachment: { name: "Cuadro_Mensual_Diciembre.pdf", size: "483 KB" },
      likes: 12,
      comments: 3
    },
    {
      author: { name: "Prof. García", photo_url: null },
      date: "20 Nov, 14:30 PM",
      type: "Anuncio",
      title: "Recordatorio: Proyecto final",
      content: "Recuerden que la fecha límite para la entrega del proyecto final es el viernes. Cualquier duda, me escriben.",
      likes: 8,
      comments: 5
    }
  ]);
  
  const [materials] = useState([]);
  const [tasks] = useState([]);
  const [exams] = useState([]);
  const [threads] = useState([]);
  const [grades] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load settings
      const settingsRes = await axios.get(`${API}/settings`, { headers });
      setSettings(settingsRes.data);
      
      // Load subject details
      const subjectsRes = await axios.get(`${API}/academic/subjects`, { headers });
      const foundSubject = subjectsRes.data.find(s => s.id === subjectId);
      
      if (!foundSubject) {
        setError("Asignatura no encontrada");
        setLoading(false);
        return;
      }
      
      setSubject(foundSubject);
      setLevelName(foundSubject.level_name || "");
      setGradeName(foundSubject.grade_name || "");
      
      // Load teacher from the subject data (now includes primary_teacher from academic_assignments)
      if (foundSubject.primary_teacher) {
        setTeacher({
          id: foundSubject.primary_teacher.id,
          name: foundSubject.primary_teacher.name,
          photo_url: foundSubject.primary_teacher.profile_image,
          role: foundSubject.primary_teacher.role
        });
      }
      
      // Load students for this grade
      try {
        const usersRes = await axios.get(`${API}/users`, { headers });
        const gradeStudents = usersRes.data.filter(
          u => u.role === "student" && u.grado_id === foundSubject.grade_id
        );
        setStudents(gradeStudents);
      } catch (e) {
        console.log("Could not load students");
      }
      
      // Get the academic period from assignments for this subject
      try {
        const assignmentsRes = await axios.get(`${API}/academic/assignments`, { headers });
        const subjectAssignment = assignmentsRes.data.find(a => a.subject_id === subjectId && a.status === "activo");
        if (subjectAssignment) {
          // Use academic_year if available, otherwise show school_year
          if (subjectAssignment.academic_year) {
            setAcademicPeriodName(`Año Escolar ${subjectAssignment.academic_year}`);
          } else if (subjectAssignment.school_year) {
            setAcademicPeriodName(`Año Escolar ${subjectAssignment.school_year}`);
          }
        } else {
          // Fallback: try to get active academic year
          const yearsRes = await axios.get(`${API}/academic/years`, { headers });
          const activeYear = yearsRes.data.find(y => y.status === "activo");
          if (activeYear) {
            setAcademicPeriodName(`Año Escolar ${activeYear.year}`);
          } else {
            setAcademicPeriodName(`${new Date().getFullYear()}`);
          }
        }
      } catch (e) {
        setAcademicPeriodName(`${new Date().getFullYear()}`);
      }
      
    } catch (err) {
      console.error(err);
      setError("Error al cargar los datos del curso");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (subdomain) {
      navigate(`/school/${subdomain}/asignaturas`);
    } else {
      navigate("/asignaturas");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "tablero":
        return <DashboardContent subjectId={subjectId} token={token} user={user} />;
      case "tareas":
        return <UnifiedContentFeed subjectId={subjectId} token={token} user={user} postType="task" />;
      case "material":
        return <UnifiedContentFeed subjectId={subjectId} token={token} user={user} postType="material" />;
      case "examenes":
        return <ExamsContent subjectId={subjectId} token={token} userRole={user?.role} />;
      case "foro":
        return <UnifiedContentFeed subjectId={subjectId} token={token} user={user} postType="forum" />;
      case "recordatorios":
        return <RemindersTabContent subjectId={subjectId} token={token} userRole={user?.role} />;
      case "calificaciones":
        return <GradesContent grades={grades} />;
      default:
        return <DashboardContent subjectId={subjectId} token={token} user={user} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex">
        <Sidebar
          user={user}
          settings={settings}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          subdomain={subdomain}
          onLogout={onLogout}
        />
        <div className="flex-1 p-6 lg:p-8">
          <HeaderSkeleton />
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3">
              <SidebarSkeleton />
            </div>
            <div className="lg:col-span-6">
              <ContentSkeleton />
            </div>
            <div className="lg:col-span-3">
              <SidebarSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex">
        <Sidebar
          user={user}
          settings={settings}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          subdomain={subdomain}
          onLogout={onLogout}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{error}</h2>
            <button
              onClick={handleBack}
              className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver a asignaturas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100 flex">
      <Sidebar
        user={user}
        settings={settings}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
        active="asignaturas"
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Sticky at top */}
        <div className="sticky top-0 z-40 bg-gradient-to-br from-slate-100/95 via-gray-50/95 to-zinc-100/95 backdrop-blur-sm">
          <DashboardHeader
            user={user}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            onLogout={onLogout}
            logoUrl={settings?.logo_url}
            schoolName={settings?.system_name}
            subdomain={subdomain}
            token={token}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 px-6 lg:px-8 py-6">
          {/* Hero Header */}
          <CourseHeroHeader
            subject={subject}
            level={levelName}
            grade={gradeName}
            academicPeriod={academicPeriodName}
            onEdit={() => {}}
            onViewStudents={() => setActiveTab("calificaciones")}
            onViewGrades={() => setActiveTab("calificaciones")}
            onBack={() => navigate("/asignaturas")}
          />
          
          {/* Tabs */}
          <div className="mt-6 sticky top-[72px] z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-gradient-to-br from-slate-100/95 via-gray-50/95 to-zinc-100/95 backdrop-blur-sm border-b border-gray-200/50">
            <PremiumTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          {/* 3-Column Layout - Hide sidebars for exams tab */}
          <div className={`mt-6 grid grid-cols-1 gap-6 items-start ${
            activeTab === "examenes" 
              ? "" 
              : "lg:grid-cols-12"
          }`}>
            {/* Left Sidebar - Sticky (hidden on exams tab) */}
            {activeTab !== "examenes" && (
              <aside className="hidden lg:block lg:col-span-3 sticky top-[200px] self-start">
                <CourseInfoSidebar
                  subject={subject}
                  subjectId={subjectId}
                  token={token}
                />
              </aside>
            )}
            
            {/* Main Content Area - Full width on exams tab */}
            <div className={activeTab === "examenes" ? "" : "lg:col-span-6"}>
              {renderTabContent()}
            </div>
            
            {/* Right Sidebar - Sticky (hidden on exams tab) */}
            {activeTab !== "examenes" && (
              <aside className="hidden lg:block lg:col-span-3 sticky top-[200px] self-start">
                <CourseRightSidebar
                  teacher={teacher}
                  students={students}
                  subjectId={subjectId}
                  token={token}
                  userRole={user?.role}
                />
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
