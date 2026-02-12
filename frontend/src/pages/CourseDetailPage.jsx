import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import {
  BookOpen, Users, Edit3, ChevronRight, Clock, 
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Trophy, Download, Upload, 
  Calendar, Bell, Mail, Phone, MoreVertical, Plus,
  ArrowLeft, AlertCircle, File, Image, 
  FileVideo, Heart, MessageSquare, 
  ChevronDown, ChevronUp, User, GraduationCap,
  PenTool, Search, Send, X, Loader2, Trash2, Edit2, Paperclip
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ══════════════════════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: PenTool },
  { id: "material", label: "Material de estudio", icon: FolderOpen },
  { id: "examenes", label: "Exámenes", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
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
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 p-2">
      <div className="flex items-center overflow-x-auto hide-scrollbar gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/30 rounded-full" />
              )}
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
function CourseInfoSidebar({ subject, activities, news }) {
  return (
    <div className="space-y-5">
      {/* Course Card with Image */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        {subject?.image_url ? (
          <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg">
            <img 
              src={subject.image_url} 
              alt={subject.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div 
            className="w-full aspect-square rounded-2xl flex items-center justify-center mb-4 shadow-inner"
            style={{ 
              background: `linear-gradient(135deg, ${subject?.color || '#6366F1'}20, ${subject?.color || '#6366F1'}40)`,
              border: `2px solid ${subject?.color || '#6366F1'}30`
            }}
          >
            <BookOpen className="w-16 h-16" style={{ color: subject?.color || '#6366F1' }} />
          </div>
        )}
        <h3 className="font-bold text-gray-800 text-center">{subject?.name}</h3>
        {subject?.description && (
          <p className="text-sm text-gray-500 text-center mt-2 line-clamp-3">{subject.description}</p>
        )}
      </div>
      
      {/* Activity Feed */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Actividad del curso
        </h4>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin actividad reciente</p>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {activity.user?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-2">
                    <span className="font-semibold">{activity.user}</span> {activity.action}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* News Section */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          Últimas noticias
        </h4>
        {news.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin noticias</p>
        ) : (
          <div className="space-y-3">
            {news.slice(0, 3).map((item, idx) => (
              <div key={idx} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm font-medium text-gray-700 line-clamp-2">{item.title}</p>
                <p className="text-xs text-gray-400 mt-1">{item.date}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Quick Links */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h4 className="font-bold text-gray-700 mb-4">Accesos rápidos</h4>
        <div className="space-y-2">
          {[
            { icon: FolderOpen, label: "Materiales", color: "from-blue-400 to-blue-600" },
            { icon: PenTool, label: "Tareas pendientes", color: "from-amber-400 to-orange-500" },
            { icon: FileVideo, label: "Clases grabadas", color: "from-rose-400 to-pink-500" },
          ].map((link, idx) => (
            <button
              key={idx}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                <link.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT SIDEBAR - TEACHER & STUDENTS
// ══════════════════════════════════════════════════════════════════════════════
function CourseRightSidebar({ teacher, students, reminders }) {
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
      
      {/* Reminders */}
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl overflow-hidden border border-rose-100 shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-rose-500 to-pink-500">
          <h4 className="font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Recordatorios
          </h4>
        </div>
        <div className="p-4">
          {reminders.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">Sin recordatorios</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder, idx) => (
                <div key={idx} className="p-3 bg-white rounded-xl border border-rose-100">
                  <p className="text-sm font-medium text-gray-700">{reminder.title}</p>
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {reminder.date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB CONTENT (TIMELINE FEED) - FUNCTIONAL
// ══════════════════════════════════════════════════════════════════════════════

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const loadPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/course/${subjectId}/posts`, { headers });
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  }, [subjectId, token]);
  
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);
  
  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };
  
  const handlePostDeleted = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
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
            <Image className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
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
        posts.map((post) => (
          <PostCard 
            key={post.id} 
            post={post} 
            token={token}
            currentUserId={user?.id}
            onDelete={handlePostDeleted}
            onLikeToggle={handleLikeToggle}
            onCommentAdded={handleCommentAdded}
          />
        ))
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

// Create Post Modal
function CreatePostModal({ isOpen, onClose, subjectId, token, user, onPostCreated }) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (!isOpen) {
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
  
  const uploadToCloudinary = async (fileToUpload, folder) => {
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=auto`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
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
        imageUrl = await uploadToCloudinary(compressedImage, 'edunet/posts');
      }
      
      // Upload file if present
      if (file) {
        fileUrl = await uploadToCloudinary(file, 'edunet/posts');
        fileName = file.name;
        fileType = file.type;
      }
      
      // Create post
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        content: content.trim(),
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
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Nueva publicación</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5">
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-gray-400">Publicando en el curso</p>
            </div>
          </div>
          
          {/* Text input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="¿Qué quieres compartir con tu clase?"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
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
              <File className="w-8 h-8 text-indigo-500" />
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
              <Image className="w-5 h-5 text-green-600" />
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
            disabled={submitting || (!content.trim() && !imageFile && !file)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publicar
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
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAuthor = post.author_id === currentUserId;
  
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
  
  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta publicación?')) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${post.id}`, { headers });
      onDelete(post.id);
    } catch (err) {
      alert('Error al eliminar');
    } finally {
      setDeleting(false);
      setShowMenu(false);
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
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
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
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border py-2 min-w-[140px] z-20">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
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
            href={post.file_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4 hover:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <File className="w-6 h-6 text-blue-600" />
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MATERIAL TAB CONTENT
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
      case "image": return <Image className="w-6 h-6 text-green-500" />;
      default: return <File className="w-6 h-6 text-blue-500" />;
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
function ExamsContent({ exams, onCreateExam }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={onCreateExam}
          className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Crear examen
        </button>
      </div>
      
      {exams.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Sin exámenes"
          description="No hay exámenes programados para este curso. Crea un examen para evaluar a tus estudiantes."
          action="Crear examen"
          onAction={onCreateExam}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {exams.map((exam, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                  <FlaskConical className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{exam.title}</h4>
                  <p className="text-sm text-gray-400">{exam.date}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{exam.questions} preguntas</span>
                <span className="font-bold text-purple-600">{exam.duration}</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
  
  // Mock data for demo (replace with actual API calls)
  const [activities] = useState([
    { user: "Prof. García", action: "subió nuevo material", time: "Hace 2 horas" },
    { user: "María López", action: "entregó la tarea 3", time: "Hace 5 horas" },
    { user: "Carlos Ruiz", action: "comentó en el foro", time: "Ayer" },
  ]);
  
  const [news] = useState([
    { title: "Examen parcial programado para el viernes", date: "25 Dic 2025" },
    { title: "Nueva fecha de entrega de proyecto", date: "22 Dic 2025" },
  ]);
  
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
  const [reminders] = useState([
    { title: "Entrega de proyecto final", date: "27 Dic 2025" },
    { title: "Examen parcial", date: "30 Dic 2025" },
  ]);

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
        return <DashboardContent posts={posts} onCreatePost={() => {}} />;
      case "tareas":
        return <TasksContent tasks={tasks} onCreateTask={() => {}} />;
      case "material":
        return <MaterialContent materials={materials} onUpload={() => {}} />;
      case "examenes":
        return <ExamsContent exams={exams} onCreateExam={() => {}} />;
      case "foro":
        return <ForumContent threads={threads} onCreateThread={() => {}} />;
      case "calificaciones":
        return <GradesContent grades={grades} />;
      default:
        return <DashboardContent posts={posts} onCreatePost={() => {}} />;
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
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
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
          <div className="mt-6">
            <PremiumTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          {/* 3-Column Layout */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar */}
            <div className="lg:col-span-3 order-2 lg:order-1">
              <CourseInfoSidebar
                subject={subject}
                activities={activities}
                news={news}
              />
            </div>
            
            {/* Main Content Area */}
            <div className="lg:col-span-6 order-1 lg:order-2">
              {renderTabContent()}
            </div>
            
            {/* Right Sidebar */}
            <div className="lg:col-span-3 order-3">
              <CourseRightSidebar
                teacher={teacher}
                students={students}
                reminders={reminders}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
