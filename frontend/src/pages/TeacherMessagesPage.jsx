import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import StudentHeader from "../components/StudentHeader";
import MessagePagination from "../components/MessagePagination";
import {
  Mail, Inbox, Send, Archive, Trash2, Search, Plus,
  ChevronLeft, Paperclip, X, Loader2, Circle,
  Edit3, Reply, MailOpen, AlertCircle, AlertTriangle,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Highlighter, Undo, Redo, ArchiveRestore,
  MessageSquare, Star, Sparkles, Megaphone
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ROLE_LABELS = {
  owner: "Director",
  admin: "Administrador", 
  teacher: "Profesor",
  auxiliar: "Auxiliar",
  student: "Estudiante",
  parent: "Padre/Apoderado"
};

// ══════════════════════════════════════════════════════════════════════════════
// RICH TEXT EDITOR TOOLBAR
// ══════════════════════════════════════════════════════════════════════════════
function EditorToolbar({ editor }) {
  if (!editor) return null;
  
  const ToolButton = ({ onClick, isActive, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-all ${
        isActive 
          ? "bg-indigo-100 text-indigo-700" 
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
  
  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;
  
  return (
    <div className="flex items-center flex-wrap gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">
        <Undo className="w-4 h-4" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">
        <Redo className="w-4 h-4" />
      </ToolButton>
      
      <Divider />
      
      <ToolButton 
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Negrita"
      >
        <Bold className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Cursiva"
      >
        <Italic className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Subrayado"
      >
        <UnderlineIcon className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Tachado"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="Resaltar"
      >
        <Highlighter className="w-4 h-4" />
      </ToolButton>
      
      <Divider />
      
      <ToolButton 
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Lista"
      >
        <List className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Lista numerada"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolButton>
      
      <Divider />
      
      <ToolButton 
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Alinear izquierda"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Centrar"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolButton>
      <ToolButton 
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Alinear derecha"
      >
        <AlignRight className="w-4 h-4" />
      </ToolButton>
      
      <Divider />
      
      <ToolButton 
        onClick={() => {
          const url = window.prompt("URL del enlace:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        isActive={editor.isActive("link")}
        title="Enlace"
      >
        <LinkIcon className="w-4 h-4" />
      </ToolButton>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ComposeModal({ isOpen, onClose, token, onSent, replyTo }) {
  const [recipients, setRecipients] = useState([]);
  const [subject, setSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Escribe tu mensaje aquí..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose pindigo-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
  });
  
  useEffect(() => {
    if (replyTo) {
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setRecipients([replyTo.sender]);
    } else {
      setSubject("");
      setRecipients([]);
    }
    if (editor) editor.commands.setContent("");
    setError("");
  }, [replyTo, isOpen, editor]);
  
  const searchContacts = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await axios.get(`${API}/api/internal-mail/contacts/search?q=${encodeURIComponent(query)}`, { headers });
      setSearchResults(res.data.contacts || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => searchContacts(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const addRecipient = (contact) => {
    if (!recipients.find(r => r.id === contact.id)) {
      const fullName = contact.last_name 
        ? `${contact.name || contact.first_name || ''} ${contact.last_name}`.trim()
        : contact.name || contact.first_name || '';
      setRecipients([...recipients, { ...contact, name: fullName }]);
    }
    setSearchQuery("");
    setSearchResults([]);
    setShowRecipientDropdown(false);
  };
  
  const removeRecipient = (id) => setRecipients(recipients.filter(r => r.id !== id));
  
  const handleSend = async () => {
    if (recipients.length === 0) return setError("Selecciona al menos un destinatario");
    if (!subject.trim()) return setError("El asunto es requerido");
    const bodyContent = editor?.getHTML() || "";
    const bodyText = editor?.getText() || "";
    if (!bodyText.trim()) return setError("El mensaje no puede estar vacío");
    
    setSending(true);
    setError("");
    
    try {
      if (replyTo) {
        await axios.post(`${API}/api/internal-mail/${replyTo.id}/reply`, { body: bodyContent }, { headers });
      } else {
        await axios.post(`${API}/api/internal-mail/send`, {
          subject: subject.trim(),
          body: bodyContent,
          recipient_ids: recipients.map(r => r.id)
        }, { headers });
      }
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {replyTo ? "Responder mensaje" : "Nuevo mensaje"}
              </h2>
              <p className="text-white/80 text-sm">Redacta tu comunicación</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              {error}
            </div>
          )}
          
          {/* Recipients */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Para:</label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl min-h-[52px]">
                {recipients.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 rounded-full text-sm font-medium">
                    {r.name}
                    <button onClick={() => removeRecipient(r.id)} className="hover:text-indigo-900">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowRecipientDropdown(true); }}
                  onFocus={() => setShowRecipientDropdown(true)}
                  placeholder={recipients.length === 0 ? "Buscar destinatarios..." : ""}
                  className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-sm"
                />
              </div>
              
              {showRecipientDropdown && (searchResults.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </div>
                  ) : (
                    searchResults.map(contact => {
                      const fullName = contact.last_name 
                        ? `${contact.name || contact.first_name || ''} ${contact.last_name}`.trim()
                        : contact.name || contact.first_name || '';
                      return (
                        <button
                          key={contact.id}
                          onClick={() => addRecipient(contact)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          {contact.photo_url ? (
                            <img src={contact.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
                              {fullName?.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{fullName}</p>
                            <p className="text-xs text-gray-500">{ROLE_LABELS[contact.role] || contact.role}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Asunto:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Escribe el asunto..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          
          {/* Body */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <EditorToolbar editor={editor} />
              <EditorContent editor={editor} className="min-h-[200px] max-h-[300px] overflow-y-auto" />
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
            <Paperclip className="w-4 h-4" />
            Adjuntar
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors font-medium">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, confirmStyle, icon: Icon, loading }) {
  if (!isOpen) return null;
  
  const styleClasses = {
    danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    warning: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
    primary: "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600",
  };
  
  const iconBgClasses = {
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
    primary: "bg-indigo-100 text-indigo-600",
  };
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBgClasses[confirmStyle] || iconBgClasses.danger}`}>
              {Icon && <Icon className="w-7 h-7" />}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-white font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg ${styleClasses[confirmStyle] || styleClasses.danger}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN TEACHER MESSAGES PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function TeacherMessagesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ unread: 0, inbox: 0, sent: 0, archived: 0, trash: 0 });
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [settings, setSettings] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, messageId: null });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const schoolName = settings?.system_name || user?.school_name || "Portal Docente";
  const logoUrl = settings?.logo_url;
  const currentSubdomain = subdomain || user?.subdomain;
  
  const folders = [
    { id: "inbox", label: "Bandeja de entrada", icon: Inbox, badge: stats.unread, gradient: "from-blue-500 to-cyan-500" },
    { id: "sent", label: "Enviados", icon: Send, gradient: "from-violet-500 to-purple-500" },
    { id: "archived", label: "Archivados", icon: Archive, gradient: "from-amber-500 to-orange-500" },
    { id: "trash", label: "Papelera", icon: Trash2, gradient: "from-slate-500 to-gray-600" },
  ];
  
  const loadSettings = async () => {
    try {
      const settingsSubdomain = subdomain || user?.subdomain || 'elroble';
      const res = await axios.get(`${API}/api/settings/public/${settingsSubdomain}`);
      setSettings(res.data);
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };
  
  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/api/internal-mail/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };
  
  const loadMessages = async (folder, page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/internal-mail/${folder}?page=${page}&limit=6`, { headers });
      setMessages(res.data.messages || []);
      setTotalMessages(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      setCurrentPage(page);
    } catch (err) {
      console.error("Error loading messages:", err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };
  
  const loadMessage = async (messageId) => {
    try {
      const res = await axios.get(`${API}/api/internal-mail/${messageId}`, { headers });
      setSelectedMessage(res.data);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: true } : m));
      loadStats();
    } catch (err) {
      console.error("Error loading message:", err);
    }
  };
  
  useEffect(() => {
    loadStats();
    loadSettings();
  }, [token]);
  
  useEffect(() => {
    loadMessages(activeFolder, 1);
    setSelectedMessage(null);
    setCurrentPage(1);
  }, [activeFolder]);
  
  const handleSelectMessage = (msg) => {
    if (msg.message_type === "broadcast") {
      setSelectedMessage({ ...msg, message_type: "broadcast" });
      setMobileView("message");
      axios.post(`${API}/api/broadcast/${msg.id}/read`, {}, { headers }).then(() => loadStats()).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      return;
    }
    loadMessage(msg.id);
    setMobileView("message");
  };
  
  const handleArchive = async (messageId) => {
    try {
      await axios.put(`${API}/api/internal-mail/${messageId}/archive`, null, { headers });
      loadMessages(activeFolder);
      loadStats();
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error("Error archiving:", err);
    }
  };
  
  const handleDelete = async (messageId) => {
    try {
      await axios.delete(`${API}/api/internal-mail/${messageId}`, { headers });
      loadMessages(activeFolder);
      loadStats();
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };
  
  const showDeletePermanentlyConfirm = (messageId) => {
    setConfirmModal({ isOpen: true, type: "deletePermanently", messageId });
  };
  
  const showEmptyTrashConfirm = () => {
    setConfirmModal({ isOpen: true, type: "emptyTrash", messageId: null });
  };
  
  const handleConfirmAction = async () => {
    setConfirmLoading(true);
    try {
      if (confirmModal.type === "deletePermanently" && confirmModal.messageId) {
        await axios.delete(`${API}/api/internal-mail/${confirmModal.messageId}/permanent`, { headers });
        if (selectedMessage?.id === confirmModal.messageId) setSelectedMessage(null);
      } else if (confirmModal.type === "emptyTrash") {
        await axios.delete(`${API}/api/internal-mail/trash/empty`, { headers });
        setSelectedMessage(null);
      }
      loadMessages(activeFolder);
      loadStats();
      setConfirmModal({ isOpen: false, type: null, messageId: null });
    } catch (err) {
      console.error("Error in confirm action:", err);
    } finally {
      setConfirmLoading(false);
    }
  };
  
  const handleRestore = async (messageId) => {
    try {
      await axios.put(`${API}/api/internal-mail/${messageId}/restore`, null, { headers });
      loadMessages(activeFolder);
      loadStats();
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error("Error restoring:", err);
    }
  };
  
  const handleToggleRead = async (messageId, isRead) => {
    try {
      await axios.put(`${API}/api/internal-mail/${messageId}/read?is_read=${isRead}`, null, { headers });
      loadMessages(activeFolder);
      loadStats();
    } catch (err) {
      console.error("Error toggling read:", err);
    }
  };
  
  const handleReply = () => {
    if (selectedMessage) {
      setReplyTo(selectedMessage);
      setShowCompose(true);
    }
  };
  
  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };
  
  const filteredMessages = messages.filter(msg => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      msg.subject?.toLowerCase().includes(query) ||
      msg.sender?.name?.toLowerCase().includes(query) ||
      msg.body_preview?.toLowerCase().includes(query)
    );
  });

  const totalStatsMessages = stats.inbox + stats.sent + stats.archived;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex" data-testid="teacher-messages-page">
      <TeacherSidebar
        active="mensajes"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={currentSubdomain}
        user={user}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={currentSubdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />
        
        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8 overflow-hidden flex flex-col">
          {/* Hero Section */}
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 p-6 lg:p-8 text-white shadow-2xl flex-shrink-0">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">Centro de Mensajes</h1>
                  <p className="text-white/80">Comunicación institucional</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 text-center border border-white/20">
                  <p className="text-2xl font-bold">{totalStatsMessages}</p>
                  <p className="text-white/80 text-xs">Total</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 text-center border border-white/20">
                  <p className="text-2xl font-bold">{stats.unread}</p>
                  <p className="text-white/80 text-xs">Sin leer</p>
                </div>
                <button
                  onClick={() => { setReplyTo(null); setShowCompose(true); }}
                  className="bg-white text-indigo-600 hover:bg-white/90 rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 shadow-lg transition-all hover:scale-105"
                  data-testid="compose-btn-hero"
                >
                  <Plus className="w-5 h-5" />
                  Redactar
                </button>
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
            {/* Folders Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex-shrink-0">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-lg">Carpetas</h3>
              </div>
              
              <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                      activeFolder === folder.id
                        ? `bg-gradient-to-r ${folder.gradient} text-white shadow-lg`
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    data-testid={`folder-${folder.id}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeFolder === folder.id ? "bg-white/20" : "bg-slate-100"
                    }`}>
                      <folder.icon className={`w-5 h-5 ${activeFolder === folder.id ? "text-white" : "text-slate-500"}`} />
                    </div>
                    <span className="flex-1 text-left font-medium">{folder.label}</span>
                    {folder.badge > 0 && (
                      <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg">
                        {folder.badge}
                      </span>
                    )}
                  </button>
                ))}
                
                {activeFolder === "trash" && stats.trash > 0 && (
                  <button
                    onClick={showEmptyTrashConfirm}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all border border-red-200"
                    data-testid="empty-trash-btn"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Vaciar papelera</span>
                  </button>
                )}
              </nav>
            </aside>
            
            {/* Message List */}
            <div className={`flex-1 flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden min-w-0 lg:max-w-md ${mobileView === "message" ? "hidden lg:flex" : "flex"}`}>
              {/* Search Header */}
              <div className="p-5 border-b border-slate-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar mensajes..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    data-testid="search-messages"
                  />
                </div>
                
                {/* Mobile folder selector */}
                <div className="lg:hidden mt-4 flex gap-2 overflow-x-auto pb-2">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => setActiveFolder(folder.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap text-sm transition-all ${
                        activeFolder === folder.id
                          ? `bg-gradient-to-r ${folder.gradient} text-white shadow-lg`
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <folder.icon className="w-4 h-4" />
                      {folder.label}
                      {folder.badge > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {folder.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Message List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full py-20">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                      <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                    </div>
                    <p className="text-slate-500">Cargando mensajes...</p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl flex items-center justify-center mb-4">
                      <Mail className="w-10 h-10 text-indigo-400" />
                    </div>
                    <p className="text-lg font-semibold text-slate-600">No hay mensajes</p>
                    <p className="text-sm text-slate-400">Esta carpeta está vacía</p>
                  </div>
                ) : (
                  filteredMessages.map((msg, index) => {
                    const isRead = activeFolder === "sent" || activeFolder === "trash" || msg.is_read;
                    return (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`w-full p-4 border-b border-slate-100 text-left transition-all hover:bg-slate-50 ${
                        selectedMessage?.id === msg.id ? (msg.message_type === "broadcast" ? "bg-amber-50 border-l-4 border-l-amber-500" : "bg-indigo-50 border-l-4 border-l-indigo-500") : ""
                      } ${!isRead ? (msg.message_type === "broadcast" ? "bg-amber-50/30" : "bg-blue-50/50") : ""}`}
                      style={{ animationDelay: `${index * 30}ms` }}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {msg.message_type === "broadcast" ? (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-amber-500/20">
                            <Megaphone className="w-6 h-6" />
                          </div>
                        ) : activeFolder === "sent" ? (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg shadow-indigo-500/20">
                            {msg.recipients?.[0]?.name?.charAt(0) || "?"}
                          </div>
                        ) : msg.sender?.photo_url ? (
                          <img src={msg.sender.photo_url} alt="" className="w-12 h-12 rounded-2xl object-cover flex-shrink-0 shadow-lg" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg shadow-indigo-500/20">
                            {msg.sender?.name?.charAt(0) || "?"}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {msg.message_type === "broadcast" && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase flex-shrink-0">Comunicado</span>
                              )}
                              <p className={`text-sm truncate ${!isRead ? "font-bold text-slate-900" : "font-normal text-slate-700"}`}>
                                {activeFolder === "sent" 
                                  ? (msg.recipients?.map(r => r.name).join(", ") || "Sin destinatarios")
                                  : msg.sender?.name || "Remitente desconocido"
                                }
                              </p>
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap font-medium">{formatDate(msg.created_at)}</span>
                          </div>
                          <p className={`text-sm truncate ${!isRead ? "font-semibold text-slate-800" : "font-normal text-slate-600"}`}>
                            {msg.subject}
                          </p>
                          <p className={`text-xs truncate mt-1 ${!isRead ? "font-medium text-slate-500" : "font-normal text-slate-400"}`}>{stripHtml(msg.body_preview)}</p>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1.5">
                          {!isRead && <Circle className={`w-2.5 h-2.5 ${msg.message_type === "broadcast" ? "fill-amber-500 text-amber-500" : "fill-blue-500 text-blue-500"}`} />}
                          {msg.has_attachments && <Paperclip className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </div>
                    </button>
                    );
                  })
                )}
              </div>
              
              <MessagePagination page={currentPage} totalPages={totalPages} totalMessages={totalMessages} onPageChange={(p) => loadMessages(activeFolder, p)} />

              {/* Mobile Compose Button */}
              <div className="lg:hidden p-4 border-t bg-white flex-shrink-0">
                <button
                  onClick={() => { setReplyTo(null); setShowCompose(true); }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Redactar
                </button>
              </div>
            </div>
            
            {/* Message Detail */}
            <div className={`flex-1 flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
              {selectedMessage?.message_type === "broadcast" ? (
                <>
                  <div className="p-6 border-b border-slate-100 flex-shrink-0">
                    <button onClick={() => { setSelectedMessage(null); setMobileView("list"); }} className="lg:hidden flex items-center gap-2 text-slate-600 mb-4 hover:text-slate-800">
                      <ChevronLeft className="w-5 h-5" /><span className="font-medium">Volver</span>
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg uppercase flex items-center gap-1">
                        <Megaphone className="w-3.5 h-3.5" /> Comunicado Institucional
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white"><Megaphone className="w-6 h-6" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{selectedMessage.sender?.name}</p>
                        <p className="text-sm text-slate-500">Comunicado institucional</p>
                      </div>
                      <p className="text-sm text-slate-500">{new Date(selectedMessage.created_at).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: selectedMessage.body }} />
                  </div>
                </>
              ) : selectedMessage ? (
                <>
                  {/* Message Header */}
                  <div className="p-6 border-b border-slate-100 flex-shrink-0">
                    <button
                      onClick={() => { setSelectedMessage(null); setMobileView("list"); }}
                      className="lg:hidden flex items-center gap-2 text-slate-600 mb-4 hover:text-slate-800"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      <span className="font-medium">Volver</span>
                    </button>
                    
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-900">{selectedMessage.subject}</h2>
                      <div className="flex items-center gap-2">
                        {activeFolder === "trash" ? (
                          <>
                            <button
                              onClick={() => handleRestore(selectedMessage.id)}
                              className="p-2.5 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors"
                              title="Restaurar"
                            >
                              <ArchiveRestore className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => showDeletePermanentlyConfirm(selectedMessage.id)}
                              className="p-2.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                              title="Eliminar permanentemente"
                            >
                              <AlertTriangle className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleArchive(selectedMessage.id)}
                              className="p-2.5 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors"
                              title="Archivar"
                            >
                              <Archive className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(selectedMessage.id)}
                              className="p-2.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Sender info */}
                    <div className="flex items-center gap-4 mt-5">
                      {selectedMessage.sender?.photo_url ? (
                        <img src={selectedMessage.sender.photo_url} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20">
                          {selectedMessage.sender?.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 text-lg">{selectedMessage.sender?.name}</p>
                        <p className="text-sm text-slate-500">{selectedMessage.sender?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">
                          {new Date(selectedMessage.created_at).toLocaleDateString("es-PE", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {selectedMessage.recipients?.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
                        <span className="font-medium">Para:</span>
                        <span>{selectedMessage.recipients.map(r => r.name).join(", ")}</span>
                      </div>
                    )}
                    {selectedMessage.read_stats && (
                      <div className="mt-4 grid grid-cols-3 gap-3" data-testid="message-read-stats">
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-2xl font-bold text-slate-700">{selectedMessage.read_stats.total}</p>
                          <p className="text-xs text-slate-500">Enviados</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="text-2xl font-bold text-emerald-600">{selectedMessage.read_stats.read}</p>
                          <p className="text-xs text-emerald-600">Leidos</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center">
                          <p className="text-2xl font-bold text-amber-600">{selectedMessage.read_stats.pending}</p>
                          <p className="text-xs text-amber-600">Pendientes</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Body */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div 
                      className="prose pindigo-sm max-w-none text-slate-700"
                      dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                    />
                    
                    {selectedMessage.attachments?.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Archivos adjuntos ({selectedMessage.attachments.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedMessage.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                            >
                              <Paperclip className="w-5 h-5 text-slate-400" />
                              <span className="text-sm text-slate-700 font-medium">{att.name || "Archivo"}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center gap-3 flex-shrink-0">
                    {activeFolder === "trash" ? (
                      <>
                        <button
                          onClick={() => handleRestore(selectedMessage.id)}
                          className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
                          data-testid="restore-btn"
                        >
                          <ArchiveRestore className="w-5 h-5" />
                          Restaurar
                        </button>
                        <button
                          onClick={() => showDeletePermanentlyConfirm(selectedMessage.id)}
                          className="py-3.5 px-6 bg-red-100 hover:bg-red-200 text-red-600 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all"
                          data-testid="delete-permanent-btn"
                        >
                          <AlertTriangle className="w-5 h-5" />
                          Eliminar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleReply}
                          className="flex-1 py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
                          data-testid="reply-btn"
                        >
                          <Reply className="w-5 h-5" />
                          Responder
                        </button>
                        <button
                          onClick={() => handleToggleRead(selectedMessage.id, !selectedMessage.is_read)}
                          className="py-3.5 px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all"
                        >
                          {selectedMessage.is_read ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                          {selectedMessage.is_read ? "No leído" : "Leído"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
                    <Sparkles className="w-12 h-12 text-indigo-400" />
                  </div>
                  <p className="text-xl font-bold text-slate-600">Selecciona un mensaje</p>
                  <p className="text-sm mt-2 text-slate-400">Haz clic en un mensaje para ver su contenido</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Compose Modal */}
      <ComposeModal
        isOpen={showCompose}
        onClose={() => { setShowCompose(false); setReplyTo(null); }}
        token={token}
        onSent={() => { loadMessages(activeFolder); loadStats(); }}
        replyTo={replyTo}
      />
      
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, messageId: null })}
        onConfirm={handleConfirmAction}
        title={confirmModal.type === "emptyTrash" ? "Vaciar papelera" : "Eliminar mensaje"}
        message={
          confirmModal.type === "emptyTrash"
            ? "¿Estás seguro de vaciar la papelera? Se eliminarán todos los mensajes de forma permanente y esta acción no se puede deshacer."
            : "¿Estás seguro de eliminar este mensaje permanentemente? Esta acción no se puede deshacer."
        }
        confirmText={confirmModal.type === "emptyTrash" ? "Vaciar papelera" : "Eliminar"}
        confirmStyle="danger"
        icon={AlertTriangle}
        loading={confirmLoading}
      />
      <MobileBottomNav role="teacher" />
    </div>
  );
}
