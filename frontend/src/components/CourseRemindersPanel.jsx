import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Bell, Plus, X, Calendar, FileText, BookOpen, AlertCircle,
  Clock, Check, MoreVertical, Edit2, Trash2, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, Sparkles
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  
  const options = { day: 'numeric', month: 'short' };
  const formatted = date.toLocaleDateString('es-PE', options);
  
  if (diffDays === 0) return { text: "Hoy", formatted, isUrgent: true };
  if (diffDays === 1) return { text: "Mañana", formatted, isUrgent: true };
  if (diffDays < 0) return { text: "Vencido", formatted, isPast: true };
  if (diffDays <= 3) return { text: `En ${diffDays} días`, formatted, isUrgent: true };
  if (diffDays <= 7) return { text: `En ${diffDays} días`, formatted, isSoon: true };
  
  return { text: formatted, formatted, isNormal: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER CARD - Premium balanced style
// ══════════════════════════════════════════════════════════════════════════════
function ReminderCard({ reminder, onEdit, onDelete, onComplete, canEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const typeConfig = REMINDER_TYPES[reminder.reminder_type] || REMINDER_TYPES.notice;
  const Icon = typeConfig.icon;
  const dateInfo = formatDate(reminder.date);
  const isCompleted = reminder.status === "completed";
  
  return (
    <div 
      className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-200
        ${isCompleted ? "opacity-50" : ""}
        border ${typeConfig.borderColor}
        hover:shadow-md hover:border-violet-200`}
    >
      {/* Color accent bar */}
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${typeConfig.color}`} />
      
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${typeConfig.iconBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${typeConfig.iconColor}`} />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <span className={`inline-block px-2 py-0.5 ${typeConfig.badgeBg} text-white text-[9px] font-bold rounded uppercase mb-1`}>
              {typeConfig.label}
            </span>
            
            {/* Title */}
            <h4 className={`font-semibold text-gray-800 text-sm leading-tight ${isCompleted ? "line-through text-gray-400" : ""}`}>
              {reminder.title}
            </h4>
            
            {/* Description */}
            {reminder.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reminder.description}</p>
            )}
            
            {/* Date */}
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar className={`w-3 h-3 ${dateInfo.isPast ? "text-red-500" : "text-gray-400"}`} />
              <span className={`text-xs font-medium ${
                dateInfo.isPast ? "text-red-500" : 
                dateInfo.isUrgent ? "text-amber-600" : 
                "text-gray-500"
              }`}>
                {dateInfo.text}
              </span>
              {dateInfo.isPast && !isCompleted && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded">
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT REMINDER MODAL - Premium violet theme
// ══════════════════════════════════════════════════════════════════════════════
function ReminderModal({ isOpen, onClose, reminder, onSave, subjectId }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    reminder_type: "task"
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
          reminder_type: reminder.reminder_type || "task"
        });
      } else {
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFormData({
          title: "",
          description: "",
          date: tomorrow.toISOString().split('T')[0],
          reminder_type: "task"
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-[9999]">
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
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
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
            />
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detalles adicionales..."
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {reminder ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
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

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
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
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
