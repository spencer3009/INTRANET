import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Bell, X, Calendar, FileText, BookOpen, AlertCircle,
  Clock, ChevronRight, Eye, Loader2, Sparkles, PenTool,
  FolderOpen, MessageSquare, CheckCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Reminder type icons and colors
const REMINDER_TYPE_CONFIG = {
  task: {
    icon: PenTool,
    label: "Tarea",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    badgeColor: "bg-blue-500"
  },
  exam: {
    icon: BookOpen,
    label: "Examen",
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    badgeColor: "bg-rose-500"
  },
  notice: {
    icon: Bell,
    label: "Aviso",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    badgeColor: "bg-amber-500"
  },
  material: {
    icon: FolderOpen,
    label: "Material",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    badgeColor: "bg-orange-500"
  },
  forum: {
    icon: MessageSquare,
    label: "Foro",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    badgeColor: "bg-emerald-500"
  },
  reminder: {
    icon: Bell,
    label: "Recordatorio",
    color: "text-violet-600",
    bgColor: "bg-violet-100",
    badgeColor: "bg-violet-500"
  }
};

// Format relative date
function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: "Vencido", isOverdue: true };
  if (diffDays === 0) return { text: "Hoy", isUrgent: true };
  if (diffDays === 1) return { text: "Mañana", isUrgent: true };
  if (diffDays <= 2) return { text: `En ${diffDays} días`, isUrgent: true };
  
  return { 
    text: date.toLocaleDateString("es-PE", { day: "numeric", month: "short" }),
    isNormal: true 
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER DETAIL MODAL - Portal-based
// ══════════════════════════════════════════════════════════════════════════════
function ReminderDetailModal({ reminder, isOpen, onClose, onMarkViewed }) {
  if (!isOpen || !reminder) return null;

  const typeConfig = REMINDER_TYPE_CONFIG[reminder.reminder_type] || REMINDER_TYPE_CONFIG.notice;
  const TypeIcon = typeConfig.icon;
  const dateInfo = formatRelativeDate(reminder.date);

  const handleMarkViewed = () => {
    onMarkViewed(reminder.id);
    onClose();
  };

  return createPortal(
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
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${typeConfig.bgColor} rounded-xl flex items-center justify-center`}>
                <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 ${typeConfig.badgeColor} text-white text-[10px] font-bold rounded uppercase`}>
                  {typeConfig.label}
                </span>
                <h2 className="text-lg font-semibold text-white mt-1">{reminder.title}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              data-testid="reminder-detail-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Subject & Date */}
          <div className="flex items-center gap-4 mb-4">
            {reminder.subject_name && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: reminder.subject_color || "#6366f1" }}
                />
                <span className="text-sm font-medium text-gray-700">{reminder.subject_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${dateInfo.isOverdue ? "text-red-500" : dateInfo.isUrgent ? "text-amber-500" : "text-gray-400"}`} />
              <span className={`text-sm font-medium ${
                dateInfo.isOverdue ? "text-red-600" : dateInfo.isUrgent ? "text-amber-600" : "text-gray-600"
              }`}>
                {dateInfo.text}
              </span>
              {dateInfo.isOverdue && (
                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">VENCIDO</span>
              )}
            </div>
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
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Descripción</h4>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {reminder.description || "Sin descripción adicional."}
            </p>
          </div>

          {/* Full date */}
          <div className="text-xs text-gray-400 mb-6">
            Fecha límite: {new Date(reminder.date).toLocaleDateString("es-PE", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleMarkViewed}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
              data-testid="reminder-mark-viewed"
            >
              <Eye className="w-4 h-4" />
              Marcar como visto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION ITEM
// ══════════════════════════════════════════════════════════════════════════════
function NotificationItem({ reminder, onClick, onMarkViewed }) {
  const typeConfig = REMINDER_TYPE_CONFIG[reminder.reminder_type] || REMINDER_TYPE_CONFIG.notice;
  const TypeIcon = typeConfig.icon;
  const dateInfo = formatRelativeDate(reminder.date);

  return (
    <div
      className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
      onClick={() => onClick(reminder)}
      data-testid={`notification-item-${reminder.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`flex-shrink-0 w-9 h-9 ${typeConfig.bgColor} rounded-lg flex items-center justify-center`}>
          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {reminder.is_important && (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <h4 className="text-sm font-medium text-gray-800 truncate">{reminder.title}</h4>
          </div>

          {reminder.subject_name && (
            <p className="text-xs text-gray-500 truncate mb-1">{reminder.subject_name}</p>
          )}

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${
              dateInfo.isOverdue ? "text-red-500" : 
              dateInfo.isUrgent ? "text-amber-600" : 
              "text-gray-400"
            }`}>
              {dateInfo.text}
            </span>
            {dateInfo.isOverdue && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold rounded">VENCIDO</span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function NotificationBell({ token }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState({ important: [], upcoming: [], new: [], total_count: 0 });
  const [generalNotifications, setGeneralNotifications] = useState({ notifications: [], unread_count: 0 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all", "reminders", or "messages"
  const dropdownRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load notifications
  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Load reminder notifications, general notifications, and unread messages
      const [remindersRes, generalRes, messagesRes] = await Promise.all([
        axios.get(`${API}/notifications/reminders`, { headers }),
        axios.get(`${API}/notifications/all`, { headers }).catch(() => ({ data: { notifications: [], unread_count: 0 } })),
        axios.get(`${API}/internal-mail/stats`, { headers }).catch(() => ({ data: { unread: 0 } }))
      ]);
      setNotifications(remindersRes.data);
      setGeneralNotifications(generalRes.data);
      setUnreadMessages(messagesRes.data.unread || 0);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and periodically
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mark reminder as viewed
  const markAsViewed = async (reminderId) => {
    try {
      await axios.post(`${API}/course/reminders/${reminderId}/mark-viewed`, {}, { headers });
      loadNotifications(); // Refresh
    } catch (err) {
      console.error("Error marking as viewed:", err);
    }
  };

  // Mark general notification as read
  const markGeneralAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/read`, {}, { headers });
      loadNotifications(); // Refresh
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Mark all general notifications as read
  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`, {}, { headers });
      loadNotifications(); // Refresh
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleReminderClick = (reminder) => {
    setSelectedReminder(reminder);
  };

  const totalCount = (notifications.total_count || 0) + (generalNotifications.unread_count || 0) + unreadMessages;
  const hasNotifications = totalCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) loadNotifications(); }}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#001f4b] hover:bg-slate-100 transition-colors relative"
        data-testid="notification-bell-button"
      >
        <Bell className={`w-5 h-5 ${hasNotifications ? "text-[#001f4b]" : ""}`} />
        {hasNotifications && (
          <span 
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30"
            data-testid="notification-badge"
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificaciones
            </h3>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-medium">
                  {totalCount} pendiente{totalCount !== 1 ? "s" : ""}
                </span>
              )}
              {generalNotifications.unread_count > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-white/80 hover:text-white underline"
                >
                  Marcar todo leído
                </button>
              )}
            </div>
          </div>

          {/* Messages notification */}
          {unreadMessages > 0 && (
            <a 
              href={`/school/${window.location.pathname.split('/')[2]}/mensajes`}
              className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">
                  {unreadMessages} mensaje{unreadMessages !== 1 ? "s" : ""} nuevo{unreadMessages !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-indigo-600">Haz clic para ver tu bandeja de entrada</p>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-400" />
            </a>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "text-violet-600 border-b-2 border-violet-500 bg-violet-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Actividad
              {generalNotifications.unread_count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-violet-500 text-white text-[10px] rounded-full">
                  {generalNotifications.unread_count}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("reminders")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "reminders"
                  ? "text-violet-600 border-b-2 border-violet-500 bg-violet-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Recordatorios
              {notifications.total_count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full">
                  {notifications.total_count}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto" />
                <p className="text-xs text-gray-400 mt-2">Cargando...</p>
              </div>
            ) : activeTab === "all" ? (
              /* General Notifications Tab */
              generalNotifications.notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-violet-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">¡Todo al día!</p>
                  <p className="text-gray-400 text-xs mt-1">No hay actividad reciente</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {generalNotifications.notifications.map((notif) => {
                    const config = REMINDER_TYPE_CONFIG[notif.notification_type] || REMINDER_TYPE_CONFIG.notice;
                    const Icon = config.icon;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => markGeneralAsRead(notif.id)}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notif.is_read ? "bg-violet-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">{notif.title}</p>
                              {!notif.is_read && (
                                <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`px-2 py-0.5 ${config.badgeColor} text-white text-[10px] font-medium rounded-full`}>
                                {config.label}
                              </span>
                              {notif.subject_name && (
                                <span className="text-[10px] text-gray-400">{notif.subject_name}</span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {new Date(notif.created_at).toLocaleDateString("es-PE", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Reminders Tab */
              !hasNotifications ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-violet-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">¡Todo al día!</p>
                  <p className="text-gray-400 text-xs mt-1">No tienes recordatorios pendientes</p>
                </div>
              ) : (
                <>
                  {/* Important Section */}
                  {notifications.important.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Importantes ({notifications.important.length})
                        </p>
                      </div>
                      {notifications.important.map((reminder) => (
                        <NotificationItem
                          key={reminder.id}
                          reminder={reminder}
                          onClick={handleReminderClick}
                          onMarkViewed={markAsViewed}
                        />
                      ))}
                    </div>
                  )}

                  {/* Upcoming Section */}
                  {notifications.upcoming.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-rose-50 border-b border-rose-100">
                        <p className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Próximos a vencer ({notifications.upcoming.length})
                        </p>
                      </div>
                      {notifications.upcoming.map((reminder) => (
                        <NotificationItem
                          key={reminder.id}
                          reminder={reminder}
                          onClick={handleReminderClick}
                          onMarkViewed={markAsViewed}
                        />
                      ))}
                    </div>
                  )}

                  {/* New Section */}
                  {notifications.new.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nuevos ({notifications.new.length})
                        </p>
                      </div>
                      {notifications.new.map((reminder) => (
                        <NotificationItem
                          key={reminder.id}
                          reminder={reminder}
                          onClick={handleReminderClick}
                          onMarkViewed={markAsViewed}
                        />
                      ))}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ReminderDetailModal
        reminder={selectedReminder}
        isOpen={!!selectedReminder}
        onClose={() => setSelectedReminder(null)}
        onMarkViewed={markAsViewed}
      />
    </div>
  );
}
