import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  MessageSquare,
  Loader2,
  Inbox,
  User,
  Clock,
  Mail
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentMessagesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("mensajes");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({ unread: 0, inbox: 0 });
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const init = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);
        
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          
          const [inboxRes, statsRes] = await Promise.all([
            axios.get(`${API}/api/parent/messages/inbox?student_id=${childToSelect.id}`, { headers }),
            axios.get(`${API}/api/parent/messages/stats?student_id=${childToSelect.id}`, { headers })
          ]);
          setMessages(inboxRes.data.messages || []);
          setStats(statsRes.data || { unread: 0, inbox: 0 });
          localStorage.setItem('selected_child_id', childToSelect.id);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    const headers = { Authorization: `Bearer ${token}` };
    setSelectedChild(newChild);
    setLoading(true);
    try {
      const [inboxRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/parent/messages/inbox?student_id=${newChild.id}`, { headers }),
        axios.get(`${API}/api/parent/messages/stats?student_id=${newChild.id}`, { headers })
      ]);
      setMessages(inboxRes.data.messages || []);
      setStats(statsRes.data || { unread: 0, inbox: 0 });
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hora(s)`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={handleChildChange}
      />

      {sidebarExpanded && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <MessageSquare className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Mensajes de {selectedChild?.name}
                </h1>
                <p className="text-indigo-100">Comunicaciones del colegio</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{stats.unread}</p>
                  <p className="text-xs text-indigo-100">No leídos</p>
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{stats.inbox}</p>
                  <p className="text-xs text-indigo-100">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Messages List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-800">Bandeja de Entrada</h3>
            </div>
            
            {messages.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin mensajes</h3>
                <p className="text-slate-500">{selectedChild?.name} no tiene mensajes en su bandeja</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!msg.is_read ? 'bg-indigo-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {msg.sender?.photo_url ? (
                        <img src={msg.sender.photo_url} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium text-slate-800 truncate ${!msg.is_read ? 'font-bold' : ''}`}>
                            {msg.sender?.name || 'Remitente desconocido'}
                          </p>
                          <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${!msg.is_read ? 'text-slate-800' : 'text-slate-600'}`}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 truncate">{msg.content}</p>
                      </div>
                      {!msg.is_read && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
