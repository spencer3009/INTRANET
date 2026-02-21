import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { 
  ClipboardList, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  BarChart3, Eye, Users, Send, ChevronRight, Filter, Clock,
  CheckCircle2, XCircle, FileText
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status configuration
const STATUS_CONFIG = {
  draft: { label: "Borrador", color: "#64748B", bgClass: "bg-slate-100", textClass: "text-slate-700", icon: FileText },
  active: { label: "Activa", color: "#10B981", bgClass: "bg-emerald-100", textClass: "text-emerald-700", icon: CheckCircle2 },
  closed: { label: "Cerrada", color: "#EF4444", bgClass: "bg-red-100", textClass: "text-red-700", icon: XCircle }
};

// Role labels
const ROLE_LABELS = {
  teacher: "Profesores",
  student: "Estudiantes",
  parent: "Padres",
  admin: "Administradores",
  director: "Directores"
};

// Chart colors
const CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ══════════════════════════════════════════════════════════════════════════════
function SurveysSkeleton() {
  return (
    <div className="space-y-4" data-testid="surveys-skeleton">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
          <div className="flex gap-2">
            <div className="h-8 bg-slate-200 rounded-full w-20" />
            <div className="h-8 bg-slate-200 rounded-full w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState({ isAdmin, onCreateNew }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center" data-testid="surveys-empty">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ClipboardList className="w-10 h-10 text-indigo-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">No hay encuestas</h3>
      <p className="text-slate-500 mb-6 max-w-md mx-auto">
        {isAdmin 
          ? "Aún no se han creado encuestas. Crea tu primera encuesta para recoger opiniones."
          : "No hay encuestas disponibles para ti en este momento."
        }
      </p>
      {isAdmin && (
        <button
          onClick={onCreateNew}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center gap-2 mx-auto"
          data-testid="create-first-survey-btn"
        >
          <Plus className="w-5 h-5" />
          Crear encuesta
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SURVEY CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function SurveyCard({ survey, isAdmin, onEdit, onView, onResults, onClose, onDelete, onAnswer }) {
  const statusInfo = STATUS_CONFIG[survey.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusInfo.icon;
  const hasResponses = survey.response_count > 0;
  const canRespond = survey.status === "active" && !survey.user_has_responded && !isAdmin;
  
  return (
    <div 
      className={`bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all border-l-4 ${
        survey.status === "active" && hasResponses 
          ? "border-emerald-500" 
          : survey.status === "active" 
          ? "border-amber-400"
          : survey.status === "closed"
          ? "border-slate-300"
          : "border-slate-200"
      }`}
      data-testid={`survey-card-${survey.id}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800 line-clamp-2 mb-2">
              {survey.question}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${statusInfo.bgClass} ${statusInfo.textClass} font-medium`}>
                <StatusIcon className="w-4 h-4" />
                {statusInfo.label}
              </span>
              {survey.target_roles?.length > 0 ? (
                <span className="text-slate-500 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {survey.target_roles.map(r => ROLE_LABELS[r] || r).join(", ")}
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Todos
                </span>
              )}
            </div>
          </div>
          
          {/* Response stats */}
          <div className="flex flex-col items-end">
            <div className="text-2xl font-bold text-slate-800">
              {survey.response_count || 0}
            </div>
            <div className="text-xs text-slate-500">respuestas</div>
            {isAdmin && survey.target_count > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                {survey.participation_rate || 0}% participación
              </div>
            )}
          </div>
        </div>
        
        {/* Options preview */}
        <div className="flex flex-wrap gap-2 mb-4">
          {survey.options?.slice(0, 4).map((opt, idx) => (
            <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm">
              {opt}
            </span>
          ))}
          {survey.options?.length > 4 && (
            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-sm">
              +{survey.options.length - 4} más
            </span>
          )}
        </div>
        
        {/* Participation indicator for active surveys */}
        {isAdmin && survey.status === "active" && survey.target_count > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Participación</span>
              <span>{survey.response_count} / {survey.target_count}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  (survey.participation_rate || 0) > 50 ? "bg-emerald-500" : "bg-amber-400"
                }`}
                style={{ width: `${survey.participation_rate || 0}%` }}
              />
            </div>
          </div>
        )}
        
        {/* User response indicator */}
        {!isAdmin && survey.user_has_responded && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Ya respondiste esta encuesta</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
          {/* User can answer */}
          {canRespond && (
            <button
              onClick={() => onAnswer(survey)}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
              data-testid={`answer-survey-${survey.id}`}
            >
              <Send className="w-4 h-4" />
              Responder
            </button>
          )}
          
          {/* View details */}
          <button
            onClick={() => onView(survey)}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
            data-testid={`view-survey-${survey.id}`}
          >
            <Eye className="w-4 h-4" />
            Ver
          </button>
          
          {/* Admin actions */}
          {isAdmin && (
            <>
              {(survey.status === "active" || survey.status === "closed") && (
                <button
                  onClick={() => onResults(survey)}
                  className="px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors flex items-center gap-2"
                  data-testid={`results-survey-${survey.id}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Resultados
                </button>
              )}
              
              {survey.status !== "closed" && (
                <>
                  <button
                    onClick={() => onEdit(survey)}
                    className="px-4 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition-colors flex items-center gap-2"
                    data-testid={`edit-survey-${survey.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  
                  {survey.status === "active" && (
                    <button
                      onClick={() => onClose(survey)}
                      className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                      data-testid={`close-survey-${survey.id}`}
                    >
                      <XCircle className="w-4 h-4" />
                      Cerrar
                    </button>
                  )}
                </>
              )}
              
              <button
                onClick={() => onDelete(survey)}
                className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                data-testid={`delete-survey-${survey.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Footer info */}
      <div className="px-6 py-3 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {new Date(survey.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        {survey.created_by_name && (
          <span>Por: {survey.created_by_name}</span>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SurveyFormModal({ isOpen, onClose, survey, onSave }) {
  const [formData, setFormData] = useState({
    question: "",
    options: ["", ""],
    target_roles: [],
    status: "draft"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (survey) {
      setFormData({
        question: survey.question || "",
        options: survey.options?.length >= 2 ? [...survey.options] : ["", ""],
        target_roles: survey.target_roles || [],
        status: survey.status || "draft"
      });
    } else {
      setFormData({
        question: "",
        options: ["", ""],
        target_roles: [],
        status: "draft"
      });
    }
    setError("");
  }, [survey, isOpen]);

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ""] }));
  };

  const removeOption = (index) => {
    if (formData.options.length <= 2) return;
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const toggleRole = (role) => {
    const roles = formData.target_roles.includes(role)
      ? formData.target_roles.filter(r => r !== role)
      : [...formData.target_roles, role];
    setFormData(prev => ({ ...prev, target_roles: roles }));
  };

  const handleSubmit = async (e, publishNow = false) => {
    e.preventDefault();
    setError("");

    // Validate
    if (!formData.question.trim()) {
      setError("La pregunta es requerida");
      return;
    }

    const validOptions = formData.options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError("Debes tener al menos 2 opciones válidas");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        question: formData.question.trim(),
        options: validOptions,
        target_roles: formData.target_roles,
        status: publishNow ? "active" : formData.status
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar encuesta");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="survey-form-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {survey?.id ? "Editar Encuesta" : "Nueva Encuesta"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" data-testid="close-modal-btn">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Question */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pregunta principal <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="¿Cuál es tu pregunta?"
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              data-testid="survey-question-input"
            />
          </div>

          {/* Options */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Opciones de respuesta <span className="text-red-500">*</span>
              <span className="font-normal text-slate-500 ml-2">(mínimo 2)</span>
            </label>
            <div className="space-y-3">
              {formData.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Opción ${idx + 1}`}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid={`survey-option-${idx}`}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`remove-option-${idx}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-3 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2 font-medium"
              data-testid="add-option-btn"
            >
              <Plus className="w-5 h-5" />
              Agregar opción
            </button>
          </div>

          {/* Target roles */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Usuarios objetivo
              <span className="font-normal text-slate-500 ml-2">(vacío = todos)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 rounded-xl border-2 transition-all ${
                    formData.target_roles.includes(role)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  data-testid={`role-toggle-${role}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex-1" />
            {!survey?.id && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={saving}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="save-draft-btn"
              >
                <FileText className="w-5 h-5" />
                Guardar borrador
              </button>
            )}
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
              data-testid="publish-survey-btn"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {survey?.id ? "Actualizar" : "Publicar encuesta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANSWER MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AnswerModal({ isOpen, onClose, survey, onSubmit }) {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSelected(null);
    setError("");
    setSuccess(false);
  }, [survey, isOpen]);

  const handleSubmit = async () => {
    if (selected === null) {
      setError("Selecciona una opción");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSubmit(survey.id, selected);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar respuesta");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !survey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="answer-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Responder Encuesta</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8" data-testid="answer-success">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Gracias por tu participación!</h3>
              <p className="text-slate-500 mb-6">Tu respuesta ha sido registrada correctamente.</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Question */}
              <h3 className="text-lg font-bold text-slate-800 mb-6">{survey.question}</h3>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {survey.options?.map((option, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelected(idx)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                      selected === idx
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid={`answer-option-${idx}`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected === idx
                        ? "border-indigo-500 bg-indigo-500"
                        : "border-slate-300"
                    }`}>
                      {selected === idx && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`font-medium ${selected === idx ? "text-indigo-700" : "text-slate-700"}`}>
                      {option}
                    </span>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selected === null}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="submit-answer-btn"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Enviar respuesta
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS MODAL WITH CHARTS
// ══════════════════════════════════════════════════════════════════════════════
function ResultsModal({ isOpen, onClose, surveyId, token }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [chartType, setChartType] = useState("bar");

  useEffect(() => {
    if (isOpen && surveyId) {
      loadResults();
    }
  }, [isOpen, surveyId]);

  const loadResults = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/surveys/${surveyId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cargar resultados");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const chartData = data?.results?.map((r, i) => ({
    name: r.option.length > 20 ? r.option.substring(0, 20) + "..." : r.option,
    fullName: r.option,
    count: r.count,
    percentage: r.percentage,
    fill: CHART_COLORS[i % CHART_COLORS.length]
  })) || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-800">{data.fullName}</p>
          <p className="text-indigo-600">{data.count} votos ({data.percentage}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="results-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Resultados de Encuesta</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          ) : data && (
            <>
              {/* Question */}
              <h3 className="text-xl font-bold text-slate-800 mb-6">{data.survey?.question}</h3>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">{data.total_responses}</div>
                  <div className="text-sm text-indigo-600">Respuestas totales</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{data.target_count}</div>
                  <div className="text-sm text-emerald-600">Usuarios objetivo</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-amber-600">{data.participation_rate}%</div>
                  <div className="text-sm text-amber-600">Participación</div>
                </div>
              </div>

              {/* Chart type toggle */}
              <div className="flex justify-center gap-2 mb-6">
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    chartType === "bar"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid="chart-type-bar"
                >
                  📊 Barras
                </button>
                <button
                  onClick={() => setChartType("pie")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    chartType === "pie"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid="chart-type-pie"
                >
                  🥧 Circular
                </button>
              </div>

              {/* Chart */}
              <div className="h-80 mb-6" data-testid="results-chart">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={(v) => `${v}`} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={500}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={120}
                        dataKey="count"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        animationDuration={500}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Results table */}
              <div className="bg-slate-50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Opción</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Votos</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results?.map((result, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-4 py-3 text-slate-800 flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          {result.option}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{result.count}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                            {result.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW SURVEY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ViewSurveyModal({ isOpen, onClose, survey }) {
  if (!isOpen || !survey) return null;

  const statusInfo = STATUS_CONFIG[survey.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="view-survey-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Detalle de Encuesta</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Status */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusInfo.bgClass} ${statusInfo.textClass} font-medium`}>
              <StatusIcon className="w-4 h-4" />
              {statusInfo.label}
            </span>
            <span className="text-slate-500 text-sm">
              {survey.response_count || 0} respuestas
            </span>
          </div>

          {/* Question */}
          <h3 className="text-lg font-bold text-slate-800 mb-4">{survey.question}</h3>

          {/* Options */}
          <div className="space-y-2 mb-6">
            {survey.options?.map((option, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-xl border-2 ${
                  survey.user_has_responded && survey.user_response === idx
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-slate-700">{option}</span>
                  {survey.user_has_responded && survey.user_response === idx && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Target roles */}
          <div className="mb-6">
            <p className="text-sm text-slate-500 mb-2">Usuarios objetivo:</p>
            <div className="flex flex-wrap gap-2">
              {survey.target_roles?.length > 0 ? (
                survey.target_roles.map(role => (
                  <span key={role} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                    {ROLE_LABELS[role] || role}
                  </span>
                ))
              ) : (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">Todos los usuarios</span>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-sm text-slate-500 pt-4 border-t border-slate-200">
            <p>Creada: {new Date(survey.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}</p>
            {survey.created_by_name && <p>Por: {survey.created_by_name}</p>}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SurveysPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Surveys data
  const [surveys, setSurveys] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answeringSurvey, setAnsweringSurvey] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultssurveyId, setResultsSurveyId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingSurvey, setViewingSurvey] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadSurveys();
    }
  }, [statusFilter]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const settingsRes = await axios.get(`${API}/settings`, { headers });
      setSettings(settingsRes.data);
      await loadSurveys();
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSurveys = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      
      const res = await axios.get(`${API}/surveys`, { headers, params });
      setSurveys(res.data);
    } catch (err) {
      console.error("Error loading surveys:", err);
    }
  };

  const handleCreateNew = () => {
    setEditingSurvey(null);
    setShowFormModal(true);
  };

  const handleEdit = (survey) => {
    setEditingSurvey(survey);
    setShowFormModal(true);
  };

  const handleView = (survey) => {
    setViewingSurvey(survey);
    setShowViewModal(true);
  };

  const handleResults = (survey) => {
    setResultsSurveyId(survey.id);
    setShowResultsModal(true);
  };

  const handleAnswer = (survey) => {
    setAnsweringSurvey(survey);
    setShowAnswerModal(true);
  };

  const handleSaveSurvey = async (data) => {
    if (editingSurvey?.id) {
      await axios.put(`${API}/surveys/${editingSurvey.id}`, data, { headers });
    } else {
      await axios.post(`${API}/surveys`, data, { headers });
    }
    loadSurveys();
  };

  const handleCloseSurvey = async (survey) => {
    if (!window.confirm(`¿Estás seguro de cerrar la encuesta "${survey.question}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      await axios.put(`${API}/surveys/${survey.id}/close`, {}, { headers });
      loadSurveys();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cerrar encuesta");
    }
  };

  const handleDeleteSurvey = async (survey) => {
    if (!window.confirm(`¿Estás seguro de eliminar la encuesta "${survey.question}"? Se perderán todas las respuestas.`)) return;
    
    try {
      await axios.delete(`${API}/surveys/${survey.id}`, { headers });
      loadSurveys();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar encuesta");
    }
  };

  const handleSubmitAnswer = async (surveyId, optionIndex) => {
    await axios.post(`${API}/surveys/${surveyId}/answer`, { option_selected: optionIndex }, { headers });
    loadSurveys();
  };

  // Separate active surveys that need attention
  const activeSurveysForUser = surveys.filter(s => 
    s.status === "active" && 
    !s.user_has_responded && 
    !isAdmin
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="surveys-page">
      <Sidebar 
        active="encuestas"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name}
        subdomain={subdomain}
        user={user}
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
        <main className="flex-1 p-6 lg:p-8">
          {/* Page Title */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <ClipboardList className="w-10 h-10 text-indigo-600" />
                </div>
                <div className="text-white">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Encuestas</h1>
                  <p className="text-indigo-200 text-lg">Participa y opina sobre temas institucionales</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg"
                  data-testid="create-survey-btn"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Encuesta
                </button>
              )}
            </div>
          </div>

          {/* Pending surveys alert for non-admin users */}
          {!isAdmin && activeSurveysForUser.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4" data-testid="pending-surveys-alert">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800">Tienes encuestas pendientes</h3>
                <p className="text-amber-700 text-sm">
                  Hay {activeSurveysForUser.length} encuesta(s) esperando tu participación
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-amber-400" />
            </div>
          )}

          {/* Filters (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
              <div className="flex items-center gap-4">
                <Filter className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Filtrar por estado:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusFilter("")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      statusFilter === ""
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid="filter-all"
                  >
                    Todas
                  </button>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                        statusFilter === key
                          ? `${config.bgClass} ${config.textClass}`
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      data-testid={`filter-${key}`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Surveys List */}
          {loading ? (
            <SurveysSkeleton />
          ) : surveys.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onCreateNew={handleCreateNew} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {surveys.map(survey => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onView={handleView}
                  onResults={handleResults}
                  onClose={handleCloseSurvey}
                  onDelete={handleDeleteSurvey}
                  onAnswer={handleAnswer}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <SurveyFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingSurvey(null);
        }}
        survey={editingSurvey}
        onSave={handleSaveSurvey}
      />

      <AnswerModal
        isOpen={showAnswerModal}
        onClose={() => {
          setShowAnswerModal(false);
          setAnsweringSurvey(null);
        }}
        survey={answeringSurvey}
        onSubmit={handleSubmitAnswer}
      />

      <ResultsModal
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setResultsSurveyId(null);
        }}
        surveyId={resultssurveyId}
        token={token}
      />

      <ViewSurveyModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingSurvey(null);
        }}
        survey={viewingSurvey}
      />
    </div>
  );
}
