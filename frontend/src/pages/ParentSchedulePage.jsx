import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Clock, Calendar, BookOpen, User, Loader2, AlertCircle, GraduationCap, MapPin
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ALL_DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miercoles", short: "Mie" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sabado", short: "Sab" },
  { id: "domingo", label: "Domingo", short: "Dom" }
];

const getVisibleDays = (settings) => {
  let days = ALL_DAYS.slice(0, 5);
  if (settings?.include_saturday) days = [...days, ALL_DAYS[5]];
  if (settings?.include_sunday) days = [...days, ALL_DAYS[6]];
  return days;
};

function ScheduleCalendarGrid({ schedules, settings, breaks }) {
  const visibleDays = getVisibleDays(settings);
  const [tooltip, setTooltip] = useState(null);

  const isTimeBlocked = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      const [endH] = b.end_time.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  }, [breaks]);

  const getBreakForSlot = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      return slotHour === startH;
    });
  }, [breaks]);

  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const endHour = parseInt(settings?.end_hour?.split(':')[0] || '18');
    for (let h = startHour; h < endHour; h++) slots.push(`${h.toString().padStart(2, '0')}:00`);
    return slots;
  }, [settings]);

  const timeSlots = generateTimeSlots();

  const formatTime = (time) => {
    if (!time) return time;
    if (settings?.time_format === "12h") {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }
    return time;
  };

  const formatTimeRange = (time) => {
    const [h] = time.split(':');
    const hour = parseInt(h);
    const nextHour = hour + 1;
    if (settings?.time_format === "12h") {
      return `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'} - ${nextHour % 12 || 12}:00 ${nextHour >= 12 ? 'PM' : 'AM'}`;
    }
    return `${time} - ${nextHour.toString().padStart(2, '0')}:00`;
  };

  const getColorStyle = (color) => ({ backgroundColor: color || '#6366F1', borderColor: color || '#6366F1' });

  const schedulesByDay = {};
  ALL_DAYS.forEach(d => { schedulesByDay[d.id] = []; });
  schedules.forEach(s => { if (schedulesByDay[s.dia]) schedulesByDay[s.dia].push(s); });

  const getSchedulesForSlot = (day, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return schedulesByDay[day].filter(s => {
      const [startH] = s.hora_inicio.split(':').map(Number);
      const [endH] = s.hora_fin.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  };

  const scheduleStartsAtSlot = (schedule, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    const [startH] = schedule.hora_inicio.split(':').map(Number);
    return slotHour === startH;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="parent-schedule-grid">
      {tooltip && (
        <div className="fixed z-50 bg-slate-800 text-white rounded-xl shadow-xl px-4 py-3 text-sm pointer-events-none transform -translate-x-1/2 -translate-y-full" style={{ left: tooltip.x, top: tooltip.y }}>
          <p className="font-bold text-cyan-300">{tooltip.schedule.materia}</p>
          <div className="mt-1 space-y-0.5 text-slate-300">
            <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{tooltip.schedule.profesor_nombre || "Sin profesor"}</p>
            <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatTime(tooltip.schedule.hora_inicio)} - {formatTime(tooltip.schedule.hora_fin)}</p>
            {tooltip.schedule.aula && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{tooltip.schedule.aula}</p>}
          </div>
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full"><div className="border-8 border-transparent border-t-slate-800" /></div>
        </div>
      )}

      <div className="flex border-b border-slate-200 bg-gradient-to-r from-cyan-600 to-blue-600 sticky top-0 z-10">
        <div className="w-32 md:w-36 flex-shrink-0 p-3 border-r border-white/20 flex items-center justify-center"><Clock className="w-5 h-5 text-white/80" /></div>
        {visibleDays.map(day => (
          <div key={day.id} className="flex-1 p-3 text-center border-r last:border-r-0 border-white/20 min-w-[120px]">
            <p className="font-bold text-white">{day.label}</p>
            <p className="text-xs text-white/70">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        {timeSlots.map((time) => {
          const breakItem = getBreakForSlot(time);
          const isBlocked = isTimeBlocked(time);

          if (breakItem) {
            const btc = {
              break: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", icon: "break" },
              lunch: { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", icon: "lunch" },
              event: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", icon: "event" }
            }[breakItem.type] || { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800", icon: "pause" };
            return (
              <div key={time} className={`flex border-b ${btc.border} min-h-[60px] ${btc.bg}`}>
                <div className={`w-32 md:w-36 flex-shrink-0 px-2 py-2 border-r ${btc.border} sticky left-0 z-10 flex items-center justify-center ${btc.bg}`}>
                  <span className={`text-xs font-medium ${btc.text}`}>{formatTimeRange(time)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-3 px-4">
                  <span className={`font-bold text-lg ${btc.text}`}>{breakItem.label}</span>
                  <span className={`text-sm ${btc.text} opacity-70`}>({breakItem.start_time} - {breakItem.end_time})</span>
                </div>
              </div>
            );
          }

          if (isBlocked) return null;

          return (
            <div key={time} className="flex border-b border-slate-100 min-h-[60px]">
              <div className="w-32 md:w-36 flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600 text-center leading-tight">{formatTimeRange(time)}</span>
              </div>
              {visibleDays.map(day => {
                const slotSchedules = getSchedulesForSlot(day.id, time);
                return (
                  <div key={`${day.id}-${time}`} className="flex-1 min-w-[120px] border-r last:border-r-0 border-slate-100 p-1">
                    {slotSchedules.map(schedule => {
                      if (!scheduleStartsAtSlot(schedule, time)) return null;
                      const [startH] = schedule.hora_inicio.split(':').map(Number);
                      const [endH] = schedule.hora_fin.split(':').map(Number);
                      const spanRows = endH - startH;
                      return (
                        <div key={schedule.id} className="rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md relative cursor-default" style={{ ...getColorStyle(schedule.color), minHeight: spanRows > 1 ? `${spanRows * 60 - 8}px` : '52px' }}
                          onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 10, schedule }); }}
                          onMouseLeave={() => setTooltip(null)}>
                          <div className="h-full p-2 flex flex-col text-white">
                            <p className="font-bold text-sm truncate mb-0.5">{schedule.materia}</p>
                            {schedule.profesor_nombre && (
                              <div className="flex items-center gap-1.5">
                                {schedule.profesor_foto ? <img src={schedule.profesor_foto} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-white/80" /></div>}
                                <span className="text-[11px] opacity-90 truncate">{schedule.profesor_nombre}</span>
                              </div>
                            )}
                            {schedule.aula && <div className="mt-auto"><span className="text-[10px] bg-black/20 rounded px-1.5 py-0.5">{schedule.aula}</span></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ParentSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [gradeName, setGradeName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadScheduleForChild = async (childId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/api/parent/schedule?student_id=${childId}`, { headers });
      const data = res.data;
      setSchedules(data.schedules || []);
      setBreaks(data.breaks || []);
      setScheduleSettings(data.settings || null);
      setGradeName(data.grade_name || "");
      setSectionName(data.section_name || "");
    } catch (err) {
      console.error("Error:", err);
      setError("No se pudo cargar el horario.");
      setSchedules([]); setBreaks([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        if (settingsRes.data) setSchoolSettings(settingsRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem('selected_child_id');
          const child = childrenList.find(c => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem('selected_child_id', child.id);
          await loadScheduleForChild(child.id);
        } else { setLoading(false); }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadScheduleForChild(newChild.id);
  };

  const schoolName = schoolSettings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = schoolSettings?.logo_url;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-schedule-page">
      <ParentSidebar active="horarios" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"><Calendar className="w-5 h-5 text-white" /></div>
              Horario de {selectedChild?.name || ""}
            </h1>
            {(gradeName || sectionName) && (
              <p className="text-slate-500 mt-2 ml-13 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" /><span className="font-medium text-slate-700">{gradeName}</span>
                {sectionName && <><span className="text-slate-300">-</span><span>Seccion {sectionName}</span></>}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="text-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto mb-3" /><p className="text-slate-500">Cargando horario...</p></div></div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center"><AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" /><p className="text-red-700 font-medium">{error}</p></div>
          ) : schedules.length === 0 && breaks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center"><Calendar className="w-10 h-10 text-slate-400" /></div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Horario no disponible</h3>
              <p className="text-slate-500 max-w-md mx-auto">El horario de clases aun no ha sido configurado.</p>
            </div>
          ) : (
            <>
              <ScheduleCalendarGrid schedules={schedules} settings={scheduleSettings} breaks={breaks} />
              {schedules.length > 0 && (
                <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-400" />Asignaturas ({[...new Set(schedules.map(s => s.materia))].length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(schedules.map(s => JSON.stringify({ materia: s.materia, color: s.color })))].map(subjectStr => {
                      const subject = JSON.parse(subjectStr);
                      return <span key={subject.materia} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: subject.color || '#6366F1' }}>{subject.materia}</span>;
                    })}
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-sm text-slate-500">Total clases</p><p className="text-2xl font-bold text-slate-800">{schedules.length}</p></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-sm text-slate-500">Horas semanales</p><p className="text-2xl font-bold text-cyan-600">{schedules.reduce((acc, s) => { const [sH, sM] = s.hora_inicio.split(':').map(Number); const [eH, eM] = s.hora_fin.split(':').map(Number); return acc + ((eH * 60 + eM) - (sH * 60 + sM)) / 60; }, 0).toFixed(1)}h</p></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-sm text-slate-500">Dias con clases</p><p className="text-2xl font-bold text-cyan-600">{new Set(schedules.map(s => s.dia)).size}</p></div>
                <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-sm text-slate-500">Profesores</p><p className="text-2xl font-bold text-violet-600">{new Set(schedules.map(s => s.profesor_id).filter(Boolean)).size}</p></div>
              </div>
            </>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
    </div>
  );
}
