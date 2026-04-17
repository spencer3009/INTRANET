import { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus, Edit3, Trash2, Loader2, X, FileText,
  ChevronUp, ChevronDown, CheckCircle, FlaskConical,
  ClipboardCheck, Clock, Monitor, Grid3X3, Key, Copy
} from "lucide-react";
import { toast } from "sonner";
import AnswerKeyEditor from './AnswerKeyEditor';
import CloneActivityModal from "./CloneActivityModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Exam status configuration
const EXAM_STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600', icon: FileText },
  scheduled: { label: 'Programado', color: 'bg-blue-100 text-blue-700', icon: Clock },
  published: { label: 'Publicado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  closed: { label: 'Cerrado', color: 'bg-red-100 text-red-700', icon: X }
};

// Empty State Component
function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-10 h-10 text-purple-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-400 mb-6">{description}</p>
      {action && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// Confirm Modal for Exam Actions
function ConfirmExamModal({ isOpen, onClose, onConfirm, title, message, confirmText, confirmColor }) {
  if (!isOpen) return null;
  
  const colorClasses = {
    green: 'bg-emerald-500 hover:bg-emerald-600',
    amber: 'bg-amber-500 hover:bg-amber-600',
    red: 'bg-red-500 hover:bg-red-600'
  };
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white font-medium rounded-xl transition-colors ${colorClasses[confirmColor] || colorClasses.green}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Exam Modal for Create/Edit
function ExamModal({ isOpen, onClose, onSave, exam, subjectId }) {
  const [examType, setExamType] = useState('digital');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [minScore, setMinScore] = useState(60);
  const [numQuestions, setNumQuestions] = useState(20);
  const [optionsPerQuestion, setOptionsPerQuestion] = useState(5);
  const [pointsPerQuestion, setPointsPerQuestion] = useState(1.0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!exam;

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setExamType(exam.type || 'digital');
        setTitle(exam.title || '');
        setDescription(exam.description || '');
        if (exam.type !== 'omr' && exam.start_datetime && exam.end_datetime) {
          const start = new Date(exam.start_datetime);
          const end = new Date(exam.end_datetime);
          setStartDate(start.toISOString().split('T')[0]);
          setStartTime(start.toTimeString().slice(0, 5));
          setEndDate(end.toISOString().split('T')[0]);
          setEndTime(end.toTimeString().slice(0, 5));
        }
        setMinScore(exam.min_score_percentage || 60);
        setNumQuestions(exam.num_questions || 20);
        setOptionsPerQuestion(exam.options_per_question || 5);
        setPointsPerQuestion(exam.points_per_question || 1.0);
      } else {
        const today = new Date().toISOString().split('T')[0];
        setExamType('digital');
        setTitle(''); setDescription('');
        setStartDate(today); setStartTime('09:00');
        setEndDate(today); setEndTime('10:00');
        setMinScore(60);
        setNumQuestions(20); setOptionsPerQuestion(5); setPointsPerQuestion(1.0);
      }
      setError('');
    }
  }, [isOpen, exam]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El titulo es requerido'); return; }
    if (examType === 'digital' && (!startDate || !endDate)) { setError('Las fechas son requeridas'); return; }
    if (examType === 'omr') {
      if (numQuestions < 5 || numQuestions > 100) { setError('Preguntas: entre 5 y 100'); return; }
      if (pointsPerQuestion <= 0) { setError('Puntaje debe ser positivo'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const data = { title: title.trim(), description: description.trim(), type: examType };
      if (examType === 'digital') {
        data.start_datetime = `${startDate}T${startTime}:00`;
        data.end_datetime = `${endDate}T${endTime}:00`;
        data.min_score_percentage = minScore;
      } else {
        data.num_questions = numQuestions;
        data.options_per_question = optionsPerQuestion;
        data.points_per_question = pointsPerQuestion;
      }
      await onSave(data, exam?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {isEditing ? 'Editar Examen' : 'Nuevo Examen'}
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
          )}

          {/* Type selector — only when creating */}
          {!isEditing && (
            <div className="grid grid-cols-2 gap-3" data-testid="exam-type-selector">
              <button type="button" onClick={() => setExamType('digital')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  examType === 'digital' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <Monitor className={`w-7 h-7 ${examType === 'digital' ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${examType === 'digital' ? 'text-emerald-700' : 'text-gray-500'}`}>Examen en linea</span>
              </button>
              <button type="button" onClick={() => setExamType('omr')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  examType === 'omr' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <Grid3X3 className={`w-7 h-7 ${examType === 'omr' ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${examType === 'omr' ? 'text-emerald-700' : 'text-gray-500'}`}>Examen fisico OMR</span>
              </button>
            </div>
          )}
          {isEditing && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              examType === 'omr' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {examType === 'omr' ? <Grid3X3 className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              {examType === 'omr' ? 'OMR' : 'Digital'}
            </div>
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Titulo del examen *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
              placeholder="Ej: Examen parcial" data-testid="exam-title-input" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Descripcion</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
              placeholder="Instrucciones o descripcion del examen..." data-testid="exam-description-input" />
          </div>

          {/* Digital-specific */}
          {examType === 'digital' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora inicio</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha fin</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hora fin</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nota minima aprobatoria (%)</label>
                <input type="number" value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
                  min={0} max={100}
                  className="w-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400" />
              </div>
            </>
          )}

          {/* OMR-specific */}
          {examType === 'omr' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">N. de preguntas</label>
                  <input type="number" value={numQuestions} min={5} max={100}
                    onChange={(e) => setNumQuestions(Math.max(5, Math.min(100, Number(e.target.value) || 5)))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                    data-testid="omr-num-questions" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Opciones por pregunta</label>
                  <select value={optionsPerQuestion} onChange={(e) => setOptionsPerQuestion(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                    data-testid="omr-options-per-question">
                    <option value={2}>2 (A-B)</option>
                    <option value={3}>3 (A-C)</option>
                    <option value={4}>4 (A-D)</option>
                    <option value={5}>5 (A-E)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Puntaje por pregunta</label>
                <input type="number" value={pointsPerQuestion} min={0.1} step={0.1}
                  onChange={(e) => setPointsPerQuestion(Math.max(0.1, Number(e.target.value) || 0.1))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                  data-testid="omr-points-per-question" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                Total: <strong>{numQuestions * pointsPerQuestion} puntos</strong> ({numQuestions} preguntas x {pointsPerQuestion} pts)
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear examen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Exam Detail View - Imported from separate file or inline
export function ExamDetailView({ examId, token, userRole, onBack }) {
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    const loadExam = async () => {
      try {
        const res = await axios.get(`${API}/exams/${examId}`, { headers });
        setExam(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al cargar examen');
      } finally {
        setLoading(false);
      }
    };
    loadExam();
  }, [examId]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error}</p>
        <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">
          Volver
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-40">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Volver a exámenes
      </button>
      
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{exam?.title}</h2>
            <p className="text-gray-500">{exam?.description || 'Sin descripción'}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500 uppercase">Estado</p>
            <p className="font-semibold text-gray-800">{exam?.status}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Tipo</p>
            <p className="font-semibold text-gray-800">{exam?.type === 'omr' ? 'OMR' : 'Digital'}</p>
          </div>
          {exam?.type === 'omr' ? (
            <>
              <div>
                <p className="text-xs text-gray-500 uppercase">Preguntas</p>
                <p className="font-semibold text-gray-800">{exam?.num_questions || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total puntos</p>
                <p className="font-semibold text-gray-800">{exam?.total_points || 0}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-gray-500 uppercase">Preguntas</p>
                <p className="font-semibold text-gray-800">{exam?.questions?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Nota minima</p>
                <p className="font-semibold text-gray-800">{exam?.min_score_percentage}%</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase">Intentos</p>
            <p className="font-semibold text-gray-800">{exam?.attempts_count || 0}</p>
          </div>
        </div>
        
        {/* OMR → AnswerKeyEditor, Digital → Questions list */}
        {exam?.type === 'omr' ? (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-500" />
              Clave de respuestas
            </h3>
            <AnswerKeyEditor
              examId={exam.id}
              numQuestions={exam.num_questions || 20}
              optionsPerQuestion={exam.options_per_question || 5}
              initialAnswerKey={exam.answer_key}
              token={token}
              onSave={(newKey) => setExam(prev => ({ ...prev, answer_key: newKey }))}
            />
          </div>
        ) : (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-purple-500" />
            Preguntas ({exam?.questions?.length || 0})
          </h3>
          
          {exam?.questions?.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay preguntas. Agrega preguntas al examen.
            </p>
          ) : (
            <div className="space-y-3">
              {exam?.questions?.map((q, idx) => (
                <div key={q.id || idx} className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-medium text-gray-800">
                    {idx + 1}. {q.question_text}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tipo: {q.question_type} | Puntos: {q.points}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// Main ExamsContent Component
export default function ExamsContent({ subjectId, token, userRole }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedExam, setExpandedExam] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [cloneExam, setCloneExam] = useState(null);
  
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
            const start = exam.type === 'omr' ? { date: '', time: '' } : formatDateTime(exam.start_datetime);
            const end = exam.type === 'omr' ? { date: '', time: '' } : formatDateTime(exam.end_datetime);
            const isExpanded = expandedExam === exam.id;
            
            return (
              <div 
                key={exam.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                      <FlaskConical className="w-7 h-7 text-white" />
                    </div>
                    
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
                          <h3 className="text-lg font-bold text-gray-800">
                            {exam.title}
                            <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold align-middle ${
                              exam.type === 'omr' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {exam.type === 'omr' ? <Grid3X3 className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                              {exam.type === 'omr' ? 'OMR' : 'Digital'}
                            </span>
                          </h3>
                          {exam.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{exam.description}</p>
                          )}
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          {exam.type === 'omr' ? (
                            <div className="px-3 py-2 bg-emerald-50 rounded-xl">
                              <p className="text-sm font-semibold text-emerald-700">{exam.num_questions || 0} preguntas</p>
                              <p className="text-xs text-emerald-500">{exam.total_points || 0} pts</p>
                            </div>
                          ) : (
                            <div className="px-3 py-2 bg-gray-50 rounded-xl">
                              <p className="text-sm font-semibold text-gray-700">{start.date}</p>
                              <p className="text-xs text-gray-500">{start.time} - {end.time}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {canEdit && (
                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                          <button
                            onClick={() => setSelectedExamId(exam.id)}
                            className={`px-4 py-2 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all flex items-center gap-1.5 ${
                              exam.type === 'omr'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : 'bg-gradient-to-r from-purple-500 to-pink-500'
                            }`}
                          >
                            {exam.type === 'omr' ? (
                              <><Key className="w-4 h-4" /> CONFIGURAR CLAVE</>
                            ) : (
                              <><Edit3 className="w-4 h-4" /> GESTIONAR</>
                            )}
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
                              PUBLICAR
                            </button>
                          )}
                          
                          {exam.status === 'published' && (
                            <button
                              onClick={() => setConfirmAction({ type: 'close', exam })}
                              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              CERRAR
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
                          <button
                            onClick={() => setCloneExam(exam)}
                            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                          >
                            <Copy className="w-4 h-4" />
                            CLONAR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
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
      
      <ExamModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingExam(null); }}
        onSave={handleSave}
        exam={editingExam}
        subjectId={subjectId}
      />
      
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'publish'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handlePublish(confirmAction?.exam)}
        title="¿Publicar examen?"
        message="El examen será visible para todos los estudiantes del curso."
        confirmText="Publicar"
        confirmColor="green"
      />
      
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'close'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleClose(confirmAction?.exam)}
        title="¿Cerrar examen?"
        message="Los estudiantes ya no podrán acceder al examen."
        confirmText="Cerrar examen"
        confirmColor="amber"
      />
      
      <ConfirmExamModal
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleDelete(confirmAction?.exam)}
        title="¿Eliminar examen?"
        message="Esta acción eliminará permanentemente el examen."
        confirmText="Eliminar"
        confirmColor="red"
      />
      <CloneActivityModal isOpen={!!cloneExam} onClose={() => setCloneExam(null)} activity={cloneExam} activityType="exam" token={token} user={{ role: userRole }} subjectId={subjectId} onSuccess={loadExams} />
    </div>
  );
}
