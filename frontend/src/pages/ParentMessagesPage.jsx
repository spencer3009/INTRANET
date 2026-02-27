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
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import {
  Mail, Inbox, Send, Archive, Trash2, Search, Plus, ChevronLeft, Paperclip, X, Loader2, Circle,
  Edit3, Reply, MailOpen, AlertCircle, AlertTriangle, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon,
  Highlighter, Undo, Redo, ArchiveRestore
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ROLE_LABELS = { owner: "Director", admin: "Administrador", teacher: "Profesor", auxiliar: "Auxiliar", student: "Estudiante", parent: "Padre/Apoderado" };

function EditorToolbar({ editor }) {
  if (!editor) return null;
  const B = ({ onClick, isActive, children, title }) => <button type="button" onClick={onClick} title={title} className={`p-2 rounded-lg transition-all ${isActive ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}>{children}</button>;
  const D = () => <div className="w-px h-6 bg-gray-200 mx-1" />;
  return (
    <div className="flex items-center flex-wrap gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
      <B onClick={() => editor.chain().focus().undo().run()} title="Deshacer"><Undo className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().redo().run()} title="Rehacer"><Redo className="w-4 h-4" /></B><D />
      <B onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Negrita"><Bold className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Cursiva"><Italic className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Subrayado"><UnderlineIcon className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Tachado"><Strikethrough className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Resaltar"><Highlighter className="w-4 h-4" /></B><D />
      <B onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")}><List className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")}><ListOrdered className="w-4 h-4" /></B><D />
      <B onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })}><AlignLeft className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })}><AlignCenter className="w-4 h-4" /></B>
      <B onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })}><AlignRight className="w-4 h-4" /></B><D />
      <B onClick={() => { const url = window.prompt("URL:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} isActive={editor.isActive("link")}><LinkIcon className="w-4 h-4" /></B>
    </div>
  );
}

function ComposeModal({ isOpen, onClose, token, onSent, replyTo }) {
  const [recipients, setRecipients] = useState([]);
  const [subject, setSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Underline, TextAlign.configure({ types: ["heading", "paragraph"] }), Highlight, Link.configure({ openOnClick: false }), Placeholder.configure({ placeholder: "Escribe tu mensaje..." })],
    content: "", editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4" } }
  });

  useEffect(() => {
    if (replyTo) { setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`); setRecipients([replyTo.sender]); }
    else { setSubject(""); setRecipients([]); }
    if (editor) editor.commands.setContent("");
    setError("");
  }, [replyTo, isOpen, editor]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      setSearching(true);
      try { const res = await axios.get(`${API}/api/internal-mail/contacts/search?q=${encodeURIComponent(searchQuery)}`, { headers }); setSearchResults(res.data.contacts || []); } catch (e) {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addRecipient = (c) => { if (!recipients.find(r => r.id === c.id)) { const n = c.last_name ? `${c.name || c.first_name || ''} ${c.last_name}`.trim() : c.name || c.first_name || ''; setRecipients([...recipients, { ...c, name: n }]); } setSearchQuery(""); setSearchResults([]); setShowDrop(false); };

  const handleSend = async () => {
    if (recipients.length === 0) return setError("Selecciona al menos un destinatario");
    if (!subject.trim()) return setError("El asunto es requerido");
    const body = editor?.getHTML() || "";
    if (!editor?.getText()?.trim()) return setError("El mensaje no puede estar vacio");
    setSending(true); setError("");
    try {
      if (replyTo) await axios.post(`${API}/api/internal-mail/${replyTo.id}/reply`, { body }, { headers });
      else await axios.post(`${API}/api/internal-mail/send`, { subject: subject.trim(), body, recipient_ids: recipients.map(r => r.id) }, { headers });
      onSent?.(); onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al enviar"); } finally { setSending(false); }
  };

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Edit3 className="w-5 h-5 text-white" /></div><h2 className="text-lg font-semibold text-white">{replyTo ? "Responder" : "Nuevo mensaje"}</h2></div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Para:</label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl min-h-[48px]">
                {recipients.map(r => <span key={r.id} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">{r.name}<button onClick={() => setRecipients(recipients.filter(x => x.id !== r.id))}><X className="w-3 h-3" /></button></span>)}
                <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowDrop(true); }} onFocus={() => setShowDrop(true)} placeholder={recipients.length === 0 ? "Buscar destinatarios..." : ""} className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-sm" />
              </div>
              {showDrop && (searchResults.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {searching ? <div className="p-3 text-center text-gray-500"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div> :
                    searchResults.map(c => { const n = c.last_name ? `${c.name || c.first_name || ''} ${c.last_name}`.trim() : c.name || c.first_name || ''; return (
                      <button key={c.id} onClick={() => addRecipient(c)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left">
                        {c.photo_url ? <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">{n?.charAt(0)}</div>}
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{n}</p><p className="text-xs text-gray-500">{ROLE_LABELS[c.role] || c.role}</p></div>
                      </button>
                    ); })}
                </div>
              )}
            </div>
          </div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Asunto:</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Escribe el asunto..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label><div className="border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500"><EditorToolbar editor={editor} /><EditorContent editor={editor} className="min-h-[200px] max-h-[300px] overflow-y-auto" /></div></div>
        </div>
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"><Paperclip className="w-4 h-4" />Adjuntar</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleSend} disabled={sending} className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" />Enviar</button>
          </div>
        </div>
      </div>
    </div>, document.body
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, loading }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6"><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600"><AlertTriangle className="w-6 h-6" /></div><div className="flex-1"><h3 className="text-lg font-bold text-gray-900">{title}</h3><p className="mt-2 text-sm text-gray-600">{message}</p></div></div></div>
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50">{loading && <Loader2 className="w-4 h-4 animate-spin" />}{confirmText}</button>
        </div>
      </div>
    </div>, document.body
  );
}

export default function ParentMessagesPage({ user, token, onLogout }) {
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
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, messageId: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const folders = [
    { id: "inbox", label: "Bandeja de entrada", icon: Inbox, count: stats.inbox, badge: stats.unread },
    { id: "sent", label: "Enviados", icon: Send, count: stats.sent },
    { id: "archived", label: "Archivados", icon: Archive, count: stats.archived },
    { id: "trash", label: "Papelera", icon: Trash2, count: stats.trash },
  ];

  const loadStats = async () => { try { const res = await axios.get(`${API}/api/internal-mail/stats`, { headers }); setStats(res.data); } catch (e) {} };
  const loadMessages = async (folder) => { setLoading(true); try { const res = await axios.get(`${API}/api/internal-mail/${folder}`, { headers }); setMessages(res.data.messages || []); } catch (e) { setMessages([]); } finally { setLoading(false); } };
  const loadMessage = async (id) => { try { const res = await axios.get(`${API}/api/internal-mail/${id}`, { headers }); setSelectedMessage(res.data); loadStats(); } catch (e) {} };

  useEffect(() => {
    const init = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        const cl = profileRes.data.children || [];
        setChildren(cl);
        if (cl.length > 0) {
          const savedId = localStorage.getItem('selected_child_id');
          const child = cl.find(c => c.id === savedId) || cl[0];
          setSelectedChild(child);
          localStorage.setItem('selected_child_id', child.id);
        }
      } catch (e) {}
      loadStats(); loadMessages("inbox");
    };
    init();
  }, [token]);

  useEffect(() => { loadMessages(activeFolder); setSelectedMessage(null); }, [activeFolder]);

  const handleChildChange = (newChild) => { if (!newChild || newChild.id === selectedChild?.id) return; setSelectedChild(newChild); localStorage.setItem('selected_child_id', newChild.id); };

  const handleArchive = async (id) => { try { await axios.put(`${API}/api/internal-mail/${id}/archive`, null, { headers }); loadMessages(activeFolder); loadStats(); if (selectedMessage?.id === id) setSelectedMessage(null); } catch (e) {} };
  const handleDelete = async (id) => { try { await axios.delete(`${API}/api/internal-mail/${id}`, { headers }); loadMessages(activeFolder); loadStats(); if (selectedMessage?.id === id) setSelectedMessage(null); } catch (e) {} };
  const handleRestore = async (id) => { try { await axios.put(`${API}/api/internal-mail/${id}/restore`, null, { headers }); loadMessages(activeFolder); loadStats(); if (selectedMessage?.id === id) setSelectedMessage(null); } catch (e) {} };
  const handleToggleRead = async (id, isRead) => { try { await axios.put(`${API}/api/internal-mail/${id}/read?is_read=${isRead}`, null, { headers }); loadMessages(activeFolder); loadStats(); } catch (e) {} };

  const handleConfirmAction = async () => {
    setConfirmLoading(true);
    try {
      if (confirmModal.type === "deletePermanently") { await axios.delete(`${API}/api/internal-mail/${confirmModal.messageId}/permanent`, { headers }); if (selectedMessage?.id === confirmModal.messageId) setSelectedMessage(null); }
      else if (confirmModal.type === "emptyTrash") { await axios.delete(`${API}/api/internal-mail/trash/empty`, { headers }); setSelectedMessage(null); }
      loadMessages(activeFolder); loadStats(); setConfirmModal({ isOpen: false, type: null, messageId: null });
    } catch (e) {} finally { setConfirmLoading(false); }
  };

  const stripHtml = (html) => html ? html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : "";
  const formatDate = (dateStr) => { const d = new Date(dateStr); const t = new Date(); if (d.toDateString() === t.toDateString()) return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }); };

  const filteredMessages = messages.filter(msg => { if (!searchQuery.trim()) return true; const q = searchQuery.toLowerCase(); return msg.subject?.toLowerCase().includes(q) || msg.sender?.name?.toLowerCase().includes(q) || msg.body_preview?.toLowerCase().includes(q); });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="parent-messages-page">
      <ParentSidebar active="mensajes" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Folders */}
          <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="p-4"><button onClick={() => { setReplyTo(null); setShowCompose(true); }} className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg" data-testid="compose-btn"><Plus className="w-5 h-5" />Redactar</button></div>
            <nav className="flex-1 px-3 py-2 space-y-1">
              {folders.map(f => (
                <button key={f.id} onClick={() => setActiveFolder(f.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeFolder === f.id ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-100"}`} data-testid={`folder-${f.id}`}>
                  <f.icon className="w-5 h-5" /><span className="flex-1 text-left font-medium">{f.label}</span>
                  {f.badge > 0 && <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{f.badge}</span>}
                  {f.count > 0 && !f.badge && <span className="text-sm text-gray-400">{f.count}</span>}
                </button>
              ))}
              {activeFolder === "trash" && stats.trash > 0 && <button onClick={() => setConfirmModal({ isOpen: true, type: "emptyTrash", messageId: null })} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200"><AlertTriangle className="w-4 h-4" /><span className="font-medium text-sm">Vaciar papelera</span></button>}
            </nav>
          </aside>

          {/* Message List */}
          <div className={`flex-1 flex flex-col lg:max-w-md border-r border-gray-200 bg-white ${mobileView === "message" ? "hidden lg:flex" : "flex"}`}>
            <div className="p-4 border-b border-gray-100">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar mensajes..." className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white" data-testid="search-messages" /></div>
              <div className="lg:hidden mt-3 flex gap-2 overflow-x-auto pb-2">
                {folders.map(f => <button key={f.id} onClick={() => setActiveFolder(f.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm ${activeFolder === f.id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}><f.icon className="w-4 h-4" />{f.label}{f.badge > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{f.badge}</span>}</button>)}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /></div>
              : filteredMessages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8"><Mail className="w-16 h-16 mb-4 opacity-50" /><p className="text-lg font-medium">No hay mensajes</p></div>
              : filteredMessages.map(msg => (
                <button key={msg.id} onClick={() => { loadMessage(msg.id); setMobileView("message"); }} className={`w-full p-4 border-b border-gray-100 text-left hover:bg-gray-50 ${selectedMessage?.id === msg.id ? "bg-emerald-50" : ""} ${!msg.is_read ? "bg-blue-50/50" : ""}`} data-testid={`message-${msg.id}`}>
                  <div className="flex items-start gap-3">
                    {activeFolder === "sent" ? <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{msg.recipients?.[0]?.name?.charAt(0) || "?"}</div>
                    : msg.sender?.photo_url ? <img src={msg.sender.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{msg.sender?.name?.charAt(0) || "?"}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2"><p className={`text-sm truncate ${!msg.is_read ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{activeFolder === "sent" ? (msg.recipients?.map(r => r.name).join(", ") || "Sin destinatarios") : msg.sender?.name || "Desconocido"}</p><span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(msg.created_at)}</span></div>
                      <p className={`text-sm truncate ${!msg.is_read ? "font-semibold text-gray-800" : "text-gray-600"}`}>{msg.subject}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{stripHtml(msg.body_preview)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">{!msg.is_read && <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />}{msg.has_attachments && <Paperclip className="w-3 h-3 text-gray-400" />}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="lg:hidden p-4 border-t bg-white"><button onClick={() => { setReplyTo(null); setShowCompose(true); }} className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><Plus className="w-5 h-5" />Redactar</button></div>
          </div>

          {/* Detail */}
          <div className={`flex-1 flex flex-col bg-white ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
            {selectedMessage ? (
              <>
                <div className="p-6 border-b border-gray-100">
                  <button onClick={() => { setSelectedMessage(null); setMobileView("list"); }} className="lg:hidden flex items-center gap-2 text-gray-600 mb-4"><ChevronLeft className="w-5 h-5" />Volver</button>
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-900">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-2">
                      {activeFolder === "trash" ? (<><button onClick={() => handleRestore(selectedMessage.id)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg"><ArchiveRestore className="w-5 h-5" /></button><button onClick={() => setConfirmModal({ isOpen: true, type: "deletePermanently", messageId: selectedMessage.id })} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></button></>) : (<><button onClick={() => handleArchive(selectedMessage.id)} className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg"><Archive className="w-5 h-5" /></button><button onClick={() => handleDelete(selectedMessage.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-5 h-5" /></button></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    {selectedMessage.sender?.photo_url ? <img src={selectedMessage.sender.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg font-bold">{selectedMessage.sender?.name?.charAt(0) || "?"}</div>}
                    <div className="flex-1"><p className="font-semibold text-gray-900">{selectedMessage.sender?.name}</p><p className="text-sm text-gray-500">{selectedMessage.sender?.email}</p></div>
                    <div className="text-right"><p className="text-sm text-gray-500">{new Date(selectedMessage.created_at).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p></div>
                  </div>
                  {selectedMessage.recipients?.length > 0 && <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><span>Para:</span><span>{selectedMessage.recipients.map(r => r.name).join(", ")}</span></div>}
                </div>
                <div className="flex-1 overflow-y-auto p-6"><div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: selectedMessage.body }} /></div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
                  {activeFolder === "trash" ? (<><button onClick={() => handleRestore(selectedMessage.id)} className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><ArchiveRestore className="w-5 h-5" />Restaurar</button><button onClick={() => setConfirmModal({ isOpen: true, type: "deletePermanently", messageId: selectedMessage.id })} className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-600 font-medium rounded-xl flex items-center justify-center gap-2"><AlertTriangle className="w-5 h-5" />Eliminar</button></>) : (<><button onClick={() => { setReplyTo(selectedMessage); setShowCompose(true); }} className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2" data-testid="reply-btn"><Reply className="w-5 h-5" />Responder</button><button onClick={() => handleToggleRead(selectedMessage.id, !selectedMessage.is_read)} className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2">{selectedMessage.is_read ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}{selectedMessage.is_read ? "No leido" : "Leido"}</button></>)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8"><Mail className="w-20 h-20 mb-4 opacity-30" /><p className="text-xl font-medium">Selecciona un mensaje</p></div>
            )}
          </div>
        </main>
      </div>

      <ComposeModal isOpen={showCompose} onClose={() => { setShowCompose(false); setReplyTo(null); }} token={token} onSent={() => { loadMessages(activeFolder); loadStats(); }} replyTo={replyTo} />
      <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, type: null, messageId: null })} onConfirm={handleConfirmAction} title={confirmModal.type === "emptyTrash" ? "Vaciar papelera" : "Eliminar mensaje"} message={confirmModal.type === "emptyTrash" ? "Se eliminaran todos los mensajes permanentemente." : "Se eliminara este mensaje permanentemente."} confirmText={confirmModal.type === "emptyTrash" ? "Vaciar papelera" : "Eliminar"} loading={confirmLoading} />
    </div>
  );
}
