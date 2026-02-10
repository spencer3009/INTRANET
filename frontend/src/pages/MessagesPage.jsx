import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { 
  MessageSquare, Send, Paperclip, Search, X, Check, CheckCheck,
  Mail, Users, ChevronRight, Loader2, AlertCircle, Clock, 
  User, ArrowLeft, FileText, Image, File, Trash2, Eye, Circle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Tab configurations
const MESSAGE_TABS = [
  { id: "chats", label: "Chats", icon: MessageSquare, description: "Conversaciones directas" },
  { id: "escribir", label: "Escribir", icon: Mail, description: "Mensaje tipo correo" },
  { id: "grupos", label: "Grupos", icon: Users, description: "Mensajes grupales" }
];

// Role labels for Spanish
const ROLE_LABELS = {
  owner: "Director",
  admin: "Administrador",
  director: "Director",
  teacher: "Profesor",
  parent: "Padre",
  student: "Estudiante"
};

// ══════════════════════════════════════════════════════════════════════════════
// PRESENCE INDICATOR COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function PresenceIndicator({ isOnline, size = "md", showLabel = false, lastSeen }) {
  const sizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  const formatLastSeen = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`${sizeClasses[size]} rounded-full ${
          isOnline 
            ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" 
            : "bg-slate-400"
        }`}
        title={isOnline ? "En línea" : `Última vez: ${formatLastSeen(lastSeen)}`}
      />
      {showLabel && (
        <span className={`text-xs ${isOnline ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
          {isOnline ? "En línea" : formatLastSeen(lastSeen)}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// USER SELECTOR COMPONENT (Dropdown grouped by role with presence)
// ══════════════════════════════════════════════════════════════════════════════
function UserSelector({ value, onChange, users, loading, placeholder = "Seleccionar destinatario..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get selected user info
  const selectedUser = users.flatMap(g => g.users).find(u => u.id === value);

  // Filter users by search
  const filteredGroups = users.map(group => ({
    ...group,
    users: group.users.filter(u => 
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(group => group.users.length > 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected value display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        data-testid="user-selector-trigger"
      >
        {selectedUser ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              {selectedUser.photo_url ? (
                <img src={selectedUser.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {selectedUser.name?.charAt(0) || "U"}
                </div>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                selectedUser.is_online ? "bg-emerald-500" : "bg-slate-400"
              }`} />
            </div>
            <div>
              <p className="font-medium text-slate-800">{selectedUser.full_name}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span>
                <span className={`text-xs ${selectedUser.is_online ? "text-emerald-600" : "text-slate-400"}`}>
                  • {selectedUser.is_online ? "En línea" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-96 overflow-hidden" data-testid="user-selector-dropdown">
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* User list grouped by role */}
          <div className="overflow-y-auto max-h-72">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No se encontraron usuarios
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide sticky top-0 flex items-center justify-between">
                    <span>{group.label}</span>
                    <span className="text-emerald-600">
                      {group.users.filter(u => u.is_online).length} en línea
                    </span>
                  </div>
                  {group.users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onChange(user.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors ${
                        value === user.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="relative">
                        {user.photo_url ? (
                          <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold">
                            {user.name?.charAt(0) || "U"}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          user.is_online ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">{user.full_name}</p>
                          {user.is_online && (
                            <span className="text-xs text-emerald-600 font-medium">En línea</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      {value === user.id && (
                        <Check className="w-5 h-5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT VIEW COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function ChatView({ partner, messages, currentUserId, onSendMessage, onBack, token }) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    
    setSending(true);
    try {
      await onSendMessage(newMessage, attachments);
      setNewMessage("");
      setAttachments([]);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Get Cloudinary signature
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;

      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("signature", signature);
        formData.append("timestamp", timestamp);
        formData.append("api_key", api_key);
        formData.append("folder", folder);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
          { method: "POST", body: formData }
        );
        const uploadData = await uploadRes.json();
        
        uploaded.push({
          url: uploadData.secure_url,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hoy";
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  // Group messages by date
  const groupedMessages = [];
  let currentDate = null;
  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ type: "date", date: msg.created_at });
    }
    groupedMessages.push({ type: "message", ...msg });
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors lg:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {partner.photo_url ? (
          <img src={partner.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/30" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
            {partner.name?.charAt(0) || "U"}
          </div>
        )}
        <div className="flex-1 text-white">
          <h3 className="font-bold text-lg">{partner.name}</h3>
          <p className="text-blue-100 text-sm">{ROLE_LABELS[partner.role] || partner.role}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" style={{ minHeight: "300px" }}>
        {groupedMessages.map((item, idx) => (
          item.type === "date" ? (
            <div key={`date-${idx}`} className="flex justify-center">
              <span className="px-4 py-1 bg-white rounded-full text-xs text-slate-500 shadow-sm">
                {formatDate(item.date)}
              </span>
            </div>
          ) : (
            <div
              key={item.id}
              className={`flex ${item.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  item.sender_id === currentUserId
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md"
                    : "bg-white text-slate-800 shadow-md rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{item.message}</p>
                
                {/* Attachments */}
                {item.attachments?.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {item.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          item.sender_id === currentUserId ? "bg-white/20 hover:bg-white/30" : "bg-slate-100 hover:bg-slate-200"
                        } transition-colors`}
                      >
                        {att.type?.startsWith("image/") ? (
                          <Image className="w-4 h-4" />
                        ) : (
                          <File className="w-4 h-4" />
                        )}
                        <span className="text-xs truncate max-w-[150px]">{att.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                
                <div className={`flex items-center justify-end gap-1 mt-1 ${
                  item.sender_id === currentUserId ? "text-blue-100" : "text-slate-400"
                }`}>
                  <span className="text-xs">{formatTime(item.created_at)}</span>
                  {item.sender_id === currentUserId && (
                    item.read ? <CheckCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>
          )
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex gap-2 flex-wrap">
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1 rounded-full text-sm">
              <File className="w-4 h-4 text-slate-500" />
              <span className="truncate max-w-[100px]">{att.name}</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-end gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 px-4 py-3 bg-slate-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={sending || (!newMessage.trim() && attachments.length === 0)}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center justify-center disabled:opacity-50 transition-all shadow-lg"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WRITE MESSAGE COMPONENT (Mail type)
// ══════════════════════════════════════════════════════════════════════════════
function WriteMessage({ users, loadingUsers, token, onSuccess }) {
  const [receiver, setReceiver] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;

      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("signature", signature);
        formData.append("timestamp", timestamp);
        formData.append("api_key", api_key);
        formData.append("folder", folder);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
          { method: "POST", body: formData }
        );
        const uploadData = await uploadRes.json();
        
        uploaded.push({
          url: uploadData.secure_url,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Error al subir archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSend = async () => {
    setError("");
    
    if (!receiver) {
      setError("Selecciona un destinatario");
      return;
    }
    if (!subject.trim()) {
      setError("El asunto es requerido");
      return;
    }
    if (!message.trim()) {
      setError("El mensaje es requerido");
      return;
    }

    setSending(true);
    try {
      await axios.post(`${API}/messages/send`, {
        receiver_id: receiver,
        type: "mail",
        subject: subject.trim(),
        message: message.trim(),
        attachments
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(true);
      setReceiver("");
      setSubject("");
      setMessage("");
      setAttachments([]);
      onSuccess?.();
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar mensaje");
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    setReceiver("");
    setSubject("");
    setMessage("");
    setAttachments([]);
    setError("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
        <div className="flex items-center gap-3 text-white">
          <Mail className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold">Nuevo Mensaje</h2>
            <p className="text-emerald-100 text-sm">Envía un mensaje tipo correo interno</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>Mensaje enviado correctamente</span>
          </div>
        )}

        {/* Receptor */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Receptor <span className="text-red-500">*</span>
          </label>
          <UserSelector
            value={receiver}
            onChange={setReceiver}
            users={users}
            loading={loadingUsers}
            placeholder="Seleccionar destinatario..."
          />
        </div>

        {/* Asunto */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Asunto <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Escribe el asunto del mensaje..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            data-testid="mail-subject"
          />
        </div>

        {/* Mensaje */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Mensaje <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
            rows={8}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            data-testid="mail-message"
          />
        </div>

        {/* Adjuntos */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Adjuntos
          </label>
          <div className="flex flex-wrap gap-3">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                {att.type?.startsWith("image/") ? (
                  <Image className="w-5 h-5 text-slate-500" />
                ) : (
                  <FileText className="w-5 h-5 text-slate-500" />
                )}
                <span className="text-sm truncate max-w-[150px]">{att.name}</span>
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
              <span>Adjuntar archivo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="mail-send-btn"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Enviar mensaje
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INBOX COMPONENT (Mail list)
// ══════════════════════════════════════════════════════════════════════════════
function InboxView({ messages, loading, onMarkRead, onViewMessage, currentUserId }) {
  const [filter, setFilter] = useState("all"); // all, received, sent
  const [selectedMessage, setSelectedMessage] = useState(null);

  const filteredMessages = messages.filter(msg => {
    if (filter === "received") return msg.receiver_id === currentUserId;
    if (filter === "sent") return msg.sender_id === currentUserId;
    return true;
  });

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  const handleViewMessage = async (msg) => {
    setSelectedMessage(msg);
    if (!msg.read && msg.receiver_id === currentUserId) {
      await onMarkRead(msg.id);
    }
  };

  if (selectedMessage) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
          <button
            onClick={() => setSelectedMessage(null)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver a bandeja</span>
          </button>
          <h2 className="text-xl font-bold text-white">{selectedMessage.subject}</h2>
          <p className="text-violet-100 text-sm">
            {selectedMessage.is_sent_by_me ? `Para: ${selectedMessage.receiver_name}` : `De: ${selectedMessage.sender_name}`}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200">
            {(selectedMessage.is_sent_by_me ? selectedMessage.receiver_photo : selectedMessage.sender_photo) ? (
              <img
                src={selectedMessage.is_sent_by_me ? selectedMessage.receiver_photo : selectedMessage.sender_photo}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                {(selectedMessage.is_sent_by_me ? selectedMessage.receiver_name : selectedMessage.sender_name)?.charAt(0) || "U"}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                {selectedMessage.is_sent_by_me ? selectedMessage.receiver_name : selectedMessage.sender_name}
              </p>
              <p className="text-sm text-slate-500">
                {ROLE_LABELS[selectedMessage.is_sent_by_me ? selectedMessage.receiver_role : selectedMessage.sender_role]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">{formatDate(selectedMessage.created_at)}</p>
              {selectedMessage.is_sent_by_me && (
                <span className="text-xs text-blue-500">Enviado</span>
              )}
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="whitespace-pre-wrap text-slate-700">{selectedMessage.message}</p>
          </div>

          {/* Attachments */}
          {selectedMessage.attachments?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h4 className="font-semibold text-slate-700 mb-3">Adjuntos ({selectedMessage.attachments.length})</h4>
              <div className="flex flex-wrap gap-3">
                {selectedMessage.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    {att.type?.startsWith("image/") ? (
                      <Image className="w-5 h-5 text-slate-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-500" />
                    )}
                    <span className="text-sm">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header with filters */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white mb-3">Bandeja de Entrada</h2>
        <div className="flex gap-2">
          {[
            { id: "all", label: "Todos" },
            { id: "received", label: "Recibidos" },
            { id: "sent", label: "Enviados" }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-white text-violet-600"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-500" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Mail className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p>No hay mensajes</p>
          </div>
        ) : (
          filteredMessages.map(msg => (
            <button
              key={msg.id}
              onClick={() => handleViewMessage(msg)}
              className={`w-full p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors text-left ${
                !msg.read && msg.receiver_id === currentUserId ? "bg-violet-50" : ""
              }`}
            >
              {(msg.is_sent_by_me ? msg.receiver_photo : msg.sender_photo) ? (
                <img
                  src={msg.is_sent_by_me ? msg.receiver_photo : msg.sender_photo}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {(msg.is_sent_by_me ? msg.receiver_name : msg.sender_name)?.charAt(0) || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`font-semibold ${!msg.read && msg.receiver_id === currentUserId ? "text-slate-900" : "text-slate-700"}`}>
                    {msg.is_sent_by_me ? `Para: ${msg.receiver_name}` : msg.sender_name}
                  </p>
                  {!msg.read && msg.receiver_id === currentUserId && (
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                  )}
                </div>
                <p className={`text-sm mb-1 truncate ${!msg.read && msg.receiver_id === currentUserId ? "font-medium text-slate-800" : "text-slate-600"}`}>
                  {msg.subject}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {msg.message.substring(0, 80)}...
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400">{formatDate(msg.created_at)}</p>
                {msg.attachments?.length > 0 && (
                  <Paperclip className="w-4 h-4 text-slate-400 mt-1 ml-auto" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function MessagesPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chats");
  
  // Data
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  
  // Chat view state
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "chats" && !selectedChat) {
      loadChats();
    } else if (activeTab === "escribir") {
      loadUsers();
      loadInbox();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const settingsRes = await axios.get(`${API}/settings`, { headers });
      setSettings(settingsRes.data);
      await loadUsers();
      await loadChats();
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API}/messages/users`, { headers });
      setUsers(res.data);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const res = await axios.get(`${API}/messages/chats`, { headers });
      setChats(res.data);
    } catch (err) {
      console.error("Error loading chats:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChatHistory = async (partnerId) => {
    setLoadingChatMessages(true);
    try {
      const res = await axios.get(`${API}/messages/chats/${partnerId}`, { headers });
      setSelectedChat(res.data.partner);
      setChatMessages(res.data.messages);
    } catch (err) {
      console.error("Error loading chat:", err);
    } finally {
      setLoadingChatMessages(false);
    }
  };

  const loadInbox = async () => {
    setLoadingInbox(true);
    try {
      const res = await axios.get(`${API}/messages/inbox`, { headers });
      setInbox(res.data);
    } catch (err) {
      console.error("Error loading inbox:", err);
    } finally {
      setLoadingInbox(false);
    }
  };

  const handleSendChatMessage = async (message, attachments) => {
    if (!selectedChat) return;
    
    await axios.post(`${API}/messages/chats/send`, {
      receiver_id: selectedChat.id,
      type: "chat",
      message,
      attachments
    }, { headers });
    
    // Reload chat history
    await loadChatHistory(selectedChat.id);
  };

  const handleMarkRead = async (messageId) => {
    try {
      await axios.put(`${API}/messages/${messageId}/read`, {}, { headers });
      setInbox(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
    } catch (err) {
      console.error("Error marking message as read:", err);
    }
  };

  const handleStartNewChat = async (userId) => {
    await loadChatHistory(userId);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="messages-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl">
              <MessageSquare className="w-6 h-6 text-slate-600" />
            </button>
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-800">{settings?.system_name || "Instituto"}</h1>
              <p className="text-sm text-slate-500">Mensajería Interna</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Page Title */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center gap-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <MessageSquare className="w-10 h-10 text-violet-600" />
              </div>
              <div className="text-white">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Mensajes</h1>
                <p className="text-violet-200 text-lg">Comunicación interna del colegio</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
            {MESSAGE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "chats") setSelectedChat(null);
                  }}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-white shadow-lg text-violet-600 border-2 border-violet-200" 
                      : "bg-white/50 text-slate-600 hover:bg-white hover:shadow border-2 border-transparent"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-violet-100" : "bg-slate-100"}`}>
                    <Icon className={`w-6 h-6 ${isActive ? "text-violet-600" : "text-slate-500"}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{tab.label}</p>
                    <p className="text-xs opacity-60">{tab.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-5 h-5 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Content based on active tab */}
          {activeTab === "chats" && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Chat list */}
              <div className={`lg:col-span-1 ${selectedChat ? "hidden lg:block" : ""}`}>
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Conversaciones</h3>
                    
                    {/* Start new chat */}
                    <div className="mt-4">
                      <UserSelector
                        value=""
                        onChange={handleStartNewChat}
                        users={users}
                        loading={loadingUsers}
                        placeholder="Iniciar nuevo chat..."
                      />
                    </div>
                  </div>
                  
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {loadingChats ? (
                      <div className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-500" />
                      </div>
                    ) : chats.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No hay conversaciones</p>
                        <p className="text-sm">Usa el selector arriba para iniciar un chat</p>
                      </div>
                    ) : (
                      chats.map(chat => (
                        <button
                          key={chat.partner_id}
                          onClick={() => loadChatHistory(chat.partner_id)}
                          className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left ${
                            selectedChat?.id === chat.partner_id ? "bg-violet-50" : ""
                          }`}
                        >
                          {chat.partner_photo ? (
                            <img src={chat.partner_photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold">
                              {chat.partner_name?.charAt(0) || "U"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-slate-800 truncate">{chat.partner_name}</p>
                              <span className="text-xs text-slate-400">{formatTime(chat.last_message_time)}</span>
                            </div>
                            <p className="text-sm text-slate-500 truncate">
                              {chat.is_sender && "Tú: "}{chat.last_message}
                            </p>
                          </div>
                          {chat.unread_count > 0 && (
                            <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">
                              {chat.unread_count}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Chat view */}
              <div className={`lg:col-span-2 ${!selectedChat ? "hidden lg:block" : ""}`}>
                {selectedChat ? (
                  <ChatView
                    partner={selectedChat}
                    messages={chatMessages}
                    currentUserId={user?.id}
                    onSendMessage={handleSendChatMessage}
                    onBack={() => setSelectedChat(null)}
                    token={token}
                  />
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg p-12 text-center h-full flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-violet-100 flex items-center justify-center mb-6">
                      <MessageSquare className="w-12 h-12 text-violet-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona una conversación</h3>
                    <p className="text-slate-500">Elige un chat de la lista o inicia uno nuevo</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "escribir" && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Write form */}
              <WriteMessage
                users={users}
                loadingUsers={loadingUsers}
                token={token}
                onSuccess={() => loadInbox()}
              />

              {/* Inbox */}
              <InboxView
                messages={inbox}
                loading={loadingInbox}
                onMarkRead={handleMarkRead}
                currentUserId={user?.id}
              />
            </div>
          )}

          {activeTab === "grupos" && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Grupos</h3>
              <p className="text-slate-500 mb-6">Mensajes grupales por grado, sección o rol</p>
              <span className="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                Próximamente
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
