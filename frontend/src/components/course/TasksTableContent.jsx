import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ArrowLeft, Loader2, Trash2, Eye, Plus, PenTool,
  Users, User, FileText, Download, Clock, Calendar,
  MoreVertical, CheckCircle
} from "lucide-react";
import PremiumTaskModal from "./PremiumTaskModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TasksTableContent({ subjectId, token, user, students, subject, levelName, gradeName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'submissions'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
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
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get(`${API}/course/${subjectId}/posts?post_type=task&limit=100`, { headers });
        setTasks(res.data.posts || []);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [subjectId, token]);
  
  // Generate mock submissions when viewing submissions
  const loadSubmissions = () => {
    setLoadingSubmissions(true);
    // Mock submissions data - in production this would be an API call
    setTimeout(() => {
      const mockSubmissions = students?.map((student, idx) => ({
        id: student.id,
        student: student,
        comment: '',
        status: idx % 3 === 0 ? 'Entregado' : 'Sin entregar',
        file: idx % 3 === 0 ? 'tarea.pdf' : null,
        teacherComment: '',
        grade: ''
      })) || [];
      setSubmissions(mockSubmissions);
      setLoadingSubmissions(false);
    }, 500);
  };
  
  const handleViewSubmissions = () => {
    setShowMenu(false);
    setViewMode('submissions');
    loadSubmissions();
  };
  
  const handleTaskCreated = (newTask) => {
    setTasks([newTask, ...tasks]);
  };
  
  const handleDeleteClick = (task) => {
    setTaskToDelete(task);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${taskToDelete.id}`, { headers });
      setTasks(tasks.filter(t => t.id !== taskToDelete.id));
      setShowDeleteModal(false);
      setTaskToDelete(null);
      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getDeliveryType = (content) => {
    if (!content) return 'Texto en línea';
    if (content.includes('Archivos')) return 'Archivos';
    if (content.includes('Texto y archivos')) return 'Texto y archivos';
    return 'Texto en línea';
  };
  
  const extractDueDate = (task) => {
    if (task.due_date) return task.due_date;
    if (task.metadata?.due_date) return task.metadata.due_date;
    const match = task.content?.match(/Fecha de entrega:\s*(.+?)(?:\n|$)/);
    if (match) {
      try {
        return new Date(match[1]).toISOString();
      } catch (e) {
        return task.created_at;
      }
    }
    return task.created_at;
  };
  
  // Submissions View
  if (selectedTask && viewMode === 'submissions') {
    return (
      <div className="space-y-4 pt-6 pb-48">
        <button
          onClick={() => { setViewMode('detail'); }}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la tarea
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Entregas</h2>
            <p className="text-slate-500 mt-1">{selectedTask.title}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-white uppercase tracking-wider">
              <div className="col-span-2">Estudiante</div>
              <div className="col-span-2">Comentario del estudiante</div>
              <div className="col-span-2">Estado de la entrega</div>
              <div className="col-span-2">Archivo/Respuesta</div>
              <div className="col-span-2">Comentario del profesor</div>
              <div className="col-span-2">Nota</div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {loadingSubmissions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay estudiantes</h3>
                <p className="text-slate-400">No hay estudiantes matriculados en este curso</p>
              </div>
            ) : (
              submissions.map((submission) => {
                const studentPhoto = submission.student?.photo_url || submission.student?.profile_pic;
                return (
                  <div key={submission.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                    <div className="col-span-2 flex items-center gap-3">
                      {studentPhoto ? (
                        <img 
                          src={studentPhoto} 
                          alt={submission.student?.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700 truncate">{submission.student?.name}</span>
                    </div>
                    
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Sin comentario"
                        value={submission.comment}
                        readOnly
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder:text-slate-400"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        submission.status === 'Entregado' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          submission.status === 'Entregado' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}></span>
                        {submission.status}
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      {submission.file ? (
                        <button className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors">
                          <FileText className="w-4 h-4" />
                          {submission.file}
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">Sin archivo</span>
                      )}
                    </div>
                    
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Añadir comentario..."
                        value={submission.teacherComment}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="0-20"
                        value={submission.grade}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-center"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Detail View (when a task is selected)
  if (selectedTask) {
    return (
      <div className="space-y-4 pt-6 pb-48">
        <button
          onClick={() => setSelectedTask(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la lista
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Task Header */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <PenTool className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-amber-100 text-sm font-medium">Tarea</p>
                      <h2 className="text-xl font-bold text-white">{selectedTask.title}</h2>
                    </div>
                  </div>
                  <div className="relative" ref={menuRef}>
                    <button 
                      onClick={() => setShowMenu(!showMenu)}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                        <button
                          onClick={handleViewSubmissions}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Ver entregas
                        </button>
                        <button
                          onClick={() => handleDeleteClick(selectedTask)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div 
                  className="prose prose-sm max-w-none text-slate-600"
                  dangerouslySetInnerHTML={{ __html: selectedTask.content || 'Sin descripción' }}
                />
                {selectedTask.attachments?.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Archivos adjuntos
                    </h4>
                    <div className="space-y-2">
                      {selectedTask.attachments.map((att, idx) => (
                        <a 
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <FileText className="w-5 h-5 text-amber-500" />
                          <span className="text-sm font-medium text-slate-700">{att.name}</span>
                          <Download className="w-4 h-4 text-slate-400 ml-auto" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Task Info */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-5 py-3">
                <h3 className="font-semibold text-slate-800">Detalles</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Fecha de entrega</p>
                    <p className="text-sm font-medium text-slate-700">{formatDateTime(extractDueDate(selectedTask))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Publicado</p>
                    <p className="text-sm font-medium text-slate-700">{formatDateTime(selectedTask.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Estado</p>
                    <p className="text-sm font-medium text-emerald-600">Publicado</p>
                  </div>
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
                    {students.map((student, idx) => (
                      <div key={student.id || idx} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                        {student.profile_pic ? (
                          <img 
                            src={student.profile_pic} 
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
                          <p className="text-xs text-slate-400">Roll ID: {student.roll_id || student.id?.slice(0, 6)}</p>
                        </div>
                      </div>
                    ))}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tarea</h2>
          <div className="w-8 h-1 bg-amber-500 rounded-full mt-2"></div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center shadow-lg shadow-amber-500/25"
          data-testid="create-task-btn"
        >
          <PenTool className="w-6 h-6" />
        </button>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
            <div className="col-span-2">Estado</div>
            <div className="col-span-4">Título</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">Permitir entregas hasta</div>
            <div className="col-span-2 text-center">Opciones</div>
          </div>
        </div>
        
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
            tasks.map((task) => (
              <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Publicado
                  </span>
                </div>
                
                <div className="col-span-4">
                  <p className="font-semibold text-slate-800 truncate">{task.title}</p>
                </div>
                
                <div className="col-span-2">
                  <span className="inline-block px-3 py-1.5 bg-lime-500 text-white rounded text-xs font-semibold">
                    {getDeliveryType(task.content)}
                  </span>
                </div>
                
                <div className="col-span-2">
                  <p className="text-sm text-slate-600">{formatDate(extractDueDate(task))}</p>
                </div>
                
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors"
                    title="Ver tarea"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(task)}
                    className="w-9 h-9 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-lg flex items-center justify-center transition-colors"
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
      
      <PremiumTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        subjectId={subjectId}
        token={token}
        user={user}
        onPostCreated={handleTaskCreated}
      />
      
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Eliminar tarea</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar la tarea "<strong>{taskToDelete?.title}</strong>"?
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
