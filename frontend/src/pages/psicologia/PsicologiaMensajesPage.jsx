import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import {
  ArrowLeft, Send, Search, MessageSquare, User, Paperclip,
  AlertTriangle, Check, CheckCheck, Clock, ChevronRight, Plus,
  X, FileText, Mail, AlertCircle, BookOpen, Filter
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaMensajesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const fetchConversations = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API}/v1/psychology/messages/conversations${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    setMobileShowChat(true);
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API}/v1/psychology/messages/conversations/${convo.conversation_id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingMsgs(false);
      fetchConversations();
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeConvo) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/v1/psychology/messages`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          student_id: activeConvo.student_id,
          to_user_id: activeConvo.parent_id,
          body: reply.trim(),
          requires_response: requiresResponse,
          is_urgent: isUrgent,
        })
      });
      if (res.ok) {
        setReply("");
        setRequiresResponse(false);
        setIsUrgent(false);
        openConversation(activeConvo);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleNewMessage = async (data) => {
    try {
      const res = await fetch(`${API}/v1/psychology/messages`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setShowNewMsg(false);
        fetchConversations();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("es-PE", { weekday: "short" });
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50" data-testid="psicologia-mensajes">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => mobileShowChat ? setMobileShowChat(false) : navigate(getSchoolPath("/psicologia"))}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors" data-testid="back-btn">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Comunicacion con Padres</h1>
            <p className="text-xs text-slate-500">{conversations.length} conversaciones</p>
          </div>
          <button onClick={() => setShowNewMsg(true)}
            className="px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-1.5"
            data-testid="new-message-btn">
            <Plus className="w-3.5 h-3.5" /> Nuevo mensaje
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto h-[calc(100vh-57px)] flex">
        {/* Left Panel - Conversations */}
        <div className={`w-full sm:w-[340px] lg:w-[380px] border-r border-slate-200/60 bg-white flex flex-col flex-shrink-0 ${mobileShowChat ? "hidden sm:flex" : "flex"}`}>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar padre o estudiante..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="search-conversations" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                    <div className="flex-1 space-y-2"><div className="h-4 w-32 bg-slate-200 rounded"></div><div className="h-3 w-48 bg-slate-100 rounded"></div></div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No hay conversaciones</p>
              </div>
            ) : conversations.map(convo => (
              <button key={convo.conversation_id}
                onClick={() => openConversation(convo)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-violet-50/50 transition-colors text-left border-b border-slate-100/60 ${activeConvo?.conversation_id === convo.conversation_id ? "bg-violet-50/80" : ""}`}
                data-testid={`convo-${convo.conversation_id}`}>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {convo.parent_photo ? <img src={convo.parent_photo} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${convo.unread_count > 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{convo.parent_name}</p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(convo.last_message_date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{convo.student_name} {convo.student_grade ? `- ${convo.student_grade}` : ""}</p>
                  <p className={`text-xs mt-0.5 truncate ${convo.unread_count > 0 ? "text-slate-700 font-medium" : "text-slate-400"}`}>{convo.last_message_preview}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-1">
                  {convo.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center font-bold">{convo.unread_count}</span>
                  )}
                  {convo.has_requires_response && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Active Conversation */}
        <div className={`flex-1 flex flex-col bg-slate-50/50 ${!mobileShowChat ? "hidden sm:flex" : "flex"}`}>
          {!activeConvo ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Selecciona una conversacion</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 bg-white border-b border-slate-200/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {activeConvo.parent_photo ? <img src={activeConvo.parent_photo} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{activeConvo.parent_name}</p>
                  <p className="text-xs text-slate-500 truncate">Estudiante: {activeConvo.student_name} {activeConvo.student_grade ? `(${activeConvo.student_grade} ${activeConvo.student_section || ""})` : ""}</p>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="messages-area">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full"></div></div>
                ) : messages.map(msg => {
                  const isMine = msg.from_role === "psicologo";
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-violet-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"}`}
                        data-testid={`msg-${msg.id}`}>
                        {msg.subject && <p className={`text-xs font-semibold mb-1 ${isMine ? "text-violet-200" : "text-slate-500"}`}>{msg.subject}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        {msg.attachments?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map((a, i) => (
                              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                                className={`flex items-center gap-1 text-xs ${isMine ? "text-violet-200 hover:text-white" : "text-violet-600 hover:text-violet-700"}`}>
                                <Paperclip className="w-3 h-3" />{a.name || "Adjunto"}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                          <span className={`text-[10px] ${isMine ? "text-violet-200" : "text-slate-400"}`}>{formatDate(msg.created_at)}</span>
                          {isMine && (msg.read ? <CheckCheck className="w-3 h-3 text-violet-200" /> : <Check className="w-3 h-3 text-violet-300" />)}
                          {msg.is_urgent && <AlertTriangle className={`w-3 h-3 ${isMine ? "text-yellow-300" : "text-amber-500"}`} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              <div className="px-4 py-3 bg-white border-t border-slate-200/60">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      rows={2} data-testid="reply-input"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                    <div className="flex items-center gap-3 mt-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={requiresResponse} onChange={(e) => setRequiresResponse(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5" />
                        <span className="text-[11px] text-slate-500">Requiere respuesta</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5" />
                        <span className="text-[11px] text-slate-500">Urgente</span>
                      </label>
                      <button type="button" onClick={() => setShowTemplates(true)} className="text-[11px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Plantilla
                      </button>
                    </div>
                  </div>
                  <button onClick={sendReply} disabled={!reply.trim() || sending}
                    className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    data-testid="send-reply-btn">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showNewMsg && <NewMessageModal token={token} onSend={handleNewMessage} onClose={() => setShowNewMsg(false)} />}
      {showTemplates && <TemplatesModal token={token} onSelect={(tpl) => { setReply(tpl.body); setShowTemplates(false); }} onClose={() => setShowTemplates(false)} />}
    </div>
  );
}


function NewMessageModal({ token, onSend, onClose }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (studentSearch.length < 2) { setStudents([]); return; }
    const timer = setTimeout(async () => {
      setLoadingStudents(true);
      try {
        const res = await fetch(`${API}/v1/psychology/students?search=${encodeURIComponent(studentSearch)}&limit=10`, { headers });
        if (res.ok) { const d = await res.json(); setStudents(d.students || []); }
      } catch(e) {} finally { setLoadingStudents(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  const selectStudent = async (student) => {
    setSelectedStudent(student);
    setStudents([]);
    setStudentSearch(`${student.name} ${student.last_name}`);
    setLoadingParents(true);
    try {
      const res = await fetch(`${API}/v1/psychology/students/${student.id}/parents`, { headers });
      if (res.ok) { const d = await res.json(); setParents(d.parents || []); if (d.parents?.length === 1) setSelectedParent(d.parents[0]); }
    } catch(e) {} finally { setLoadingParents(false); }
  };

  const handleSend = () => {
    if (!selectedStudent || !selectedParent || !body.trim()) return;
    onSend({
      student_id: selectedStudent.id,
      to_user_id: selectedParent.id,
      subject,
      body: body.trim(),
      requires_response: requiresResponse,
      is_urgent: isUrgent,
    });
  };

  const applyTemplate = (tpl) => {
    let s = tpl.subject || "";
    let b = tpl.body || "";
    if (selectedStudent) {
      b = b.replace(/\{\{nombre_estudiante\}\}/g, `${selectedStudent.name} ${selectedStudent.last_name}`);
      b = b.replace(/\{\{grado\}\}/g, selectedStudent.grade || "");
    }
    if (selectedParent) {
      b = b.replace(/\{\{nombre_padre\}\}/g, `${selectedParent.name} ${selectedParent.last_name}`);
    }
    b = b.replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString("es-PE"));
    setSubject(s);
    setBody(b);
    setShowTemplates(false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-xl" data-testid="new-message-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-800">Nuevo Mensaje</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Student search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante *</label>
            <div className="relative">
              <input type="text" value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); setParents([]); setSelectedParent(null); }}
                placeholder="Buscar estudiante..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="search-student-input" />
              {students.length > 0 && !selectedStudent && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {students.map(s => (
                    <button key={s.id} type="button" onClick={() => selectStudent(s)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-violet-50 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{s.name} {s.last_name}</span>
                      {s.grade && <span className="text-xs text-slate-400 ml-auto">{s.grade} {s.section||""}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Parent selector */}
          {selectedStudent && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Padre/Apoderado *</label>
              {loadingParents ? <p className="text-xs text-slate-400">Buscando...</p> : parents.length === 0 ? (
                <p className="text-xs text-amber-600">Este estudiante no tiene padres vinculados</p>
              ) : (
                <div className="space-y-1.5">
                  {parents.map(p => (
                    <button key={p.id} type="button" onClick={() => setSelectedParent(p)}
                      className={`w-full px-3 py-2 text-left text-sm border rounded-xl flex items-center gap-2 transition-colors ${selectedParent?.id === p.id ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}
                      data-testid={`parent-option-${p.id}`}>
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{p.name} {p.last_name}</span>
                      {p.email && <span className="text-xs text-slate-400 ml-auto">{p.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asunto (opcional)</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="message-subject" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">Mensaje *</label>
              <button type="button" onClick={() => setShowTemplates(true)} className="text-[11px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Usar plantilla
              </button>
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={5} required data-testid="message-body" />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={requiresResponse} onChange={(e) => setRequiresResponse(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
              <span className="text-xs text-slate-600">Requiere respuesta</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
              <span className="text-xs text-slate-600">Urgente</span>
            </label>
          </div>

          <button type="button" onClick={handleSend} disabled={!selectedStudent || !selectedParent || !body.trim()}
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="send-new-message-btn">
            <Send className="w-4 h-4" /> Enviar Mensaje
          </button>
        </div>
      </div>

      {showTemplates && <TemplatesModal token={token} onSelect={applyTemplate} onClose={() => setShowTemplates(false)} nested />}
    </div>
  );
}


function TemplatesModal({ token, onSelect, onClose, nested }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchTemplates(); }, [catFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = catFilter ? `?category=${catFilter}` : "";
      const res = await fetch(`${API}/v1/psychology/templates${params}`, { headers });
      if (res.ok) { const d = await res.json(); setTemplates(d.templates || []); }
    } catch(e) {} finally { setLoading(false); }
  };

  const createTemplate = async (data) => {
    try {
      const res = await fetch(`${API}/v1/psychology/templates`, { method: "POST", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify(data) });
      if (res.ok) { setShowCreate(false); fetchTemplates(); }
    } catch(e) {}
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Eliminar plantilla?")) return;
    try { await fetch(`${API}/v1/psychology/templates/${id}`, { method: "DELETE", headers }); fetchTemplates(); } catch(e) {}
  };

  const cats = ["citacion", "informe", "autorizacion", "seguimiento", "general"];

  return (
    <div className={`fixed inset-0 ${nested ? "z-[350]" : "z-[300]"} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-auto shadow-xl" data-testid="templates-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-800">Plantillas</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowCreate(true)} className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Nueva</button>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>
        <div className="px-5 py-2 border-b border-slate-100">
          <div className="flex gap-1.5 overflow-x-auto">
            <button type="button" onClick={() => setCatFilter("")} className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap ${!catFilter ? "bg-violet-100 text-violet-700 font-medium" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>Todas</button>
            {cats.map(c => (
              <button key={c} type="button" onClick={() => setCatFilter(c)} className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap capitalize ${catFilter === c ? "bg-violet-100 text-violet-700 font-medium" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="p-3">
          {loading ? <div className="p-4 text-center text-sm text-slate-400">Cargando...</div> : templates.length === 0 ? (
            <div className="p-8 text-center"><FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No hay plantillas</p></div>
          ) : templates.map(tpl => (
            <div key={tpl.id} className="px-3 py-2.5 border border-slate-200 rounded-xl mb-2 hover:border-violet-300 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-800">{tpl.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full capitalize">{tpl.category}</span>
                  <button type="button" onClick={() => deleteTemplate(tpl.id)} className="p-1 hover:bg-red-50 rounded"><X className="w-3 h-3 text-red-400" /></button>
                </div>
              </div>
              {tpl.subject && <p className="text-xs text-slate-500 mb-1">Asunto: {tpl.subject}</p>}
              <p className="text-xs text-slate-400 line-clamp-2 mb-2">{tpl.body}</p>
              <button type="button" onClick={() => onSelect(tpl)} className="text-xs text-violet-600 hover:text-violet-700 font-medium" data-testid={`use-template-${tpl.id}`}>Usar esta plantilla</button>
            </div>
          ))}
        </div>

        {showCreate && <CreateTemplateInline onCreate={createTemplate} onCancel={() => setShowCreate(false)} />}
      </div>
    </div>
  );
}

function CreateTemplateInline({ onCreate, onCancel }) {
  const [form, setForm] = useState({ name: "", subject: "", body: "", category: "general", is_shared: false });
  return (
    <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
      <h4 className="text-xs font-semibold text-slate-700 mb-3">Nueva Plantilla</h4>
      <div className="space-y-2">
        <input type="text" value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} placeholder="Nombre" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" data-testid="tpl-name" />
        <select value={form.category} onChange={(e) => setForm(f => ({...f, category: e.target.value}))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
          {["citacion","informe","autorizacion","seguimiento","general"].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <input type="text" value={form.subject} onChange={(e) => setForm(f => ({...f, subject: e.target.value}))} placeholder="Asunto" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        <textarea value={form.body} onChange={(e) => setForm(f => ({...f, body: e.target.value}))} placeholder="Cuerpo (usar {{nombre_estudiante}}, {{nombre_padre}}, {{fecha}}, {{grado}})" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm resize-none" rows={3} data-testid="tpl-body" />
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.is_shared} onChange={(e) => setForm(f => ({...f, is_shared: e.target.checked}))} className="rounded" /><span className="text-xs text-slate-600">Compartir con otros psicologos</span></label>
        <div className="flex gap-2">
          <button type="button" onClick={() => onCreate(form)} disabled={!form.name || !form.body} className="flex-1 py-1.5 bg-violet-600 text-white text-xs rounded-lg disabled:opacity-50">Crear</button>
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
