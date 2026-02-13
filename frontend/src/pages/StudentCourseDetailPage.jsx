import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen, ArrowLeft, Clock, Calendar, User, Users,
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Bell, Trophy, Download,
  Loader2, AlertCircle, File as FileIcon, 
  ChevronRight, CheckCircle, Lock, Play,
  Eye, ExternalLink, Heart
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Tabs for students (read-only)
const STUDENT_TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: FileText },
  { id: "material", label: "Material", icon: FolderOpen },
  { id: "examenes", label: "Exámenes", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
];

// Empty State Component
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto">{description}</p>
    </div>
  );
}

// Course Header
function CourseHeader({ subject, teacher, onBack }) {
  const baseColor = subject?.color || "#06b6d4";
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden shadow-lg"
      style={{ background: `linear-gradient(135deg, ${baseColor}DD 0%, ${baseColor}99 100%)` }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      
      <div className="relative z-10 p-6 lg:p-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all border border-white/30"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">{subject?.name || "Curso"}</h1>
            {teacher && (
              <div className="flex items-center gap-2 mt-2">
                <User className="w-4 h-4 text-white/70" />
                <span className="text-white/90 text-sm">{teacher.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tabs Component
function CourseTabs({ activeTab, onTabChange }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STUDENT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                isActive
                  ? "bg-cyan-500 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              data-testid={`tab-${tab.id}`}
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

// Post Card Component with like and comment functionality
function PostCard({ post, token, user }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  
  const headers = { Authorization: `Bearer ${token}` };
  const itemType = post.post_type || post.type || 'announcement';
  const authorObj = post.author || {};
  const authorName = authorObj.name || post.author_name || post.created_by_name || 'Profesor';
  const authorPhoto = authorObj.photo_url || post.author_photo || post.created_by_photo;
  
  const getTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
  };
  
  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await axios.post(`${API}/api/course/posts/${post.id}/like`, {}, { headers });
      setLiked(res.data.liked);
      setLikesCount(res.data.likes_count);
    } catch (err) {
      console.error('Error liking:', err);
    } finally {
      setLiking(false);
    }
  };
  
  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/api/course/posts/${post.id}/comments`, { headers });
      setComments(res.data || []);
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
      const res = await axios.post(`${API}/api/course/posts/${post.id}/comments`, {
        content: newComment.trim()
      }, { headers });
      setComments([...comments, res.data.comment || res.data]);
      setNewComment("");
      setCommentsCount(prev => prev + 1);
    } catch (err) {
      console.error('Error commenting:', err);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Post Header - Author info */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {authorPhoto ? (
            <img 
              src={authorPhoto} 
              alt={authorName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold">
              {authorName?.charAt(0) || 'P'}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-slate-800">{authorName}</h4>
            <p className="text-xs text-slate-400">{getTimeAgo(post.created_at)}</p>
          </div>
        </div>
      </div>
      
      {/* Post Type Badge */}
      <div className="px-4 pb-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          itemType === 'task' ? 'bg-amber-100 text-amber-700' : 
          itemType === 'material' ? 'bg-indigo-100 text-indigo-700' : 
          itemType === 'forum' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
        }`}>
          {itemType === 'task' ? (
            <FileText className="w-3.5 h-3.5" />
          ) : itemType === 'material' ? (
            <FolderOpen className="w-3.5 h-3.5" />
          ) : itemType === 'forum' ? (
            <MessageCircle className="w-3.5 h-3.5" />
          ) : (
            <Bell className="w-3.5 h-3.5" />
          )}
          {itemType === 'task' ? 'Tarea' : itemType === 'material' ? 'Material' : itemType === 'forum' ? 'Foro' : 'Anuncio'}
        </span>
      </div>
      
      {/* Post Content */}
      <div className="px-4 pb-4">
        {post.title && (
          <h3 className="font-bold text-lg text-slate-800 mb-2">{post.title}</h3>
        )}
        {/* Render HTML content properly */}
        {(post.content || post.description) && (
          <div 
            className="prose prose-sm max-w-none text-slate-600"
            dangerouslySetInnerHTML={{ 
              __html: post.content || post.description || '' 
            }}
          />
        )}
        
        {/* Due date for tasks */}
        {post.due_date && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm font-medium">
            <Clock className="w-4 h-4" />
            Fecha de entrega: {new Date(post.due_date).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}
      </div>
      
      {/* Attachments */}
      {post.attachments?.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {post.attachments.map((file, idx) => (
            <a
              key={idx}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <FileIcon className="w-4 h-4" />
              {file.name}
              <Download className="w-3.5 h-3.5" />
            </a>
          ))}
        </div>
      )}
      
      {/* Post Actions - Like and Comment */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-6">
        <button 
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-2 transition-colors ${
            liked ? 'text-red-500' : 'text-slate-500 hover:text-red-500'
          } ${liking ? 'opacity-50' : ''}`}
        >
          <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          <span className="text-sm">{likesCount}</span>
        </button>
        <button 
          onClick={handleToggleComments}
          className="flex items-center gap-2 text-slate-500 hover:text-cyan-500 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">{commentsCount}</span>
        </button>
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {/* Comment Input */}
          <div className="flex items-start gap-3 py-4">
            {user?.photo_url ? (
              <img 
                src={user.photo_url} 
                alt={user?.name || 'Usuario'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user?.name?.charAt(0) || 'E'}
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={2}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="px-4 py-1.5 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? 'Enviando...' : 'Comentar'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Comments List */}
          {loadingComments ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No hay comentarios aún. ¡Sé el primero en comentar!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment, idx) => (
                <div key={comment.id || idx} className="flex items-start gap-3">
                  {comment.author?.photo_url ? (
                    <img
                      src={comment.author.photo_url}
                      alt={comment.author?.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                      {comment.author?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{comment.author?.name || 'Usuario'}</span>
                      <span className="text-xs text-slate-400">{getTimeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Dashboard/Tablero Content - 3 Column Layout (matching owner's portal design)
function DashboardContent({ subject, teacher, posts, students, tasks, materials, reminders, onViewPost, token, user }) {
  const baseColor = subject?.color || "#06b6d4";
  
  // Helper function to get time ago
  const getTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
  };
  
  // Get upcoming tasks (next 7 days)
  const upcomingTasks = tasks
    .filter(t => new Date(t.due_date) > new Date())
    .slice(0, 3);
  
  // Get recent activity (all posts combined)
  const recentActivity = [...posts, ...tasks.slice(0, 2), ...materials.slice(0, 2)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* LEFT COLUMN - Course Image & Activity */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-3 space-y-4">
        {/* Course Image Card - Elegant Design */}
        <div className="bg-gradient-to-br from-indigo-50/50 to-violet-50/30 rounded-2xl p-4 border border-indigo-200/40 shadow-sm">
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
                background: `linear-gradient(135deg, ${baseColor}15, ${baseColor}30)`,
                border: `2px solid ${baseColor}25`
              }}
            >
              <BookOpen className="w-16 h-16" style={{ color: baseColor }} />
            </div>
          )}
          <h3 className="font-bold text-slate-800 text-center text-lg">{subject?.name}</h3>
          {subject?.description && (
            <p className="text-sm text-slate-500 text-center mt-2 line-clamp-3">{subject.description}</p>
          )}
        </div>

        {/* Activity Summary - Green themed like owner's portal */}
        <div className="bg-gradient-to-br from-emerald-50/40 to-teal-50/20 rounded-2xl p-4 border border-emerald-200/40 shadow-sm">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm relative">
              <LayoutDashboard className="w-3.5 h-3.5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white animate-pulse" />
            </div>
            Actividad del curso
          </h4>
          
          {/* Activity Stats */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
              <span className="text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Tareas
              </span>
              <span className="font-bold text-slate-800 bg-amber-100 px-2.5 py-0.5 rounded-full text-xs">{tasks.length}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
              <span className="text-slate-600 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-500" />
                Materiales
              </span>
              <span className="font-bold text-slate-800 bg-indigo-100 px-2.5 py-0.5 rounded-full text-xs">{materials.length}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
              <span className="text-slate-600 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-cyan-500" />
                Publicaciones
              </span>
              <span className="font-bold text-slate-800 bg-cyan-100 px-2.5 py-0.5 rounded-full text-xs">{posts.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CENTER COLUMN - Posts/Feed (Read-only for students) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-6 space-y-4">
        {/* Read-only notice for students */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-slate-500 text-sm">
              Publicaciones del curso
            </div>
          </div>
        </div>
        
        {/* Recent Activity Feed */}
        {recentActivity.length > 0 ? (
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <PostCard key={item.id} post={item} token={token} user={user} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin publicaciones</h3>
            <p className="text-slate-500">Aún no hay publicaciones en este curso.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT COLUMN - Teacher, Students, Reminders */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-3 space-y-4">
        {/* Teacher Card - Orange gradient header like owner's portal */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl overflow-hidden border border-amber-100 shadow-sm">
          <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              Profesor del curso
            </h4>
          </div>
          <div className="p-4">
            {teacher ? (
              <div className="text-center">
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={teacher.name}
                    className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg ring-4 ring-white"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-white text-white text-2xl font-bold">
                    {teacher.name?.charAt(0)}
                  </div>
                )}
                <h5 className="font-bold text-gray-800">{teacher.name} {teacher.last_name || ''}</h5>
                <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full mt-2">
                  Profesor
                </span>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">Sin profesor asignado</p>
              </div>
            )}
          </div>
        </div>

        {/* Students Card - Green/Teal gradient like owner's portal */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl overflow-hidden border border-emerald-100 shadow-sm">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              Estudiantes
            </h4>
            <span className="px-2.5 py-1 bg-white/20 rounded-full text-white text-xs font-bold">
              {students.length}
            </span>
          </div>
          <div className="p-4">
            {students.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {students.slice(0, 8).map((student, idx) => (
                  <div 
                    key={student.id || idx}
                    className="flex items-center gap-3 p-2 bg-white rounded-xl hover:bg-emerald-100/50 transition-colors"
                  >
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.name}
                        className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-emerald-200">
                        {student.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {student.name} {student.last_name?.charAt(0) || ''}.
                      </p>
                    </div>
                  </div>
                ))}
                {students.length > 8 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-emerald-600 font-medium">
                      +{students.length - 8} más estudiantes
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin estudiantes matriculados</p>
              </div>
            )}
          </div>
        </div>

        {/* Reminders Card - Purple/Blue gradient like owner's portal */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl overflow-hidden border border-violet-100 shadow-sm">
          <div className="px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4" />
              Recordatorios
            </h4>
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="p-4">
            {reminders.length > 0 ? (
              <div className="space-y-2">
                {reminders.slice(0, 4).map((reminder, idx) => (
                  <div key={reminder.id || idx} className="p-3 bg-white rounded-xl border border-violet-100">
                    <p className="text-sm font-medium text-slate-800">{reminder.title || reminder.message}</p>
                    {reminder.date && (
                      <p className="text-xs text-violet-600 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(reminder.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin recordatorios</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks Card */}
        {upcomingTasks.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl overflow-hidden border border-amber-100 shadow-sm">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500">
              <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Próximas Entregas
              </h4>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="p-3 bg-white rounded-xl border border-amber-100">
                    <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.due_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tasks Content (Read-only for students)
function TasksContent({ tasks, studentId, onSubmitTask }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin tareas asignadas"
        description="El profesor aún no ha asignado tareas para este curso."
      />
    );
  }

  const getTaskStatus = (task) => {
    const submission = task.submissions?.find(s => s.student_id === studentId);
    if (submission) {
      if (submission.grade !== null && submission.grade !== undefined) {
        return { status: "graded", label: "Calificada", color: "bg-emerald-100 text-emerald-700", grade: submission.grade };
      }
      return { status: "submitted", label: "Entregada", color: "bg-blue-100 text-blue-700" };
    }
    const now = new Date();
    const dueDate = new Date(task.due_date);
    if (dueDate < now) {
      return { status: "late", label: "Vencida", color: "bg-red-100 text-red-700" };
    }
    return { status: "pending", label: "Pendiente", color: "bg-amber-100 text-amber-700" };
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const taskStatus = getTaskStatus(task);
        
        return (
          <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800">{task.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${taskStatus.color}`}>
                    {taskStatus.label}
                    {taskStatus.grade !== undefined && ` - ${taskStatus.grade}/${task.max_grade || 20}`}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{task.description || task.content}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Fecha límite: {new Date(task.due_date).toLocaleDateString("es-PE")}
                  </span>
                  {task.max_grade && (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Puntaje máximo: {task.max_grade}
                    </span>
                  )}
                </div>
              </div>
              
              {taskStatus.status === "pending" && (
                <button
                  onClick={() => onSubmitTask(task)}
                  className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Entregar
                </button>
              )}
            </div>
            
            {/* Attachments */}
            {task.attachments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Archivos adjuntos:</p>
                <div className="flex flex-wrap gap-2">
                  {task.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <FileIcon className="w-4 h-4" />
                      {file.name}
                      <Download className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Material Content (Read-only)
function MaterialContent({ materials }) {
  if (materials.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Sin material de estudio"
        description="El profesor aún no ha compartido material de estudio."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {materials.map((material) => (
        <div key={material.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">{material.title}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{material.description || material.content}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(material.created_at).toLocaleDateString("es-PE")}
              </div>
            </div>
          </div>
          
          {/* Files */}
          {material.attachments?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                {material.attachments.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <FileIcon className="w-5 h-5 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700 truncate">{file.name}</span>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-500" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Exams Content (Read-only)
function ExamsContent({ exams, studentId }) {
  if (exams.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Sin exámenes"
        description="El profesor aún no ha programado exámenes para este curso."
      />
    );
  }

  const getExamStatus = (exam) => {
    const attempt = exam.attempts?.find(a => a.student_id === studentId);
    if (attempt) {
      return { status: "completed", label: "Completado", color: "bg-emerald-100 text-emerald-700", score: attempt.score };
    }
    const now = new Date();
    const startDate = new Date(exam.start_date);
    const endDate = new Date(exam.end_date);
    if (now < startDate) {
      return { status: "upcoming", label: "Próximamente", color: "bg-slate-100 text-slate-700" };
    }
    if (now > endDate) {
      return { status: "closed", label: "Cerrado", color: "bg-red-100 text-red-700" };
    }
    return { status: "available", label: "Disponible", color: "bg-cyan-100 text-cyan-700" };
  };

  return (
    <div className="space-y-4">
      {exams.map((exam) => {
        const examStatus = getExamStatus(exam);
        
        return (
          <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800">{exam.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${examStatus.color}`}>
                    {examStatus.label}
                    {examStatus.score !== undefined && ` - ${examStatus.score}%`}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{exam.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {exam.duration_minutes} minutos
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(exam.start_date).toLocaleDateString("es-PE")} - {new Date(exam.end_date).toLocaleDateString("es-PE")}
                  </span>
                </div>
              </div>
              
              {examStatus.status === "available" && (
                <button className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Iniciar
                </button>
              )}
              {examStatus.status === "upcoming" && (
                <div className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Bloqueado
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Forum Content (Read-only) - Fixed to render HTML content
function ForumContent({ posts }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin discusiones"
        description="Aún no hay discusiones en el foro de este curso."
      />
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const authorObj = post.author || {};
        const authorName = authorObj.name || post.author_name || 'Usuario';
        
        return (
          <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800">{post.title}</h3>
                {/* Render HTML content properly */}
                <div 
                  className="prose prose-sm max-w-none text-slate-600 mt-1 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: post.content || '' }}
                />
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span>{authorName}</span>
                  <span>{new Date(post.created_at).toLocaleDateString("es-PE")}</span>
                  {post.comments_count !== undefined && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.comments_count} respuestas
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Main Component
export default function StudentCourseDetailPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain, courseId } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [subject, setSubject] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState("tablero");
  
  // Content states
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [exams, setExams] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [students, setStudents] = useState([]);
  const [reminders, setReminders] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token, courseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load settings and subject info
      const [settingsRes, coursesRes] = await Promise.all([
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/student/courses`, { headers })
      ]);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      
      // Find the specific course
      const course = coursesRes.data.courses?.find(c => c.id === courseId);
      if (course) {
        setSubject(course);
        setTeacher(course.teacher);
      }
      
      // Load classmates (students in the same section)
      try {
        const classmatesRes = await axios.get(`${API}/api/student/classmates`, { headers });
        setStudents(classmatesRes.data.students || []);
      } catch (e) {
        console.log("Could not load classmates:", e);
      }
      
      // Load course reminders - correct endpoint
      try {
        const remindersRes = await axios.get(`${API}/api/course/${courseId}/reminders`, { headers });
        setReminders(remindersRes.data || []);
      } catch (e) {
        console.log("Could not load reminders:", e);
      }
      
      // Load course content
      await loadContent();
      
    } catch (err) {
      console.error("Error loading course data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      // Load all posts for this course - correct endpoint: /api/course/{subject_id}/posts
      const postsRes = await axios.get(`${API}/api/course/${courseId}/posts`, { headers });
      const allPosts = postsRes.data.posts || postsRes.data || [];
      
      // Separate by type (post_type field)
      setPosts(allPosts.filter(p => p.post_type === "post" || p.post_type === "announcement" || !p.post_type));
      setTasks(allPosts.filter(p => p.post_type === "task"));
      setMaterials(allPosts.filter(p => p.post_type === "material"));
      setForumPosts(allPosts.filter(p => p.post_type === "forum"));
      
      // Load exams
      const examsRes = await axios.get(`${API}/api/exams?subject_id=${courseId}`, { headers }).catch(() => ({ data: [] }));
      setExams(examsRes.data || []);
      
    } catch (err) {
      console.error("Error loading content:", err);
    }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = settings?.logo_url;

  const handleBack = () => {
    const basePath = subdomain ? `/school/${subdomain}` : "";
    navigate(`${basePath}/student/courses`);
  };

  const handleSubmitTask = (task) => {
    // TODO: Implement task submission modal
    console.log("Submit task:", task);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "tablero":
        return (
          <DashboardContent 
            subject={subject}
            teacher={teacher}
            posts={posts}
            students={students}
            tasks={tasks}
            materials={materials}
            reminders={reminders}
            onViewPost={() => {}}
            token={token}
            user={user}
          />
        );
      case "tareas":
        return <TasksContent tasks={tasks} studentId={user?.id} onSubmitTask={handleSubmitTask} />;
      case "material":
        return <MaterialContent materials={materials} />;
      case "examenes":
        return <ExamsContent exams={exams} studentId={user?.id} />;
      case "foro":
        return <ForumContent posts={forumPosts} />;
      default:
        return (
          <DashboardContent 
            subject={subject}
            teacher={teacher}
            posts={posts}
            students={students}
            tasks={tasks}
            materials={materials}
            reminders={reminders}
            onViewPost={() => {}}
            token={token}
            user={user}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active="cursos"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Course Header */}
              <CourseHeader 
                subject={subject} 
                teacher={teacher}
                onBack={handleBack}
              />
              
              {/* Tabs */}
              <div className="mt-6">
                <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} />
              </div>
              
              {/* Tab Content */}
              <div className="mt-6">
                {renderContent()}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
