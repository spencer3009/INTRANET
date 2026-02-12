import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Bell, X, Calendar, FileText, BookOpen, AlertCircle,
  Clock, Eye
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Reminder type icons and colors
const REMINDER_TYPE_CONFIG = {
  task: {
    icon: FileText,
    label: "Tarea",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-500"
  },
  exam: {
    icon: BookOpen,
    label: "Examen",
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    gradientFrom: "from-rose-500",
    gradientTo: "to-red-500"
  },
  notice: {
    icon: Bell,
    label: "Aviso",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-500"
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
  
  return { 
    text: date.toLocaleDateString("es-PE", { day: "numeric", month: "short" }),
    isNormal: true 
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER POPUP COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ReminderPopup({ token, onNavigateToReminder }) {
  const [reminder, setReminder] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Check for popup reminder on mount
  useEffect(() => {
    const checkForPopup = async () => {
      if (!token || isDismissed) return;

      // Check if we've already shown a popup this session
      const sessionKey = `reminder_popup_shown_${new Date().toDateString()}`;
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }

      try {
        const res = await axios.get(`${API}/notifications/reminders/popup`, { headers });
        if (res.data.reminder) {
          setReminder(res.data.reminder);
          // Small delay for smoother UX
          setTimeout(() => setIsVisible(true), 1500);
          // Mark this session as having shown a popup
          sessionStorage.setItem(sessionKey, "true");
        }
      } catch (err) {
        console.error("Error checking popup reminders:", err);
      }
    };

    checkForPopup();
  }, [token, isDismissed]);

  // Dismiss popup and record in backend
  const handleDismiss = async () => {
    setIsVisible(false);
    setIsDismissed(true);
    
    if (reminder) {
      try {
        await axios.post(`${API}/notifications/reminders/${reminder.id}/dismiss-popup`, {}, { headers });
      } catch (err) {
        console.error("Error dismissing popup:", err);
      }
    }
  };

  // View reminder (mark as viewed and navigate/close)
  const handleView = async () => {
    if (reminder) {
      try {
        await axios.post(`${API}/course/reminders/${reminder.id}/mark-viewed`, {}, { headers });
      } catch (err) {
        console.error("Error marking as viewed:", err);
      }
      
      // If callback provided, navigate to reminder
      if (onNavigateToReminder) {
        onNavigateToReminder(reminder);
      }
    }
    
    setIsVisible(false);
    setIsDismissed(true);
  };

  // Remind later - just close without marking as viewed
  const handleRemindLater = () => {
    handleDismiss();
  };

  if (!isVisible || !reminder) return null;

  const typeConfig = REMINDER_TYPE_CONFIG[reminder.reminder_type] || REMINDER_TYPE_CONFIG.notice;
  const TypeIcon = typeConfig.icon;
  const dateInfo = formatRelativeDate(reminder.date);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 10002, position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
      data-testid="reminder-popup-overlay"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in"
        onClick={handleRemindLater}
      />

      {/* Popup Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-slide-up"
        style={{ zIndex: 10003 }}
        data-testid="reminder-popup-card"
      >
        {/* Animated gradient border for urgent items */}
        {(dateInfo.isOverdue || dateInfo.isUrgent || reminder.is_important) && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 p-[2px] animate-pulse-slow">
            <div className="bg-white rounded-2xl h-full w-full" />
          </div>
        )}

        <div className="relative">
          {/* Header */}
          <div className={`bg-gradient-to-r ${typeConfig.gradientFrom} ${typeConfig.gradientTo} px-5 py-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  {reminder.is_important ? (
                    <AlertCircle className="w-5 h-5 text-white" />
                  ) : (
                    <TypeIcon className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-white/80 text-xs font-medium">
                    {reminder.is_important ? "Recordatorio Importante" : "Recordatorio"}
                  </p>
                  <p className="text-white text-sm font-semibold">{typeConfig.label}</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                data-testid="popup-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Title */}
            <h3 className="text-gray-800 font-semibold text-base mb-2">{reminder.title}</h3>

            {/* Subject */}
            {reminder.subject_name && (
              <p className="text-gray-500 text-sm mb-3">{reminder.subject_name}</p>
            )}

            {/* Date badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              dateInfo.isOverdue ? "bg-red-100 text-red-700" :
              dateInfo.isUrgent ? "bg-amber-100 text-amber-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">
                {dateInfo.isOverdue ? "Vencido" : `Vence ${dateInfo.text}`}
              </span>
            </div>

            {/* Important warning */}
            {reminder.is_important && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-700">Este recordatorio requiere tu atención</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={handleRemindLater}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
              data-testid="popup-remind-later-btn"
            >
              Recordármelo luego
            </button>
            <button
              onClick={handleView}
              className={`flex-1 px-4 py-2.5 bg-gradient-to-r ${typeConfig.gradientFrom} ${typeConfig.gradientTo} text-white rounded-xl text-sm font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2`}
              data-testid="popup-view-btn"
            >
              <Eye className="w-4 h-4" />
              Ver recordatorio
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>,
    document.body
  );
}
