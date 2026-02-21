import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import {
  Mail, Inbox, Send, Archive, Trash2, Search, Plus,
  ChevronLeft, Paperclip, X, Clock, Loader2, Circle,
  Edit3, Reply, MailOpen, AlertCircle, AlertTriangle,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Highlighter, Undo, Redo, ArchiveRestore
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
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {replyTo ? "Responder mensaje" : "Nuevo mensaje"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {/* Recipients */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Para:</label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl min-h-[48px]">
                {recipients.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                    {r.name}
                    <button onClick={() => removeRecipient(r.id)} className="hover:text-indigo-900">
                      <X className="w-3 h-3" />
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
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
                            <img src={contact.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Body */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500">
              <EditorToolbar editor={editor} />
              <EditorContent editor={editor} className="min-h-[200px] max-h-[300px] overflow-y-auto" />
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            <Paperclip className="w-4 h-4" />
            Adjuntar
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
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
// MAIN STUDENT MESSAGES PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function StudentMessagesPage({ user, token, onLogout }) {
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
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const folders = [
    { id: "inbox", label: "Bandeja de entrada", icon: Inbox, count: stats.inbox, badge: stats.unread },
    { id: "sent", label: "Enviados", icon: Send, count: stats.sent },
    { id: "archived", label: "Archivados", icon: Archive, count: stats.archived },
    { id: "trash", label: "Papelera", icon: Trash2, count: stats.trash },
  ];
  
  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/api/internal-mail/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };
  
  const loadMessages = async (folder) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/internal-mail/${folder}`, { headers });
      setMessages(res.data.messages || []);
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
      loadStats();
    } catch (err) {
      console.error("Error loading message:", err);
    }
  };
  
  useEffect(() => {
    loadStats();
  }, [token]);
  
  useEffect(() => {
    loadMessages(activeFolder);
    setSelectedMessage(null);
  }, [activeFolder]);
  
  const handleSelectMessage = (msg) => {
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
  
  const handleDeletePermanently = async (messageId) => {
    if (!window.confirm("¿Estás seguro de eliminar este mensaje permanentemente? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      await axios.delete(`${API}/api/internal-mail/${messageId}/permanent`, { headers });
      loadMessages(activeFolder);
      loadStats();
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error("Error deleting permanently:", err);
    }
  };
  
  const handleEmptyTrash = async () => {
    if (!window.confirm("¿Estás seguro de vaciar la papelera? Se eliminarán todos los mensajes permanentemente.")) {
      return;
    }
    try {
      await axios.delete(`${API}/api/internal-mail/trash/empty`, { headers });
      loadMessages(activeFolder);
      loadStats();
      setSelectedMessage(null);
    } catch (err) {
      console.error("Error emptying trash:", err);
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
  
  // Helper to strip HTML tags from preview text
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
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="student-messages-page">
      <StudentSidebar
        active="mensajes"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName="Portal Alumno"
        subdomain={user?.subdomain}
        user={user}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
        />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col lg:flex-row">
          {/* Folders Sidebar */}
          <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="p-4">
              <button
                onClick={() => { setReplyTo(null); setShowCompose(true); }}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                data-testid="compose-btn"
              >
                <Plus className="w-5 h-5" />
                Redactar
              </button>
            </div>
            
            <nav className="flex-1 px-3 py-2 space-y-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeFolder === folder.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  data-testid={`folder-${folder.id}`}
                >
                  <folder.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{folder.label}</span>
                  {folder.badge > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {folder.badge}
                    </span>
                  )}
                  {folder.count > 0 && !folder.badge && (
                    <span className="text-sm text-gray-400">{folder.count}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
          
          {/* Message List */}
          <div className={`flex-1 flex flex-col lg:max-w-md border-r border-gray-200 bg-white ${mobileView === "message" ? "hidden lg:flex" : "flex"}`}>
            {/* Search Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mensajes..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  data-testid="search-messages"
                />
              </div>
              
              {/* Mobile folder selector */}
              <div className="lg:hidden mt-3 flex gap-2 overflow-x-auto pb-2">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm transition-all ${
                      activeFolder === folder.id
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <folder.icon className="w-4 h-4" />
                    {folder.label}
                    {folder.badge > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
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
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                  <Mail className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No hay mensajes</p>
                  <p className="text-sm">Esta carpeta está vacía</p>
                </div>
              ) : (
                filteredMessages.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`w-full p-4 border-b border-gray-100 text-left transition-all hover:bg-gray-50 ${
                      selectedMessage?.id === msg.id ? "bg-indigo-50" : ""
                    } ${!msg.is_read ? "bg-blue-50/50" : ""}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {activeFolder === "sent" ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {msg.recipients?.[0]?.name?.charAt(0) || "?"}
                        </div>
                      ) : msg.sender?.photo_url ? (
                        <img src={msg.sender.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {msg.sender?.name?.charAt(0) || "?"}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${!msg.is_read ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                            {activeFolder === "sent" 
                              ? (msg.recipients?.map(r => r.name).join(", ") || "Sin destinatarios")
                              : msg.sender?.name || "Remitente desconocido"
                            }
                          </p>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className={`text-sm truncate ${!msg.is_read ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{stripHtml(msg.body_preview)}</p>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1">
                        {!msg.is_read && <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />}
                        {msg.has_attachments && <Paperclip className="w-3 h-3 text-gray-400" />}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {/* Mobile Compose Button */}
            <div className="lg:hidden p-4 border-t bg-white">
              <button
                onClick={() => { setReplyTo(null); setShowCompose(true); }}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Redactar
              </button>
            </div>
          </div>
          
          {/* Message Detail */}
          <div className={`flex-1 flex flex-col bg-white ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
            {selectedMessage ? (
              <>
                {/* Message Header */}
                <div className="p-6 border-b border-gray-100">
                  <button
                    onClick={() => { setSelectedMessage(null); setMobileView("list"); }}
                    className="lg:hidden flex items-center gap-2 text-gray-600 mb-4"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Volver
                  </button>
                  
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-900">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-2">
                      {activeFolder === "trash" ? (
                        <button
                          onClick={() => handleRestore(selectedMessage.id)}
                          className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                          title="Restaurar"
                        >
                          <ArchiveRestore className="w-5 h-5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleArchive(selectedMessage.id)}
                            className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                            title="Archivar"
                          >
                            <Archive className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(selectedMessage.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Sender info */}
                  <div className="flex items-center gap-4 mt-4">
                    {selectedMessage.sender?.photo_url ? (
                      <img src={selectedMessage.sender.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                        {selectedMessage.sender?.name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{selectedMessage.sender?.name}</p>
                      <p className="text-sm text-gray-500">{selectedMessage.sender?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
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
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <span>Para:</span>
                      <span>{selectedMessage.recipients.map(r => r.name).join(", ")}</span>
                    </div>
                  )}
                </div>
                
                {/* Message Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div 
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                  />
                  
                  {selectedMessage.attachments?.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Archivos adjuntos ({selectedMessage.attachments.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedMessage.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <Paperclip className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-700">{att.name || "Archivo"}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
                  <button
                    onClick={handleReply}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                    data-testid="reply-btn"
                  >
                    <Reply className="w-5 h-5" />
                    Responder
                  </button>
                  <button
                    onClick={() => handleToggleRead(selectedMessage.id, !selectedMessage.is_read)}
                    className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {selectedMessage.is_read ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                    {selectedMessage.is_read ? "No leído" : "Leído"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <Mail className="w-20 h-20 mb-4 opacity-30" />
                <p className="text-xl font-medium">Selecciona un mensaje</p>
                <p className="text-sm mt-1">Haz clic en un mensaje para ver su contenido</p>
              </div>
            )}
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
    </div>
  );
}
