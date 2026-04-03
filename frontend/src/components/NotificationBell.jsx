import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Bell, X, Calendar, FileText, BookOpen, AlertCircle,
  Clock, ChevronRight, Eye, Loader2, Sparkles, PenTool,
  FolderOpen, MessageSquare, CheckCircle, CheckCheck, ExternalLink, Wifi, WifiOff,
  Megaphone, UserCheck
} from "lucide-react";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REMINDER_TYPE_CONFIG = {
  task: { icon: PenTool, label: "Tarea", color: "text-blue-600", bgColor: "bg-blue-100", bgColorUnread: "bg-blue-50", badgeColor: "bg-blue-500" },
  exam: { icon: BookOpen, label: "Examen", color: "text-rose-600", bgColor: "bg-rose-100", bgColorUnread: "bg-rose-50", badgeColor: "bg-rose-500" },
  notice: { icon: Bell, label: "Aviso", color: "text-amber-600", bgColor: "bg-amber-100", bgColorUnread: "bg-amber-50", badgeColor: "bg-amber-500" },
  material: { icon: FolderOpen, label: "Material", color: "text-orange-600", bgColor: "bg-orange-100", bgColorUnread: "bg-orange-50", badgeColor: "bg-orange-500" },
  forum: { icon: MessageSquare, label: "Foro", color: "text-emerald-600", bgColor: "bg-emerald-100", bgColorUnread: "bg-emerald-50", badgeColor: "bg-emerald-500" },
  reminder: { icon: Bell, label: "Recordatorio", color: "text-violet-600", bgColor: "bg-violet-100", bgColorUnread: "bg-violet-50", badgeColor: "bg-violet-500" },
  announcement: { icon: Bell, label: "Anuncio", color: "text-indigo-600", bgColor: "bg-indigo-100", bgColorUnread: "bg-indigo-50", badgeColor: "bg-indigo-500" },
};

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Vencido", isOverdue: true };
  if (diffDays === 0) return { text: "Hoy", isUrgent: true };
  if (diffDays === 1) return { text: "Manana", isUrgent: true };
  if (diffDays <= 2) return { text: `En ${diffDays} dias`, isUrgent: true };
  return { text: date.toLocaleDateString("es-PE", { day: "numeric", month: "short" }), isNormal: true };
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ReminderDetailModal({ reminder, isOpen, onClose, onMarkViewed }) {
  if (!isOpen || !reminder) return null;
  const typeConfig = REMINDER_TYPE_CONFIG[reminder.reminder_type] || REMINDER_TYPE_CONFIG.notice;
  const TypeIcon = typeConfig.icon;
  const dateInfo = formatRelativeDate(reminder.date);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10000 }} data-testid="reminder-detail-modal">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" style={{ zIndex: 10001 }}>
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${typeConfig.bgColor} rounded-xl flex items-center justify-center`}>
                <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 ${typeConfig.badgeColor} text-white text-[10px] font-bold rounded uppercase`}>{typeConfig.label}</span>
                <h2 className="text-lg font-semibold text-white mt-1">{reminder.title}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors" data-testid="reminder-detail-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {reminder.subject_name && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: reminder.subject_color || "#6366f1" }} />
                <span className="text-sm font-medium text-gray-700">{reminder.subject_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${dateInfo.isOverdue ? "text-red-500" : dateInfo.isUrgent ? "text-amber-500" : "text-gray-400"}`} />
              <span className={`text-sm font-medium ${dateInfo.isOverdue ? "text-red-600" : dateInfo.isUrgent ? "text-amber-600" : "text-gray-600"}`}>{dateInfo.text}</span>
              {dateInfo.isOverdue && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">VENCIDO</span>}
            </div>
          </div>
          {reminder.is_important && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">Este recordatorio esta marcado como IMPORTANTE</span>
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Descripcion</h4>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{reminder.description || "Sin descripcion adicional."}</p>
          </div>
          <div className="text-xs text-gray-400 mb-6">
            Fecha limite: {new Date(reminder.date).toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">Cerrar</button>
            <button onClick={() => { onMarkViewed(reminder.id); onClose(); }} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25" data-testid="reminder-mark-viewed">
              <Eye className="w-4 h-4" /> Marcar como visto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION ITEM - General (Navigable)
// ══════════════════════════════════════════════════════════════════════════════
function GeneralNotificationItem({ notif, onClick }) {
  const config = REMINDER_TYPE_CONFIG[notif.notification_type] || REMINDER_TYPE_CONFIG.notice;
  const Icon = config.icon;
  const isRead = notif.is_read;
  const hasLink = !!notif.link_destino;

  return (
    <div
      onClick={() => onClick(notif)}
      className={`px-4 py-3 cursor-pointer transition-all border-b border-gray-50 last:border-0 group ${
        isRead
          ? "bg-white hover:bg-gray-50"
          : `${config.bgColorUnread} hover:bg-gray-100`
      }`}
      data-testid={`notification-item-${notif.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center relative`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
          {!isRead && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm truncate ${isRead ? "font-normal text-gray-500" : "font-semibold text-gray-800"}`}>
              {notif.title}
            </p>
          </div>
          <p className={`text-xs mt-0.5 line-clamp-2 ${isRead ? "text-gray-400" : "text-gray-500"}`}>
            {notif.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 ${config.badgeColor} text-white text-[10px] font-medium rounded-full`}>
              {config.label}
            </span>
            {notif.subject_name && (
              <span className="text-[10px] text-gray-400">{notif.subject_name}</span>
            )}
            <span className="text-[10px] text-gray-400">{formatTimeAgo(notif.created_at)}</span>
          </div>
        </div>
        {hasLink && (
          <ExternalLink className={`w-4 h-4 flex-shrink-0 mt-1 transition-colors ${isRead ? "text-gray-300" : "text-violet-400 group-hover:text-violet-600"}`} />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER NOTIFICATION ITEM
// ══════════════════════════════════════════════════════════════════════════════
function ReminderNotificationItem({ reminder, onClick }) {
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
        <div className={`flex-shrink-0 w-9 h-9 ${typeConfig.bgColor} rounded-lg flex items-center justify-center`}>
          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {reminder.is_important && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
            <h4 className="text-sm font-medium text-gray-800 truncate">{reminder.title}</h4>
          </div>
          {reminder.subject_name && <p className="text-xs text-gray-500 truncate mb-1">{reminder.subject_name}</p>}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${dateInfo.isOverdue ? "text-red-500" : dateInfo.isUrgent ? "text-amber-600" : "text-gray-400"}`}>{dateInfo.text}</span>
            {dateInfo.isOverdue && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold rounded">VENCIDO</span>}
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
export default function NotificationBell({ token, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState({ important: [], upcoming: [], new: [], total_count: 0 });
  const [generalNotifications, setGeneralNotifications] = useState({ notifications: [], unread_count: 0 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadBroadcasts, setUnreadBroadcasts] = useState(0);
  const [attendanceNotifs, setAttendanceNotifs] = useState([]);
  const [attendanceUnread, setAttendanceUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);
  const fcmRegistered = useRef(false);
  const navigate = useNavigate();
  const isParent = userRole === "parent";

  const headers = { Authorization: `Bearer ${token}` };

  // Build correct path prefix based on current URL
  const getSchoolPrefix = useCallback(() => {
    const match = window.location.pathname.match(/^\/([^/]+)/);
    return match ? `/${match[1]}` : "";
  }, []);

  // WebSocket handler for real-time push notifications
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === "new_notification") {
      const notif = data.notification;
      setGeneralNotifications(prev => ({
        ...prev,
        unread_count: prev.unread_count + 1,
        notifications: [{ ...notif, is_read: false }, ...prev.notifications]
      }));
      const config = REMINDER_TYPE_CONFIG[notif.notification_type] || REMINDER_TYPE_CONFIG.notice;
      toast(notif.title, {
        description: notif.message,
        duration: 5000,
        icon: <Bell className="w-4 h-4" />,
        action: notif.link_destino ? {
          label: "Ver",
          onClick: () => {
            const prefix = getSchoolPrefix();
            navigate(`${prefix}${notif.link_destino}`);
          }
        } : undefined
      });
    } else if (data.type === "attendance_notification") {
      const notif = data.notification;
      setAttendanceNotifs(prev => [{
        id: notif.id, body: notif.body, type: notif.event_type,
        student_id: notif.student_id, student_name: notif.student_name,
        created_at: notif.created_at, read_at: null,
      }, ...prev]);
      setAttendanceUnread(prev => prev + 1);
      // Dispatch event for AttendanceToast component
      window.dispatchEvent(new CustomEvent("attendance-notification", { detail: notif }));
    } else if (data.type === "new_message") {
      setUnreadMessages(prev => prev + 1);
      toast(`Nuevo mensaje de ${data.sender_name}`, {
        description: data.content,
        duration: 4000,
        icon: <MessageSquare className="w-4 h-4" />
      });
    }
  }, [getSchoolPrefix, navigate]);

  // Connect WebSocket
  const { isConnected } = useNotificationSocket(token, handleWebSocketMessage);

  // FCM Registration for parents
  useEffect(() => {
    if (!token || !isParent || fcmRegistered.current) return;
    fcmRegistered.current = true;
    (async () => {
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await axios.post(`${API}/push/register-token`, { token: fcmToken }, { headers });
        }
      } catch (e) {
        console.warn("FCM registration failed:", e);
      }
    })();
  }, [token, isParent]);

  // FCM foreground listener for parents
  useEffect(() => {
    if (!token || !isParent) return;
    const unsubscribe = onForegroundMessage((payload) => {
      const data = payload.data || {};
      const notif = payload.notification || {};
      toast(notif.title || "Asistencia", {
        description: notif.body,
        duration: 6000,
        icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
      });
      loadAttendanceNotifs();
    });
    return unsubscribe;
  }, [token, isParent]);

  // Load attendance notifications for parents
  const loadAttendanceNotifs = useCallback(async () => {
    if (!token || !isParent) return;
    try {
      const [listRes, countRes] = await Promise.all([
        axios.get(`${API}/push/attendance-notifications?limit=20`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/push/unread-count`, { headers }).catch(() => ({ data: { count: 0 } })),
      ]);
      setAttendanceNotifs(listRes.data);
      setAttendanceUnread(countRes.data.count || 0);
    } catch {}
  }, [token, isParent]);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [remindersRes, generalRes, messagesRes, broadcastRes] = await Promise.all([
        axios.get(`${API}/notifications/reminders`, { headers }),
        axios.get(`${API}/notifications/all`, { headers }).catch(() => ({ data: { notifications: [], unread_count: 0 } })),
        axios.get(`${API}/internal-mail/stats`, { headers }).catch(() => ({ data: { unread: 0 } })),
        axios.get(`${API}/broadcast/unread`, { headers }).catch(() => ({ data: { count: 0 } }))
      ]);
      setNotifications(remindersRes.data);
      setGeneralNotifications(generalRes.data);
      setUnreadMessages(messagesRes.data.unread || 0);
      setUnreadBroadcasts(broadcastRes.data.count || 0);
      if (isParent) loadAttendanceNotifs();
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [token, isParent, loadAttendanceNotifs]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mark reminder as viewed
  const markAsViewed = async (reminderId) => {
    try {
      await axios.post(`${API}/course/reminders/${reminderId}/mark-viewed`, {}, { headers });
      loadNotifications();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Handle general notification click: mark read + navigate
  const handleGeneralNotificationClick = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      try {
        const res = await axios.post(`${API}/notifications/${notif.id}/read`, {}, { headers });
        // Update local state immediately for instant feedback
        setGeneralNotifications(prev => ({
          ...prev,
          unread_count: res.data.unread_count ?? Math.max(0, prev.unread_count - 1),
          notifications: prev.notifications.map(n =>
            n.id === notif.id ? { ...n, is_read: true } : n
          )
        }));
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    }

    // Navigate if there's a link
    if (notif.link_destino) {
      const prefix = getSchoolPrefix();
      const fullPath = `${prefix}${notif.link_destino}`;
      setIsOpen(false);
      navigate(fullPath);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`, {}, { headers });
      setGeneralNotifications(prev => ({
        ...prev,
        unread_count: 0,
        notifications: prev.notifications.map(n => ({ ...n, is_read: true }))
      }));
      if (isParent) {
        await axios.post(`${API}/push/mark-read`, {}, { headers });
        setAttendanceUnread(0);
        setAttendanceNotifs(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Handle attendance notification click
  const handleAttendanceClick = async (notif) => {
    if (!notif.read_at) {
      try {
        await axios.post(`${API}/push/mark-read`, { notification_id: notif.id }, { headers });
        setAttendanceNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
        setAttendanceUnread(prev => Math.max(0, prev - 1));
      } catch {}
    }
    if (notif.student_id) {
      const prefix = getSchoolPrefix();
      setIsOpen(false);
      navigate(`${prefix}/parent/dashboard?student=${notif.student_id}`);
    }
  };

  const handleReminderClick = (reminder) => setSelectedReminder(reminder);

  const totalCount = (notifications.total_count || 0) + (generalNotifications.unread_count || 0) + unreadMessages + unreadBroadcasts + attendanceUnread;
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
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ zIndex: 9999 }}
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificaciones
              {isConnected && (
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" title="Conectado en tiempo real" />
              )}
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
                  className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
                  data-testid="mark-all-read-btn"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todo leido
                </button>
              )}
            </div>
          </div>

          {/* Messages notification */}
          {unreadMessages > 0 && (
            <div
              onClick={() => { setIsOpen(false); navigate(`${getSchoolPrefix()}/mensajes`); }}
              className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer"
              data-testid="unread-messages-link"
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
            </div>
          )}

          {/* Broadcast notifications */}
          {unreadBroadcasts > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100 hover:bg-amber-100 transition-colors cursor-pointer"
              data-testid="unread-broadcasts-link"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {unreadBroadcasts} comunicado{unreadBroadcasts !== 1 ? "s" : ""} institucional{unreadBroadcasts !== 1 ? "es" : ""}
                </p>
                <p className="text-xs text-amber-600">Comunicados pendientes de lectura</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "all" ? "text-violet-600 border-b-2 border-violet-500 bg-violet-50" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Actividad
              {generalNotifications.unread_count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-violet-500 text-white text-[10px] rounded-full">{generalNotifications.unread_count}</span>
              )}
            </button>
            {isParent && (
              <button
                onClick={() => setActiveTab("attendance")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "attendance" ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50" : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid="attendance-tab"
              >
                Asistencia
                {attendanceUnread > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] rounded-full">{attendanceUnread}</span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab("reminders")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "reminders" ? "text-violet-600 border-b-2 border-violet-500 bg-violet-50" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Recordatorios
              {notifications.total_count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full">{notifications.total_count}</span>
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
              generalNotifications.notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-violet-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Todo al dia!</p>
                  <p className="text-gray-400 text-xs mt-1">No hay actividad reciente</p>
                </div>
              ) : (
                <div>
                  {generalNotifications.notifications.map((notif) => (
                    <GeneralNotificationItem
                      key={notif.id}
                      notif={notif}
                      onClick={handleGeneralNotificationClick}
                    />
                  ))}
                </div>
              )
            ) : activeTab === "attendance" ? (
              attendanceNotifs.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="w-6 h-6 text-emerald-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Sin notificaciones</p>
                  <p className="text-gray-400 text-xs mt-1">Las notificaciones de asistencia apareceran aqui</p>
                </div>
              ) : (
                <div>
                  {attendanceNotifs.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleAttendanceClick(notif)}
                      className={`px-4 py-3 cursor-pointer transition-all border-b border-gray-50 last:border-0 group ${
                        notif.read_at ? "bg-white hover:bg-gray-50" : "bg-emerald-50 hover:bg-emerald-100"
                      }`}
                      data-testid={`attendance-notif-${notif.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center relative">
                          <UserCheck className="w-5 h-5 text-emerald-600" />
                          {!notif.read_at && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${notif.read_at ? "text-gray-500" : "font-semibold text-gray-800"}`}>
                            {notif.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-medium rounded-full capitalize">
                              {notif.type}
                            </span>
                            <span className="text-[10px] text-gray-400">{formatTimeAgo(notif.created_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              !notifications.total_count ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-violet-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Todo al dia!</p>
                  <p className="text-gray-400 text-xs mt-1">No tienes recordatorios pendientes</p>
                </div>
              ) : (
                <>
                  {notifications.important?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Importantes ({notifications.important.length})
                        </p>
                      </div>
                      {notifications.important.map((r) => (
                        <ReminderNotificationItem key={r.id} reminder={r} onClick={handleReminderClick} />
                      ))}
                    </div>
                  )}
                  {notifications.upcoming?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-rose-50 border-b border-rose-100">
                        <p className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Proximos a vencer ({notifications.upcoming.length})
                        </p>
                      </div>
                      {notifications.upcoming.map((r) => (
                        <ReminderNotificationItem key={r.id} reminder={r} onClick={handleReminderClick} />
                      ))}
                    </div>
                  )}
                  {notifications.new?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Nuevos ({notifications.new.length})
                        </p>
                      </div>
                      {notifications.new.map((r) => (
                        <ReminderNotificationItem key={r.id} reminder={r} onClick={handleReminderClick} />
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
