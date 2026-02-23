import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  CalendarCheck,
  Clock,
  Loader2,
  User
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export default function ParentSchedulePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("horarios");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [schedule, setSchedule] = useState([]);
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
          
          const scheduleRes = await axios.get(`${API}/api/parent/schedule?student_id=${childToSelect.id}`, { headers });
          setSchedule(scheduleRes.data.schedule || []);
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
      const scheduleRes = await axios.get(`${API}/api/parent/schedule?student_id=${newChild.id}`, { headers });
      setSchedule(scheduleRes.data.schedule || []);
      localStorage.setItem('selected_child_id', newChild.id);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  // Get schedule entry for a specific day and hour
  const getScheduleEntry = (day, hour) => {
    return schedule.find(entry => 
      entry.day_of_week === day && 
      entry.start_time?.startsWith(hour.split(':')[0])
    );
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
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <CalendarCheck className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Horario de {selectedChild?.name}
                </h1>
                <p className="text-purple-100">Horario semanal de clases</p>
              </div>
              <div className="bg-white/20 rounded-xl px-6 py-3 text-center">
                <p className="text-3xl font-bold">{schedule.length}</p>
                <p className="text-xs text-purple-100">Clases</p>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          {schedule.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CalendarCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin horario asignado</h3>
              <p className="text-slate-500">{selectedChild?.name} no tiene horario de clases configurado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                        Hora
                      </th>
                      {DAYS.map(day => (
                        <th key={day} className="p-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map((hour, idx) => (
                      <tr key={hour} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2 text-sm font-medium text-slate-600 border-r border-slate-100">
                          {hour}
                        </td>
                        {DAYS.map(day => {
                          const entry = getScheduleEntry(day, hour);
                          return (
                            <td key={`${day}-${hour}`} className="p-1 border-r border-slate-100 last:border-r-0">
                              {entry ? (
                                <div 
                                  className="p-2 rounded-lg text-white text-xs"
                                  style={{ backgroundColor: entry.subject_color || '#3B82F6' }}
                                >
                                  <p className="font-semibold truncate">{entry.subject_name}</p>
                                  {entry.teacher_name && (
                                    <p className="opacity-80 truncate text-[10px]">{entry.teacher_name}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="p-2 text-center text-slate-300">-</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
