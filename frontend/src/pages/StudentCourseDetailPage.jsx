import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  BookOpen, ArrowLeft, Clock, Calendar, User, Users,
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Bell, Trophy, Download, Upload, X,
  Loader2, AlertCircle, AlertTriangle, File as FileIcon, 
  ChevronRight, CheckCircle, Lock, Play, Check,
  Eye, ExternalLink, Heart, Send, MessageSquare,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Quote, Code, Link as LinkIcon, Highlighter,
  Heading1, Heading2, Heading3, HardDrive, Cloud,
  ClipboardList, MessagesSquare, Mail, Inbox, SendHorizontal,
  Reply, Trash2, Star, Archive
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Tabs for students (read-only)
const STUDENT_TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: FileText },
  { id: "material", label: "Material", icon: FolderOpen },
  { id: "examenes", label: "Exámenes", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
  { id: "mensajes", label: "Mensajes", icon: Mail },
  { id: "calificaciones", label: "Calificaciones", icon: Trophy },
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
function CourseTabs({ activeTab, onTabChange, messageStats }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STUDENT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const unreadCount = tab.id === "mensajes" ? messageStats?.unread : 0;
          
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
              {unreadCount > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  isActive ? "bg-white/30 text-white" : "bg-red-500 text-white"
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Post File Download Button - For downloading attachments in feed posts
function PostFileDownloadButton({ post, token }) {
  const [downloading, setDownloading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Check if file is stored in Google Drive
      if (post.storage_type === 'google_drive' || post.drive_file_id) {
        // Download through backend (secure streaming)
        const response = await axios.get(`${API}/api/materials/download/${post.id}`, {
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
      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors text-xs"
      data-testid="post-download-btn"
    >
      {downloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="hidden sm:inline">Descargando...</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Descargar</span>
        </>
      )}
    </button>
  );
}

// Post Action Button - Navigation button based on post type
function PostActionButton({ postType, postId, onNavigate }) {
  const getActionConfig = () => {
    switch (postType) {
      case 'task':
        return {
          label: 'Ver tarea',
          icon: ClipboardList,
          hoverColor: 'hover:text-amber-500'
        };
      case 'material':
        return {
          label: 'Ver material',
          icon: FolderOpen,
          hoverColor: 'hover:text-indigo-500'
        };
      case 'forum':
        return {
          label: 'Ver discusión',
          icon: MessagesSquare,
          hoverColor: 'hover:text-purple-500'
        };
      default:
        return null;
    }
  };
  
  const config = getActionConfig();
  if (!config) return null;
  
  const Icon = config.icon;
  
  const handleClick = () => {
    if (onNavigate) {
      onNavigate(config.tab || postType === 'task' ? 'tareas' : postType === 'material' ? 'material' : 'foro', postId);
    } else {
      // Fallback: use URL params to navigate
      const tab = postType === 'task' ? 'tareas' : postType === 'material' ? 'material' : 'foro';
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      url.searchParams.set('postId', postId);
      window.location.href = url.toString();
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 text-slate-500 ${config.hoverColor} transition-colors`}
      data-testid={`post-action-${postType}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm">{config.label}</span>
    </button>
  );
}

// Post Card Component with like and comment functionality
function PostCard({ post, token, user, onNavigateToDetail }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [replyingTo, setReplyingTo] = useState(null); // { id, authorName } for replying to a specific comment
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  
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
      const newCommentData = res.data.comment || res.data;
      newCommentData.replies = []; // Initialize empty replies array
      setComments([...comments, newCommentData]);
      setNewComment("");
      setCommentsCount(prev => prev + 1);
    } catch (err) {
      console.error('Error commenting:', err);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  const handleSubmitReply = async (parentCommentId) => {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      const res = await axios.post(`${API}/api/course/posts/${post.id}/comments`, {
        content: replyText.trim(),
        parent_id: parentCommentId
      }, { headers });
      const newReply = res.data.comment || res.data;
      
      // Add reply to the parent comment
      setComments(comments.map(c => {
        if (c.id === parentCommentId) {
          return { ...c, replies: [...(c.replies || []), newReply] };
        }
        return c;
      }));
      
      setReplyText("");
      setReplyingTo(null);
      setCommentsCount(prev => prev + 1);
    } catch (err) {
      console.error('Error replying:', err);
    } finally {
      setSubmittingReply(false);
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
        {(post.due_date || post.metadata?.due_date) && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm font-medium">
            <Clock className="w-4 h-4" />
            Fecha de entrega: {(() => {
              const dateStr = post.due_date || post.metadata?.due_date;
              const date = new Date(dateStr);
              return !isNaN(date.getTime()) 
                ? date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
                : "Sin fecha definida";
            })()}
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
      
      {/* File Attachment (Google Drive or Cloudinary) */}
      {(post.drive_file_id || post.file_url || post.file_name) && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate text-sm">
                {post.file_name || post.drive_file_name || 'Archivo adjunto'}
              </p>
              <p className="text-xs text-slate-500">
                {post.storage_type === 'google_drive' ? 'Google Drive' : 'Archivo adjunto'}
              </p>
            </div>
            <PostFileDownloadButton post={post} token={token} />
          </div>
        </div>
      )}
      
      {/* Post Actions - Like, Comment, and Action Button */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center">
        <div className="flex items-center gap-6">
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
          
          {/* Action Button - inline with social actions */}
          {itemType !== 'announcement' && (
            <PostActionButton postType={itemType} postId={post.id} onNavigate={onNavigateToDetail} />
          )}
        </div>
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
                <div key={comment.id || idx} className="space-y-3">
                  {/* Main Comment */}
                  <div className="flex items-start gap-3">
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
                    <div className="flex-1">
                      <div className="bg-slate-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">{comment.author?.name || 'Usuario'}</span>
                          <span className="text-xs text-slate-400">{getTimeAgo(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
                      </div>
                      {/* Reply Button */}
                      <button
                        onClick={() => setReplyingTo({ id: comment.id, authorName: comment.author?.name || 'Usuario' })}
                        className="text-xs text-cyan-600 hover:text-cyan-700 font-medium mt-1 ml-2"
                      >
                        Responder
                      </button>
                      
                      {/* Reply Input (shows when replying to this comment) */}
                      {replyingTo?.id === comment.id && (
                        <div className="flex items-start gap-2 mt-3 ml-2">
                          {user?.photo_url ? (
                            <img src={user.photo_url} alt={user?.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {user?.name?.charAt(0) || 'E'}
                            </div>
                          )}
                          <div className="flex-1">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={`Responder a ${replyingTo.authorName}...`}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                className="px-3 py-1 text-slate-500 text-xs font-medium hover:bg-slate-100 rounded-lg"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleSubmitReply(comment.id)}
                                disabled={!replyText.trim() || submittingReply}
                                className="px-3 py-1 bg-cyan-500 text-white text-xs font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                              >
                                {submittingReply ? 'Enviando...' : 'Responder'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Replies to this comment */}
                      {comment.replies?.length > 0 && (
                        <div className="ml-4 mt-3 space-y-3 border-l-2 border-slate-200 pl-3">
                          {comment.replies.map((reply, replyIdx) => (
                            <div key={reply.id || replyIdx} className="flex items-start gap-2">
                              {reply.author?.photo_url ? (
                                <img
                                  src={reply.author.photo_url}
                                  alt={reply.author?.name}
                                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                                  {reply.author?.name?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="flex-1 bg-slate-100 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-slate-800">{reply.author?.name || 'Usuario'}</span>
                                  <span className="text-xs text-slate-400">{getTimeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
function DashboardContent({ subject, teacher, posts, students, tasks, materials, forumPosts, exams, reminders, onViewPost, onNavigateToDetail, token, user, onSendMessage }) {
  const baseColor = subject?.color || "#06b6d4";
  
  // Refs for calculating dynamic sticky top
  const leftColumnRef = useRef(null);
  const rightColumnRef = useRef(null);
  const [leftStickyTop, setLeftStickyTop] = useState('auto');
  const [rightStickyTop, setRightStickyTop] = useState('auto');
  
  // Calculate dynamic sticky top values based on column heights
  useEffect(() => {
    const calculateStickyTops = () => {
      // Only on desktop
      if (window.innerWidth < 1024) {
        setLeftStickyTop('auto');
        setRightStickyTop('auto');
        return;
      }
      
      const headerHeight = 96; // Height of sticky header
      const viewportHeight = window.innerHeight;
      
      if (leftColumnRef.current) {
        const leftHeight = leftColumnRef.current.offsetHeight;
        // Calculate top so sticky activates when bottom of column is visible
        // top = viewportHeight - columnHeight - headerHeight
        const leftTop = Math.max(headerHeight, viewportHeight - leftHeight);
        setLeftStickyTop(`${leftTop}px`);
      }
      
      if (rightColumnRef.current) {
        const rightHeight = rightColumnRef.current.offsetHeight;
        const rightTop = Math.max(headerHeight, viewportHeight - rightHeight);
        setRightStickyTop(`${rightTop}px`);
      }
    };
    
    // Initial calculation after render
    const timer = setTimeout(calculateStickyTops, 100);
    
    // Recalculate on resize
    window.addEventListener('resize', calculateStickyTops);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateStickyTops);
    };
  }, [posts, tasks, materials, forumPosts, students, reminders]); // Recalculate when content changes
  
  // Calculate student's grades for "Mi rendimiento" card
  const studentId = user?.id;
  const taskGrades = tasks
    .map(task => {
      const submission = task.submissions?.find(s => s.student_id === studentId);
      if (submission && submission.grade !== null && submission.grade !== undefined) {
        return { grade: submission.grade, maxGrade: task.max_grade || task.metadata?.points || 20 };
      }
      return null;
    })
    .filter(Boolean);
  
  const examGrades = (exams || [])
    .map(exam => {
      const attempt = exam.attempts?.find(a => a.student_id === studentId);
      if (attempt && attempt.score !== null && attempt.score !== undefined) {
        return { grade: attempt.score, maxGrade: exam.total_points || 20 };
      }
      return null;
    })
    .filter(Boolean);
  
  const allGrades = [...taskGrades, ...examGrades];
  const totalPoints = allGrades.reduce((acc, g) => acc + g.grade, 0);
  const maxTotalPoints = allGrades.reduce((acc, g) => acc + g.maxGrade, 0);
  const average = allGrades.length > 0 ? ((totalPoints / maxTotalPoints) * 20).toFixed(1) : null;
  
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
  
  // Helper to get task due date (can be at root level, in metadata, or parsed from content)
  const getTaskDueDate = (task) => {
    // First try root level
    if (task.due_date) return task.due_date;
    // Then try metadata
    if (task.metadata?.due_date) return task.metadata.due_date;
    // Try to parse from content as last resort
    if (task.content) {
      // Look for ISO date format
      const isoMatch = task.content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      if (isoMatch) return isoMatch[1];
      
      // Parse Spanish date: "14 de febrero de 2026, 11:00 p. m."
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
          if (!isNaN(date.getTime())) return date.toISOString();
        }
      }
    }
    return null;
  };

  // Get upcoming tasks (next 7 days)
  const upcomingTasks = tasks
    .filter(t => {
      const dueDate = getTaskDueDate(t);
      return dueDate && new Date(dueDate) > new Date();
    })
    .slice(0, 3);
  
  // Get recent activity (all posts combined including forum posts)
  const allForumPosts = (forumPosts || []).map(p => ({ ...p, post_type: 'forum' }));
  const allActivity = [...posts, ...tasks, ...materials, ...allForumPosts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Pagination state for activity feed
  const [visiblePosts, setVisiblePosts] = useState(4);
  const POSTS_INCREMENT = 4;
  
  const displayedActivity = allActivity.slice(0, visiblePosts);
  const hasMorePosts = visiblePosts < allActivity.length;
  const remainingPosts = allActivity.length - visiblePosts;

  const handleLoadMore = () => {
    setVisiblePosts(prev => prev + POSTS_INCREMENT);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* LEFT COLUMN - Course Image & Activity (Dynamic Sticky) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div 
        ref={leftColumnRef}
        className="lg:col-span-3 space-y-4 lg:sticky self-start"
        style={{ top: leftStickyTop }}
      >
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
            <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
              <span className="text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                Foro
              </span>
              <span className="font-bold text-slate-800 bg-purple-100 px-2.5 py-0.5 rounded-full text-xs">{(forumPosts || []).length}</span>
            </div>
          </div>
        </div>

        {/* Mi Rendimiento Card */}
        <div className="bg-gradient-to-br from-amber-50/40 to-orange-50/20 rounded-2xl p-4 border border-amber-200/40 shadow-sm">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-white" />
            </div>
            Mi rendimiento
          </h4>
          
          <div className="space-y-3 text-sm">
            {/* Average */}
            <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl">
              <span className="text-slate-600">Promedio</span>
              <span className={`text-2xl font-bold ${
                average === null ? 'text-slate-400' :
                parseFloat(average) >= 14 ? 'text-emerald-600' :
                parseFloat(average) >= 11 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {average || '-'}
              </span>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white/60 rounded-lg text-center">
                <p className="text-lg font-bold text-slate-800">{allGrades.length}</p>
                <p className="text-xs text-slate-500">Evaluaciones</p>
              </div>
              <div className="p-2 bg-white/60 rounded-lg text-center">
                <p className="text-lg font-bold text-slate-800">{taskGrades.length + examGrades.length > 0 ? `${taskGrades.length}/${examGrades.length}` : '0/0'}</p>
                <p className="text-xs text-slate-500">Tareas/Exámenes</p>
              </div>
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
        {allActivity.length > 0 ? (
          <div className="space-y-4">
            {displayedActivity.map((item) => (
              <PostCard key={item.id} post={item} token={token} user={user} onNavigateToDetail={onNavigateToDetail} />
            ))}
            
            {/* Load More Button */}
            {hasMorePosts && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">
                  Mostrando {visiblePosts} de {allActivity.length} publicaciones
                </p>
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
                  data-testid="load-more-posts-btn"
                >
                  Cargar más ({remainingPosts} restantes)
                </button>
              </div>
            )}
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
      {/* RIGHT COLUMN - Teacher, Students, Reminders (Dynamic Sticky) */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div 
        ref={rightColumnRef}
        className="lg:col-span-3 space-y-4 lg:sticky self-start"
        style={{ top: rightStickyTop }}
      >
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
                {/* Send Message Button */}
                <button
                  onClick={() => setActiveTab("mensajes")}
                  className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                  data-testid="send-message-teacher-btn"
                >
                  <Mail className="w-4 h-4" />
                  Enviar mensaje
                </button>
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
                {upcomingTasks.map((task) => {
                  const dueDate = getTaskDueDate(task);
                  return (
                  <div key={task.id} className="p-3 bg-white rounded-xl border border-amber-100">
                    <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dueDate && !isNaN(new Date(dueDate).getTime())
                        ? new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                        : "Sin fecha"}
                    </p>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Rich Text Editor Component for Task Submission
function RichTextEditor({ content, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Escribe tu respuesta aquí...',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('URL del enlace:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const ToolbarButton = ({ onClick, isActive, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        isActive 
          ? 'bg-cyan-100 text-cyan-700' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
      title={title}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-200 mx-1" />
  );

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-2 bg-slate-50 border-b border-slate-200 flex-wrap">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Título 1"
        >
          <span className="text-sm font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Título 2"
        >
          <span className="text-sm font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Título 3"
        >
          <span className="text-sm font-bold">H3</span>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Subrayado"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Highlight */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Resaltar"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista con viñetas"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Alinear izquierda"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Centrar"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Alinear derecha"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justificar"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Quote and Code */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Cita"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Código"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive('link')}
          title="Insertar enlace"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}

// Task Submission Form Component
function TaskSubmissionForm({ task, deliveryType, onSubmit }) {
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);
  
  // Check if task is expired
  const getTaskDueDate = (t) => t.due_date || t.metadata?.due_date || null;
  const dueDate = getTaskDueDate(task);
  const now = new Date();
  const deadline = dueDate ? new Date(dueDate) : null;
  const isExpired = deadline && !isNaN(deadline.getTime()) && deadline < now;
  const allowLateSubmissions = task.metadata?.allow_late_submissions || false;
  const canSubmit = !isExpired || allowLateSubmissions;
  
  // Calculate time remaining or time since expired
  const getTimeStatus = () => {
    if (!deadline || isNaN(deadline.getTime())) return null;
    
    const diff = deadline - now;
    const absDiff = Math.abs(diff);
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (isExpired) {
      if (days > 0) return `Venció hace ${days} día${days > 1 ? 's' : ''}`;
      if (hours > 0) return `Venció hace ${hours} hora${hours > 1 ? 's' : ''}`;
      return `Venció hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      if (days > 0) return `${days} día${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
      if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
      return `${minutes} minuto${minutes > 1 ? 's' : ''} restante${minutes > 1 ? 's' : ''}`;
    }
  };
  
  const timeStatus = getTimeStatus();
  
  // Determine what type of submission is allowed
  const allowsText = deliveryType === 'Texto en línea' || deliveryType === 'Texto y archivos' || deliveryType === 'Tarea';
  const allowsFiles = deliveryType === 'Archivos' || deliveryType === 'Texto y archivos';

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo no puede superar los 10MB');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // Check if can submit
    if (!canSubmit) {
      setError('El plazo para entregar esta tarea ha vencido');
      return;
    }
    
    // Helper to check if HTML content is effectively empty
    const isContentEmpty = (html) => {
      if (!html) return true;
      const div = document.createElement('div');
      div.innerHTML = html;
      return !div.textContent?.trim();
    };

    // Validate based on delivery type
    if (allowsText && !allowsFiles && isContentEmpty(textContent)) {
      setError('Por favor, escribe tu respuesta');
      return;
    }
    if (allowsFiles && !allowsText && !selectedFile) {
      setError('Por favor, selecciona un archivo');
      return;
    }
    if (deliveryType === 'Texto y archivos' && isContentEmpty(textContent) && !selectedFile) {
      setError('Por favor, escribe tu respuesta o adjunta un archivo');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Call the submit function with the submission data
      await onSubmit(task, {
        text_content: textContent,
        file: selectedFile
      });
    } catch (err) {
      setError(err.message || 'Error al entregar la tarea');
    } finally {
      setUploading(false);
    }
  };

  // Get file type icon
  const getFileTypeIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return { color: 'bg-red-100 text-red-600', label: 'PDF' };
    if (['doc', 'docx'].includes(ext)) return { color: 'bg-blue-100 text-blue-600', label: 'Word' };
    if (['xls', 'xlsx'].includes(ext)) return { color: 'bg-green-100 text-green-600', label: 'Excel' };
    if (['ppt', 'pptx'].includes(ext)) return { color: 'bg-orange-100 text-orange-600', label: 'PowerPoint' };
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return { color: 'bg-purple-100 text-purple-600', label: 'Imagen' };
    return { color: 'bg-slate-100 text-slate-600', label: 'Archivo' };
  };

  // If task is expired and no late submissions allowed, show expired message
  if (isExpired && !allowLateSubmissions) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
        {/* Expired Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Plazo Vencido
          </h3>
          <p className="text-red-100 text-sm mt-1">
            {timeStatus}
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h4 className="font-semibold text-red-800">No es posible entregar esta tarea</h4>
              <p className="text-red-600 text-sm mt-1">
                El plazo para la entrega finalizó el {deadline?.toLocaleDateString("es-PE", { 
                  day: "numeric", 
                  month: "long", 
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}. Contacta a tu profesor si tienes alguna duda.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${
        isExpired && allowLateSubmissions 
          ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
      }`}>
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <Send className="w-5 h-5" />
          Entregar Tarea
          {isExpired && allowLateSubmissions && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-2">Entrega tardía</span>
          )}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-cyan-100 text-sm">
            Tipo de entrega: <span className="font-medium text-white">{deliveryType}</span>
          </p>
          {timeStatus && (
            <p className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              isExpired 
                ? 'bg-red-100 text-red-700' 
                : 'bg-white/20 text-white'
            }`}>
              ⏱ {timeStatus}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Rich Text Editor Section */}
        {allowsText && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              📝 Tu respuesta
            </label>
            <RichTextEditor
              content={textContent}
              onChange={setTextContent}
              placeholder="Describe las instrucciones y requisitos de la tarea..."
            />
          </div>
        )}

        {/* File Upload Section */}
        {allowsFiles && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              📎 Adjuntar archivo
            </label>
            
            {/* Google Drive indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <span className="text-sm text-blue-700 font-medium">
                Tu archivo se guardará en Google Drive del colegio
              </span>
            </div>
            
            {!selectedFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors"
                data-testid="file-upload-zone"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">Haz clic para seleccionar un archivo</p>
                <p className="text-sm text-slate-400 mt-1">
                  PDF, Word, Excel, PowerPoint, Imágenes (máx. 10MB)
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getFileTypeIcon(selectedFile.name).color}`}>
                    <FileIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{selectedFile.name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{(selectedFile.size / 1024).toFixed(1)} KB • {getFileTypeIcon(selectedFile.name).label}</span>
                      <span className="text-blue-500 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                        Drive
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar archivo"
                    data-testid="remove-file-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
              className="hidden"
              data-testid="file-input"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {allowsText && allowsFiles 
              ? "Puedes escribir una respuesta y/o adjuntar un archivo"
              : allowsText 
                ? "Escribe tu respuesta en el editor de texto"
                : "Adjunta un archivo con tu trabajo"
            }
          </p>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:from-cyan-600 hover:to-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
            data-testid="submit-task-btn"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Entregar tarea
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tasks Content - Table view like owner's portal (Read-only for students)
function TasksContent({ tasks, studentId, onSubmitTask, students, subject, token, highlightedPostId, onClearHighlight }) {
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Auto-select task if highlightedPostId matches
  useEffect(() => {
    if (highlightedPostId) {
      const taskToHighlight = tasks.find(t => t.id === highlightedPostId);
      if (taskToHighlight) {
        setSelectedTask(taskToHighlight);
        if (onClearHighlight) onClearHighlight();
      }
    }
  }, [highlightedPostId, tasks, onClearHighlight]);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin tareas asignadas"
        description="El profesor aún no ha asignado tareas para este curso."
      />
    );
  }

  // Helper to get due date from task (can be at root level, in metadata, or parsed from content)
  const getTaskDueDate = (task) => {
    // First try root level
    if (task.due_date) return task.due_date;
    // Then try metadata
    if (task.metadata?.due_date) return task.metadata.due_date;
    // Try to parse from content as last resort
    if (task.content) {
      // Look for ISO date format in content (e.g., from older tasks)
      const isoMatch = task.content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      if (isoMatch) {
        return isoMatch[1];
      }
      
      // Try to parse Spanish date format: "14 de febrero de 2026, 11:00 p. m."
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

  // Helper to get delivery type label
  const getDeliveryTypeLabel = (task) => {
    const deliveryType = task.metadata?.delivery_type;
    if (deliveryType === 'text') return 'Texto en línea';
    if (deliveryType === 'files') return 'Archivos';
    if (deliveryType === 'both') return 'Texto y archivos';
    // Try to parse from content if metadata not available
    if (task.content?.includes('Archivos')) return 'Archivos';
    if (task.content?.includes('Texto en línea')) return 'Texto en línea';
    return 'Tarea';
  };

  const getTaskStatus = (task) => {
    const submission = task.submissions?.find(s => s.student_id === studentId);
    if (submission) {
      if (submission.grade !== null && submission.grade !== undefined) {
        return { status: "graded", label: "Calificada", color: "bg-emerald-100 text-emerald-700", grade: submission.grade };
      }
      return { status: "submitted", label: "Entregada", color: "bg-blue-100 text-blue-700" };
    }
    const now = new Date();
    const dueDate = getTaskDueDate(task);
    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      if (!isNaN(dueDateObj.getTime()) && dueDateObj < now) {
        return { status: "late", label: "Vencida", color: "bg-red-100 text-red-700" };
      }
    }
    return { status: "pending", label: "Pendiente", color: "bg-amber-100 text-amber-700" };
  };

  // Task Detail View Component
  if (selectedTask) {
    const taskStatus = getTaskStatus(selectedTask);
    const dueDate = getTaskDueDate(selectedTask);
    const deliveryType = getDeliveryTypeLabel(selectedTask);
    const maxGrade = selectedTask.max_grade || selectedTask.metadata?.points || 20;

    return (
      <div className="space-y-6">
        {/* Simple back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedTask(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            data-testid="back-to-tasks-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver a tareas</span>
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${taskStatus.color}`}>
            {taskStatus.label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Title */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h1 className="text-2xl font-bold text-slate-800 mb-4">{selectedTask.title}</h1>
              
              {/* Task Content */}
              <div className="prose prose-slate max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: selectedTask.content || 'Sin contenido adicional' 
                  }}
                />
              </div>

              {/* File attachment if exists - supports both Cloudinary and Google Drive */}
              {(selectedTask.file_url || selectedTask.drive_file_id) && (
                <TaskFileDownload 
                  task={selectedTask} 
                  token={token}
                />
              )}
            </div>

            {/* Submit Task Section */}
            {taskStatus.status === "pending" && (
              <TaskSubmissionForm 
                task={selectedTask}
                deliveryType={deliveryType}
                onSubmit={onSubmitTask}
              />
            )}
            
            {/* Expired Task Warning Banner */}
            {taskStatus.status === "late" && (
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 overflow-hidden shadow-lg">
                {/* Warning Header */}
                <div className="bg-gradient-to-r from-red-500 via-red-600 to-orange-500 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xl">Plazo de Entrega Vencido</h3>
                      <p className="text-red-100 text-sm mt-0.5">Esta tarea ya no acepta entregas</p>
                    </div>
                  </div>
                </div>
                
                {/* Warning Content */}
                <div className="p-6 space-y-4">
                  {/* Main Message */}
                  <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-red-200 shadow-sm">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-800 text-lg">No es posible enviar esta tarea</h4>
                      <p className="text-red-700 mt-2 leading-relaxed">
                        El plazo para la entrega de esta tarea ha finalizado. 
                        Ya no es posible enviar archivos ni completar la entrega a través de esta plataforma.
                      </p>
                      {dueDate && (
                        <p className="text-red-600 text-sm mt-2 font-medium">
                          La fecha límite fue: {new Date(dueDate).toLocaleDateString("es-PE", { 
                            weekday: 'long',
                            day: "numeric", 
                            month: "long", 
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Contact Teacher Suggestion */}
                  <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-amber-800">¿Necesitas una extensión?</h5>
                      <p className="text-amber-700 text-sm mt-1">
                        Si tienes una justificación válida o necesitas más tiempo, 
                        comunícate directamente con tu profesor para solicitar una extensión del plazo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* Students Stats Card - Orange gradient like owner's portal */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Estudiantes
                </h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Curso:</span>
                  <span className="font-medium text-slate-800">{subject?.name || 'Curso'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Grado:</span>
                  <span className="font-medium text-slate-800">{subject?.grade_name || subject?.level_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Sección:</span>
                  <span className="font-medium text-slate-800">{subject?.section_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Estudiantes totales:</span>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">{students?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Entregada:</span>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">{selectedTask?.submissions?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600">Sin entregar:</span>
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">{(students?.length || 0) - (selectedTask?.submissions?.length || 0)}</span>
                </div>
              </div>
            </div>

            {/* Students List Card - Orange gradient */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Estudiantes
                </h4>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {students && students.length > 0 ? (
                  students.map((student) => {
                    const hasSubmitted = selectedTask?.submissions?.some(s => s.student_id === student.id);
                    return (
                      <div key={student.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {student.name} {student.last_name || ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            Roll ID: {student.id?.slice(-6) || 'N/A'}
                          </p>
                        </div>
                        {hasSubmitted && (
                          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center text-slate-500 text-sm">
                    No hay estudiantes registrados
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <div className="col-span-1">Estado</div>
        <div className="col-span-4">Título</div>
        <div className="col-span-2">Tipo</div>
        <div className="col-span-2">Fecha de entrega</div>
        <div className="col-span-2">Puntaje</div>
        <div className="col-span-1">Opciones</div>
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const taskStatus = getTaskStatus(task);
          const dueDate = getTaskDueDate(task);
          const deliveryType = getDeliveryTypeLabel(task);
          const maxGrade = task.max_grade || task.metadata?.points || 20;
          
          return (
            <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
              {/* Status */}
              <div className="col-span-1">
                <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${taskStatus.color}`}>
                  {taskStatus.label}
                </span>
              </div>
              
              {/* Title */}
              <div className="col-span-4">
                <h3 className="font-medium text-slate-800 truncate">{task.title}</h3>
                {task.description && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>
                )}
              </div>
              
              {/* Type - Shows delivery type like owner portal */}
              <div className="col-span-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-lime-100 text-lime-700 text-xs font-medium rounded-md border border-lime-200">
                  {deliveryType}
                </span>
              </div>
              
              {/* Due Date with Time */}
              <div className="col-span-2 text-sm text-slate-600">
                {dueDate && !isNaN(new Date(dueDate).getTime()) 
                  ? (
                    <div>
                      <span className="font-medium">{new Date(dueDate).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</span>
                      <span className="text-slate-400 ml-1 text-xs">
                        {new Date(dueDate).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                  )
                  : <span className="text-slate-400">Sin fecha</span>
                }
              </div>
              
              {/* Score */}
              <div className="col-span-2">
                {taskStatus.grade !== undefined ? (
                  <span className="font-semibold text-emerald-600">{taskStatus.grade}/{maxGrade}</span>
                ) : (
                  <span className="text-slate-400">{maxGrade} pts</span>
                )}
              </div>
              
              {/* Action - View button (eye) + status indicator */}
              <div className="col-span-1 flex items-center gap-1">
                {/* Eye button to view task - ONLY this should be clickable */}
                <button
                  onClick={() => setSelectedTask(task)}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Ver tarea"
                  data-testid={`view-task-${task.id}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
                
                {/* Status indicator - NOT clickable, just visual indicator */}
                {taskStatus.status === "pending" && (
                  <span 
                    className="p-2 bg-amber-100 text-amber-600 rounded-lg cursor-default"
                    title="Pendiente de entrega"
                  >
                    <Clock className="w-4 h-4" />
                  </span>
                )}
                {taskStatus.status === "submitted" && (
                  <span 
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg cursor-default"
                    title="Entregada"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </span>
                )}
                {taskStatus.status === "graded" && (
                  <span 
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg cursor-default"
                    title="Calificada"
                  >
                    <Trophy className="w-4 h-4" />
                  </span>
                )}
                {taskStatus.status === "late" && (
                  <span 
                    className="p-2 bg-red-100 text-red-600 rounded-lg cursor-default"
                    title="Plazo vencido"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Task File Download Component - handles both Cloudinary and Google Drive
function TaskFileDownload({ task, token }) {
  const [downloading, setDownloading] = useState(false);
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const headers = { Authorization: `Bearer ${token}` };
  
  const isGoogleDrive = task.storage_type === 'google_drive' || task.drive_file_id;
  const fileName = task.file_name || task.drive_file_name || 'Archivo adjunto';
  
  const handleDownload = async () => {
    if (isGoogleDrive) {
      // Download from Google Drive via backend streaming
      setDownloading(true);
      try {
        const response = await fetch(`${API}/materials/download/${task.id}`, {
          headers: headers
        });
        
        if (!response.ok) {
          throw new Error('Error al descargar');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error downloading:', err);
        alert('Error al descargar el archivo. Por favor intenta de nuevo.');
      } finally {
        setDownloading(false);
      }
    } else if (task.file_url) {
      // Cloudinary - open in new tab
      window.open(task.file_url, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 w-full text-left disabled:opacity-50"
      >
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          {downloading ? (
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          ) : (
            <FileIcon className="w-5 h-5 text-indigo-600" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{fileName}</p>
          <p className="text-sm text-slate-500">
            {downloading ? 'Descargando...' : 'Click para descargar'}
            {isGoogleDrive && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                <HardDrive className="w-3 h-3" />
                Drive
              </span>
            )}
          </p>
        </div>
        <Download className="w-5 h-5 ml-auto" />
      </button>
    </div>
  );
}

// Material Content - Card view like owner's portal (Read-only)
function MaterialContent({ materials, token, highlightedPostId, onClearHighlight }) {
  const [downloading, setDownloading] = useState(null);
  const [highlightedMaterialId, setHighlightedMaterialId] = useState(null);
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const headers = { Authorization: `Bearer ${token}` };
  
  // Highlight material if navigated from feed
  useEffect(() => {
    if (highlightedPostId) {
      const materialExists = materials.find(m => m.id === highlightedPostId);
      if (materialExists) {
        setHighlightedMaterialId(highlightedPostId);
        // Scroll to highlighted material after a short delay
        setTimeout(() => {
          const element = document.getElementById(`material-${highlightedPostId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        if (onClearHighlight) onClearHighlight();
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedMaterialId(null), 3000);
      }
    }
  }, [highlightedPostId, materials, onClearHighlight]);
  
  if (materials.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Sin material de estudio"
        description="El profesor aún no ha compartido material de estudio."
      />
    );
  }

  // Get file icon based on extension or type
  const getFileIcon = (material) => {
    const fileName = material.file_name || material.drive_file_name || material.title;
    const ext = fileName?.split('.').pop()?.toLowerCase();
    
    if (['pdf'].includes(ext)) return <FileIcon className="w-5 h-5 text-red-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileIcon className="w-5 h-5 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext)) return <FileIcon className="w-5 h-5 text-green-500" />;
    if (['ppt', 'pptx'].includes(ext)) return <FileIcon className="w-5 h-5 text-orange-500" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <FileIcon className="w-5 h-5 text-purple-500" />;
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };

  // Handle download - supports both Google Drive and Cloudinary
  const handleDownload = async (material) => {
    const isGoogleDrive = material.storage_type === 'google_drive' || material.drive_file_id;
    
    if (isGoogleDrive) {
      // Download from Google Drive via backend streaming
      setDownloading(material.id);
      try {
        const response = await fetch(`${API}/materials/download/${material.id}`, {
          headers: headers
        });
        
        if (!response.ok) {
          throw new Error('Error al descargar');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', material.file_name || material.drive_file_name || 'archivo');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error downloading:', err);
        alert('Error al descargar el archivo. Por favor intenta de nuevo.');
      } finally {
        setDownloading(null);
      }
    } else if (material.file_url) {
      // Cloudinary - open in new tab
      window.open(material.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const isGoogleDrive = (material) => material.storage_type === 'google_drive' || material.drive_file_id;

  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Card container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {materials.map((material) => {
            const fileName = material.file_name || material.drive_file_name || material.title;
            const fileSize = formatFileSize(material.file_size);
            const isDrive = isGoogleDrive(material);
            const isHighlighted = highlightedMaterialId === material.id;
            
            return (
              <div 
                key={material.id} 
                id={`material-${material.id}`}
                className={`flex items-center px-6 py-4 transition-all duration-300 ${
                  isHighlighted 
                    ? 'bg-cyan-50 ring-2 ring-cyan-400' 
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Title and File info together */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{material.title}</p>
                  <div className="flex items-center gap-2 text-slate-500">
                    {getFileIcon(material)}
                    <span className="text-sm">Archivo</span>
                    {fileSize && (
                      <span className="text-xs text-slate-400">({fileSize})</span>
                    )}
                    {/* Storage indicator */}
                    {isDrive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        <HardDrive className="w-3 h-3" />
                        Drive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                        <Cloud className="w-3 h-3" />
                        Cloud
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Download Button */}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Exams Content - Cards view like owner's portal (Read-only for students)
function ExamsContent({ exams, studentId, subdomain, token }) {
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };
  const [examAttempts, setExamAttempts] = useState({});
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [startingExam, setStartingExam] = useState(null);
  
  // Fetch attempt status for each exam
  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const attempts = {};
        for (const exam of exams) {
          try {
            const res = await axios.get(`${API}/api/exams/${exam.id}/my-attempt`, { headers });
            if (res.data.has_attempt) {
              attempts[exam.id] = res.data.attempt;
            }
          } catch (err) {
            // Ignore individual errors
          }
        }
        setExamAttempts(attempts);
      } catch (err) {
        console.error('Error fetching attempts:', err);
      } finally {
        setLoadingAttempts(false);
      }
    };
    
    if (exams.length > 0) {
      fetchAttempts();
    } else {
      setLoadingAttempts(false);
    }
  }, [exams]);
  
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
    const attempt = examAttempts[exam.id];
    
    if (attempt) {
      if (attempt.status === 'completed') {
        return { 
          status: "completed", 
          label: "Completado", 
          color: "bg-emerald-100 text-emerald-700", 
          borderColor: "border-emerald-200", 
          score: attempt.percentage,
          attemptId: attempt.id 
        };
      }
      if (attempt.status === 'in_progress') {
        return { 
          status: "in_progress", 
          label: "En progreso", 
          color: "bg-amber-100 text-amber-700", 
          borderColor: "border-amber-200",
          attemptId: attempt.id 
        };
      }
      if (attempt.status === 'expired') {
        return { 
          status: "expired", 
          label: "Tiempo agotado", 
          color: "bg-red-100 text-red-700", 
          borderColor: "border-red-200",
          attemptId: attempt.id 
        };
      }
    }
    
    // Use is_available flag from API if present
    if (exam.is_available === false && exam.availability_message?.includes('finalizado')) {
      return { status: "closed", label: "Cerrado", color: "bg-red-100 text-red-700", borderColor: "border-red-200" };
    }
    
    const now = new Date();
    const startDate = new Date(exam.start_datetime || exam.start_date);
    const endDate = new Date(exam.end_datetime || exam.end_date);
    
    if (now < startDate) {
      return { status: "upcoming", label: "Próximamente", color: "bg-slate-100 text-slate-600", borderColor: "border-slate-200" };
    }
    if (now > endDate) {
      return { status: "closed", label: "Cerrado", color: "bg-red-100 text-red-700", borderColor: "border-red-200" };
    }
    return { status: "available", label: "Disponible", color: "bg-cyan-100 text-cyan-700", borderColor: "border-cyan-200" };
  };
  
  const handleStartExam = (exam) => {
    setStartingExam(exam.id);
    navigate(`/school/${subdomain}/exam/${exam.id}/attempt`);
  };
  
  const handleViewResults = (exam, attemptId) => {
    navigate(`/school/${subdomain}/exam/${exam.id}/result/${attemptId}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {exams.map((exam) => {
        const examStatus = getExamStatus(exam);
        
        return (
          <div 
            key={exam.id} 
            className={`bg-white rounded-2xl border-2 ${examStatus.borderColor} overflow-hidden hover:shadow-lg transition-all`}
          >
            {/* Exam Header with gradient */}
            <div className={`px-5 py-4 ${
              examStatus.status === 'available' ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' :
              examStatus.status === 'in_progress' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
              examStatus.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
              examStatus.status === 'closed' || examStatus.status === 'expired' ? 'bg-gradient-to-r from-red-400 to-red-500' :
              'bg-gradient-to-r from-slate-400 to-slate-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{exam.title}</h3>
                    <p className="text-white/80 text-xs">{exam.questions?.length || 0} preguntas</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${examStatus.color}`}>
                  {examStatus.label}
                </span>
              </div>
            </div>
            
            {/* Exam Body */}
            <div className="p-5">
              {exam.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{exam.description}</p>
              )}
              
              {/* Exam Info */}
              <div className="space-y-3">
                {exam.duration_minutes && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Duración
                    </span>
                    <span className="font-semibold text-slate-800">{exam.duration_minutes} min</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Fecha inicio
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(exam.start_datetime || exam.start_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Fecha fin
                  </span>
                  <span className="font-semibold text-slate-800">
                    {new Date(exam.end_datetime || exam.end_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                  </span>
                </div>
                
                {examStatus.score !== undefined && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      Tu puntaje
                    </span>
                    <span className="font-bold text-emerald-600 text-lg">{examStatus.score?.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              
              {/* Action Button */}
              <div className="mt-5">
                {examStatus.status === "available" && (
                  <button 
                    onClick={() => handleStartExam(exam)}
                    disabled={startingExam === exam.id}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-cyan-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {startingExam === exam.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    Iniciar Examen
                  </button>
                )}
                {examStatus.status === "in_progress" && (
                  <button 
                    onClick={() => handleStartExam(exam)}
                    disabled={startingExam === exam.id}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {startingExam === exam.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    Continuar Examen
                  </button>
                )}
                {examStatus.status === "upcoming" && (
                  <div className="w-full py-3 bg-slate-100 text-slate-500 font-semibold rounded-xl flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    No disponible aún
                  </div>
                )}
                {examStatus.status === "closed" && (
                  <div className="w-full py-3 bg-red-50 text-red-500 font-semibold rounded-xl flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Examen cerrado
                  </div>
                )}
                {examStatus.status === "expired" && (
                  <button 
                    onClick={() => handleViewResults(exam, examStatus.attemptId)}
                    className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100"
                  >
                    <Eye className="w-5 h-5" />
                    Ver resultados
                  </button>
                )}
                {examStatus.status === "completed" && (
                  <button 
                    onClick={() => handleViewResults(exam, examStatus.attemptId)}
                    className="w-full py-3 bg-emerald-50 text-emerald-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100"
                  >
                    <Eye className="w-5 h-5" />
                    Ver resultados
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Student Forum Download Button - For downloading attachments in forum posts
function StudentForumDownloadButton({ post, token }) {
  const [downloading, setDownloading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Check if file is stored in Google Drive
      if (post.storage_type === 'google_drive' || post.drive_file_id) {
        // Download through backend (secure streaming)
        const response = await axios.get(`${API}/api/materials/download/${post.id}`, {
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
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors text-sm"
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

// Forum Content - Table view for students with detail modal
function ForumContent({ posts, token, user, students, highlightedPostId, onClearHighlight }) {
  const [selectedPost, setSelectedPost] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, authorName }
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Auto-select post if highlighted from feed
  useEffect(() => {
    if (highlightedPostId) {
      const postToHighlight = posts.find(p => p.id === highlightedPostId);
      if (postToHighlight) {
        handleViewPost(postToHighlight);
        if (onClearHighlight) onClearHighlight();
      }
    }
  }, [highlightedPostId, posts]);
  
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
  
  const loadComments = async (postId) => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/api/course/posts/${postId}/comments`, { headers });
      setComments(res.data || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handleViewPost = async (post) => {
    setSelectedPost(post);
    await loadComments(post.id);
    setShowComments(true);
  };
  
  const handleSubmitComment = async () => {
    if (!newComment.trim() || submittingComment || !selectedPost) return;
    setSubmittingComment(true);
    try {
      const res = await axios.post(`${API}/api/course/posts/${selectedPost.id}/comments`, {
        content: newComment.trim()
      }, { headers });
      const newCommentData = res.data.comment || res.data;
      newCommentData.replies = [];
      setComments([...comments, newCommentData]);
      setNewComment("");
    } catch (err) {
      console.error('Error commenting:', err);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  const handleSubmitReply = async (parentCommentId) => {
    if (!replyText.trim() || submittingReply || !selectedPost) return;
    setSubmittingReply(true);
    try {
      const res = await axios.post(`${API}/api/course/posts/${selectedPost.id}/comments`, {
        content: replyText.trim(),
        parent_id: parentCommentId
      }, { headers });
      const newReply = res.data.comment || res.data;
      
      // Add reply to the parent comment
      setComments(comments.map(c => {
        if (c.id === parentCommentId) {
          return { ...c, replies: [...(c.replies || []), newReply] };
        }
        return c;
      }));
      
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      console.error('Error replying:', err);
    } finally {
      setSubmittingReply(false);
    }
  };
  
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin discusiones"
        description="Aún no hay discusiones en el foro de este curso."
      />
    );
  }

  // Detail View of a forum post
  if (selectedPost) {
    const authorObj = selectedPost.author || {};
    const authorName = authorObj.name || 'Profesor';
    const authorPhoto = authorObj.photo_url;
    
    return (
      <div className="space-y-4">
        {/* Back Button */}
        <button
          onClick={() => { setSelectedPost(null); setShowComments(false); setComments([]); }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Post Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl px-6 py-4">
              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center gap-4">
                  <span className="font-medium">Autor</span>
                  <span className="font-medium">Tema</span>
                </div>
                <span>{new Date(selectedPost.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })} {new Date(selectedPost.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            
            {/* Post Content */}
            <div className="bg-white rounded-b-2xl border border-slate-200 p-6">
              <div className="flex gap-6">
                {/* Author Column */}
                <div className="flex flex-col items-center text-center w-24 flex-shrink-0">
                  {authorPhoto ? (
                    <img src={authorPhoto} alt={authorName} className="w-16 h-16 rounded-full object-cover mb-2" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xl font-bold mb-2">
                      {authorName?.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold text-slate-800 text-sm">{authorName}</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full mt-1">
                    {authorObj.role === 'teacher' ? 'Docente' : 'Usuario'}
                  </span>
                </div>
                
                {/* Content Column */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-800 mb-4">{selectedPost.title}</h2>
                  <div 
                    className="prose prose-sm max-w-none text-slate-600"
                    dangerouslySetInnerHTML={{ __html: selectedPost.content || '' }}
                  />
                  
                  {/* File attachment */}
                  {(selectedPost.drive_file_id || selectedPost.file_url) && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {selectedPost.file_name || selectedPost.drive_file_name || 'Archivo adjunto'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedPost.storage_type === 'google_drive' ? 'Google Drive' : 'Archivo'}
                          </p>
                        </div>
                        <StudentForumDownloadButton post={selectedPost} token={token} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Comment Section */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-500" />
                  Respuestas ({comments.length})
                </h3>
                
                {/* Comment Input */}
                <div className="flex items-start gap-3 mb-6">
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt={user?.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                      {user?.name?.charAt(0) || 'E'}
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || submittingComment}
                        className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {submittingComment ? 'Enviando...' : 'Responder'}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Comments List */}
                {loadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Sé el primero en responder a este tema.</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          {comment.author?.photo_url ? (
                            <img src={comment.author.photo_url} alt={comment.author?.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-sm font-bold">
                              {comment.author?.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-800">{comment.author?.name || 'Usuario'}</span>
                              <span className="text-xs text-slate-400">{getTimeAgo(comment.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-600">{comment.content}</p>
                            
                            {/* Reply Button */}
                            <button
                              onClick={() => setReplyingTo({ id: comment.id, authorName: comment.author?.name || 'Usuario' })}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2"
                            >
                              Responder
                            </button>
                            
                            {/* Reply Input */}
                            {replyingTo?.id === comment.id && (
                              <div className="flex items-start gap-2 mt-3">
                                {user?.photo_url ? (
                                  <img src={user.photo_url} alt={user?.name} className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                    {user?.name?.charAt(0) || 'E'}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={`Responder a ${replyingTo.authorName}...`}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                    <button
                                      onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                      className="px-3 py-1 text-slate-500 text-xs font-medium hover:bg-slate-100 rounded-lg"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleSubmitReply(comment.id)}
                                      disabled={!replyText.trim() || submittingReply}
                                      className="px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                      {submittingReply ? 'Enviando...' : 'Responder'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Replies */}
                        {comment.replies?.length > 0 && (
                          <div className="ml-12 mt-3 space-y-3 border-l-2 border-emerald-200 pl-4">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-2">
                                {reply.author?.photo_url ? (
                                  <img src={reply.author.photo_url} alt={reply.author?.name} className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold">
                                    {reply.author?.name?.charAt(0) || 'U'}
                                  </div>
                                )}
                                <div className="flex-1 bg-white rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-slate-800">{reply.author?.name}</span>
                                    <span className="text-xs text-slate-400">{getTimeAgo(reply.created_at)}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Sidebar - Participants */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Estudiantes del Curso
              </h4>
              {students && students.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-3">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                          {student.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm text-slate-800">{student.name} {student.last_name?.charAt(0) || ''}.</p>
                        <p className="text-xs text-slate-400">Estudiante</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin compañeros de clase</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Table View (List of forum posts)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 italic">Foro de Discusión</h2>
          <p className="text-slate-500">Gestiona los temas de discusión del curso</p>
        </div>
        {/* No "Nuevo Tema" button for students - read only */}
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2">Estado</div>
          <div className="col-span-6">Título</div>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-2 text-center">Opciones</div>
        </div>
        
        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {posts.map((post) => {
            const authorObj = post.author || {};
            const authorName = authorObj.name || 'Usuario';
            
            return (
              <div key={post.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                {/* Status */}
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Publicado
                  </span>
                </div>
                
                {/* Title */}
                <div className="col-span-6">
                  <h3 className="font-semibold text-slate-800 text-sm">{post.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">por {authorName}</p>
                </div>
                
                {/* Date */}
                <div className="col-span-2 text-sm text-slate-600">
                  {new Date(post.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })} {new Date(post.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                </div>
                
                {/* Actions - Only view for students */}
                <div className="col-span-2 flex justify-center">
                  <button
                    onClick={() => handleViewPost(post)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                    title="Ver tema"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT MESSAGES CONTENT - Gmail-like interface
// ══════════════════════════════════════════════════════════════════════════════
function StudentMessagesContent({ courseId, token, user, teacher }) {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ unread: 0, inbox: 0, sent: 0 });
  const [showCompose, setShowCompose] = useState(false);
  const [allowedRecipients, setAllowedRecipients] = useState([]);
  const [composeData, setComposeData] = useState({ subject: "", body: "", recipients: [] });
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRecipients, setFilteredRecipients] = useState([]);
  const [preselectedTeacher, setPreselectedTeacher] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load messages and stats
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = activeFolder === "sent" 
        ? `${API}/api/student-portal/messages/sent?course_id=${courseId}`
        : `${API}/api/student-portal/messages/inbox?course_id=${courseId}`;
      
      const [messagesRes, statsRes] = await Promise.all([
        axios.get(endpoint, { headers }),
        axios.get(`${API}/api/student-portal/messages/stats?course_id=${courseId}`, { headers })
      ]);
      
      setMessages(messagesRes.data.messages || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId, token, activeFolder]);

  // Load allowed recipients
  const loadAllowedRecipients = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/student-portal/messages/allowed-recipients?course_id=${courseId}`, { headers });
      setAllowedRecipients(res.data.recipients || []);
    } catch (err) {
      console.error("Error loading recipients:", err);
    }
  }, [courseId, token]);

  useEffect(() => {
    loadMessages();
    loadAllowedRecipients();
  }, [loadMessages, loadAllowedRecipients]);

  // View message detail
  const viewMessage = async (msg) => {
    try {
      const res = await axios.get(`${API}/api/student-portal/messages/${msg.id}`, { headers });
      setSelectedMessage(res.data);
      
      // Update local read status
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      
      // Update stats
      if (!msg.is_read) {
        setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      }
    } catch (err) {
      console.error("Error viewing message:", err);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!composeData.subject.trim() || !composeData.body.trim() || composeData.recipients.length === 0) {
      alert("Por favor completa todos los campos");
      return;
    }

    try {
      setSending(true);
      await axios.post(
        `${API}/api/student-portal/messages/send?course_id=${courseId}`,
        {
          subject: composeData.subject,
          body: composeData.body,
          recipient_ids: composeData.recipients.map(r => r.id)
        },
        { headers }
      );
      
      setShowCompose(false);
      setComposeData({ subject: "", body: "", recipients: [] });
      setPreselectedTeacher(null);
      loadMessages();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  };

  // Open compose with preselected teacher
  const openComposeWithTeacher = () => {
    if (teacher) {
      const fullName = `${teacher.name || ''} ${teacher.last_name || ''}`.trim();
      setComposeData({
        subject: "",
        body: "",
        recipients: [{
          id: teacher.id,
          name: fullName,
          role: "teacher",
          photo_url: teacher.photo_url
        }]
      });
    }
    setShowCompose(true);
  };

  // Filter recipients for search
  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredRecipients(
        allowedRecipients.filter(r => 
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !composeData.recipients.find(cr => cr.id === r.id)
        )
      );
    } else {
      setFilteredRecipients([]);
    }
  }, [searchQuery, allowedRecipients, composeData.recipients]);

  // Add recipient
  const addRecipient = (recipient) => {
    setComposeData(prev => ({
      ...prev,
      recipients: [...prev.recipients, recipient]
    }));
    setSearchQuery("");
    setFilteredRecipients([]);
  };

  // Remove recipient
  const removeRecipient = (id) => {
    setComposeData(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r.id !== id)
    }));
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return date.toLocaleDateString("es-PE", { weekday: "short" });
    } else {
      return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
    }
  };

  const FOLDERS = [
    { id: "inbox", label: "Entrada", icon: Inbox, count: stats.inbox },
    { id: "sent", label: "Enviados", icon: SendHorizontal, count: stats.sent },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ minHeight: "600px" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Mensajes
            {stats.unread > 0 && (
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                {stats.unread} nuevos
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowCompose(true)}
            className="px-4 py-2 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg"
          >
            <Send className="w-4 h-4" />
            Redactar
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex" style={{ height: "550px" }}>
        {/* Left: Folders */}
        <div className="w-48 border-r border-slate-200 bg-slate-50 p-3">
          <div className="space-y-1">
            {FOLDERS.map(folder => (
              <button
                key={folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedMessage(null); }}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                  activeFolder === folder.id
                    ? "bg-indigo-100 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <folder.icon className="w-4 h-4" />
                <span className="flex-1 text-left text-sm">{folder.label}</span>
                {folder.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeFolder === folder.id ? "bg-indigo-200" : "bg-slate-200"
                  }`}>
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick action: Message teacher */}
          {teacher && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={openComposeWithTeacher}
                className="w-full px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Escribir al profesor
              </button>
            </div>
          )}
        </div>

        {/* Center: Message List */}
        <div className="w-80 border-r border-slate-200 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Mail className="w-12 h-12 mb-2" />
              <p>Sin mensajes</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => viewMessage(msg)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                    selectedMessage?.id === msg.id ? "bg-indigo-50" : ""
                  } ${!msg.is_read && activeFolder === "inbox" ? "bg-indigo-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {(activeFolder === "inbox" ? msg.sender?.photo_url : msg.recipient?.photo_url) ? (
                      <img
                        src={activeFolder === "inbox" ? msg.sender?.photo_url : msg.recipient?.photo_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {(activeFolder === "inbox" ? msg.sender?.name : msg.recipient?.name)?.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!msg.is_read && activeFolder === "inbox" ? "font-bold text-slate-900" : "text-slate-700"}`}>
                          {activeFolder === "inbox" ? msg.sender?.name : `Para: ${msg.recipient?.name}`}
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${!msg.is_read && activeFolder === "inbox" ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                        {msg.subject}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {msg.body?.replace(/<[^>]*>/g, "").substring(0, 60)}...
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Message Detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedMessage ? (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4">{selectedMessage.subject}</h3>
                <div className="flex items-center gap-3 mb-4">
                  {selectedMessage.sender?.photo_url ? (
                    <img
                      src={selectedMessage.sender.photo_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {selectedMessage.sender?.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">{selectedMessage.sender?.name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(selectedMessage.created_at).toLocaleString("es-PE")}
                    </p>
                  </div>
                  {selectedMessage.sender?.role === "teacher" && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      Profesor
                    </span>
                  )}
                </div>
              </div>
              
              <div 
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
              />

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => {
                    setComposeData({
                      subject: `Re: ${selectedMessage.subject}`,
                      body: "",
                      recipients: [{
                        id: selectedMessage.sender?.id,
                        name: selectedMessage.sender?.name,
                        photo_url: selectedMessage.sender?.photo_url,
                        role: selectedMessage.sender?.role
                      }]
                    });
                    setShowCompose(true);
                  }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-2"
                >
                  <Reply className="w-4 h-4" />
                  Responder
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Mail className="w-16 h-16 mb-3" />
              <p>Selecciona un mensaje para leer</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5" />
                Nuevo mensaje
              </h3>
              <button
                onClick={() => { setShowCompose(false); setComposeData({ subject: "", body: "", recipients: [] }); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 140px)" }}>
              {/* Recipients */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Para:</label>
                <div className="relative">
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[48px]">
                    {composeData.recipients.map(r => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                      >
                        {r.name}
                        <button onClick={() => removeRecipient(r.id)} className="hover:text-indigo-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={composeData.recipients.length === 0 ? "Buscar destinatarios..." : ""}
                      className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-sm"
                    />
                  </div>
                  
                  {/* Search Results */}
                  {filteredRecipients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredRecipients.map(recipient => (
                        <button
                          key={recipient.id}
                          onClick={() => addRecipient(recipient)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          {recipient.photo_url ? (
                            <img src={recipient.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                              {recipient.name?.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{recipient.name}</p>
                            <p className="text-xs text-slate-500">
                              {recipient.role === "teacher" ? "Profesor" : "Compañero"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto:</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Escribe el asunto del mensaje..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mensaje:</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowCompose(false); setComposeData({ subject: "", body: "", recipients: [] }); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending || composeData.recipients.length === 0 || !composeData.subject.trim()}
                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Grades Content - Show student's grades for this course
function GradesContent({ tasks, exams, studentId, subject }) {
  // Calculate grades from tasks
  const taskGrades = tasks
    .map(task => {
      const submission = task.submissions?.find(s => s.student_id === studentId);
      if (submission && submission.grade !== null && submission.grade !== undefined) {
        return {
          id: task.id,
          title: task.title,
          type: 'Tarea',
          maxGrade: task.max_grade || task.metadata?.points || 20,
          grade: submission.grade,
          date: submission.submitted_at || task.created_at
        };
      }
      return null;
    })
    .filter(Boolean);

  // Calculate grades from exams
  const examGrades = exams
    .map(exam => {
      const attempt = exam.attempts?.find(a => a.student_id === studentId);
      if (attempt && attempt.score !== null && attempt.score !== undefined) {
        return {
          id: exam.id,
          title: exam.title,
          type: 'Examen',
          maxGrade: exam.total_points || 20,
          grade: attempt.score,
          date: attempt.completed_at || exam.created_at
        };
      }
      return null;
    })
    .filter(Boolean);

  const allGrades = [...taskGrades, ...examGrades].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  // Calculate average
  const totalPoints = allGrades.reduce((acc, g) => acc + g.grade, 0);
  const maxTotalPoints = allGrades.reduce((acc, g) => acc + g.maxGrade, 0);
  const average = allGrades.length > 0 ? ((totalPoints / maxTotalPoints) * 20).toFixed(1) : '-';

  if (allGrades.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sin calificaciones aún"
        description="Aún no tienes calificaciones registradas en este curso. Completa tareas y exámenes para ver tus notas aquí."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm">Promedio del curso</p>
            <p className="text-4xl font-bold mt-1">{average}</p>
            <p className="text-emerald-100 text-sm mt-1">{subject?.name || 'Curso'}</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{taskGrades.length}</p>
            <p className="text-emerald-100 text-xs">Tareas calificadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{examGrades.length}</p>
            <p className="text-emerald-100 text-xs">Exámenes calificados</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{allGrades.length}</p>
            <p className="text-emerald-100 text-xs">Total evaluaciones</p>
          </div>
        </div>
      </div>

      {/* Grades Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Detalle de calificaciones</h3>
        </div>
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-5">Evaluación</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-3 text-center">Calificación</div>
        </div>
        
        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {allGrades.map((grade) => {
            const percentage = (grade.grade / grade.maxGrade) * 100;
            const gradeColor = percentage >= 70 ? 'text-emerald-600 bg-emerald-50' : 
                              percentage >= 50 ? 'text-amber-600 bg-amber-50' : 
                              'text-red-600 bg-red-50';
            
            return (
              <div key={grade.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                {/* Title */}
                <div className="col-span-5">
                  <h4 className="font-medium text-slate-800 truncate">{grade.title}</h4>
                </div>
                
                {/* Type */}
                <div className="col-span-2">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    grade.type === 'Tarea' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {grade.type}
                  </span>
                </div>
                
                {/* Date */}
                <div className="col-span-2 text-sm text-slate-600">
                  {new Date(grade.date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                </div>
                
                {/* Grade */}
                <div className="col-span-3 flex items-center justify-center gap-2">
                  <span className={`px-3 py-1.5 rounded-lg font-bold ${gradeColor}`}>
                    {grade.grade}/{grade.maxGrade}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [messageStats, setMessageStats] = useState({ unread: 0, inbox: 0, sent: 0 });
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState({ title: "", message: "", type: "success" });
  
  // Content states
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [exams, setExams] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [students, setStudents] = useState([]);
  const [reminders, setReminders] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };
  
  // Function to navigate to detail view from feed
  const handleNavigateToDetail = (tab, postId) => {
    setActiveTab(tab);
    setHighlightedPostId(postId);
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Read URL params for navigation from feed action buttons
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const postId = urlParams.get('postId');
    
    if (tab && postId) {
      setActiveTab(tab);
      setHighlightedPostId(postId);
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.searchParams.delete('postId');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

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
      
      // Load message stats for badge
      try {
        const msgStatsRes = await axios.get(`${API}/api/student-portal/messages/stats?course_id=${courseId}`, { headers });
        setMessageStats(msgStatsRes.data || { unread: 0, inbox: 0, sent: 0 });
      } catch (e) {
        console.log("Could not load message stats:", e);
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
      
      // Load exams - correct endpoint: /api/course/{subject_id}/exams
      try {
        const examsRes = await axios.get(`${API}/api/course/${courseId}/exams`, { headers });
        // Filter to only show published exams for students
        const publishedExams = (examsRes.data || []).filter(e => e.status === 'published' || e.status === 'scheduled');
        setExams(publishedExams);
      } catch (e) {
        console.log("Could not load exams:", e);
        setExams([]);
      }
      
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

  const handleSubmitTask = async (task, submissionData) => {
    try {
      // If submissionData is provided, it means we're submitting from the detail view
      if (submissionData) {
        const formData = new FormData();
        formData.append('task_id', task.id);
        
        if (submissionData.text_content) {
          formData.append('text_content', submissionData.text_content);
        }
        
        if (submissionData.file) {
          formData.append('file', submissionData.file);
        }
        
        // Call the API to submit the task
        await axios.post(
          `${API}/api/course/tasks/${task.id}/submit`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        
        // Reload tasks to show updated status
        await loadContent();
        
        // Show premium success modal
        setSuccessModalContent({
          title: "¡Tarea Entregada!",
          message: "Tu entrega ha sido registrada exitosamente. El profesor revisará tu trabajo pronto.",
          type: "success"
        });
        setShowSuccessModal(true);
      } else {
        // Legacy: just log for now (clicking from table row without detail view)
        console.log("Submit task:", task);
      }
    } catch (err) {
      console.error("Error submitting task:", err);
      throw new Error(err.response?.data?.detail || 'Error al entregar la tarea');
    }
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
            forumPosts={forumPosts}
            exams={exams}
            reminders={reminders}
            onViewPost={() => {}}
            token={token}
            user={user}
          />
        );
      case "tareas":
        return <TasksContent tasks={tasks} studentId={user?.id} onSubmitTask={handleSubmitTask} students={students} subject={subject} token={token} highlightedPostId={highlightedPostId} onClearHighlight={() => setHighlightedPostId(null)} />;
      case "material":
        return <MaterialContent materials={materials} token={token} highlightedPostId={highlightedPostId} onClearHighlight={() => setHighlightedPostId(null)} />;
      case "examenes":
        return <ExamsContent exams={exams} studentId={user?.id} subdomain={subdomain} token={token} />;
      case "foro":
        return <ForumContent posts={forumPosts} token={token} user={user} students={students} highlightedPostId={highlightedPostId} onClearHighlight={() => setHighlightedPostId(null)} />;
      case "mensajes":
        return <StudentMessagesContent courseId={courseId} token={token} user={user} teacher={teacher} />;
      case "calificaciones":
        return <GradesContent tasks={tasks} exams={exams} studentId={user?.id} subject={subject} />;
      default:
        return (
          <DashboardContent 
            subject={subject}
            teacher={teacher}
            posts={posts}
            students={students}
            tasks={tasks}
            materials={materials}
            forumPosts={forumPosts}
            exams={exams}
            reminders={reminders}
            onViewPost={() => {}}
            onNavigateToDetail={handleNavigateToDetail}
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
      <div className="flex-1 min-w-0">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-30">
          <StudentHeader
            user={user}
            onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
            onLogout={onLogout}
            logoUrl={logoUrl}
            schoolName={schoolName}
            subdomain={subdomain || user?.subdomain}
            token={token}
          />
        </div>

        {/* Main Content Area */}
        <main className="p-4 lg:p-6">
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
                <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} messageStats={messageStats} />
              </div>
              
              {/* Tab Content */}
              <div className="mt-6">
                {renderContent()}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Premium Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            {/* Header with gradient */}
            <div className={`px-6 py-8 text-center ${
              successModalContent.type === 'success' 
                ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500' 
                : successModalContent.type === 'error'
                ? 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-500'
                : 'bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500'
            }`}>
              {/* Animated Icon */}
              <div className="w-20 h-20 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                {successModalContent.type === 'success' ? (
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-8 h-8 text-emerald-500" />
                  </div>
                ) : successModalContent.type === 'error' ? (
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-blue-500" />
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{successModalContent.title}</h3>
            </div>
            
            {/* Content */}
            <div className="px-6 py-6 text-center">
              <p className="text-slate-600 mb-6">{successModalContent.message}</p>
              
              {/* Google Drive badge for task submissions */}
              {successModalContent.type === 'success' && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-6 mx-auto w-fit">
                  <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span className="text-sm text-blue-700 font-medium">Guardado en Google Drive</span>
                </div>
              )}
              
              <button
                onClick={() => setShowSuccessModal(false)}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all hover:shadow-lg ${
                  successModalContent.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600'
                    : successModalContent.type === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
