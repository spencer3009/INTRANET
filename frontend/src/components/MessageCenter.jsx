import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  MessageSquare, X, Send, Megaphone, HeadphonesIcon, GraduationCap,
  ChevronRight, AlertCircle, Clock, CheckCircle, Loader2, Plus,
  User, Search, ArrowLeft, Paperclip, MoreVertical, Filter,
  Bell, AlertTriangle, Info, Trash2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Priority configurations
const PRIORITY_CONFIG = {
  normal: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-100", badgeColor: "bg-blue-500", label: "Normal" },
  important: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", badgeColor: "bg-amber-500", label: "Importante" },
  urgent: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100", badgeColor: "bg-red-500", label: "Urgente" }
};

// Support categories
const SUPPORT_CATEGORIES = [
  { id: "access_problem", label: "Problemas de acceso", icon: "🔐" },
  { id: "academic_query", label: "Consultas académicas", icon: "📚" },
  { id: "technical_support", label: "Soporte técnico", icon: "🔧" },
  { id: "other", label: "Otro", icon: "💬" }
];

// Ticket status config
const STATUS_CONFIG = {
  open: { label: "Abierto", color: "bg-blue-500" },
  in_progress: { label: "En proceso", color: "bg-amber-500" },
  responded: { label: "Respondido", color: "bg-emerald-500" },
  closed: { label: "Cerrado", color: "bg-slate-400" }
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN MESSAGE CENTER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function MessageCenter({ token, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("academic");
  const [stats, setStats] = useState({ total_unread: 0, institutional: 0, support: 0, academic: 0 });
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Load stats
  const loadStats = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/messaging/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const tabs = [
    { id: "academic", label: "Mensajes", icon: GraduationCap, count: stats.academic },
    { id: "institutional", label: "Comunicados", icon: Megaphone, count: stats.institutional },
    { id: "support", label: "Soporte", icon: HeadphonesIcon, count: stats.support }
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-105 z-40"
        data-testid="message-center-btn"
      >
        <MessageSquare className="w-6 h-6" />
        {stats.total_unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {stats.total_unread > 9 ? "9+" : stats.total_unread}
          </span>
        )}
      </button>

      {/* Drawer */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Centro de Mensajes</h2>
                  <p className="text-white/70 text-xs">Comunicación institucional</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 flex-shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${
                      activeTab === tab.id
                        ? "text-indigo-600 bg-indigo-50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        activeTab === tab.id ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "institutional" && (
                <InstitutionalTab token={token} user={user} onRefreshStats={loadStats} />
              )}
              {activeTab === "support" && (
                <SupportTab token={token} user={user} onRefreshStats={loadStats} />
              )}
              {activeTab === "academic" && (
                <AcademicTab token={token} user={user} onRefreshStats={loadStats} />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL TAB
// ══════════════════════════════════════════════════════════════════════════════
function InstitutionalTab({ token, user, onRefreshStats }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const canCreate = ["admin", "owner", "director", "coordinator"].includes(user?.role);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/messaging/institutional`, { headers });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [token]);

  const markAsRead = async (messageId) => {
    try {
      await axios.post(`${API}/messaging/institutional/${messageId}/read`, {}, { headers });
      loadMessages();
      onRefreshStats();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleMessageClick = (msg) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      markAsRead(msg.id);
    }
  };

  // Detail view
  if (selectedMessage) {
    const priorityConfig = PRIORITY_CONFIG[selectedMessage.priority] || PRIORITY_CONFIG.normal;
    const PriorityIcon = priorityConfig.icon;
    
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <button
            onClick={() => setSelectedMessage(null)}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="font-semibold text-slate-800">Comunicado</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${priorityConfig.bgColor} rounded-full mb-4`}>
            <PriorityIcon className={`w-3.5 h-3.5 ${priorityConfig.color}`} />
            <span className={`text-xs font-semibold ${priorityConfig.color}`}>{priorityConfig.label}</span>
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 mb-4">{selectedMessage.title}</h2>
          
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            {selectedMessage.author_photo ? (
              <img src={selectedMessage.author_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-500" />
              </div>
            )}
            <div>
              <p className="font-medium text-slate-800">{selectedMessage.author_name}</p>
              <p className="text-xs text-slate-400">
                {new Date(selectedMessage.created_at).toLocaleDateString("es-PE", {
                  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </p>
            </div>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600 whitespace-pre-wrap">{selectedMessage.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Action bar */}
      {canCreate && (
        <div className="p-4 border-b border-slate-100">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Comunicado
          </button>
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-indigo-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Sin comunicados</h3>
            <p className="text-sm text-slate-400">No hay comunicados institucionales</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((msg) => {
              const priorityConfig = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
              const PriorityIcon = priorityConfig.icon;
              
              return (
                <div
                  key={msg.id}
                  onClick={() => handleMessageClick(msg)}
                  className={`px-4 py-4 hover:bg-slate-50 cursor-pointer transition-colors ${!msg.is_read ? "bg-indigo-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${priorityConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <PriorityIcon className={`w-5 h-5 ${priorityConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold text-slate-800 truncate ${!msg.is_read ? "" : "font-medium"}`}>
                          {msg.title}
                        </p>
                        {!msg.is_read && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 ${priorityConfig.badgeColor} text-white text-[10px] font-medium rounded-full`}>
                          {priorityConfig.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInstitutionalModal
          token={token}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { loadMessages(); onRefreshStats(); setShowCreateModal(false); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE INSTITUTIONAL MESSAGE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function CreateInstitutionalModal({ token, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/messaging/institutional`, {
        title: title.trim(),
        content: content.trim(),
        priority
      }, { headers });
      onCreated();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Nuevo Comunicado
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del comunicado..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Prioridad</label>
            <div className="flex gap-2">
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setPriority(key)}
                    className={`flex-1 px-3 py-2 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      priority === key
                        ? `${config.bgColor} border-current ${config.color}`
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contenido *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el contenido del comunicado..."
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold flex items-center gap-2 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT TAB
// ══════════════════════════════════════════════════════════════════════════════
function SupportTab({ token, user, onRefreshStats }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const isStaff = ["admin", "owner", "director", "coordinator"].includes(user?.role);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/messaging/support`, { headers });
      setTickets(res.data.tickets || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetail = async (ticketId) => {
    try {
      const res = await axios.get(`${API}/messaging/support/${ticketId}`, { headers });
      setSelectedTicket(res.data);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [token]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/messaging/support/${selectedTicket.id}/reply`, {
        content: replyText.trim()
      }, { headers });
      setReplyText("");
      loadTicketDetail(selectedTicket.id);
      onRefreshStats();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      await axios.put(`${API}/messaging/support/${selectedTicket.id}/status`, { status: "closed" }, { headers });
      loadTicketDetail(selectedTicket.id);
      loadTickets();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Ticket detail view
  if (selectedTicket) {
    const statusConfig = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTicket(null)}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div>
              <p className="font-semibold text-slate-800">{selectedTicket.subject}</p>
              <p className="text-xs text-slate-400">{selectedTicket.ticket_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 ${statusConfig.color} text-white text-xs font-semibold rounded-full`}>
              {statusConfig.label}
            </span>
            {isStaff && selectedTicket.status !== "closed" && (
              <button
                onClick={handleCloseTicket}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedTicket.messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.is_staff ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[80%] ${msg.is_staff ? "order-2" : "order-1"}`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.is_staff
                    ? "bg-slate-100 text-slate-800 rounded-tl-none"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-tr-none"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className={`flex items-center gap-2 mt-1 ${msg.is_staff ? "" : "justify-end"}`}>
                  <span className="text-[10px] text-slate-400">{msg.sender_name}</span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply input */}
        {selectedTicket.status !== "closed" && (
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={2}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors resize-none text-sm"
              />
              <button
                onClick={handleSendReply}
                disabled={sending || !replyText.trim()}
                className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl flex items-center justify-center transition-all"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Create button */}
      <div className="p-4 border-b border-slate-100">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nueva Consulta
        </button>
      </div>

      {/* Tickets list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HeadphonesIcon className="w-8 h-8 text-emerald-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Sin consultas</h3>
            <p className="text-sm text-slate-400">Crea una consulta si necesitas ayuda</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => {
              const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const category = SUPPORT_CATEGORIES.find(c => c.id === ticket.category);
              
              return (
                <div
                  key={ticket.id}
                  onClick={() => loadTicketDetail(ticket.id)}
                  className="px-4 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-lg">
                      {category?.icon || "💬"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 truncate">{ticket.subject}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{ticket.ticket_number}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 ${statusConfig.color} text-white text-[10px] font-medium rounded-full`}>
                          {statusConfig.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ticket.updated_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSupportModal
          token={token}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { loadTickets(); onRefreshStats(); setShowCreateModal(false); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE SUPPORT TICKET MODAL
// ══════════════════════════════════════════════════════════════════════════════
function CreateSupportModal({ token, onClose, onCreated }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async () => {
    if (!subject.trim() || !category || !description.trim()) return;
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/messaging/support`, {
        subject: subject.trim(),
        category,
        description: description.trim()
      }, { headers });
      onCreated();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HeadphonesIcon className="w-5 h-5" />
            Nueva Consulta
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Describe brevemente tu consulta..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Categoría *</label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                    category === cat.id
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Descripción *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalladamente tu consulta o problema..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !category || !description.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold flex items-center gap-2 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ACADEMIC TAB - Shows contacts directly with Spanish role labels
// ══════════════════════════════════════════════════════════════════════════════

// Role translation map
const ROLE_LABELS = {
  owner: "Propietario",
  director: "Director",
  admin: "Administrador",
  coordinator: "Coordinador",
  teacher: "Profesor",
  auxiliar: "Auxiliar",
  student: "Alumno",
  parent: "Padre de familia"
};

function AcademicTab({ token, user, onRefreshStats }) {
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]); // Messages in current conversation
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const getRoleLabel = (role) => ROLE_LABELS[role] || role;

  const loadThreads = async () => {
    try {
      const res = await axios.get(`${API}/messaging/academic`, { headers });
      setThreads(res.data.threads || []);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/messaging/academic/contacts`, { headers });
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (threadId) => {
    try {
      const res = await axios.get(`${API}/messaging/academic/${threadId}`, { headers });
      setSelectedThread(res.data);
      onRefreshStats();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    loadThreads();
    loadContacts();
  }, [token]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    const receiverId = selectedThread 
      ? selectedThread.other_participant?.id 
      : selectedContact?.id;
    
    if (!receiverId) return;
    
    setSending(true);
    const sentMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user?.id,
      content: messageText.trim(),
      created_at: new Date().toISOString()
    };
    
    try {
      // Optimistically add the message to the conversation
      if (selectedContact && !selectedThread) {
        setConversationMessages(prev => [...prev, sentMessage]);
      }
      
      const res = await axios.post(`${API}/messaging/academic`, {
        receiver_id: receiverId,
        content: messageText.trim()
      }, { headers });
      
      setMessageText("");
      
      // If we're in a thread, reload it to get updated messages
      if (selectedThread && res.data.thread_id) {
        loadThread(res.data.thread_id);
      }
      
      loadThreads();
      onRefreshStats();
      
    } catch (err) {
      console.error("Error:", err);
      // Remove optimistic message on error
      setConversationMessages(prev => prev.filter(m => m.id !== sentMessage.id));
    } finally {
      setSending(false);
    }
  };

  // Filter contacts by search query
  const filteredContacts = contacts.filter(contact => 
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRoleLabel(contact.role)?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Thread detail view (conversation)
  if (selectedThread) {
    const other = selectedThread.other_participant;
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <button
            onClick={() => setSelectedThread(null)}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          {other?.photo_url ? (
            <img src={other.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <User className="w-5 h-5 text-amber-500" />
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800">{other?.name}</p>
            <p className="text-xs text-slate-400">{getRoleLabel(other?.role)}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedThread.messages?.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%]`}>
                  <div className={`px-4 py-3 rounded-2xl ${
                    isMe
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-none"
                      : "bg-slate-100 text-slate-800 rounded-tl-none"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? "text-right" : ""}`}>
                    {new Date(msg.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-end gap-2">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={2}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors resize-none text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !messageText.trim()}
              className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl flex items-center justify-center transition-all"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Composing new message to a selected contact
  if (selectedContact) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with contact info always visible */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <button
            onClick={() => { setSelectedContact(null); setConversationMessages([]); }}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          {selectedContact.photo_url ? (
            <img src={selectedContact.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <User className="w-5 h-5 text-amber-500" />
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800">{selectedContact.name}</p>
            <p className="text-xs text-slate-400">{getRoleLabel(selectedContact.role)}</p>
          </div>
        </div>
        
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversationMessages.map((msg) => (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[80%]">
                <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-none">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {new Date(msg.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Message input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-end gap-2">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={2}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-400 transition-colors resize-none text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !messageText.trim()}
              className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl flex items-center justify-center transition-all"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main view: Contact list (shown directly as requested)
  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="p-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar contacto..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-amber-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchQuery ? "Sin resultados" : "Sin contactos"}
            </h3>
            <p className="text-sm text-slate-400">
              {searchQuery ? "Intenta con otro término de búsqueda" : "No hay contactos disponibles"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
              >
                {contact.photo_url ? (
                  <img src={contact.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-amber-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{contact.name}</p>
                  <p className="text-xs text-slate-400">
                    {getRoleLabel(contact.role)}
                    {contact.subject_name && ` • ${contact.subject_name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
