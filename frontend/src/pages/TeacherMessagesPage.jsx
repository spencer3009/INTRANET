import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import TeacherFooter from "../components/TeacherFooter";
import {
  MessageSquare,
  Loader2,
  Menu,
  Send,
  Search,
  Users,
  User,
  ChevronLeft,
  MoreVertical,
  Paperclip,
  Image as ImageIcon
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherMessagesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [studentsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/students`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      
      // Format contacts
      const studentContacts = (studentsRes.data.students || []).map(s => ({
        id: s.id,
        name: `${s.name} ${s.last_name}`,
        photo_url: s.photo_url,
        type: "student",
        section: s.section_name
      }));
      
      setContacts(studentContacts);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading contacts:", err);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const loadConversation = async (contact) => {
    setSelectedContact(contact);
    try {
      const res = await axios.get(`${API}/api/messaging/academic?participant=${contact.id}`, { headers });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/api/messaging/academic`, {
        recipient_id: selectedContact.id,
        content: newMessage.trim()
      }, { headers });
      
      // Add message locally
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender_id: user.id,
        content: newMessage.trim(),
        created_at: new Date().toISOString()
      }]);
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group contacts by section
  const contactsBySection = filteredContacts.reduce((acc, contact) => {
    const section = contact.section || "Otros";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(contact);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-messages-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="mensajes"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content - Chat Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />
        
        <div className="flex-1 flex min-w-0">
          {/* Contacts List */}
          <div className={`${selectedContact ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white`}>
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-xl font-bold text-slate-800">Mensajes</h1>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  data-testid="contact-search-input"
                />
              </div>
            </div>
            
            {/* Contacts */}
            <div className="flex-1 overflow-y-auto">
              {Object.keys(contactsBySection).length > 0 ? (
                Object.entries(contactsBySection).map(([section, sectionContacts]) => (
                  <div key={section}>
                  <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {section}
                  </div>
                  {sectionContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => loadConversation(contact)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                        selectedContact?.id === contact.id ? "bg-emerald-50" : ""
                      }`}
                      data-testid={`contact-${contact.id}`}
                    >
                      {contact.photo_url ? (
                        <img 
                          src={contact.photo_url} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-slate-800 truncate">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.type === "student" ? "Estudiante" : contact.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No hay contactos disponibles</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-col flex-1 bg-slate-50`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {selectedContact.photo_url ? (
                  <img 
                    src={selectedContact.photo_url} 
                    alt="" 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{selectedContact.name}</p>
                  <p className="text-xs text-slate-500">{selectedContact.section}</p>
                </div>
                
                <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length > 0 ? (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                          isOwn 
                            ? "bg-emerald-500 text-white rounded-br-md" 
                            : "bg-white text-slate-800 rounded-bl-md border border-slate-200"
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? "text-emerald-100" : "text-slate-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("es-PE", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-500">No hay mensajes aún</p>
                      <p className="text-sm text-slate-400">Envía el primer mensaje</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Message Input */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    data-testid="message-input"
                  />
                  
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="send-message-btn"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Tus mensajes</h3>
                <p className="text-slate-500">Selecciona un contacto para iniciar una conversación</p>
              </div>
            </div>
          )}
        </div>
        </div>
        <TeacherFooter />
      </div>

      {/* Message Center (Floating) */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
