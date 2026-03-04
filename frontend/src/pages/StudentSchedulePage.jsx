import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Clock,
  Calendar,
  BookOpen,
  User,
  Users,
  Loader2,
  AlertCircle,
  GraduationCap,
  MapPin
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// All days of the week
const ALL_DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" },
  { id: "domingo", label: "Domingo", short: "Dom" }
];

// Function to get visible days based on settings
const getVisibleDays = (settings) => {
  let days = ALL_DAYS.slice(0, 5); // Lunes a Viernes por defecto
  if (settings?.include_saturday) {
    days = [...days, ALL_DAYS[5]];
  }
  if (settings?.include_sunday) {
    days = [...days, ALL_DAYS[6]];
  }
  return days;
};

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT CALENDAR GRID - Read-only professional weekly view
// mode="student" - No editing, no context menu, no clicks, just visualization
// ══════════════════════════════════════════════════════════════════════════════
function StudentCalendarGrid({ schedules, settings, breaks, mode = "student" }) {
  const visibleDays = getVisibleDays(settings);
  const viewMode = settings?.view_mode || "horizontal";
  
  // Tooltip state
  const [tooltip, setTooltip] = useState(null);
  
  // Check if a time slot is blocked by a break
  const isTimeBlocked = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      const [endH] = b.end_time.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  }, [breaks]);

  // Get break for a time slot
  const getBreakForSlot = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      return slotHour === startH;
    });
  }, [breaks]);
  
  // Generate time slots based on settings
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const endHour = parseInt(settings?.end_hour?.split(':')[0] || '18');
    
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, [settings]);

  const timeSlots = generateTimeSlots();

  // Format time for display
  const formatTime = (time) => {
    if (!time) return time;
    if (settings?.time_format === "12h") {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    }
    return time;
  };

  // Format time range for horizontal mode
  const formatTimeRange = (time) => {
    const [h] = time.split(':');
    const hour = parseInt(h);
    const nextHour = hour + 1;
    
    if (settings?.time_format === "12h") {
      const ampm1 = hour >= 12 ? 'PM' : 'AM';
      const ampm2 = nextHour >= 12 ? 'PM' : 'AM';
      const hour12_1 = hour % 12 || 12;
      const hour12_2 = nextHour % 12 || 12;
      return `${hour12_1}:00 ${ampm1} - ${hour12_2}:00 ${ampm2}`;
    }
    return `${time} - ${nextHour.toString().padStart(2, '0')}:00`;
  };

  // Get color style
  const getColorStyle = (color) => {
    return {
      backgroundColor: color || '#6366F1',
      borderColor: color || '#6366F1'
    };
  };

  // Group schedules by day
  const schedulesByDay = {};
  ALL_DAYS.forEach(d => { schedulesByDay[d.id] = []; });
  schedules.forEach(s => {
    if (schedulesByDay[s.dia]) {
      schedulesByDay[s.dia].push(s);
    }
  });

  // Get schedules for a specific time slot and day
  const getSchedulesForSlot = (day, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return schedulesByDay[day].filter(s => {
      const [startH] = s.hora_inicio.split(':').map(Number);
      const [endH] = s.hora_fin.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  };

  // Check if schedule starts at this slot
  const scheduleStartsAtSlot = (schedule, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    const [startH] = schedule.hora_inicio.split(':').map(Number);
    return slotHour === startH;
  };

  // Show tooltip
  const showTooltip = (e, schedule) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      schedule
    });
  };

  // Hide tooltip
  const hideTooltip = () => {
    setTooltip(null);
  };

  // HORIZONTAL MODE - Time ranges as rows, days as columns (default for students)
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="student-schedule-grid">
      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-50 bg-slate-800 text-white rounded-xl shadow-xl px-4 py-3 text-sm pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-bold text-cyan-300">{tooltip.schedule.materia}</p>
          <div className="mt-1 space-y-0.5 text-slate-300">
            <p className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {tooltip.schedule.profesor_nombre || "Sin profesor"}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(tooltip.schedule.hora_inicio)} - {formatTime(tooltip.schedule.hora_fin)}
            </p>
            {tooltip.schedule.aula && (
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {tooltip.schedule.aula}
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
            <div className="border-8 border-transparent border-t-slate-800" />
          </div>
        </div>
      )}

      {/* Header - Days */}
      <div className="flex border-b border-slate-200 bg-gradient-to-r from-cyan-600 to-blue-600 sticky top-0 z-10">
        {/* Time column header */}
        <div className="w-32 md:w-36 flex-shrink-0 p-3 border-r border-white/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white/80" />
        </div>
        
        {/* Day headers */}
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`student-schedule-day-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-white/20 min-w-[120px]">
            <p className="font-bold text-white">{day.label}</p>
            <p className="text-xs text-white/70">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>

      {/* Grid Body - Time ranges as rows */}
      <div className="overflow-x-auto">
        {timeSlots.map((time, idx) => {
          const breakItem = getBreakForSlot(time);
          const isBlocked = isTimeBlocked(time);
          
          // If this slot has a break that starts here, render break row
          if (breakItem) {
            const breakTypeConfig = {
              break: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", icon: "☕" },
              lunch: { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", icon: "🍽️" },
              event: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", icon: "🎉" }
            }[breakItem.type] || { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800", icon: "⏸️" };
            
            return (
              <div key={time} className={`flex border-b ${breakTypeConfig.border} min-h-[60px] ${breakTypeConfig.bg}`}>
                {/* Time cell */}
                <div className={`w-32 md:w-36 flex-shrink-0 px-2 py-2 border-r ${breakTypeConfig.border} sticky left-0 z-10 flex items-center justify-center ${breakTypeConfig.bg}`}>
                  <span className={`text-xs font-medium ${breakTypeConfig.text}`}>
                    {formatTimeRange(time)}
                  </span>
                </div>
                
                {/* Break spans all days - READ ONLY, no click */}
                <div className="flex-1 flex items-center justify-center gap-3 px-4">
                  <span className="text-2xl">{breakTypeConfig.icon}</span>
                  <span className={`font-bold text-lg ${breakTypeConfig.text}`}>{breakItem.label}</span>
                  <span className={`text-sm ${breakTypeConfig.text} opacity-70`}>
                    ({breakItem.start_time} - {breakItem.end_time})
                  </span>
                </div>
              </div>
            );
          }
          
          // Skip rows that are within a break but not the start
          if (isBlocked) {
            return null;
          }
          
          // Normal row
          return (
            <div key={time} className="flex border-b border-slate-100 min-h-[60px]">
              {/* Time range cell - sticky */}
              <div className="w-32 md:w-36 flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600 text-center leading-tight">
                  {formatTimeRange(time)}
                </span>
              </div>
            
              {/* Day cells - READ ONLY, no click handlers */}
              {visibleDays.map(day => {
                const slotSchedules = getSchedulesForSlot(day.id, time);
                
                return (
                  <div 
                    key={`${day.id}-${time}`}
                    data-testid={`student-schedule-cell-${day.id}-${time.replace(':', '')}`}
                    className="flex-1 min-w-[120px] border-r last:border-r-0 border-slate-100 p-1"
                  >
                    {slotSchedules.map(schedule => {
                      // Only render if this is the start slot
                      if (!scheduleStartsAtSlot(schedule, time)) return null;
                      
                      const [startH] = schedule.hora_inicio.split(':').map(Number);
                      const [endH] = schedule.hora_fin.split(':').map(Number);
                      const spanRows = endH - startH;
                      
                      return (
                        <div
                          key={schedule.id}
                          data-testid={`student-schedule-block-${schedule.id}`}
                          className="rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md relative cursor-default"
                          style={{
                            ...getColorStyle(schedule.color),
                            minHeight: spanRows > 1 ? `${spanRows * 60 - 8}px` : '52px'
                          }}
                          onMouseEnter={(e) => showTooltip(e, schedule)}
                          onMouseLeave={hideTooltip}
                        >
                          <div className="h-full p-2 flex flex-col text-white">
                            {/* Subject name */}
                            <p className="font-bold text-sm truncate mb-0.5">{schedule.materia}</p>
                            
                            {/* Teacher with photo */}
                            {schedule.profesor_nombre && (
                              <div className="flex items-center gap-1.5">
                                {schedule.profesor_foto ? (
                                  <img 
                                    src={schedule.profesor_foto} 
                                    alt={schedule.profesor_nombre}
                                    className="w-5 h-5 rounded-full object-cover border border-white/30 flex-shrink-0"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <User className="w-3 h-3 text-white/80" />
                                  </div>
                                )}
                                <span className="text-[11px] opacity-90 truncate">{schedule.profesor_nombre}</span>
                              </div>
                            )}
                            
                            {/* Room badge */}
                            {schedule.aula && (
                              <div className="mt-auto">
                                <span className="text-[10px] bg-black/20 rounded px-1.5 py-0.5">
                                  {schedule.aula}
                                </span>
                              </div>
                            )}
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function StudentSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data from backend
  const [schedules, setSchedules] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [gradeName, setGradeName] = useState("");
  const [sectionName, setSectionName] = useState("");
  
  // School settings (for logo)
  const [schoolSettings, setSchoolSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduleRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/student/schedule`, { headers }),
        axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
      ]);
      
      // Extract data from response
      const data = scheduleRes.data;
      setSchedules(data.schedules || []);
      setBreaks(data.breaks || []);
      setSettings(data.settings || null);
      setGradeName(data.grade_name || "");
      setSectionName(data.section_name || "");
      
      // School settings for logo
      if (settingsRes.data) {
        setSchoolSettings(settingsRes.data);
      }
    } catch (err) {
      console.error("Error loading schedule:", err);
      setError("No se pudo cargar el horario. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Get display values from settings
  const schoolName = schoolSettings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = schoolSettings?.logo_url;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="student-schedule-page">
      {/* Student Sidebar */}
      <StudentSidebar
        active="horarios"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header - Shows grade and section from backend */}
          <div className="mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-3" data-testid="student-schedule-title">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              Mi Horario de Clases
            </h1>
            {(gradeName || sectionName) && (
              <p className="text-slate-500 mt-2 ml-13 flex items-center gap-2" data-testid="student-schedule-context">
                <GraduationCap className="w-4 h-4" />
                <span className="font-medium text-slate-700">{gradeName}</span>
                {sectionName && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>Sección {sectionName}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20" data-testid="student-schedule-loading">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-slate-500">Cargando horario...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center" data-testid="student-schedule-error">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <button 
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : schedules.length === 0 && breaks.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="student-schedule-empty">
              <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Horario no disponible
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                El horario de clases para tu sección aún no ha sido configurado por el administrador.
                Por favor, consulta con tu coordinador o espera a que se publique.
              </p>
            </div>
          ) : (
            <>
              {/* Professional Calendar Grid - READ ONLY mode */}
              <StudentCalendarGrid
                schedules={schedules}
                settings={settings}
                breaks={breaks}
                mode="student"
              />

              {/* Legend - Mis Asignaturas */}
              {schedules.length > 0 && (
                <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-4" data-testid="student-schedule-legend">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    Mis Asignaturas ({[...new Set(schedules.map(s => s.materia))].length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(schedules.map(s => JSON.stringify({ materia: s.materia, color: s.color })))].map(subjectStr => {
                      const subject = JSON.parse(subjectStr);
                      return (
                        <span 
                          key={subject.materia}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                          style={{ backgroundColor: subject.color || '#6366F1' }}
                        >
                          {subject.materia}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats Summary */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Total clases</p>
                  <p className="text-2xl font-bold text-slate-800">{schedules.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Horas semanales</p>
                  <p className="text-2xl font-bold text-cyan-600">
                    {schedules.reduce((acc, s) => {
                      const [startH, startM] = s.hora_inicio.split(':').map(Number);
                      const [endH, endM] = s.hora_fin.split(':').map(Number);
                      return acc + ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
                    }, 0).toFixed(1)}h
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Días con clases</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {new Set(schedules.map(s => s.dia)).size}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">Profesores</p>
                  <p className="text-2xl font-bold text-violet-600">
                    {new Set(schedules.map(s => s.profesor_id).filter(Boolean)).size}
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
