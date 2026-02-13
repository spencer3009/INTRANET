import { useState, useEffect } from "react";
import axios from "axios";
import {
  ArrowLeft, Loader2, Trash2, Eye, Plus, Edit2,
  MessageCircle, Users, Send
} from "lucide-react";
import PremiumForumModal from "./PremiumForumModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForumContent({ subjectId, token, user, students }) {
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
        <button
          onClick={() => setSelectedTopic(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al listado
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Topic Header */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <span className="text-white/80 text-sm font-medium">Autor</span>
                  <span className="text-white text-sm font-medium">Tema</span>
                </div>
                <span className="text-white/80 text-sm">{formatDate(selectedTopic.created_at)}</span>
              </div>
              
              <div className="p-6 flex gap-6">
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
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
            <div className="col-span-2">Estado</div>
            <div className="col-span-6">Título</div>
            <div className="col-span-2">Fecha</div>
            <div className="col-span-2 text-center">Opciones</div>
          </div>
        </div>
        
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
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Publicado
                  </span>
                </div>
                
                <div className="col-span-6">
                  <p className="font-semibold text-slate-800 truncate">{topic.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    por {topic.author?.name || 'Usuario'}
                  </p>
                </div>
                
                <div className="col-span-2">
                  <p className="text-sm text-slate-600">{formatDate(topic.created_at)}</p>
                </div>
                
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
