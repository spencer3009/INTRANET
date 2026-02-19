import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import CourseRemindersPanel from "../components/CourseRemindersPanel";
import MessageCenter from "../components/MessageCenter";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  BookOpen, Users, Edit3, ChevronRight, Clock, 
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Trophy, Download, Upload, 
  Calendar, Bell, Mail, Phone, MoreVertical, Plus,
  ArrowLeft, AlertCircle, File as FileIcon, Image as ImageIcon, 
  FileVideo, Heart, MessageSquare, 
  ChevronDown, ChevronUp, User, GraduationCap,
  PenTool, Search, Send, X, Loader2, Trash2, Edit2, Paperclip,
  Activity, Megaphone, CheckCircle, Check, Lock, Play, Camera, ZoomIn, ZoomOut,
  Type, Layers, Eye, EyeOff, Archive, RotateCcw, HardDrive, Cloud, Minus
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD UTILITIES - Google Drive & Cloudinary
// ══════════════════════════════════════════════════════════════════════════════

// Extensions that should go to Google Drive (documents)
const GOOGLE_DRIVE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'txt'];

// Check if a file should be uploaded to Google Drive
const shouldUseGoogleDrive = (file) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type || '';
  
  // Images go to Cloudinary
  if (mimeType.startsWith('image/')) return false;
  
  // Documents go to Google Drive
  return GOOGLE_DRIVE_EXTENSIONS.includes(ext);
};

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
function CourseInfoSidebar({ subject, subjectId, token, onActivityClick }) {
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [sidebarData, setSidebarData] = useState({ news: [], quick_access: [], stats: {} });
  const [loadingSidebar, setLoadingSidebar] = useState(true);

  // Handle activity click - navigate to the relevant content
  const handleActivityClick = (activity) => {
    if (onActivityClick) {
      onActivityClick(activity);
    }
  };

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
            {activities.slice(0, 7).map((activity) => {
              const style = getActivityStyle(activity.activity_type);
              const IconComponent = style.icon;
              return (
                <div 
                  key={activity.id} 
                  onClick={() => handleActivityClick(activity)}
                  className="flex items-start gap-3 p-3 bg-white/80 border border-slate-200/50 rounded-xl hover:bg-white hover:border-slate-300/60 hover:shadow-sm transition-all cursor-pointer group"
                  data-testid={`activity-${activity.id}`}
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [presenceStatus, setPresenceStatus] = useState({});
  const displayedStudents = showAllStudents ? students : students.slice(0, 6);
  
  // Fetch presence status periodically
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await axios.get(`${API}/presence/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPresenceStatus(res.data);
      } catch (err) {
        console.log("Could not fetch presence");
      }
    };
    
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [token]);
  
  // Online status indicator component
  const OnlineIndicator = ({ userId, size = "sm" }) => {
    const status = presenceStatus[userId];
    const isOnline = status?.is_online;
    const sizeClasses = size === "sm" ? "w-3 h-3" : "w-4 h-4";
    
    return (
      <div className={`${sizeClasses} rounded-full flex items-center justify-center ${
        isOnline 
          ? 'bg-green-500 ring-2 ring-white' 
          : 'bg-red-400 ring-2 ring-white'
      }`}>
        {!isOnline && <Minus className="w-2 h-2 text-white" />}
      </div>
    );
  };
  
  // Student Detail Modal using Portal
  const StudentDetailModal = selectedStudent ? createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-8 text-center relative">
          <button 
            onClick={() => setSelectedStudent(null)}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="relative inline-block">
            {selectedStudent.photo_url ? (
              <img
                src={selectedStudent.photo_url}
                alt={selectedStudent.name}
                className="w-24 h-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-white/50 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 ring-4 ring-white/50 text-white text-3xl font-bold">
                {selectedStudent.name?.charAt(0)}
              </div>
            )}
            {/* Online indicator in modal */}
            <div className="absolute bottom-3 right-0">
              <OnlineIndicator userId={selectedStudent.id} size="lg" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white">
            {selectedStudent.name} {selectedStudent.last_name}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            {selectedStudent.username && (
              <p className="text-emerald-100 text-sm">@{selectedStudent.username}</p>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              presenceStatus[selectedStudent.id]?.is_online 
                ? 'bg-green-400/30 text-green-100' 
                : 'bg-red-400/30 text-red-100'
            }`}>
              {presenceStatus[selectedStudent.id]?.is_online ? 'En línea' : 'Desconectado'}
            </span>
          </div>
        </div>
        
        {/* Student Info */}
        <div className="p-6 space-y-4">
          {selectedStudent.email && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Correo electrónico</p>
                <p className="text-sm font-medium text-gray-800">{selectedStudent.email}</p>
              </div>
            </div>
          )}
          
          {selectedStudent.phone && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Teléfono</p>
                <p className="text-sm font-medium text-gray-800">{selectedStudent.phone}</p>
              </div>
            </div>
          )}
          
          {selectedStudent.grade_name && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Grado / Sección</p>
                <p className="text-sm font-medium text-gray-800">
                  {selectedStudent.grade_name} {selectedStudent.section_name && `- ${selectedStudent.section_name}`}
                </p>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                // TODO: Implementar chat en línea
                alert('Chat en línea próximamente');
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
            >
              <MessageCircle className="w-5 h-5" />
              Chat en línea
            </button>
            <button
              onClick={() => {
                // TODO: Implementar envío de mensaje
                alert('Enviar mensaje próximamente');
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
            >
              <Mail className="w-5 h-5" />
              Enviar Mensaje
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
  
  return (
    <div className="space-y-5 lg:sticky lg:top-4">
      {StudentDetailModal}
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
                    onClick={() => setSelectedStudent(student)}
                    className="flex items-center gap-3 p-2.5 bg-white rounded-xl hover:bg-emerald-100/50 transition-colors cursor-pointer group"
                  >
                    <div className="relative">
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
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <OnlineIndicator userId={student.id} size="sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {student.name} {student.last_name?.charAt(0)}.
                      </p>
                      {student.username && (
                        <p className="text-xs text-gray-400">@{student.username}</p>
                      )}
                    </div>
                    <MessageCircle className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
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
  
  // Google Drive state
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  
  const config = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.announcement;
  const headers = { Authorization: `Bearer ${token}` };
  
  // Check Google Drive status on mount
  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const res = await axios.get(`${API}/integrations/google-drive/status`, { headers });
        setDriveStatus(res.data);
      } catch (err) {
        console.error('Error checking Drive status:', err);
      }
    };
    checkDriveStatus();
  }, [token]);
  
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
    // Determine resource type based on file extension for more accurate handling
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase();
    const rawExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv'];
    const shouldUseRaw = isRawFile || rawExtensions.includes(fileExtension) || !fileToUpload.type.startsWith('image/');
    const resourceType = shouldUseRaw ? 'raw' : 'image';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    // Use the correct endpoint based on resource type
    const uploadEndpoint = resourceType;
    
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
  
  // Upload to Google Drive
  const uploadToGoogleDrive = async (fileToUpload) => {
    // Use the file-only upload endpoint (no database record created)
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('subject_id', subjectId);
    
    const res = await axios.post(`${API}/files/upload-to-drive`, formData, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      }
    });
    
    return res.data;
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
    
    // Check if file needs Google Drive but Drive is not connected
    if (file && shouldUseGoogleDrive(file) && !driveStatus.connected) {
      setError("Para adjuntar documentos (PDF, Word, Excel, etc.) debes conectar Google Drive desde Ajustes.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let imageUrl = null;
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      let driveFileId = null;
      let storageType = null;
      
      // Upload image if present (always to Cloudinary)
      if (imageFile) {
        const compressedImage = await compressImageForPost(imageFile);
        imageUrl = await uploadToCloudinary(compressedImage, 'edunet/posts', false);
      }
      
      // Upload file if present
      if (file) {
        if (shouldUseGoogleDrive(file)) {
          // Upload documents to Google Drive
          const driveRes = await uploadToGoogleDrive(file);
          driveFileId = driveRes.drive_file_id;
          fileName = driveRes.drive_file_name || file.name;
          fileType = file.type || 'application/octet-stream';
          storageType = 'google_drive';
        } else {
          // Upload other files to Cloudinary
          const isRawFile = !file.type.startsWith('image/');
          fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
          fileName = file.name;
          fileType = file.type;
          storageType = 'cloudinary';
        }
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
        file_type: fileType,
        drive_file_id: driveFileId,
        storage_type: storageType
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
            <div className="mt-4 space-y-3">
              {/* Google Drive Status Banner */}
              {shouldUseGoogleDrive(file) && !driveStatus.connected && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-start gap-2">
                  <HardDrive className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Google Drive no conectado</p>
                    <p className="text-xs mt-0.5">Para adjuntar este tipo de archivo, conecta Google Drive desde Ajustes.</p>
                  </div>
                </div>
              )}
              
              {shouldUseGoogleDrive(file) && driveStatus.connected && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                  <HardDrive className="w-4 h-4 flex-shrink-0" />
                  <span>Este archivo se guardará en Google Drive</span>
                </div>
              )}
              
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                <FileIcon className="w-8 h-8 text-indigo-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 hover:bg-gray-200 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
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

// ══════════════════════════════════════════════════════════════════════════════
// RICH TEXT EDITOR - Tiptap-based editor with toolbar
// ══════════════════════════════════════════════════════════════════════════════
function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Highlight.configure({
        multicolor: true
      }),
      Link.configure({
        openOnClick: false
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Escribe aquí...'
      })
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-all ${
        active 
          ? 'bg-amber-500 text-white' 
          : 'text-slate-600 hover:bg-amber-100 hover:text-amber-700'
      }`}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-300 mx-1" />
  );

  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 focus-within:border-amber-400 transition-all bg-slate-50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-slate-100/80 border-b border-slate-200">
        {/* Text Style */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Título 1"
        >
          <span className="text-xs font-bold px-1">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Título 2"
        >
          <span className="text-xs font-bold px-1">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Título 3"
        >
          <span className="text-xs font-bold px-1">H3</span>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Bold, Italic, Underline, Strike */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrita"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Cursiva"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Subrayado"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Tachado"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Highlight */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          active={editor.isActive('highlight')}
          title="Resaltar"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.59 10.09l-2.29 2.29L2.5 23.17 5.33 20H22v-3H9.41l6.18-6.91zM1.42 1.42L6.63 6.63 3.41 9.85l3.03 3.03 3.54-3.54 1.41 1.41-3.54 3.54 3.03 3.03 3.22-3.22 5.21 5.21 1.41-1.41L2.83 0 1.42 1.42z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista con viñetas"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Alinear izquierda"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Centrar"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Alinear derecha"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Quote & Code */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Cita"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Bloque de código"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL del enlace:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          title="Enlace"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-3 min-h-[120px] max-h-[200px] overflow-y-auto bg-white focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASK TIME PICKER - Circular dial time picker with amber theme
// ══════════════════════════════════════════════════════════════════════════════
function TaskTimePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(value ? parseInt(value.split(':')[0]) : 23);
  const [minutes, setMinutes] = useState(value ? parseInt(value.split(':')[1]) : 59);
  const [seconds, setSeconds] = useState(value && value.split(':')[2] ? parseInt(value.split(':')[2]) : 0);
  const [isPM, setIsPM] = useState(value ? parseInt(value.split(':')[0]) >= 12 : true);
  const [selectingMode, setSelectingMode] = useState('hours'); // 'hours', 'minutes', 'seconds'
  const dialRef = useRef(null);
  
  useEffect(() => {
    if (value) {
      const parts = value.split(':');
      const hour24 = parseInt(parts[0]) || 0;
      setHours(hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24);
      setMinutes(parseInt(parts[1]) || 0);
      setSeconds(parseInt(parts[2]) || 0);
      setIsPM(hour24 >= 12);
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
    
    if (selectingMode === 'hours') {
      const hour = Math.round(angle / 30) % 12 || 12;
      setHours(hour);
    } else if (selectingMode === 'minutes') {
      const minute = Math.round(angle / 6) % 60;
      setMinutes(minute);
    } else {
      const second = Math.round(angle / 6) % 60;
      setSeconds(second);
    }
  };
  
  const confirmTime = () => {
    // Convert to 24-hour format
    let hour24 = hours;
    if (isPM && hours !== 12) hour24 = hours + 12;
    if (!isPM && hours === 12) hour24 = 0;
    
    const timeStr = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };
  
  const goNext = () => {
    if (selectingMode === 'hours') setSelectingMode('minutes');
    else if (selectingMode === 'minutes') setSelectingMode('seconds');
  };
  
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteSecondNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  // Get current dial numbers and selected value
  const currentNumbers = selectingMode === 'hours' ? hourNumbers : minuteSecondNumbers;
  const currentValue = selectingMode === 'hours' ? hours : selectingMode === 'minutes' ? minutes : seconds;
  const currentAngle = selectingMode === 'hours' 
    ? (hours % 12) * 30 
    : selectingMode === 'minutes' 
      ? minutes * 6 
      : seconds * 6;
  
  // Format display time in 12-hour format with AM/PM
  const formatDisplayTime = () => {
    if (!value) return "11:59 PM";
    const parts = value.split(':');
    const hour24 = parseInt(parts[0]) || 0;
    const min = parseInt(parts[1]) || 0;
    const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`;
  };
  
  const displayTime = formatDisplayTime();
  
  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-left flex items-center gap-3 hover:border-amber-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
        data-testid="task-time-picker-btn"
      >
        <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <span className="text-slate-800 font-semibold text-lg">
          {displayTime}
        </span>
      </button>
      
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-[340px] animate-in fade-in zoom-in-95 duration-200">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-6 py-5">
              <p className="text-amber-100 text-sm mb-1 font-medium">Seleccionar hora límite</p>
              <div className="flex items-center gap-3 justify-center">
                <div className="flex items-baseline gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectingMode('hours')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'hours' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {hours.toString().padStart(2, '0')}
                  </button>
                  <span className="text-4xl font-light text-white/50">:</span>
                  <button
                    type="button"
                    onClick={() => setSelectingMode('minutes')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'minutes' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {minutes.toString().padStart(2, '0')}
                  </button>
                  <span className="text-4xl font-light text-white/50">:</span>
                  <button
                    type="button"
                    onClick={() => setSelectingMode('seconds')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'seconds' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {seconds.toString().padStart(2, '0')}
                  </button>
                </div>
                {/* AM/PM Toggle */}
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPM(false)}
                    className={`px-2 py-0.5 rounded text-sm font-bold transition-all ${!isPM ? 'bg-white text-amber-600' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPM(true)}
                    className={`px-2 py-0.5 rounded text-sm font-bold transition-all ${isPM ? 'bg-white text-amber-600' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
            
            {/* Clock Dial */}
            <div className="p-6 bg-gradient-to-b from-slate-50 to-white">
              <div 
                ref={dialRef}
                onClick={handleDialClick}
                className="relative w-[240px] h-[240px] mx-auto rounded-full bg-white shadow-inner border border-slate-200 cursor-pointer"
              >
                {/* Hand line - from center pointing outward */}
                <div 
                  className="absolute z-5"
                  style={{
                    width: '3px',
                    height: '80px',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-1.5px',
                    marginTop: '-80px',
                    background: 'linear-gradient(to bottom, #ea580c, #f59e0b)',
                    transformOrigin: 'bottom center',
                    transform: `rotate(${currentAngle}deg)`,
                    borderRadius: '3px'
                  }}
                />
                
                {/* Tip circle at the end of hand */}
                <div 
                  className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 z-5 shadow-lg flex items-center justify-center"
                  style={{
                    left: `calc(50% + ${80 * Math.sin(currentAngle * Math.PI / 180)}px)`,
                    top: `calc(50% - ${80 * Math.cos(currentAngle * Math.PI / 180)}px)`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {selectingMode === 'hours' 
                      ? (hours === 0 ? 12 : hours > 12 ? hours - 12 : hours) 
                      : currentValue.toString().padStart(2, '0')
                    }
                  </span>
                </div>
                
                {/* Center dot - on top of everything */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full z-20 shadow-lg" />
                
                {/* Numbers around the dial */}
                {currentNumbers.map((num, idx) => {
                  const angle = (idx * 30 - 90) * (Math.PI / 180);
                  const radius = 90;
                  const x = 120 + radius * Math.cos(angle);
                  const y = 120 + radius * Math.sin(angle);
                  const isSelected = selectingMode === 'hours' 
                    ? (num === hours || (num === 12 && hours === 0)) 
                    : num === currentValue;
                  
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectingMode === 'hours') {
                          setHours(num === 12 ? 0 : num);
                        } else if (selectingMode === 'minutes') {
                          setMinutes(num);
                        } else {
                          setSeconds(num);
                        }
                      }}
                      className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        isSelected 
                          ? 'text-transparent' 
                          : 'hover:bg-amber-100 text-slate-700'
                      }`}
                      style={{ left: x, top: y }}
                    >
                      {selectingMode === 'hours' ? num : num.toString().padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
              
              {/* Mode indicator */}
              <div className="flex justify-center mt-4 gap-2">
                <button
                  onClick={() => setSelectingMode('hours')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'hours' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Horas
                </button>
                <button
                  onClick={() => setSelectingMode('minutes')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'minutes' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Minutos
                </button>
                <button
                  onClick={() => setSelectingMode('seconds')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'seconds' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Segundos
                </button>
              </div>
            </div>
            
            {/* Actions */}
            <div className="px-6 pb-6 flex justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={goNext}
                className={`px-5 py-2.5 font-semibold rounded-xl transition-all ${selectingMode !== 'seconds' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'hidden'}`}
              >
                Siguiente
              </button>
              <button
                type="button"
                onClick={confirmTime}
                className={`px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25 ${selectingMode === 'seconds' ? '' : 'hidden'}`}
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

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM TASK CREATION MODAL - Beautiful task creation experience
// ══════════════════════════════════════════════════════════════════════════════
function PremiumTaskModal({ isOpen, onClose, subjectId, token, user, onPostCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("text"); // text, files, both
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [showToStudents, setShowToStudents] = useState(true);
  const [points, setPoints] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  
  // Google Drive state
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Check Google Drive status on mount
  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const res = await axios.get(`${API}/integrations/google-drive/status`, { headers });
        setDriveStatus(res.data);
      } catch (err) {
        console.error('Error checking Drive status:', err);
      }
    };
    checkDriveStatus();
  }, [token]);
  
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setDeliveryType("text");
      setDueDate("");
      setDueTime("23:59");
      setShowToStudents(true);
      setPoints("");
      setFile(null);
      setError("");
      setUploadProgress(0);
    }
  }, [isOpen]);
  
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
    // Determine resource type based on file extension
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase();
    const rawExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv'];
    const shouldUseRaw = isRawFile || rawExtensions.includes(fileExtension) || !fileToUpload.type.startsWith('image/');
    const resourceType = shouldUseRaw ? 'raw' : 'image';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    const uploadEndpoint = resourceType;
    
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
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    
    if (!dueDate) {
      setError("La fecha de entrega es requerida");
      return;
    }
    
    // Check if file needs Google Drive but Drive is not connected
    if (file && shouldUseGoogleDrive(file) && !driveStatus.connected) {
      setError("Para adjuntar documentos (PDF, Word, Excel, etc.) debes conectar Google Drive desde Ajustes.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      let driveFileId = null;
      let storageType = null;
      
      if (file) {
        // Determine if file should go to Google Drive or Cloudinary
        if (shouldUseGoogleDrive(file)) {
          // Upload to Google Drive (file-only, no database record)
          const formData = new FormData();
          formData.append('file', file);
          formData.append('subject_id', subjectId);
          
          const driveRes = await axios.post(`${API}/files/upload-to-drive`, formData, {
            headers: {
              ...headers,
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            }
          });
          
          driveFileId = driveRes.data.drive_file_id;
          fileName = driveRes.data.drive_file_name || file.name;
          fileType = file.type || 'application/octet-stream';
          storageType = 'google_drive';
        } else {
          // Upload images to Cloudinary
          const isRawFile = !file.type.startsWith('image/');
          fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
          fileName = file.name;
          fileType = file.type || 'application/octet-stream';
          storageType = 'cloudinary';
        }
      }
      
      // Combine date and time - store in ISO format with Peru timezone offset
      // Peru is UTC-5, so we append that offset to ensure consistent parsing
      // Handle both "HH:MM" and "HH:MM:SS" formats
      const timeParts = dueTime.split(':');
      const timeWithSeconds = timeParts.length === 2 ? `${dueTime}:00` : dueTime;
      const dueDateTime = `${dueDate}T${timeWithSeconds}-05:00`;
      
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: title.trim(),
        content: description.trim() || `Tipo de entrega: ${deliveryType === 'text' ? 'Texto en línea' : deliveryType === 'files' ? 'Archivos' : 'Texto y archivos'}${points ? ` | Puntos: ${points}` : ''}${!showToStudents ? ' | (Oculto para estudiantes)' : ''}\n\nFecha de entrega: ${new Date(dueDateTime).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}`,
        post_type: "task",
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        drive_file_id: driveFileId,
        storage_type: storageType,
        metadata: {
          delivery_type: deliveryType,
          due_date: dueDateTime,
          show_to_students: showToStudents,
          points: points ? parseInt(points) : null
        }
      }, { headers });
      
      onPostCreated(res.data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la tarea');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen) return null;
  
  // Get file extension icon
  const getFileIcon = (fileName) => {
    if (!fileName) return FileIcon;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return FileIcon;
    if (['doc', 'docx'].includes(ext)) return FileIcon;
    if (['xls', 'xlsx'].includes(ext)) return FileIcon;
    if (['ppt', 'pptx'].includes(ext)) return FileIcon;
    return FileIcon;
  };
  
  const FileIconComponent = file ? getFileIcon(file.name) : FileIcon;
  
  // Calculate min date (today)
  const today = new Date().toISOString().split('T')[0];
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Premium gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRoLTEydjJoMTJ2LTJ6bTAtNGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <PenTool className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nueva Tarea</h2>
                <p className="text-sm text-white/80">Asigna una actividad a tus estudiantes</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto custom-scroll">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título de la tarea <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Análisis del capítulo 5"
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
              data-testid="task-title-input"
            />
          </div>
          
          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha de entrega <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                  data-testid="task-date-input"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <TaskTimePicker
                value={dueTime}
                onChange={setDueTime}
                label="Hora límite"
              />
            </div>
          </div>
          
          {/* Delivery Type */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Tipo de entrega
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'text', label: 'Texto en línea', icon: Type, desc: 'Respuesta escrita' },
                { id: 'files', label: 'Archivos', icon: Upload, desc: 'Subir documentos' },
                { id: 'both', label: 'Ambos', icon: Layers, desc: 'Texto y archivos' }
              ].map((type) => {
                const TypeIcon = type.icon;
                const isSelected = deliveryType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDeliveryType(type.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    data-testid={`delivery-type-${type.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>
                      {type.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{type.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Points (Optional) */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Puntos <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative w-32">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
                min="0"
                max="1000"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                data-testid="task-points-input"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">pts</span>
            </div>
          </div>
          
          {/* Visibility Toggle */}
          <div className="mb-5 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showToStudents ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  {showToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mostrar a estudiantes</p>
                  <p className="text-xs text-slate-400">
                    {showToStudents ? 'Los estudiantes podrán ver esta tarea' : 'Solo visible para profesores'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToStudents(!showToStudents)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  showToStudents ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                data-testid="task-visibility-toggle"
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  showToStudents ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
          
          {/* Description - Rich Text Editor */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Instrucciones
            </label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe las instrucciones y requisitos de la tarea..."
            />
          </div>
          
          {/* File Attachment */}
          <div className="mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adjuntar material <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            
            {/* Google Drive Status Banner */}
            {file && shouldUseGoogleDrive(file) && !driveStatus.connected && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-start gap-2">
                <HardDrive className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Google Drive no conectado</p>
                  <p className="text-xs mt-0.5">Para adjuntar este tipo de archivo, el propietario debe conectar Google Drive desde Ajustes.</p>
                </div>
              </div>
            )}
            
            {file && shouldUseGoogleDrive(file) && driveStatus.connected && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 flex-shrink-0" />
                <span>Este archivo se guardará en Google Drive</span>
              </div>
            )}
            
            {file ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <FileIconComponent className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  onClick={() => setFile(null)} 
                  className="w-8 h-8 bg-slate-200 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group">
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-amber-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-amber-700">Arrastra o haz clic para subir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, PowerPoint hasta 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
              </label>
            )}
          </div>
          
          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-amber-700">Subiendo archivo...</span>
                <span className="font-bold text-amber-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !dueDate}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
            data-testid="submit-task-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Crear Tarea
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT TASK MODAL - Modal for editing existing tasks
// ══════════════════════════════════════════════════════════════════════════════
function EditTaskModal({ isOpen, onClose, task, token, onTaskUpdated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("text");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [showToStudents, setShowToStudents] = useState(true);
  const [points, setPoints] = useState("");
  const [file, setFile] = useState(null);
  const [existingFile, setExistingFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Populate form with task data when modal opens
  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title || "");
      setDescription(task.content || "");
      
      // Extract delivery type from content or metadata
      const deliveryTypeFromMetadata = task.metadata?.delivery_type;
      if (deliveryTypeFromMetadata) {
        setDeliveryType(deliveryTypeFromMetadata);
      } else if (task.content?.includes("Texto y archivos")) {
        setDeliveryType("both");
      } else if (task.content?.includes("Archivos")) {
        setDeliveryType("files");
      } else {
        setDeliveryType("text");
      }
      
      // Extract due date and time
      const dueDateValue = task.metadata?.due_date || task.due_date;
      if (dueDateValue) {
        const dateObj = new Date(dueDateValue);
        if (!isNaN(dateObj.getTime())) {
          // Get date parts in Peru timezone to avoid UTC conversion issues
          const peruDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/Lima' }));
          const year = peruDate.getFullYear();
          const month = (peruDate.getMonth() + 1).toString().padStart(2, '0');
          const day = peruDate.getDate().toString().padStart(2, '0');
          setDueDate(`${year}-${month}-${day}`);
          
          const hours = peruDate.getHours().toString().padStart(2, '0');
          const minutes = peruDate.getMinutes().toString().padStart(2, '0');
          setDueTime(`${hours}:${minutes}`);
        }
      }
      
      // Extract visibility
      setShowToStudents(task.metadata?.show_to_students !== false);
      
      // Extract points
      const pointsValue = task.metadata?.points;
      setPoints(pointsValue ? String(pointsValue) : "");
      
      // Extract existing file
      if (task.file_url) {
        setExistingFile({
          url: task.file_url,
          name: task.file_name || "Archivo adjunto",
          type: task.file_type
        });
      } else {
        setExistingFile(null);
      }
      
      setFile(null);
      setError("");
    }
  }, [isOpen, task]);
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('El archivo no debe superar 25MB');
      return;
    }
    
    setFile(selectedFile);
    setExistingFile(null);
    setError("");
  };
  
  const uploadToCloudinary = async (fileToUpload, folder, isRawFile = false) => {
    // Determine resource type based on file extension
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase();
    const rawExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv'];
    const shouldUseRaw = isRawFile || rawExtensions.includes(fileExtension) || !fileToUpload.type.startsWith('image/');
    const resourceType = shouldUseRaw ? 'raw' : 'image';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    const uploadEndpoint = resourceType;
    
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
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    
    if (!dueDate) {
      setError("La fecha de entrega es requerida");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let fileUrl = existingFile?.url || null;
      let fileName = existingFile?.name || null;
      let fileType = existingFile?.type || null;
      
      // Upload new file if selected
      if (file) {
        const isRawFile = !file.type.startsWith('image/');
        fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
      }
      
      // Combine date and time - store in ISO format with Peru timezone offset
      // Peru is UTC-5, so we append that offset to ensure consistent parsing
      // Handle both "HH:MM" and "HH:MM:SS" formats
      const timeParts = dueTime.split(':');
      const timeWithSeconds = timeParts.length === 2 ? `${dueTime}:00` : dueTime;
      const dueDateTime = `${dueDate}T${timeWithSeconds}-05:00`;
      
      // Build content with delivery type info
      const deliveryTypeLabel = deliveryType === 'text' ? 'Texto en línea' : deliveryType === 'files' ? 'Archivos' : 'Texto y archivos';
      const content = `Tipo de entrega: ${deliveryTypeLabel}${points ? ` | Puntos: ${points}` : ''}${!showToStudents ? ' | (Oculto para estudiantes)' : ''}\n\nFecha de entrega: ${new Date(dueDateTime).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}`;
      
      const updateData = {
        title: title.trim(),
        content: content,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        metadata: {
          delivery_type: deliveryType,
          due_date: dueDateTime,
          show_to_students: showToStudents,
          points: points ? parseInt(points) : null
        }
      };
      
      const res = await axios.put(`${API}/course/posts/${task.id}`, updateData, { headers });
      
      // Build the updated task with the new data
      // Ensure metadata.due_date is correctly set for the UI to display
      const updatedTask = {
        ...task,
        title: title.trim(),
        content: content,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        metadata: {
          ...(task.metadata || {}),
          delivery_type: deliveryType,
          due_date: dueDateTime,
          show_to_students: showToStudents,
          points: points ? parseInt(points) : null
        },
        updated_at: new Date().toISOString()
      };
      
      // If the API returns the updated post, merge with our local updates
      // This ensures metadata is always present
      if (res.data.post) {
        const serverPost = res.data.post;
        const finalTask = {
          ...serverPost,
          metadata: {
            ...(serverPost.metadata || {}),
            delivery_type: deliveryType,
            due_date: dueDateTime,
            show_to_students: showToStudents,
            points: points ? parseInt(points) : null
          }
        };
        await onTaskUpdated(finalTask);
      } else {
        await onTaskUpdated(updatedTask);
      }
      
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar la tarea');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen || !task) return null;
  
  // Get file extension icon
  const getFileIcon = (fileName) => {
    if (!fileName) return FileIcon;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return FileIcon;
    if (['doc', 'docx'].includes(ext)) return FileIcon;
    if (['xls', 'xlsx'].includes(ext)) return FileIcon;
    if (['ppt', 'pptx'].includes(ext)) return FileIcon;
    return FileIcon;
  };
  
  const FileIconComponent = file ? getFileIcon(file.name) : existingFile ? getFileIcon(existingFile.name) : FileIcon;
  
  // Calculate min date (today)
  const today = new Date().toISOString().split('T')[0];
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Premium gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRoLTEydjJoMTJ2LTJ6bTAtNGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <Edit2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Editar Tarea</h2>
                <p className="text-sm text-white/80">Modifica los detalles de la tarea</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto custom-scroll">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título de la tarea <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Análisis del capítulo 5"
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
              data-testid="edit-task-title-input"
            />
          </div>
          
          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha de entrega <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                  data-testid="edit-task-date-input"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <TaskTimePicker
                value={dueTime}
                onChange={setDueTime}
                label="Hora límite"
              />
            </div>
          </div>
          
          {/* Delivery Type */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Tipo de entrega
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'text', label: 'Texto en línea', icon: Type, desc: 'Respuesta escrita' },
                { id: 'files', label: 'Archivos', icon: Upload, desc: 'Subir documentos' },
                { id: 'both', label: 'Ambos', icon: Layers, desc: 'Texto y archivos' }
              ].map((type) => {
                const TypeIcon = type.icon;
                const isSelected = deliveryType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDeliveryType(type.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    data-testid={`edit-delivery-type-${type.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>
                      {type.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{type.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Points (Optional) */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Puntos <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative w-32">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
                min="0"
                max="1000"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                data-testid="edit-task-points-input"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">pts</span>
            </div>
          </div>
          
          {/* Visibility Toggle */}
          <div className="mb-5 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showToStudents ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  {showToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mostrar a estudiantes</p>
                  <p className="text-xs text-slate-400">
                    {showToStudents ? 'Los estudiantes podrán ver esta tarea' : 'Solo visible para profesores'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToStudents(!showToStudents)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  showToStudents ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                data-testid="edit-task-visibility-toggle"
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  showToStudents ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
          
          {/* File Attachment */}
          <div className="mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adjuntar material <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            
            {(file || existingFile) ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <FileIconComponent className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 truncate">{file?.name || existingFile?.name}</p>
                  <p className="text-xs text-slate-400">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Archivo existente'}
                  </p>
                </div>
                <button 
                  onClick={() => { setFile(null); setExistingFile(null); }} 
                  className="w-8 h-8 bg-slate-200 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group">
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-amber-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-amber-700">Arrastra o haz clic para subir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, PowerPoint hasta 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
              </label>
            )}
          </div>
          
          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-amber-700">Subiendo archivo...</span>
                <span className="font-bold text-amber-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !dueDate}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
            data-testid="submit-edit-task-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM FORUM MODAL - Beautiful forum topic creation experience
// ══════════════════════════════════════════════════════════════════════════════
function PremiumForumModal({ isOpen, onClose, subjectId, token, user, onPostCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showToStudents, setShowToStudents] = useState(true);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  
  // Google Drive state
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Check Google Drive status on mount
  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const res = await axios.get(`${API}/integrations/google-drive/status`, { headers });
        setDriveStatus(res.data);
      } catch (err) {
        console.error('Error checking Drive status:', err);
      }
    };
    checkDriveStatus();
  }, [token]);
  
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setShowToStudents(true);
      setFile(null);
      setError("");
      setUploadProgress(0);
    }
  }, [isOpen]);
  
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
    // Determine resource type based on file extension
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase();
    const rawExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv'];
    const shouldUseRaw = isRawFile || rawExtensions.includes(fileExtension) || !fileToUpload.type.startsWith('image/');
    const resourceType = shouldUseRaw ? 'raw' : 'image';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    const uploadEndpoint = resourceType;
    
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
  
  // Upload to Google Drive (file-only, no database record)
  const uploadToGoogleDrive = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('subject_id', subjectId);
    
    const res = await axios.post(`${API}/files/upload-to-drive`, formData, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      }
    });
    
    return res.data;
  };
  
  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("El título del tema es requerido");
      return;
    }
    
    if (!description.trim()) {
      setError("La descripción del tema es requerida");
      return;
    }
    
    // Check if file needs Google Drive but Drive is not connected
    if (file && shouldUseGoogleDrive(file) && !driveStatus.connected) {
      setError("Para adjuntar documentos (PDF, Word, Excel, etc.) debes conectar Google Drive desde Ajustes.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      let driveFileId = null;
      let storageType = null;
      
      if (file) {
        // Determine if file should go to Google Drive or Cloudinary
        if (shouldUseGoogleDrive(file)) {
          // Upload to Google Drive
          const driveRes = await uploadToGoogleDrive(file);
          driveFileId = driveRes.drive_file_id;
          fileName = driveRes.drive_file_name || file.name;
          fileType = file.type || 'application/octet-stream';
          storageType = 'google_drive';
        } else {
          // Upload images to Cloudinary
          const isRawFile = !file.type.startsWith('image/');
          fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
          fileName = file.name;
          fileType = file.type || 'application/octet-stream';
          storageType = 'cloudinary';
        }
      }
      
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: title.trim(),
        content: description.trim(),
        post_type: "forum",
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        drive_file_id: driveFileId,
        storage_type: storageType,
        file_type: fileType,
        metadata: {
          show_to_students: showToStudents
        }
      }, { headers });
      
      onPostCreated(res.data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el tema');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen) return null;
  
  const getFileIcon = (fileName) => {
    if (!fileName) return FileIcon;
    return FileIcon;
  };
  
  const FileIconComponent = file ? getFileIcon(file.name) : FileIcon;
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Premium gradient emerald/teal */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRoLTEydjJoMTJ2LTJ6bTAtNGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nuevo Tema</h2>
                <p className="text-sm text-white/80">Inicia una discusión con la clase</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título del tema <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Debate sobre el cambio climático"
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
              data-testid="forum-title-input"
            />
          </div>
          
          {/* Visibility Toggle */}
          <div className="mb-5 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showToStudents ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  {showToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mostrar a estudiantes</p>
                  <p className="text-xs text-slate-400">
                    {showToStudents ? 'Los estudiantes podrán ver y participar' : 'Solo visible para profesores'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToStudents(!showToStudents)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  showToStudents ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                data-testid="forum-visibility-toggle"
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  showToStudents ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
          
          {/* Description - Rich Text Editor */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Descripción del tema <span className="text-red-500">*</span>
            </label>
            <RichTextEditorForum
              value={description}
              onChange={setDescription}
              placeholder="Describe el tema de discusión y las reglas de participación..."
            />
          </div>
          
          {/* File Attachment */}
          <div className="mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adjuntar material <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            
            {/* Google Drive Status Banner */}
            {file && shouldUseGoogleDrive(file) && !driveStatus.connected && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-start gap-2">
                <HardDrive className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Google Drive no conectado</p>
                  <p className="text-xs mt-0.5">Para adjuntar este tipo de archivo, el propietario debe conectar Google Drive desde Ajustes.</p>
                </div>
              </div>
            )}
            
            {file && shouldUseGoogleDrive(file) && driveStatus.connected && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 flex-shrink-0" />
                <span>Este archivo se guardará en Google Drive</span>
              </div>
            )}
            
            {file ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <FileIconComponent className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  onClick={() => setFile(null)} 
                  className="w-8 h-8 bg-slate-200 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-emerald-700">Arrastra o haz clic para subir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, imágenes hasta 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif"
                />
              </label>
            )}
          </div>
          
          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-emerald-700">Subiendo archivo...</span>
                <span className="font-bold text-emerald-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            data-testid="submit-forum-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5" />
                Crear Tema
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Rich Text Editor for Forum (emerald theme)
function RichTextEditorForum({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Highlight.configure({
        multicolor: true
      }),
      Link.configure({
        openOnClick: false
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Escribe aquí...'
      })
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-all ${
        active 
          ? 'bg-emerald-500 text-white' 
          : 'text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
      }`}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-300 mx-1" />
  );

  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 focus-within:border-emerald-400 transition-all bg-slate-50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-slate-100/80 border-b border-slate-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrita"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Cursiva"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Subrayado"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista con viñetas"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Cita"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL del enlace:');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          title="Enlace"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-3 min-h-[120px] max-h-[200px] overflow-y-auto bg-white focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
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
        
        {/* Content - Render HTML if present, otherwise plain text */}
        {post.content && (
          post.content.includes('<') && post.content.includes('>') ? (
            <div 
              className="text-gray-700 mb-4 prose prose-sm max-w-none [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_a]:text-blue-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          ) : (
            <p className="text-gray-700 mb-4 whitespace-pre-wrap">{post.content}</p>
          )
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
      
      {/* Create Post Modal - Use Premium modal for tasks and forum */}
      {postType === "task" ? (
        <PremiumTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          subjectId={subjectId}
          token={token}
          user={user}
          onPostCreated={handlePostCreated}
        />
      ) : postType === "forum" ? (
        <PremiumForumModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          subjectId={subjectId}
          token={token}
          user={user}
          onPostCreated={handlePostCreated}
        />
      ) : (
        <CreatePostModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          subjectId={subjectId}
          token={token}
          user={user}
          onPostCreated={handlePostCreated}
          postType={postType}
        />
      )}
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

// Time picker component with circular dial - supports hours, minutes and seconds
function TimePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(value ? parseInt(value.split(':')[0]) % 12 || 12 : 9);
  const [minutes, setMinutes] = useState(value ? parseInt(value.split(':')[1]) : 0);
  const [seconds, setSeconds] = useState(value && value.split(':')[2] ? parseInt(value.split(':')[2]) : 0);
  const [period, setPeriod] = useState(value && parseInt(value.split(':')[0]) >= 12 ? 'PM' : 'AM');
  const [selectingMode, setSelectingMode] = useState('hours'); // 'hours', 'minutes', 'seconds'
  const dialRef = useRef(null);
  
  useEffect(() => {
    if (value) {
      const parts = value.split(':');
      const h = parseInt(parts[0]) || 0;
      setHours(h % 12 || 12);
      setMinutes(parseInt(parts[1]) || 0);
      setSeconds(parseInt(parts[2]) || 0);
      setPeriod(h >= 12 ? 'PM' : 'AM');
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
    
    if (selectingMode === 'hours') {
      const hour = Math.round(angle / 30) % 12 || 12;
      setHours(hour);
    } else if (selectingMode === 'minutes') {
      const minute = Math.round(angle / 6) % 60;
      setMinutes(minute);
    } else {
      const second = Math.round(angle / 6) % 60;
      setSeconds(second);
    }
  };
  
  const confirmTime = () => {
    // Convert to 24h format
    let hour24 = hours;
    if (period === 'AM' && hours === 12) {
      hour24 = 0;
    } else if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12;
    }
    const timeStr = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };
  
  const goNext = () => {
    if (selectingMode === 'hours') setSelectingMode('minutes');
    else if (selectingMode === 'minutes') setSelectingMode('seconds');
  };
  
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteSecondNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  // Get current dial numbers and selected value
  const currentNumbers = selectingMode === 'hours' ? hourNumbers : minuteSecondNumbers;
  const currentValue = selectingMode === 'hours' ? hours : selectingMode === 'minutes' ? minutes : seconds;
  const currentAngle = selectingMode === 'hours' 
    ? (hours % 12) * 30 
    : selectingMode === 'minutes' 
      ? minutes * 6 
      : seconds * 6;
  
  // Format display with AM/PM
  const displayHour = value ? (parseInt(value.split(':')[0]) % 12 || 12) : 9;
  const displayPeriod = value && parseInt(value.split(':')[0]) >= 12 ? 'PM' : 'AM';
  const displayTime = value 
    ? `${displayHour.toString().padStart(2, '0')}:${value.split(':')[1]}:${value.split(':')[2] || '00'} ${displayPeriod}`
    : "09:00:00 AM";
  
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
          {displayTime}
        </span>
      </button>
      
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-[340px]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
              <p className="text-indigo-200 text-sm mb-1">Seleccionar hora</p>
              <div className="flex items-center gap-3 justify-center">
                <div className="flex items-baseline gap-1">
                  <button
                    onClick={() => setSelectingMode('hours')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'hours' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {hours.toString().padStart(2, '0')}
                  </button>
                  <span className="text-4xl font-light text-white/50">:</span>
                  <button
                    onClick={() => setSelectingMode('minutes')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'minutes' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {minutes.toString().padStart(2, '0')}
                  </button>
                  <span className="text-4xl font-light text-white/50">:</span>
                  <button
                    onClick={() => setSelectingMode('seconds')}
                    className={`text-4xl font-light transition-all ${selectingMode === 'seconds' ? 'text-white scale-110' : 'text-white/50'}`}
                  >
                    {seconds.toString().padStart(2, '0')}
                  </button>
                </div>
                {/* AM/PM Selector */}
                <div className="flex flex-col gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setPeriod('AM')}
                    className={`px-2 py-0.5 rounded text-sm font-bold transition-all ${period === 'AM' ? 'bg-white text-indigo-600' : 'text-white/50 hover:text-white/80'}`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('PM')}
                    className={`px-2 py-0.5 rounded text-sm font-bold transition-all ${period === 'PM' ? 'bg-white text-indigo-600' : 'text-white/50 hover:text-white/80'}`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
            
            {/* Clock Dial */}
            <div className="p-6">
              <div 
                ref={dialRef}
                onClick={handleDialClick}
                className="relative w-[240px] h-[240px] mx-auto rounded-full bg-gray-100 cursor-pointer"
              >
                {/* Hand line - from center pointing outward */}
                <div 
                  className="absolute z-5"
                  style={{
                    width: '2px',
                    height: '80px',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-1px',
                    marginTop: '-80px',
                    background: 'linear-gradient(to bottom, #4f46e5, #7c3aed)',
                    transformOrigin: 'bottom center',
                    transform: `rotate(${currentAngle}deg)`,
                    borderRadius: '2px'
                  }}
                />
                
                {/* Tip circle at the end of hand */}
                <div 
                  className="absolute w-10 h-10 rounded-full bg-indigo-600 z-5 shadow-lg flex items-center justify-center"
                  style={{
                    left: `calc(50% + ${80 * Math.sin(currentAngle * Math.PI / 180)}px)`,
                    top: `calc(50% - ${80 * Math.cos(currentAngle * Math.PI / 180)}px)`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {selectingMode === 'hours' 
                      ? (hours === 0 ? 12 : hours > 12 ? hours - 12 : hours) 
                      : currentValue.toString().padStart(2, '0')
                    }
                  </span>
                </div>
                
                {/* Center dot - on top of everything */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full z-20 shadow-lg" />
                
                {/* Numbers */}
                {currentNumbers.map((num, idx) => {
                  const angle = (idx * 30 - 90) * (Math.PI / 180);
                  const radius = 90;
                  const x = 120 + radius * Math.cos(angle);
                  const y = 120 + radius * Math.sin(angle);
                  const isSelected = selectingMode === 'hours' 
                    ? (num === hours || (num === 12 && hours === 0))
                    : num === currentValue;
                  
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectingMode === 'hours') {
                          setHours(num);
                        } else if (selectingMode === 'minutes') {
                          setMinutes(num);
                        } else {
                          setSeconds(num);
                        }
                      }}
                      className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        isSelected 
                          ? 'text-transparent' 
                          : 'hover:bg-indigo-100 text-gray-700'
                      }`}
                      style={{ left: x, top: y }}
                    >
                      {selectingMode === 'hours' ? num : num.toString().padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
              
              {/* Mode indicator */}
              <div className="flex justify-center mt-4 gap-2">
                <button
                  onClick={() => setSelectingMode('hours')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'hours' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Horas
                </button>
                <button
                  onClick={() => setSelectingMode('minutes')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'minutes' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Minutos
                </button>
                <button
                  onClick={() => setSelectingMode('seconds')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'seconds' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Segundos
                </button>
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
                onClick={goNext}
                className={`px-5 py-2.5 font-medium rounded-xl transition-all ${selectingMode !== 'seconds' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'hidden'}`}
              >
                Siguiente
              </button>
              <button
                onClick={confirmTime}
                className={`px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors ${selectingMode === 'seconds' ? '' : 'hidden'}`}
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
  const [startTime, setStartTime] = useState("09:00:00");
  const [endTime, setEndTime] = useState("11:00:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minScore, setMinScore] = useState(55); // 55% = 11 de 20 en sistema peruano
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (exam) {
      setTitle(exam.title || "");
      setDescription(exam.description || "");
      if (exam.start_datetime) {
        const startDt = new Date(exam.start_datetime);
        // Use local date components to avoid timezone issues
        const year = startDt.getFullYear();
        const month = String(startDt.getMonth() + 1).padStart(2, '0');
        const day = String(startDt.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        setStartTime(`${startDt.getHours().toString().padStart(2, '0')}:${startDt.getMinutes().toString().padStart(2, '0')}`);
      }
      if (exam.end_datetime) {
        const endDt = new Date(exam.end_datetime);
        setEndTime(`${endDt.getHours().toString().padStart(2, '0')}:${endDt.getMinutes().toString().padStart(2, '0')}`);
      }
      setDurationMinutes(exam.duration_minutes || 60);
      setMinScore(exam.min_score_percentage || 60);
    } else {
      setTitle("");
      setDescription("");
      setDate("");
      setStartTime("09:00:00");
      setEndTime("11:00:00");
      setDurationMinutes(60);
      setMinScore(55); // 55% = 11 de 20 en sistema peruano
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
    if (!durationMinutes || durationMinutes < 1) {
      setError("La duración debe ser al menos 1 minuto");
      return;
    }
    
    // Combine date and time (time already includes seconds as HH:MM:SS)
    const startDatetime = new Date(`${date}T${startTime}`).toISOString();
    const endDatetime = new Date(`${date}T${endTime}`).toISOString();
    
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
        duration_minutes: parseInt(durationMinutes),
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 flex-shrink-0">
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
        
        {/* Form with scroll */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
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
          
          {/* Availability window explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">📅 Ventana de disponibilidad</p>
            <p className="text-xs text-blue-600">
              Define cuándo los estudiantes pueden <strong>iniciar</strong> el examen. 
              Una vez iniciado, tendrán el tiempo de "duración" para completarlo.
            </p>
          </div>
          
          {/* Time pickers */}
          <div className="grid grid-cols-2 gap-4">
            <TimePicker 
              label="Disponible desde *"
              value={startTime}
              onChange={setStartTime}
            />
            <TimePicker 
              label="Disponible hasta *"
              value={endTime}
              onChange={setEndTime}
            />
          </div>
          
          {/* Duration */}
          {(() => {
            // Calculate max duration based on availability window
            const parseTime = (timeStr) => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              return hours * 60 + minutes;
            };
            const startMins = parseTime(startTime);
            const endMins = parseTime(endTime);
            const windowMinutes = endMins > startMins ? endMins - startMins : 0;
            const currentDuration = parseInt(durationMinutes) || 0;
            const isOverWindow = windowMinutes > 0 && currentDuration > windowMinutes;
            
            return (
              <div className={`rounded-xl p-4 ${isOverWindow ? 'bg-red-50 border border-red-300' : 'bg-amber-50 border border-amber-200'}`}>
                <label className={`block text-sm font-semibold mb-2 ${isOverWindow ? 'text-red-800' : 'text-amber-800'}`}>
                  ⏱️ Duración del examen (minutos) *
                  {windowMinutes > 0 && (
                    <span className="font-normal text-xs ml-2">
                      (máx. {windowMinutes} min según ventana)
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={windowMinutes > 0 ? windowMinutes : 300}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className={`w-20 px-3 py-2 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-center ${
                      isOverWindow 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-amber-200 focus:ring-amber-500'
                    }`}
                    required
                  />
                  <div className="flex gap-1">
                    {[30, 45, 60, 90, 120].filter(m => windowMinutes <= 0 || m <= windowMinutes).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          parseInt(durationMinutes) === mins
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
                {isOverWindow ? (
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    ⚠️ La duración ({currentDuration} min) excede la ventana de disponibilidad ({windowMinutes} min). 
                    El estudiante solo tendrá {windowMinutes} minutos reales.
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-2">
                    Tiempo máximo para <strong>completar</strong> el examen. 
                    Si un estudiante inicia cerca del cierre, tendrá menos tiempo.
                  </p>
                )}
              </div>
            );
          })()}
          
          {/* Min Score */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nota mínima aprobatoria (0-20)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="20"
                value={Math.round(minScore * 20 / 100)}
                onChange={(e) => setMinScore(Math.round(parseInt(e.target.value) * 100 / 20))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <span className="w-16 px-3 py-2 bg-purple-100 text-purple-700 font-bold rounded-lg text-center">
                {Math.round(minScore * 20 / 100)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              En Perú: 0-10 desaprobado, 11-20 aprobado. Valor por defecto: 11
            </p>
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
// Question Form Modal with Image Upload
function QuestionFormModal({ isOpen, onClose, onSave, question, token }) {
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
  
  // Image states
  const [imageUrl, setImageUrl] = useState("");
  const [showImageCrop, setShowImageCrop] = useState(false);
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Helper function for center crop
  const centerAspectCrop = (mediaWidth, mediaHeight, aspect) => {
    return centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        aspect,
        mediaWidth,
        mediaHeight
      ),
      mediaWidth,
      mediaHeight
    );
  };
  
  useEffect(() => {
    if (question) {
      setQuestionType(question.question_type || "multiple_choice");
      setQuestionText(question.question_text || "");
      setPoints(question.points || 1);
      if (question.options) {
        setOptions(question.options);
      }
      setCorrectAnswer(question.correct_answer || "");
      setImageUrl(question.image_url || "");
    } else {
      setQuestionType("multiple_choice");
      setQuestionText("");
      setPoints(1);
      setOptions([
        { id: "1", text: "", is_correct: false },
        { id: "2", text: "", is_correct: false }
      ]);
      setCorrectAnswer("");
      setImageUrl("");
    }
    setError("");
    setImageSrc("");
    setShowImageCrop(false);
    setScale(1);
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
          return { ...o, is_correct: true };
        }
        return { ...o, [field]: value };
      }
      if (field === "is_correct" && value === true) {
        return { ...o, is_correct: false };
      }
      return o;
    }));
  };
  
  // Image handling functions
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError("Por favor selecciona una imagen válida");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setShowImageCrop(true);
      setScale(1);
    };
    reader.readAsDataURL(file);
  };
  
  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };
  
  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return null;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const outputSize = 600; // Square output
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    const scaledCropWidth = cropWidth / scale;
    const scaledCropHeight = cropHeight / scale;
    const offsetX = (cropWidth - scaledCropWidth) / 2;
    const offsetY = (cropHeight - scaledCropHeight) / 2;
    
    ctx.drawImage(image, cropX + offsetX, cropY + offsetY, scaledCropWidth, scaledCropHeight, 0, 0, outputSize, outputSize);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], 'question-image.webp', { type: 'image/webp' }));
        else resolve(null);
      }, 'image/webp', 0.8);
    });
  }, [completedCrop, scale]);
  
  const uploadToCloudinary = async (file) => {
    const signatureRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/exam-questions&resource_type=image`, { headers });
    const { signature, timestamp, cloud_name, api_key, folder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', folder);
    
    const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, formData, {
      onUploadProgress: (progressEvent) => setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
    });
    return uploadRes.data.secure_url;
  };
  
  const handleCropConfirm = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const croppedFile = await getCroppedImg();
      if (croppedFile) {
        const url = await uploadToCloudinary(croppedFile);
        setImageUrl(url);
        setShowImageCrop(false);
        setImageSrc("");
      }
    } catch (err) {
      setError("Error al subir la imagen");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };
  
  const handleRemoveImage = async () => {
    if (question?.id && imageUrl) {
      try {
        await axios.delete(`${API}/exams/questions/${question.id}/image`, { headers });
      } catch (err) {
        console.error("Error removing image:", err);
      }
    }
    setImageUrl("");
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!questionText.trim()) {
      setError("La pregunta es requerida");
      return;
    }
    
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
        correct_answer: questionType !== "multiple_choice" ? correctAnswer : null,
        image_url: imageUrl || null
      };
      
      await onSave(data, question?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };
  
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
  
  // Image Crop Modal
  if (showImageCrop) {
    return createPortal(
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowImageCrop(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Recortar imagen (cuadrado)
            </h3>
          </div>
          <div className="p-4">
            <div className="relative bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                className="max-h-[350px]"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop"
                  onLoad={onImageLoad}
                  style={{ transform: `scale(${scale})`, maxHeight: '350px' }}
                />
              </ReactCrop>
            </div>
            
            {/* Zoom control */}
            <div className="flex items-center gap-3 mt-4 px-2">
              <ZoomOut className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <ZoomIn className="w-4 h-4 text-gray-500" />
            </div>
            
            {uploading && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">Subiendo... {uploadProgress}%</p>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => { setShowImageCrop(false); setImageSrc(""); }}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              onClick={handleCropConfirm}
              disabled={uploading || !completedCrop}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {uploading ? "Subiendo..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }
  
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
          
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-500" />
              Imagen de la Pregunta
            </label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img 
                  src={imageUrl} 
                  alt="Pregunta" 
                  className="w-40 h-40 object-cover rounded-xl border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                    <Upload className="w-8 h-8 text-indigo-500" />
                  </div>
                  <span className="text-lg font-semibold text-gray-600">Subir imagen</span>
                  <span className="text-sm text-gray-400">PNG, JPG, WEBP (máx. 10MB)</span>
                </button>
              </div>
            )}
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
    <div className="space-y-6 pb-40">
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
                          <div className="flex items-start gap-3">
                            {q.image_url && (
                              <img 
                                src={q.image_url} 
                                alt="" 
                                className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                              />
                            )}
                            <div className="flex-1 min-w-0">
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
                            </div>
                          </div>
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
        token={token}
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
    <div className="space-y-6 pb-40">
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
// GRADES TAB CONTENT
// ══════════════════════════════════════════════════════════════════════════════
function GradesContent({ grades }) {
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Calificaciones</h2>
          <div className="w-8 h-1 bg-indigo-500 rounded-full mt-2"></div>
        </div>
      </div>
      
      {grades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin calificaciones</h3>
          <p className="text-slate-400">Aún no hay calificaciones registradas para este curso.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-white uppercase tracking-wider">
              <div className="col-span-4">Estudiante</div>
              <div className="col-span-2 text-center">Tarea 1</div>
              <div className="col-span-2 text-center">Tarea 2</div>
              <div className="col-span-2 text-center">Examen</div>
              <div className="col-span-2 text-center">Promedio</div>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-slate-100">
            {grades.map((student, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                {/* Student */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {student.name?.charAt(0)}
                  </div>
                  <span className="font-medium text-slate-800">{student.name}</span>
                </div>
                
                {/* Grades */}
                <div className="col-span-2 text-center font-medium text-slate-600">{student.task1 || "-"}</div>
                <div className="col-span-2 text-center font-medium text-slate-600">{student.task2 || "-"}</div>
                <div className="col-span-2 text-center font-medium text-slate-600">{student.exam || "-"}</div>
                
                {/* Average */}
                <div className="col-span-2 text-center">
                  <span className={`px-3 py-1.5 rounded-full font-bold text-sm ${
                    student.average >= 15 ? "bg-emerald-100 text-emerald-700" :
                    student.average >= 11 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {student.average || "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORUM FILE DOWNLOAD BUTTON - Reusable download button for forum attachments
// ══════════════════════════════════════════════════════════════════════════════
function ForumFileDownloadButton({ post, token }) {
  const [downloading, setDownloading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Check if file is stored in Google Drive
      if (post.storage_type === 'google_drive' || post.drive_file_id) {
        // Download through backend (secure streaming)
        const response = await axios.get(`${API}/materials/download/${post.id}`, {
          headers,
          responseType: 'blob'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', post.file_name || post.drive_file_name || 'archivo');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        return;
      }
      
      // For Cloudinary or direct URLs
      if (post.file_url) {
        window.open(post.file_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Error al descargar el archivo. Por favor intenta de nuevo.');
    } finally {
      setDownloading(false);
    }
  };
  
  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
    >
      {downloading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Descargando...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Descargar
        </>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORUM CONTENT - Table view with detail view
// ══════════════════════════════════════════════════════════════════════════════
function ForumContent({ subjectId, token, user, students }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Fetch forum topics
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await axios.get(`${API}/course/${subjectId}/posts?post_type=forum&limit=100`, { headers });
        setTopics(res.data.posts || []);
      } catch (err) {
        console.error('Error fetching forum topics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, [subjectId, token]);
  
  // Load comments when topic is selected
  useEffect(() => {
    if (selectedTopic) {
      loadComments(selectedTopic.id);
    }
  }, [selectedTopic]);
  
  const loadComments = async (topicId) => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/course/posts/${topicId}/comments`, { headers });
      setComments(res.data || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handlePostCreated = (newTopic) => {
    setTopics([newTopic, ...topics]);
  };
  
  const handleDeleteClick = (topic) => {
    setTopicToDelete(topic);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!topicToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${topicToDelete.id}`, { headers });
      setTopics(topics.filter(t => t.id !== topicToDelete.id));
      setShowDeleteModal(false);
      setTopicToDelete(null);
      if (selectedTopic?.id === topicToDelete.id) {
        setSelectedTopic(null);
      }
    } catch (err) {
      console.error('Error deleting topic:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleSubmitComment = async () => {
    if (!newMessage.trim() || !selectedTopic || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await axios.post(`${API}/course/posts/${selectedTopic.id}/comments`, {
        content: newMessage.trim()
      }, { headers });
      setComments([...comments, res.data]);
      setNewMessage("");
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = months[date.getMonth()];
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${day} ${month}. ${hour12}:${minutes}${ampm}`;
  };
  
  // Detail View
  if (selectedTopic) {
    return (
      <div className="space-y-4 pt-6 pb-48">
        {/* Back button */}
        <button
          onClick={() => setSelectedTopic(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al listado
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Topic Header */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Header bar */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <span className="text-white/80 text-sm font-medium">Autor</span>
                  <span className="text-white text-sm font-medium">Tema</span>
                </div>
                <span className="text-white/80 text-sm">{formatDate(selectedTopic.created_at)}</span>
              </div>
              
              {/* Content */}
              <div className="p-6 flex gap-6">
                {/* Author sidebar */}
                <div className="flex flex-col items-center min-w-[120px]">
                  {(selectedTopic.author?.photo_url || selectedTopic.author?.profile_pic) ? (
                    <img 
                      src={selectedTopic.author.photo_url || selectedTopic.author.profile_pic} 
                      alt={selectedTopic.author?.name || 'Usuario'}
                      className="w-16 h-16 rounded-full object-cover shadow-lg mb-2"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-2">
                      {selectedTopic.author?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <p className="font-semibold text-slate-800 text-center text-sm">
                    {selectedTopic.author?.name || 'Usuario'}
                  </p>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium mt-1">
                    {selectedTopic.author?.role === 'admin' ? 'Administrador' : 'Docente'}
                  </span>
                </div>
                
                {/* Topic content */}
                <div className="flex-1 border-l border-slate-200 pl-6">
                  <h2 className="text-xl font-bold text-slate-800 mb-4">{selectedTopic.title}</h2>
                  {selectedTopic.content && (
                    selectedTopic.content.includes('<') && selectedTopic.content.includes('>') ? (
                      <div 
                        className="prose prose-sm max-w-none text-slate-600 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4"
                        dangerouslySetInnerHTML={{ __html: selectedTopic.content }}
                      />
                    ) : (
                      <p className="text-slate-600 whitespace-pre-wrap">{selectedTopic.content}</p>
                    )
                  )}
                  
                  {/* File attachment */}
                  {(selectedTopic.drive_file_id || selectedTopic.file_url) && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {selectedTopic.file_name || selectedTopic.drive_file_name || 'Archivo adjunto'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedTopic.storage_type === 'google_drive' ? 'Google Drive' : 'Archivo'}
                          </p>
                        </div>
                        <ForumFileDownloadButton post={selectedTopic} token={token} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Comments Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                Respuestas ({comments.length})
              </h3>
              
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-slate-400 text-center py-6">No hay respuestas aún. ¡Sé el primero en participar!</p>
              ) : (
                <div className="space-y-4 mb-6">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                      {(comment.author?.photo_url || comment.author?.profile_pic) ? (
                        <img 
                          src={comment.author.photo_url || comment.author.profile_pic} 
                          alt={comment.author?.name || 'Usuario'}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {comment.author?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800 text-sm">{comment.author?.name || 'Usuario'}</span>
                          <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-slate-600 text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* New message input */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-200">
                {(user?.photo_url || user?.profile_pic) ? (
                  <img 
                    src={user.photo_url || user.profile_pic} 
                    alt={user?.name || 'Usuario'}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                    placeholder="Escribe tu mensaje..."
                    className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newMessage.trim() || submittingComment}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-medium transition-all flex items-center gap-2"
                  >
                    {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Students sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sticky top-[200px]">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Estudiantes
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {students && students.length > 0 ? (
                  students.map((student, idx) => (
                    <div key={student.id || idx} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {student.name?.charAt(0) || 'E'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{student.name}</p>
                        <p className="text-xs text-slate-400">Roll ID: {student.roll_id || student.id?.slice(0, 8)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No hay estudiantes matriculados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // List View (Table)
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Foro de Discusión</h2>
          <p className="text-slate-500 mt-1">Gestiona los temas de discusión del curso</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25"
          data-testid="create-forum-btn"
        >
          <Plus className="w-5 h-5" />
          Nuevo Tema
        </button>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
            <div className="col-span-2">Estado</div>
            <div className="col-span-6">Título</div>
            <div className="col-span-2">Fecha</div>
            <div className="col-span-2 text-center">Opciones</div>
          </div>
        </div>
        
        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : topics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay temas de discusión</h3>
              <p className="text-slate-400 mb-6">Crea el primer tema para iniciar el foro</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear primer tema
              </button>
            </div>
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                {/* Status */}
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Publicado
                  </span>
                </div>
                
                {/* Title */}
                <div className="col-span-6">
                  <p className="font-semibold text-slate-800 truncate">{topic.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    por {topic.author?.name || 'Usuario'}
                  </p>
                </div>
                
                {/* Date */}
                <div className="col-span-2">
                  <p className="text-sm text-slate-600">{formatDate(topic.created_at)}</p>
                </div>
                
                {/* Actions */}
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedTopic(topic)}
                    className="w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                    title="Ver tema"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {/* TODO: Edit */}}
                    className="w-9 h-9 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-lg flex items-center justify-center transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(topic)}
                    className="w-9 h-9 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Create Modal */}
      <PremiumForumModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        subjectId={subjectId}
        token={token}
        user={user}
        onPostCreated={handlePostCreated}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Eliminar tema</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar el tema "<strong>{topicToDelete?.title}</strong>"?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASKS TABLE CONTENT (New design similar to Forum)
// ══════════════════════════════════════════════════════════════════════════════
function TasksTableContent({ subjectId, token, user, students, subject, levelName, gradeName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'submissions'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [submissionStats, setSubmissionStats] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const menuRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Fetch tasks
  const fetchTasks = async () => {
    try {
      // Add cache-busting parameter
      const cacheBuster = new Date().getTime();
      const res = await axios.get(`${API}/course/${subjectId}/posts?post_type=task&limit=100&_t=${cacheBuster}`, { headers });
      const tasksFromServer = res.data.posts || [];
      setTasks(tasksFromServer);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTasks();
  }, [subjectId, token]);
  
  // Fetch archived tasks
  const fetchArchivedTasks = async () => {
    setLoadingArchived(true);
    try {
      const res = await axios.get(`${API}/course/${subjectId}/tasks/archived`, { headers });
      setArchivedTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Error fetching archived tasks:', err);
    } finally {
      setLoadingArchived(false);
    }
  };
  
  // Handle restoring an archived task
  const handleRestoreTask = async (taskId) => {
    try {
      await axios.post(`${API}/course/tasks/${taskId}/restore`, {}, { headers });
      // Remove from archived list and refresh active tasks
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
      fetchTasks();
    } catch (err) {
      console.error('Error restoring task:', err);
    }
  };
  
  // State for task submissions data from API
  const [taskSubmissionsData, setTaskSubmissionsData] = useState(null);
  
  // Load real submissions from API
  const loadSubmissions = async () => {
    if (!selectedTask) return;
    
    setLoadingSubmissions(true);
    try {
      const res = await axios.get(`${API}/course/tasks/${selectedTask.id}/submissions`, { headers });
      const data = res.data;
      
      // Store full submissions data
      setTaskSubmissionsData(data);
      
      // Map API response to component format
      const mappedSubmissions = data.submissions.map(sub => ({
        id: sub.id,
        student_id: sub.student_id,
        student: sub.student,
        comment: sub.text_content || '',
        status: sub.status === 'a_tiempo' ? 'A tiempo' : 'Tarde',
        file: sub.file_name,
        file_url: sub.file_url,
        drive_file_id: sub.drive_file_id,
        storage_type: sub.storage_type,
        teacherComment: sub.feedback || '',
        grade: sub.grade !== null ? sub.grade : ''
      }));
      
      setSubmissions(mappedSubmissions);
    } catch (err) {
      console.error('Error loading submissions:', err);
      setSubmissions([]);
      setTaskSubmissionsData(null);
    } finally {
      setLoadingSubmissions(false);
    }
  };
  
  const handleViewSubmissions = () => {
    setShowMenu(false);
    setViewMode('submissions');
    loadSubmissions();
  };
  
  const handleTaskCreated = (newTask) => {
    setTasks([newTask, ...tasks]);
  };
  
  const handleEditClick = (task) => {
    setTaskToEdit(task);
    setShowEditModal(true);
  };
  
  const handleTaskUpdated = async (updatedTask) => {
    // Force loading state to ensure re-render
    setLoading(true);
    
    // Clear current tasks to force re-render
    setTasks([]);
    
    // Small delay to ensure DB is updated
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Refetch from server to get the latest data
    await fetchTasks();
  };
  
  const handleDeleteClick = async (task) => {
    setTaskToDelete(task);
    setSubmissionStats(null);
    setShowDeleteModal(true);
    
    // Fetch submission stats for this task
    try {
      const res = await axios.get(`${API}/course/tasks/${task.id}/submission-stats`, { headers });
      setSubmissionStats(res.data);
    } catch (err) {
      console.error('Error fetching submission stats:', err);
      // Default to no submissions if endpoint fails
      setSubmissionStats({ submissions_count: 0, graded_count: 0, can_delete: true });
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${taskToDelete.id}`, { headers });
      setTasks(tasks.filter(t => t.id !== taskToDelete.id));
      setShowDeleteModal(false);
      setTaskToDelete(null);
      setSubmissionStats(null);
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      // Handle the case where task has submissions
      if (err.response?.data?.detail?.code === 'TASK_HAS_SUBMISSIONS') {
        // This shouldn't happen if UI is working correctly, but handle gracefully
        setSubmissionStats({
          submissions_count: err.response.data.detail.submissions_count,
          graded_count: err.response.data.detail.graded_count,
          can_delete: false
        });
      }
    } finally {
      setDeleting(false);
    }
  };
  
  const handleArchiveTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await axios.post(`${API}/course/tasks/${taskToDelete.id}/archive`, {}, { headers });
      setTasks(tasks.filter(t => t.id !== taskToDelete.id));
      setShowDeleteModal(false);
      setTaskToDelete(null);
      setSubmissionStats(null);
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Error archiving task:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    // Use Peru timezone explicitly
    return date.toLocaleDateString('es-PE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'America/Lima'
    });
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    // Use Peru timezone explicitly
    return date.toLocaleString('es-PE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Lima'
    });
  };
  
  const getDeliveryType = (content) => {
    if (!content) return 'Texto en línea';
    if (content.includes('Archivos')) return 'Archivos';
    if (content.includes('Texto y archivos')) return 'Texto y archivos';
    return 'Texto en línea';
  };
  
  const extractDueDate = (task) => {
    // Try to get due_date from task metadata FIRST (this is updated when editing)
    // then fall back to root level due_date
    if (task.metadata?.due_date) return task.metadata.due_date;
    if (task.due_date) return task.due_date;
    
    // Parse from content if needed - Spanish format: "14 de febrero de 2026, 11:00 p. m."
    if (task.content) {
      const spanishMatch = task.content.match(/Fecha de entrega:\s*(\d{1,2})\s*de\s*(\w+)\s*de\s*(\d{4}),?\s*(\d{1,2}):(\d{2})\s*(a\.\s*m\.|p\.\s*m\.)?/i);
      if (spanishMatch) {
        const months = {
          'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
          'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };
        const day = parseInt(spanishMatch[1]);
        const month = months[spanishMatch[2].toLowerCase()];
        const year = parseInt(spanishMatch[3]);
        let hour = parseInt(spanishMatch[4]);
        const minute = parseInt(spanishMatch[5]);
        const ampm = spanishMatch[6]?.toLowerCase().replace(/\s|\./g, '') || '';
        
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          const date = new Date(year, month, day, hour, minute);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
      }
    }
    return null;
  };
  
  // State for editing submissions
  const [editingGrades, setEditingGrades] = useState({});
  const [savingGrade, setSavingGrade] = useState(null);
  
  // State for premium notification modal
  const [notification, setNotification] = useState({ show: false, type: 'success', title: '', message: '' });
  
  // Show notification
  const showNotification = (type, title, message) => {
    setNotification({ show: true, type, title, message });
  };
  
  // Hide notification
  const hideNotification = () => {
    setNotification({ show: false, type: 'success', title: '', message: '' });
  };
  
  // Handle grade/feedback change
  const handleGradeChange = (submissionId, field, value) => {
    setEditingGrades(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: value
      }
    }));
  };
  
  // Save grade for a single submission
  const saveSubmissionGrade = async (submissionId) => {
    const edits = editingGrades[submissionId];
    if (!edits) return;
    
    setSavingGrade(submissionId);
    try {
      // Prepare grade value - handle empty strings and invalid numbers
      let gradeValue = null;
      if (edits.grade !== undefined && edits.grade !== '' && edits.grade !== null) {
        const parsed = parseFloat(edits.grade);
        if (!isNaN(parsed)) {
          gradeValue = parsed;
        }
      }
      
      await axios.put(
        `${API}/course/tasks/${selectedTask.id}/submissions/${submissionId}/grade`,
        {
          grade: gradeValue,
          feedback: edits.feedback && edits.feedback.trim() ? edits.feedback.trim() : null
        },
        { headers }
      );
      
      // Update local state
      setSubmissions(prev => prev.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            grade: gradeValue !== null ? gradeValue : sub.grade,
            teacherComment: edits.feedback !== undefined ? edits.feedback : sub.teacherComment
          };
        }
        return sub;
      }));
      
      // Clear editing state for this submission
      setEditingGrades(prev => {
        const next = { ...prev };
        delete next[submissionId];
        return next;
      });
      
      // Show success notification
      showNotification('success', '¡Calificación guardada!', 'La nota y comentario se han guardado correctamente.');
      
    } catch (err) {
      console.error('Error saving grade:', err);
      const errorMessage = err.response?.data?.detail || 'No se pudo guardar la calificación. Inténtalo de nuevo.';
      showNotification('error', 'Error al guardar', errorMessage);
    } finally {
      setSavingGrade(null);
    }
  };
  
  // State for downloading files
  const [downloadingFile, setDownloadingFile] = useState(null);
  
  // Download submission file
  const handleDownloadSubmissionFile = async (submission) => {
    setDownloadingFile(submission.id);
    try {
      if (submission.storage_type === 'google_drive' && submission.drive_file_id) {
        // Download from Google Drive via our backend
        const response = await axios.get(
          `${API}/course/tasks/${selectedTask.id}/submissions/${submission.id}/download`,
          { 
            headers,
            responseType: 'blob'
          }
        );
        
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = submission.file || 'archivo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (submission.file_url) {
        // Direct download for Cloudinary or other URLs
        window.open(submission.file_url, '_blank');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      showNotification('error', 'Error al descargar', 'No se pudo descargar el archivo. Inténtalo de nuevo.');
    } finally {
      setDownloadingFile(null);
    }
  };
  
  // Submissions View
  if (selectedTask && viewMode === 'submissions') {
    const maxGrade = taskSubmissionsData?.max_grade || selectedTask?.max_grade || selectedTask?.metadata?.points || 20;
    
    return (
      <div className="space-y-4 pt-6 pb-48">
        {/* Premium Notification Modal */}
        {notification.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={hideNotification}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header with gradient */}
              <div className={`px-6 py-4 ${
                notification.type === 'success' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                  : 'bg-gradient-to-r from-red-500 to-rose-500'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    {notification.type === 'success' ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <X className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white">{notification.title}</h3>
                </div>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5">
                <p className="text-slate-600">{notification.message}</p>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 flex justify-end">
                <button
                  onClick={hideNotification}
                  className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-lg ${
                    notification.type === 'success'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-500/25'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Back button */}
        <button
          onClick={() => { setViewMode('detail'); setEditingGrades({}); }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la tarea
        </button>
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Entregas</h2>
            <p className="text-slate-500 mt-1">{selectedTask.title}</p>
            {taskSubmissionsData && (
              <p className="text-sm text-slate-400 mt-1">
                {taskSubmissionsData.submissions_count} entregadas • {taskSubmissionsData.graded_count} calificadas • Nota máxima: {maxGrade}
              </p>
            )}
          </div>
        </div>
        
        {/* Submissions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Table Header - Teal color from reference image */}
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-4">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
              <div className="col-span-2">Estudiante</div>
              <div className="col-span-3">Comentario</div>
              <div className="col-span-1">Estado</div>
              <div className="col-span-2">Archivo</div>
              <div className="col-span-2">Feedback</div>
              <div className="col-span-2">Nota</div>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-slate-100">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay entregas</h3>
                <p className="text-slate-400">Ningún estudiante ha entregado esta tarea aún</p>
              </div>
            ) : (
              submissions.map((submission) => {
                const studentPhoto = submission.student?.photo_url;
                const currentGrade = editingGrades[submission.id]?.grade ?? submission.grade;
                const currentFeedback = editingGrades[submission.id]?.feedback ?? submission.teacherComment;
                const hasChanges = editingGrades[submission.id] !== undefined;
                
                return (
                  <div key={submission.id} className="grid grid-cols-12 gap-2 px-4 py-4 items-center hover:bg-slate-50 transition-colors">
                    {/* Student */}
                    <div className="col-span-2 flex items-center gap-2">
                      {studentPhoto ? (
                        <img 
                          src={studentPhoto} 
                          alt={submission.student?.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <span className="text-xs font-medium text-slate-700 truncate">{submission.student?.name}</span>
                    </div>
                    
                    {/* Student Comment */}
                    <div className="col-span-3">
                      <p className="text-xs text-slate-600 bg-slate-50 px-2 py-2 rounded-lg min-h-[36px] truncate">
                        {submission.comment || <span className="text-slate-400 italic">Sin comentario</span>}
                      </p>
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        submission.status === 'A tiempo' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {submission.status === 'A tiempo' ? 'A TIEMPO' : 'TARDE'}
                      </span>
                    </div>
                    
                    {/* File/Response */}
                    <div className="col-span-2">
                      {submission.file ? (
                        <button 
                          onClick={() => handleDownloadSubmissionFile(submission)}
                          disabled={downloadingFile === submission.id}
                          className="flex items-center gap-1 px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-70 disabled:cursor-wait whitespace-nowrap"
                        >
                          {downloadingFile === submission.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="hidden sm:inline">Cargando...</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3" />
                              VER ARCHIVO
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin archivo</span>
                      )}
                    </div>
                    
                    {/* Teacher Comment */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Comentario..."
                        value={currentFeedback}
                        onChange={(e) => handleGradeChange(submission.id, 'feedback', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    
                    {/* Grade */}
                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="--"
                        min="0"
                        max={maxGrade}
                        value={currentGrade}
                        onChange={(e) => handleGradeChange(submission.id, 'grade', e.target.value)}
                        className="w-12 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 text-center"
                      />
                      <span className="text-slate-400 text-xs">/{maxGrade}</span>
                      {hasChanges && (
                        <button
                          onClick={() => saveSubmissionGrade(submission.id)}
                          disabled={savingGrade === submission.id}
                          className="p-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
                          title="Guardar"
                        >
                          {savingGrade === submission.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Apply All Button (optional - saves all pending changes) */}
        {Object.keys(editingGrades).length > 0 && (
          <div className="flex justify-end">
            <button 
              onClick={async () => {
                for (const submissionId of Object.keys(editingGrades)) {
                  await saveSubmissionGrade(submissionId);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-teal-500/25"
            >
              Aplicar todas las calificaciones
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Detail View
  if (selectedTask) {
    const dueDate = extractDueDate(selectedTask);
    const totalStudents = students?.length || 0;
    const submitted = selectedTask.submissions_count || 0; // Get actual submission count from API
    const notSubmitted = totalStudents - submitted;
    
    // Get author photo - can be photo_url or profile_pic
    const authorPhoto = selectedTask.author?.photo_url || selectedTask.author?.profile_pic;
    
    return (
      <div className="space-y-4 pt-6 pb-48">
        {/* Back button */}
        <button
          onClick={() => setSelectedTask(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al listado
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - Left side */}
          <div className="lg:col-span-2 space-y-4">
            {/* Task content card - Professional Design */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Header with gradient - School-friendly blue */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6">
                <div className="flex items-start gap-4">
                  {/* Author photo */}
                  {authorPhoto ? (
                    <img 
                      src={authorPhoto} 
                      alt={selectedTask.author?.name || 'Usuario'}
                      className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                      <User className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{selectedTask.author?.name || 'Usuario'}</span>
                      <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">
                        Publicado
                      </span>
                    </div>
                    <p className="text-blue-100 text-sm">{levelName} • {gradeName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <PenTool className="w-5 h-5 text-white" />
                    </div>
                    {/* Three dots menu */}
                    <div className="relative" ref={menuRef}>
                      <button 
                        onClick={() => setShowMenu(!showMenu)}
                        className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-white" />
                      </button>
                      {/* Dropdown Menu */}
                      {showMenu && (
                        <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                          <button 
                            onClick={() => { setShowMenu(false); /* TODO: Open edit modal */ }}
                            className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">Editar</span>
                          </button>
                          <button 
                            onClick={handleViewSubmissions}
                            className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                          >
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">Entregas</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Content body */}
              <div className="p-6">
                {/* Title */}
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{selectedTask.title}</h2>
                
                {/* Description */}
                {selectedTask.content && (
                  <div className="mb-6 text-slate-600 leading-relaxed">
                    {selectedTask.content.includes('<') && selectedTask.content.includes('>') ? (
                      <div 
                        className="prose prose-slate max-w-none [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_strong]:text-slate-800 [&_li]:mb-1"
                        dangerouslySetInnerHTML={{ __html: selectedTask.content.split('\n\n')[0] }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{selectedTask.content.split('\n\n')[0]}</p>
                    )}
                  </div>
                )}
                
                {/* Due date footer */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Fecha de entrega</p>
                      <p className="text-slate-800 font-semibold">{formatDateTime(dueDate)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right sidebar - Students info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Course info panel */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-amber-500 text-white px-5 py-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Estudiantes
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Curso:</span>
                  <span className="font-medium text-slate-800">{subject?.name || 'Curso'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Grado:</span>
                  <span className="font-medium text-slate-800">{gradeName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Sección:</span>
                  <span className="font-medium text-slate-800">{subject?.section || 'A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Estudiantes totales:</span>
                  <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{totalStudents}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Entregada:</span>
                  <span className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{submitted}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Sin entregar:</span>
                  <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{notSubmitted}</span>
                </div>
              </div>
            </div>
            
            {/* Students list panel */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-amber-500 text-white px-5 py-3">
                <h3 className="font-semibold">Estudiantes</h3>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                {students && students.length > 0 ? (
                  <div className="space-y-3">
                    {students.map((student, idx) => {
                      const studentPhoto = student.photo_url || student.profile_pic;
                      return (
                        <div key={student.id || idx} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                          {studentPhoto ? (
                            <img 
                              src={studentPhoto} 
                              alt={student.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{student.name}</p>
                            <p className="text-xs text-slate-400">Roll ID: {student.roll_number || student.roll_id || student.id?.slice(0, 6)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No hay estudiantes matriculados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // List View (Table)
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tarea</h2>
          <div className="w-8 h-1 bg-amber-500 rounded-full mt-2"></div>
        </div>
        <div className="flex items-center gap-3">
          {/* Archived tasks button */}
          <button
            onClick={() => {
              setShowArchivedTasks(true);
              fetchArchivedTasks();
            }}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-colors flex items-center gap-2"
            data-testid="view-archived-tasks-btn"
          >
            <Archive className="w-5 h-5" />
            <span className="hidden sm:inline">Archivadas</span>
          </button>
          {/* Create task button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center shadow-lg shadow-amber-500/25"
            data-testid="create-task-btn"
          >
            <PenTool className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
            <div className="col-span-2">Estado</div>
            <div className="col-span-4">Título</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">Permitir entregas hasta</div>
            <div className="col-span-2 text-center">Opciones</div>
          </div>
        </div>
        
        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <PenTool className="w-10 h-10 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay tareas</h3>
              <p className="text-slate-400 mb-6">Crea la primera tarea para tus estudiantes</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear primera tarea
              </button>
            </div>
          ) : (
            tasks.map((task) => {
              // Check if task is expired
              const dueDate = extractDueDate(task);
              const isExpired = dueDate && new Date(dueDate) < new Date();
              
              return (
                <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  {/* Status */}
                  <div className="col-span-2">
                    {isExpired ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Vencida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Publicado
                      </span>
                    )}
                  </div>
                  
                  {/* Title */}
                  <div className="col-span-4">
                    <p className="font-semibold text-slate-800 truncate">{task.title}</p>
                  </div>
                  
                  {/* Type */}
                  <div className="col-span-2">
                    <span className="inline-block px-3 py-1.5 bg-lime-500 text-white rounded text-xs font-semibold">
                      {getDeliveryType(task.content)}
                    </span>
                  </div>
                  
                  {/* Due Date */}
                  <div className="col-span-2">
                    <p className="text-sm text-slate-600">
                      {dueDate ? formatDate(dueDate) : <span className="text-slate-400">Sin fecha</span>}
                    </p>
                  </div>
                
                {/* Actions */}
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl flex items-center justify-center transition-colors"
                    title="Ver tarea"
                    data-testid={`view-task-${task.id}`}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEditClick(task)}
                    className="w-9 h-9 bg-amber-100 hover:bg-amber-200 text-amber-500 rounded-xl flex items-center justify-center transition-colors"
                    title="Editar tarea"
                    data-testid={`edit-task-${task.id}`}
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(task)}
                    className="w-9 h-9 bg-red-100 hover:bg-red-200 text-red-500 rounded-xl flex items-center justify-center transition-colors"
                    title="Eliminar"
                    data-testid={`delete-task-${task.id}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Create Modal */}
      <PremiumTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        subjectId={subjectId}
        token={token}
        user={user}
        onPostCreated={handleTaskCreated}
      />
      
      {/* Edit Modal */}
      <EditTaskModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setTaskToEdit(null); }}
        task={taskToEdit}
        token={token}
        onTaskUpdated={handleTaskUpdated}
      />
      
      {/* Delete/Archive Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setSubmissionStats(null); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Loading state while fetching stats */}
            {!submissionStats ? (
              <div className="p-8 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
                <p className="text-slate-500">Verificando entregas...</p>
              </div>
            ) : submissionStats.can_delete || submissionStats.submissions_count === 0 ? (
              /* No submissions - Can delete */
              <>
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Eliminar tarea</h3>
                      <p className="text-sm text-slate-500">Esta tarea no tiene entregas</p>
                    </div>
                  </div>
                  <p className="text-slate-600 mb-2">
                    ¿Estás seguro de que deseas eliminar la tarea "<strong>{taskToDelete?.title}</strong>"?
                  </p>
                  <p className="text-sm text-slate-500 mb-6">
                    La tarea será eliminada permanentemente.
                  </p>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={() => { setShowDeleteModal(false); setSubmissionStats(null); }}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    data-testid="confirm-delete-task-btn"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar
                  </button>
                </div>
              </>
            ) : (
              /* Has submissions - Must archive */
              <>
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Archive className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Esta tarea tiene entregas</h3>
                      <p className="text-sm text-amber-600 font-medium">No puede ser eliminada</p>
                    </div>
                  </div>
                  
                  {/* Submission stats */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-800">{submissionStats.submissions_count}</p>
                        <p className="text-sm text-slate-500">Entregas recibidas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600">{submissionStats.graded_count}</p>
                        <p className="text-sm text-slate-500">Ya calificadas</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-amber-800">
                      <strong>Eliminar esta tarea afectaría el historial académico.</strong>
                      <br />
                      En su lugar, puedes <strong>archivarla</strong> para ocultarla de la vista principal mientras se preservan todas las entregas y calificaciones.
                    </p>
                  </div>
                  
                  <p className="text-slate-600 text-sm">
                    Tarea: "<strong>{taskToDelete?.title}</strong>"
                  </p>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={() => { setShowDeleteModal(false); setSubmissionStats(null); }}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleArchiveTask}
                    disabled={deleting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    data-testid="archive-task-btn"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                    Archivar tarea
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Archived Tasks Modal */}
      {showArchivedTasks && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowArchivedTasks(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Archive className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Tareas Archivadas</h3>
                  <p className="text-sm text-slate-500">{archivedTasks.length} tareas archivadas</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchivedTasks(false)}
                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingArchived ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
                  <p className="text-slate-500">Cargando tareas archivadas...</p>
                </div>
              ) : archivedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Archive className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-center">No hay tareas archivadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedTasks.map(task => (
                    <div key={task.id} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 truncate">{task.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>{task.submissions_count} entregas</span>
                          <span>{task.graded_count} calificadas</span>
                          {task.archived_at && (
                            <span>Archivada: {new Date(task.archived_at).toLocaleDateString('es-PE')}</span>
                          )}
                        </div>
                        {task.archived_by_name && (
                          <p className="text-xs text-slate-400 mt-1">Por: {task.archived_by_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRestoreTask(task.id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        data-testid={`restore-task-${task.id}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MATERIAL TABLE CONTENT (New design similar to Tasks and Forum)
// ══════════════════════════════════════════════════════════════════════════════
function MaterialTableContent({ subjectId, token, user }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Google Drive state
  const [driveStatus, setDriveStatus] = useState({ connected: false, server_configured: false });
  const [driveChecked, setDriveChecked] = useState(false);
  
  // Form state
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState("pdf");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Check Google Drive status on mount
  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const res = await axios.get(`${API}/integrations/google-drive/status`, { headers });
        setDriveStatus(res.data);
      } catch (err) {
        console.error('Error checking Drive status:', err);
      } finally {
        setDriveChecked(true);
      }
    };
    checkDriveStatus();
  }, [token]);
  
  // Fetch materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await axios.get(`${API}/course/${subjectId}/posts?post_type=material&limit=100`, { headers });
        setMaterials(res.data.posts || []);
      } catch (err) {
        console.error('Error fetching materials:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, [subjectId, token]);
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('El archivo no debe superar 25MB');
      return;
    }
    
    setFile(selectedFile);
    setError("");
    
    // Auto-detect file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) setFileType('pdf');
    else if (['doc', 'docx'].includes(ext)) setFileType('word');
    else if (['xls', 'xlsx'].includes(ext)) setFileType('excel');
    else if (['ppt', 'pptx'].includes(ext)) setFileType('powerpoint');
    else if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) setFileType('video');
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) setFileType('image');
    else setFileType('other');
  };
  
  const uploadToCloudinary = async (fileToUpload, folder) => {
    // Determine if file should be uploaded as RAW
    // PDFs, DOCs, XLS, PPT, etc. MUST be uploaded as RAW
    const fileExtension = fileToUpload.name.split('.').pop()?.toLowerCase();
    const rawExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv'];
    const isRawFile = rawExtensions.includes(fileExtension) || !fileToUpload.type.startsWith('image/');
    
    // ALWAYS use 'raw' for non-image files to ensure proper handling
    const resourceType = isRawFile ? 'raw' : 'image';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    // Use the correct endpoint based on resource type
    const uploadEndpoint = resourceType;
    
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
    
    // Return complete upload result with all metadata
    return {
      secure_url: uploadRes.data.secure_url,
      public_id: uploadRes.data.public_id,
      resource_type: uploadRes.data.resource_type,
      format: uploadRes.data.format,
      bytes: uploadRes.data.bytes,
      original_filename: uploadRes.data.original_filename,
      storage_type: 'cloudinary'
    };
  };
  
  // Upload to Google Drive (for documents: PDF, Word, Excel, etc.)
  const uploadToGoogleDrive = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('subject_id', subjectId);
    formData.append('title', description.trim() || fileToUpload.name);
    formData.append('description', `Archivo: ${fileToUpload.name}`);
    
    const res = await axios.post(`${API}/materials/upload`, formData, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      }
    });
    
    return {
      ...res.data,
      storage_type: 'google_drive'
    };
  };
  
  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("La descripción es requerida");
      return;
    }
    
    if (!file) {
      setError("Debes seleccionar un archivo");
      return;
    }
    
    // Check if this file type needs Google Drive
    const needsDrive = shouldUseGoogleDrive(file);
    
    // If file needs Drive but Drive is not connected, show error
    if (needsDrive && !driveStatus.connected) {
      setError("Para subir documentos (PDF, Word, Excel, etc.) debes conectar Google Drive desde Ajustes.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let result;
      
      if (needsDrive) {
        // Upload to Google Drive
        result = await uploadToGoogleDrive(file);
        
        // The backend already creates the post, so just add to list
        setMaterials([{
          id: result.id,
          title: description.trim(),
          file_name: result.drive_file_name || file.name,
          file_size: result.file_size || file.size,
          storage_type: 'google_drive',
          drive_file_id: result.drive_file_id,
          created_at: new Date().toISOString()
        }, ...materials]);
      } else {
        // Upload images to Cloudinary
        const uploadResult = await uploadToCloudinary(file, 'edunet/materials');
        
        const res = await axios.post(`${API}/course/${subjectId}/posts`, {
          subject_id: subjectId,
          title: description.trim(),
          content: `Archivo: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`,
          post_type: "material",
          file_url: uploadResult.secure_url,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_type: 'cloudinary',
          cloudinary_data: {
            public_id: uploadResult.public_id,
            resource_type: uploadResult.resource_type,
            format: uploadResult.format
          }
        }, { headers });
        
        setMaterials([res.data, ...materials]);
      }
      
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error uploading material:', err);
      const errorMsg = err.response?.data?.detail || "Error al subir el material. Intenta de nuevo.";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  const resetForm = () => {
    setDescription("");
    setFile(null);
    setFileType("pdf");
    setError("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleDeleteClick = (material) => {
    setMaterialToDelete(material);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!materialToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${materialToDelete.id}`, { headers });
      setMaterials(materials.filter(m => m.id !== materialToDelete.id));
      setShowDeleteModal(false);
      setMaterialToDelete(null);
    } catch (err) {
      console.error('Error deleting material:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleDownload = async (material) => {
    setDownloading(material.id);
    try {
      // Check if material is stored in Google Drive
      if (material.storage_type === 'google_drive' || material.drive_file_id) {
        // Download through backend (secure streaming)
        const response = await axios.get(`${API}/materials/download/${material.id}`, {
          headers,
          responseType: 'blob'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', material.file_name || material.drive_file_name || 'archivo');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        return;
      }
      
      // For Cloudinary URLs, get a signed URL using stored metadata
      if (material.file_url) {
        if (material.file_url.includes('cloudinary.com')) {
          const params = new URLSearchParams({ url: material.file_url });
          
          if (material.cloudinary_data) {
            if (material.cloudinary_data.public_id) {
              params.append('public_id', material.cloudinary_data.public_id);
            }
            if (material.cloudinary_data.resource_type) {
              params.append('resource_type', material.cloudinary_data.resource_type);
            }
          }
          
          const res = await axios.get(`${API}/cloudinary/signed-url?${params.toString()}`, { headers });
          window.open(res.data.signed_url, '_blank', 'noopener,noreferrer');
        } else {
          window.open(material.file_url, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Error al descargar el archivo. Por favor intenta de nuevo.');
    } finally {
      setDownloading(null);
    }
  };
  
  const getFileIcon = (material) => {
    const fileName = material.file_name || material.title || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileText className="w-5 h-5 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext)) return <FileText className="w-5 h-5 text-green-500" />;
    if (['ppt', 'pptx'].includes(ext)) return <FileText className="w-5 h-5 text-orange-500" />;
    if (['mp4', 'avi', 'mov'].includes(ext)) return <FileVideo className="w-5 h-5 text-purple-500" />;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return <ImageIcon className="w-5 h-5 text-pink-500" />;
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };
  
  const extractFileInfo = (material) => {
    // Try to extract file info from content or metadata
    const content = material.content || '';
    const match = content.match(/Archivo:\s*(.+?)\s*\((.+?)\)/);
    if (match) {
      return { name: match[1], size: match[2] };
    }
    return { 
      name: material.file_name || 'Archivo', 
      size: material.file_size ? `${(material.file_size / 1024).toFixed(2)}KB` : '' 
    };
  };
  
  // List View
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Material de estudio</h2>
          <div className="w-8 h-1 bg-orange-500 rounded-full mt-2"></div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center shadow-lg shadow-orange-500/25"
          data-testid="upload-material-btn"
        >
          <Upload className="w-6 h-6" />
        </button>
      </div>
      
      {/* Materials List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* List Body */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <FolderOpen className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay materiales</h3>
              <p className="text-slate-400 mb-6">Sube el primer material de estudio</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Subir material
              </button>
            </div>
          ) : (
            materials.map((material) => {
              const fileInfo = extractFileInfo(material);
              const isGoogleDrive = material.storage_type === 'google_drive' || material.drive_file_id;
              return (
                <div key={material.id} className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                  {/* Title and File info together */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{material.title}</p>
                    <div className="flex items-center gap-2 text-slate-500">
                      {getFileIcon(material)}
                      <span className="text-sm">{fileInfo.name}</span>
                      {fileInfo.size && (
                        <span className="text-xs text-slate-400">({fileInfo.size})</span>
                      )}
                      {/* Storage indicator */}
                      {isGoogleDrive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full" title="Almacenado en Google Drive">
                          <HardDrive className="w-3 h-3" />
                          Drive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full" title="Almacenado en Cloudinary">
                          <Cloud className="w-3 h-3" />
                          Cloud
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleDownload(material)}
                      disabled={downloading === material.id}
                      className="w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-wait"
                      title="Descargar"
                    >
                      {downloading === material.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(material)}
                      className="w-9 h-9 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreateModal(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Subir material de estudio
              </h3>
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Google Drive Status Banner */}
              {driveChecked && !driveStatus.connected && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-start gap-2">
                  <HardDrive className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Google Drive no conectado</p>
                    <p className="text-xs mt-0.5">Para subir documentos (PDF, Word, Excel, PowerPoint, ZIP), el propietario debe conectar Google Drive desde Ajustes.</p>
                    <p className="text-xs mt-1 text-amber-600">Las imágenes se subirán normalmente a Cloudinary.</p>
                  </div>
                </div>
              )}
              
              {driveChecked && driveStatus.connected && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
                  <HardDrive className="w-4 h-4 flex-shrink-0" />
                  <span>Google Drive conectado - Los documentos se guardarán en Drive</span>
                </div>
              )}
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Descripción *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe una descripción del material..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all resize-none"
                />
              </div>
              
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Archivo *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.avi,.mov,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    <Paperclip className="w-4 h-4" />
                    Seleccionar archivo
                  </button>
                  {file && (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-200">
                      <FileText className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(2)}KB)</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* File Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo de archivo
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
                >
                  <option value="pdf">PDF</option>
                  <option value="word">Word (DOC/DOCX)</option>
                  <option value="excel">Excel (XLS/XLSX)</option>
                  <option value="powerpoint">PowerPoint (PPT/PPTX)</option>
                  <option value="video">Video</option>
                  <option value="image">Imagen</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              {/* Progress Bar */}
              {submitting && uploadProgress > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim() || !file}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Eliminar material</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar "<strong>{materialToDelete?.title}</strong>"?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const canEdit = ["teacher", "admin", "owner", "director", "coordinator"].includes(userRole);
  
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Recordatorios</h2>
          <div className="w-8 h-1 bg-violet-500 rounded-full mt-2"></div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-14 h-14 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center shadow-lg shadow-violet-500/25"
            data-testid="create-reminder-btn"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>
      
      {/* Reminders Panel - Full width */}
      <CourseRemindersPanel 
        subjectId={subjectId} 
        token={token} 
        userRole={userRole}
        isFullWidth={true}
        externalShowModal={showCreateModal}
        onExternalModalClose={() => setShowCreateModal(false)}
      />
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
  
  // State for opening chat directly with a user
  const [directChatUser, setDirectChatUser] = useState(null);
  
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

  // Handle clicking on an activity to navigate to its content
  const handleActivityClick = (activity) => {
    const { reference_type, activity_type } = activity;
    
    // Map activity/reference types to tabs
    if (reference_type === "post" || activity_type === "post_created" || activity_type === "announcement") {
      setActiveTab("tablero");
    } else if (reference_type === "task" || activity_type === "task_assigned") {
      setActiveTab("tareas");
    } else if (reference_type === "material" || activity_type === "material_shared") {
      setActiveTab("material");
    } else if (reference_type === "exam" || activity_type === "exam_scheduled" || activity_type === "exam_published") {
      setActiveTab("examenes");
    } else if (reference_type === "reminder" || activity_type === "reminder_created") {
      setActiveTab("recordatorios");
    } else if (reference_type === "forum" || activity_type === "forum_post") {
      setActiveTab("foro");
    } else {
      // Default to dashboard/tablero
      setActiveTab("tablero");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "tablero":
        return <DashboardContent subjectId={subjectId} token={token} user={user} />;
      case "tareas":
        return <TasksTableContent subjectId={subjectId} token={token} user={user} students={students} subject={subject} levelName={levelName} gradeName={gradeName} />;
      case "material":
        return <MaterialTableContent subjectId={subjectId} token={token} user={user} />;
      case "examenes":
        return <ExamsContent subjectId={subjectId} token={token} userRole={user?.role} />;
      case "foro":
        return <ForumContent subjectId={subjectId} token={token} user={user} students={students} />;
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
          {/* Hero Header - Hidden on full-width tabs */}
          {(() => {
            const fullWidthTabs = ["examenes", "tareas", "foro", "material", "recordatorios", "calificaciones"];
            const isFullWidth = fullWidthTabs.includes(activeTab);
            if (!isFullWidth) {
              return (
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
              );
            }
            // Show back button for full-width tabs
            return (
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => navigate("/asignaturas")}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Volver a Asignaturas
                </button>
                <div className="h-6 w-px bg-slate-300"></div>
                <h1 className="text-lg font-semibold text-slate-800">{subject?.name || 'Curso'}</h1>
              </div>
            );
          })()}
          
          {/* Tabs */}
          <div className={`${activeTab === "tablero" ? "mt-6" : "mt-0"} sticky top-[72px] z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-gradient-to-br from-slate-100/95 via-gray-50/95 to-zinc-100/95 backdrop-blur-sm border-b border-gray-200/50`}>
            <PremiumTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          {/* 3-Column Layout - Hide sidebars for full-width tabs */}
          {(() => {
            const fullWidthTabs = ["examenes", "tareas", "foro", "material", "recordatorios", "calificaciones"];
            const isFullWidth = fullWidthTabs.includes(activeTab);
            return (
              <div className={`mt-6 grid grid-cols-1 gap-6 items-start ${
                isFullWidth ? "" : "lg:grid-cols-12"
              }`}>
                {/* Left Sidebar - Sticky (hidden on full-width tabs) */}
                {!isFullWidth && (
                  <aside className="hidden lg:block lg:col-span-3 sticky top-[200px] self-start">
                    <CourseInfoSidebar
                      subject={subject}
                      subjectId={subjectId}
                      token={token}
                      onActivityClick={handleActivityClick}
                    />
                  </aside>
                )}
                
                {/* Main Content Area - Full width on selected tabs */}
                <div className={isFullWidth ? "" : "lg:col-span-6"}>
                  {renderTabContent()}
                </div>
                
                {/* Right Sidebar - Sticky (hidden on full-width tabs) */}
                {!isFullWidth && (
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
            );
          })()}
        </main>
      </div>

      {/* Global Message Center - Floating Button + Drawer */}
      <MessageCenter 
        token={token} 
        user={user} 
        openWithUser={directChatUser}
        onClose={() => setDirectChatUser(null)}
      />
    </div>
  );
}
