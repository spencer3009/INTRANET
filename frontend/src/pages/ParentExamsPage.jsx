import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Calendar,
  Clock,
  Loader2,
  BookOpen,
  MapPin,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentExamsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("examenes");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [exams, setExams] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const init = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);
        
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          
          const examRes = await axios.get(`${API}/api/parent/exam-schedule?student_id=${childToSelect.id}`, { headers });
          setExams(examRes.data.exams || []);
          setUpcoming(examRes.data.upcoming || []);
          setPast(examRes.data.past || []);
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
      const examRes = await axios.get(`${API}/api/parent/exam-schedule?student_id=${newChild.id}`, { headers });
      setExams(examRes.data.exams || []);
      setUpcoming(examRes.data.upcoming || []);
      setPast(examRes.data.past || []);
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
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
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
          <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Calendar className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Exámenes de {selectedChild?.name}
                </h1>
                <p className="text-red-100">Calendario de evaluaciones programadas</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{upcoming.length}</p>
                  <p className="text-xs text-red-100">Próximos</p>
                </div>
                <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                  <p className="text-2xl font-bold">{past.length}</p>
                  <p className="text-xs text-red-100">Pasados</p>
                </div>
              </div>
            </div>
          </div>

          {exams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin exámenes programados</h3>
              <p className="text-slate-500">{selectedChild?.name} no tiene exámenes programados</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming Exams */}
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Próximos Exámenes
                  </h3>
                  <div className="grid gap-3">
                    {upcoming.map((exam) => (
                      <div key={exam.id} className="bg-white rounded-xl border-2 border-red-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                            style={{ backgroundColor: exam.subject_color || '#EF4444' }}
                          >
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800">{exam.title || exam.subject_name}</h4>
                            <p className="text-sm text-slate-500">{exam.subject_name}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm">
                              <span className="flex items-center gap-1 text-red-600">
                                <Calendar className="w-4 h-4" />
                                {formatDate(exam.date)}
                              </span>
                              {exam.start_time && (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <Clock className="w-4 h-4" />
                                  {exam.start_time} - {exam.end_time}
                                </span>
                              )}
                              {exam.location && (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <MapPin className="w-4 h-4" />
                                  {exam.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Exams */}
              {past.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Exámenes Pasados</h3>
                  <div className="grid gap-3">
                    {past.map((exam) => (
                      <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-75">
                        <div className="flex items-start gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                            style={{ backgroundColor: exam.subject_color || '#94A3B8' }}
                          >
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-600">{exam.title || exam.subject_name}</h4>
                            <p className="text-sm text-slate-400">{exam.subject_name}</p>
                            <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(exam.date)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
