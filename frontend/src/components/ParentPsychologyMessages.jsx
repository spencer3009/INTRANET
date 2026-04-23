import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Send, MessageSquare, User, Brain, Check, CheckCheck,
  Clock, ChevronRight, Paperclip, AlertTriangle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentPsychologyMessages({ token, user, subdomain, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/parents/psychology-messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    setMobileShowChat(true);
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API}/api/v1/parents/psychology-messages/${convo.conversation_id}`, { headers });
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
      const res = await fetch(`${API}/api/v1/parents/psychology-messages`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConvo.conversation_id,
          body: reply.trim(),
        })
      });
      if (res.ok) {
        setReply("");
        openConversation(activeConvo);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSending(false);
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
    <div className="h-full flex flex-col" data-testid="parent-psychology-messages">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
        <button type="button" onClick={mobileShowChat ? () => setMobileShowChat(false) : onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors" data-testid="back-btn">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <Brain className="w-5 h-5 text-violet-600" />
        <div>
          <h2 className="text-base font-bold text-slate-800">Mensajes de Psicología</h2>
          <p className="text-xs text-slate-500">{conversations.length} conversaciones</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className={`w-full sm:w-[320px] border-r border-slate-200 bg-white flex flex-col flex-shrink-0 ${mobileShowChat ? "hidden sm:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2].map(i => <div key={i} className="flex gap-3 animate-pulse"><div className="w-10 h-10 rounded-full bg-slate-200"></div><div className="flex-1 space-y-2"><div className="h-4 w-28 bg-slate-200 rounded"></div><div className="h-3 w-40 bg-slate-100 rounded"></div></div></div>)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <Brain className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No hay mensajes del departamento de psicología</p>
              </div>
            ) : conversations.map(convo => (
              <button key={convo.conversation_id} onClick={() => openConversation(convo)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-violet-50/50 transition-colors text-left border-b border-slate-100 ${activeConvo?.conversation_id === convo.conversation_id ? "bg-violet-50/80" : ""}`}
                data-testid={`parent-convo-${convo.conversation_id}`}>
                <div className="w-10 h-10 rounded-full bg-violet-100 flex-shrink-0 flex items-center justify-center">
                  {convo.psychologist_photo ? <img src={convo.psychologist_photo} alt="" className="w-full h-full rounded-full object-cover" /> : <Brain className="w-5 h-5 text-violet-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${convo.unread_count > 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{convo.psychologist_name}</p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(convo.last_message_date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Re: {convo.student_name}</p>
                  <p className={`text-xs mt-0.5 truncate ${convo.unread_count > 0 ? "text-slate-700 font-medium" : "text-slate-400"}`}>{convo.last_message_preview}</p>
                </div>
                {convo.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-1">{convo.unread_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className={`flex-1 flex flex-col bg-slate-50/50 ${!mobileShowChat ? "hidden sm:flex" : "flex"}`}>
          {!activeConvo ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-500">Selecciona una conversacion</p></div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{activeConvo.psychologist_name}</p>
                  <p className="text-xs text-slate-500">{activeConvo.psychologist_specialty || "Psicologo/a"} - Re: {activeConvo.student_name}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="parent-messages-area">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full"></div></div>
                ) : messages.map(msg => {
                  const isMine = msg.from_role === "padre";
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"}`}>
                        {msg.subject && <p className={`text-xs font-semibold mb-1 ${isMine ? "text-emerald-200" : "text-slate-500"}`}>{msg.subject}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        {msg.attachments?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map((a, i) => (
                              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 text-xs ${isMine ? "text-emerald-200" : "text-violet-600"}`}>
                                <Paperclip className="w-3 h-3" />{a.name || "Adjunto"}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                          <span className={`text-[10px] ${isMine ? "text-emerald-200" : "text-slate-400"}`}>{formatDate(msg.created_at)}</span>
                          {isMine && (msg.read ? <CheckCheck className="w-3 h-3 text-emerald-200" /> : <Check className="w-3 h-3 text-emerald-300" />)}
                          {msg.is_urgent && <AlertTriangle className={`w-3 h-3 ${isMine ? "text-yellow-300" : "text-amber-500"}`} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 bg-white border-t border-slate-200">
                <div className="flex items-end gap-2">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    rows={2} data-testid="parent-reply-input"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                  <button type="button" onClick={sendReply} disabled={!reply.trim() || sending}
                    className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    data-testid="parent-send-btn">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
