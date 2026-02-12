import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { 
  Bell, Plus, X, Calendar, FileText, BookOpen, AlertCircle,
  Clock, Check, MoreVertical, Edit2, Trash2, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, Sparkles, Eye, BellRing
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Max characters before truncating description
const MAX_DESCRIPTION_LENGTH = 120;

// Reminder type configuration - Premium balanced colors
const REMINDER_TYPES = {
  task: {
    label: "Tarea",
    icon: FileText,
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-600",
    badgeBg: "bg-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600"
  },
  exam: {
    label: "Examen",
    icon: BookOpen,
    color: "from-rose-500 to-red-500",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-600",
    badgeBg: "bg-rose-500",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600"
  },
  notice: {
    label: "Aviso",
    icon: Bell,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    badgeBg: "bg-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600"
  }
};

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  
  const options = { day: 'numeric', month: 'short' };
  const formatted = date.toLocaleDateString('es-PE', options);
  
  if (diffDays === 0) return { text: "Hoy", formatted, isUrgent: true, hoursLeft: diffHours };
  if (diffDays === 1) return { text: "Mañana", formatted, isUrgent: true, hoursLeft: diffHours };
  if (diffDays < 0) return { text: "Vencido", formatted, isPast: true };
  if (diffDays <= 2) return { text: `En ${diffDays} días`, formatted, isUrgent: true, hoursLeft: diffHours };
  if (diffDays <= 7) return { text: `En ${diffDays} días`, formatted, isSoon: true };
  
  return { text: formatted, formatted, isNormal: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL WRAPPER - Renders children directly to document.body
// ══════════════════════════════════════════════════════════════════════════════
function Portal({ children }) {
  return createPortal(children, document.body);
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER DETAIL MODAL - For viewing full content
// ══════════════════════════════════════════════════════════════════════════════
function ReminderDetailModal({ reminder, isOpen, onClose }) {
  if (!isOpen || !reminder) return null;

  const typeConfig = REMINDER_TYPES[reminder.reminder_type] || REMINDER_TYPES.notice;
  const TypeIcon = typeConfig.icon;
  const dateInfo = formatDate(reminder.date);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 10000, position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
        data-testid="reminder-detail-modal"
      >
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
          style={{ zIndex: 10001 }}
        >
          {/* Header */}
          <div className={`bg-gradient-to-r ${typeConfig.color} px-6 py-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center`}>
                  <TypeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded uppercase">
                      {typeConfig.label}
                    </span>
                    {reminder.is_important && (
                      <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded uppercase">
                        IMPORTANTE
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-white mt-1">{reminder.title}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Date */}
            <div className="flex items-center gap-2 mb-4">
              <Calendar className={`w-4 h-4 ${dateInfo.isPast ? "text-red-500" : dateInfo.isUrgent ? "text-amber-500" : "text-gray-400"}`} />
              <span className={`text-sm font-medium ${
                dateInfo.isPast ? "text-red-600" : dateInfo.isUrgent ? "text-amber-600" : "text-gray-600"
              }`}>
                {dateInfo.text} - {new Date(reminder.date).toLocaleDateString("es-PE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </span>
              {dateInfo.isPast && (
                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">VENCIDO</span>
              )}
            </div>

            {/* Important badge */}
            {reminder.is_important && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">Este recordatorio está marcado como IMPORTANTE</span>
              </div>
            )}

            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Descripción completa</h4>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {reminder.description || "Sin descripción adicional."}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER CARD - Premium balanced style with animations and "Ver completo"
// ══════════════════════════════════════════════════════════════════════════════
function ReminderCard({ reminder, onEdit, onDelete, onComplete, onViewFull, canEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const typeConfig = REMINDER_TYPES[reminder.reminder_type] || REMINDER_TYPES.notice;
  const Icon = typeConfig.icon;
  const dateInfo = formatDate(reminder.date);
  const isCompleted = reminder.status === "completed";
  const isImportant = reminder.is_important;
  
  // Check if description needs truncating
  const description = reminder.description || "";
  const needsTruncation = description.length > MAX_DESCRIPTION_LENGTH;
  const truncatedDescription = needsTruncation 
    ? description.substring(0, MAX_DESCRIPTION_LENGTH) + "..." 
    : description;
  
  // Determine if we should animate (urgent within 48h)
  const shouldAnimate = !isCompleted && (dateInfo.isUrgent || dateInfo.isPast);
  
  return (
    <div 
      className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-200
        ${isCompleted ? "opacity-50" : ""}
        ${isImportant && !isCompleted ? "ring-2 ring-amber-300" : ""}
        border ${dateInfo.isPast && !isCompleted ? "border-red-300" : dateInfo.isUrgent && !isCompleted ? "border-amber-300" : typeConfig.borderColor}
        hover:shadow-md hover:border-violet-200
        ${shouldAnimate ? "animate-subtle-pulse" : ""}`}
      data-testid={`reminder-card-${reminder.id}`}
    >
      {/* Color accent bar */}
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${
        dateInfo.isPast && !isCompleted ? "from-red-500 to-red-600" : 
        dateInfo.isUrgent && !isCompleted ? "from-amber-500 to-orange-500" : 
        typeConfig.color
      }`} />
      
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${
            isImportant && !isCompleted ? "bg-amber-100" : typeConfig.iconBg
          } flex items-center justify-center`}>
            {isImportant && !isCompleted ? (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            ) : (
              <Icon className={`w-4 h-4 ${typeConfig.iconColor}`} />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-block px-2 py-0.5 ${typeConfig.badgeBg} text-white text-[9px] font-bold rounded uppercase`}>
                {typeConfig.label}
              </span>
              {isImportant && !isCompleted && (
                <span className="inline-block px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded uppercase animate-pulse">
                  IMPORTANTE
                </span>
              )}
            </div>
            
            {/* Title */}
            <h4 className={`font-semibold text-gray-800 text-sm leading-tight ${isCompleted ? "line-through text-gray-400" : ""}`}>
              {reminder.title}
            </h4>
            
            {/* Description */}
            {description && (
              <div className="mt-0.5">
                <p className="text-xs text-gray-500 line-clamp-2">{truncatedDescription}</p>
                {needsTruncation && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewFull?.(reminder); }}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium mt-0.5 flex items-center gap-1"
                    data-testid="view-full-btn"
                  >
                    <Eye className="w-3 h-3" />
                    Ver completo
                  </button>
                )}
              </div>
            )}
            
            {/* Date */}
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar className={`w-3 h-3 ${dateInfo.isPast ? "text-red-500" : dateInfo.isUrgent ? "text-amber-500" : "text-gray-400"}`} />
              <span className={`text-xs font-medium ${
                dateInfo.isPast ? "text-red-500" : 
                dateInfo.isUrgent ? "text-amber-600" : 
                "text-gray-500"
              }`}>
                {dateInfo.text}
              </span>
              {dateInfo.isPast && !isCompleted && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded animate-pulse">
                  VENCIDO
                </span>
              )}
              {isCompleted && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> LISTO
                </span>
              )}
            </div>
          </div>
          
          {/* Actions menu */}
          {canEdit && !isCompleted && (
            <div className="relative z-10">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-[70] bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-36">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onComplete?.(reminder); }}
                      className="w-full px-3 py-2.5 text-left text-xs text-gray-600 hover:bg-emerald-50 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Completar</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(reminder); }}
                      className="w-full px-3 py-2.5 text-left text-xs text-gray-600 hover:bg-violet-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-violet-500" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(reminder); }}
                      className="w-full px-3 py-2.5 text-left text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS for subtle animation */}
      <style>{`
        @keyframes subtle-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
          50% { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2); }
        }
        .animate-subtle-pulse {
          animation: subtle-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT REMINDER MODAL - Premium violet theme (with Portal)
// ══════════════════════════════════════════════════════════════════════════════
function ReminderModal({ isOpen, onClose, reminder, onSave, subjectId }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    reminder_type: "task",
    is_important: false,
    notify_all: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (reminder) {
        setFormData({
          title: reminder.title || "",
          description: reminder.description || "",
          date: reminder.date?.split('T')[0] || "",
          reminder_type: reminder.reminder_type || "task",
          is_important: reminder.is_important || false,
          notify_all: reminder.notify_all || false
        });
      } else {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFormData({
          title: "",
          description: "",
          date: tomorrow.toISOString().split('T')[0],
          reminder_type: "task",
          is_important: false,
          notify_all: false
        });
      }
      setError("");
    }
  }, [isOpen, reminder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!formData.date) {
      setError("La fecha es requerida");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        subject_id: subjectId
      }, reminder?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Use Portal to render modal at document.body level - bypasses all stacking contexts
  return (
    <Portal>
      <div 
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        data-testid="reminder-modal-overlay"
      >
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
        <div 
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          style={{ zIndex: 10001 }}
          data-testid="reminder-modal-content"
        >
          {/* Header - Premium violet gradient */}
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {reminder ? "Editar Recordatorio" : "Nuevo Recordatorio"}
                  </h2>
                  <p className="text-xs text-white/70">Visible para todo el curso</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                data-testid="reminder-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Type selector */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(REMINDER_TYPES).map(([key, config]) => {
                  const TypeIcon = config.icon;
                  const isSelected = formData.reminder_type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, reminder_type: key }))}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? `${config.borderColor} ${config.bgColor}` 
                          : "border-gray-100 hover:border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${config.iconBg} flex items-center justify-center mx-auto mb-2`}>
                        <TypeIcon className={`w-4 h-4 ${config.iconColor}`} />
                      </div>
                      <span className={`text-xs font-semibold ${isSelected ? config.textColor : "text-gray-500"}`}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Entrega de proyecto final"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                data-testid="reminder-title-input"
              />
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                data-testid="reminder-date-input"
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción (opcional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalles adicionales..."
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none"
                data-testid="reminder-description-input"
              />
            </div>

            {/* Notification Options - Teacher Controls */}
            <div className="mb-5 p-4 bg-violet-50 rounded-xl border border-violet-100">
              <p className="text-xs font-semibold text-violet-700 uppercase mb-3 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5" />
                Opciones de notificación
              </p>
              
              {/* Important checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-3">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.is_important}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_important: e.target.checked }))}
                    className="sr-only peer"
                    data-testid="reminder-important-checkbox"
                  />
                  <div className="w-5 h-5 border-2 border-violet-300 rounded bg-white peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center">
                    {formData.is_important && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Marcar como IMPORTANTE</span>
                  <p className="text-xs text-gray-500 mt-0.5">Aparecerá destacado y en la campana de notificaciones</p>
                </div>
              </label>

              {/* Notify all checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.notify_all}
                    onChange={(e) => setFormData(prev => ({ ...prev, notify_all: e.target.checked }))}
                    className="sr-only peer"
                    data-testid="reminder-notify-checkbox"
                  />
                  <div className="w-5 h-5 border-2 border-violet-300 rounded bg-white peer-checked:bg-violet-500 peer-checked:border-violet-500 transition-all flex items-center justify-center">
                    {formData.notify_all && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Notificar a todos los alumnos</span>
                  <p className="text-xs text-gray-500 mt-0.5">Mostrará un popup al ingresar al dashboard</p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                data-testid="reminder-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
                data-testid="reminder-submit-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {reminder ? "Actualizar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN REMINDERS PANEL - Premium violet design
// ══════════════════════════════════════════════════════════════════════════════
export default function CourseRemindersPanel({ subjectId, token, userRole }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailReminder, setDetailReminder] = useState(null); // For viewing full content

  const headers = { Authorization: `Bearer ${token}` };
  const canEdit = ["teacher", "admin", "owner", "director", "coordinator"].includes(userRole);

  useEffect(() => {
    loadReminders();
  }, [subjectId]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/course/${subjectId}/reminders`, { headers });
      setReminders(res.data);
    } catch (err) {
      console.error("Error loading reminders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data, reminderId) => {
    if (reminderId) {
      await axios.put(`${API}/course/reminders/${reminderId}`, data, { headers });
    } else {
      await axios.post(`${API}/course/${subjectId}/reminders`, data, { headers });
    }
    loadReminders();
  };

  const handleComplete = async (reminder) => {
    await axios.post(`${API}/course/reminders/${reminder.id}/complete`, {}, { headers });
    loadReminders();
  };

  const handleDelete = async (reminder) => {
    await axios.delete(`${API}/course/reminders/${reminder.id}`, { headers });
    setConfirmDelete(null);
    loadReminders();
  };

  const activeReminders = reminders.filter(r => r.status === "active");
  const completedReminders = reminders.filter(r => r.status === "completed");

  // Separate upcoming and past
  const now = new Date();
  const upcomingReminders = activeReminders.filter(r => new Date(r.date) >= now);
  const pastReminders = activeReminders.filter(r => new Date(r.date) < now);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-violet-100 shadow-sm">
      {/* Header - Premium violet gradient */}
      <div className="px-5 py-4 bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-between">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Recordatorios
        </h4>
        <div className="flex items-center gap-2">
          {activeReminders.length > 0 && (
            <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-sm font-medium">
              {activeReminders.length}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => { setEditingReminder(null); setShowModal(true); }}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Agregar recordatorio"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
      
      <div className="p-4">
        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">Cargando...</p>
          </div>
        ) : activeReminders.length === 0 && completedReminders.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-violet-300" />
            </div>
            <p className="text-gray-400 text-sm">Sin recordatorios</p>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-medium rounded-lg hover:shadow-md transition-all"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Crear primero
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Past/Overdue reminders */}
            {pastReminders.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-red-500 uppercase mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Vencidos ({pastReminders.length})
                </p>
                <div className="space-y-2">
                  {pastReminders.map(reminder => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      canEdit={canEdit}
                      onEdit={() => { setEditingReminder(reminder); setShowModal(true); }}
                      onDelete={() => setConfirmDelete(reminder)}
                      onComplete={() => handleComplete(reminder)}
                      onViewFull={() => setDetailReminder(reminder)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming reminders */}
            {upcomingReminders.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Próximos ({upcomingReminders.length})
                </p>
                <div className="space-y-2">
                  {upcomingReminders.slice(0, 4).map(reminder => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      canEdit={canEdit}
                      onEdit={() => { setEditingReminder(reminder); setShowModal(true); }}
                      onDelete={() => setConfirmDelete(reminder)}
                      onComplete={() => handleComplete(reminder)}
                      onViewFull={() => setDetailReminder(reminder)}
                    />
                  ))}
                </div>
                {upcomingReminders.length > 4 && (
                  <p className="text-[10px] text-center text-violet-500 font-medium mt-2">
                    +{upcomingReminders.length - 4} más
                  </p>
                )}
              </div>
            )}

            {/* Completed reminders toggle */}
            {completedReminders.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full py-1.5 text-[10px] font-medium text-gray-400 hover:text-violet-500 flex items-center justify-center gap-1"
                >
                  {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Completados ({completedReminders.length})
                </button>
                {showCompleted && (
                  <div className="space-y-2 mt-2">
                    {completedReminders.map(reminder => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        canEdit={false}
                        onViewFull={() => setDetailReminder(reminder)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ReminderModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingReminder(null); }}
        reminder={editingReminder}
        onSave={handleSave}
        subjectId={subjectId}
      />

      {/* Detail Modal - View full content */}
      <ReminderDetailModal
        reminder={detailReminder}
        isOpen={!!detailReminder}
        onClose={() => setDetailReminder(null)}
      />

      {/* Delete Confirmation - Using Portal */}
      {confirmDelete && (
        <Portal>
          <div 
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
            data-testid="delete-confirm-overlay"
          >
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
            <div 
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
              style={{ zIndex: 10001 }}
              data-testid="delete-confirm-content"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-2">¿Eliminar recordatorio?</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Se eliminará "{confirmDelete.title}"
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                    data-testid="delete-confirm-cancel"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDelete)}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
                    data-testid="delete-confirm-submit"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
