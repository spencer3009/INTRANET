import { useState, useEffect } from "react";
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
  Loader2,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Days of the week
const DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" }
];

// Time slots (typical school hours)
const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00"
];

// Color palette for subjects
const SUBJECT_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
];

export default function StudentSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
    // Set current day as selected
    const today = new Date().getDay();
    const dayMap = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
    setSelectedDay(dayMap[today] || "lunes");
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, settingsRes, schedulesRes] = await Promise.all([
        axios.get(`${API}/api/student/profile`, { headers }),
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/student/schedule`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStudentProfile(profileRes.data);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      setSchedules(schedulesRes.data || []);
    } catch (err) {
      console.error("Error loading schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get display values from settings
  const schoolName = settings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = settings?.logo_url;

  // Academic info
  const academic = studentProfile?.academic || {};
  const gradeName = academic?.grado?.nombre || "";
  const sectionName = academic?.seccion?.nombre || "";

  // Get color for subject
  const getSubjectColor = (subjectName) => {
    const hash = subjectName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
  };

  // Get schedules for a specific day
  const getSchedulesForDay = (dayId) => {
    return schedules
      .filter(s => s.dia === dayId)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  };

  // Check if a time slot has a class
  const getClassAtTime = (dayId, time) => {
    return schedules.find(s => {
      if (s.dia !== dayId) return false;
      const startTime = s.hora_inicio;
      const endTime = s.hora_fin;
      return time >= startTime && time < endTime;
    });
  };

  // Calculate class duration in slots
  const getClassDuration = (schedule) => {
    const start = parseInt(schedule.hora_inicio.split(':')[0]);
    const end = parseInt(schedule.hora_fin.split(':')[0]);
    return end - start;
  };

  // Format time
  const formatTime = (time) => {
    const [hour] = time.split(':');
    const h = parseInt(hour);
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return `12:00 PM`;
    return `${h - 12}:00 PM`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
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

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <StudentHeader
          user={studentProfile?.user || user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-cyan-500" />
                Mi Horario de Clases
              </h2>
              {gradeName && sectionName && (
                <p className="text-sm text-slate-500 mt-1">
                  {gradeName} - Sección {sectionName}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          ) : schedules.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
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
              {/* Day Tabs (Mobile) */}
              <div className="lg:hidden mb-4 overflow-x-auto">
                <div className="flex gap-2 min-w-max pb-2">
                  {DAYS.map(day => {
                    const daySchedules = getSchedulesForDay(day.id);
                    const isSelected = selectedDay === day.id;
                    const hasClasses = daySchedules.length > 0;
                    
                    return (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-cyan-500 text-white"
                            : hasClasses
                            ? "bg-white text-slate-700 border border-slate-200"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {day.short}
                        {hasClasses && (
                          <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                            isSelected ? "bg-white/20" : "bg-cyan-100 text-cyan-700"
                          }`}>
                            {daySchedules.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile View - Selected Day */}
              <div className="lg:hidden">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#001f4b] px-4 py-3">
                    <h3 className="text-white font-semibold">
                      {DAYS.find(d => d.id === selectedDay)?.label}
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {getSchedulesForDay(selectedDay).length > 0 ? (
                      getSchedulesForDay(selectedDay).map((schedule) => {
                        const colors = getSubjectColor(schedule.materia);
                        return (
                          <div key={schedule.id} className="p-4 flex gap-4">
                            <div className="text-center flex-shrink-0">
                              <p className="text-sm font-bold text-slate-800">{formatTime(schedule.hora_inicio)}</p>
                              <p className="text-xs text-slate-400">a</p>
                              <p className="text-sm font-bold text-slate-800">{formatTime(schedule.hora_fin)}</p>
                            </div>
                            <div className={`flex-1 ${colors.bg} ${colors.border} border rounded-xl p-3`}>
                              <p className={`font-semibold ${colors.text}`}>{schedule.materia}</p>
                              {schedule.profesor_nombre && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-600">{schedule.profesor_nombre}</span>
                                </div>
                              )}
                              {schedule.aula && (
                                <p className="text-xs text-slate-500 mt-1">Aula: {schedule.aula}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>Sin clases programadas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop View - Weekly Grid */}
              <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#001f4b]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wide w-20">
                          Hora
                        </th>
                        {DAYS.map(day => (
                          <th key={day.id} className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">
                            {day.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map((time, timeIdx) => {
                        // Skip if we're in the middle of a multi-hour class
                        return (
                          <tr key={time} className={timeIdx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                            <td className="px-4 py-3 text-sm font-medium text-slate-600 border-r border-slate-100">
                              {formatTime(time)}
                            </td>
                            {DAYS.map(day => {
                              const classAtTime = getClassAtTime(day.id, time);
                              
                              if (classAtTime) {
                                // Only render if this is the start time
                                if (classAtTime.hora_inicio === time) {
                                  const duration = getClassDuration(classAtTime);
                                  const colors = getSubjectColor(classAtTime.materia);
                                  
                                  return (
                                    <td 
                                      key={day.id} 
                                      rowSpan={duration}
                                      className="px-2 py-1 border-r border-slate-100"
                                    >
                                      <div className={`h-full ${colors.bg} ${colors.border} border rounded-lg p-2 min-h-[60px]`}>
                                        <p className={`font-semibold text-sm ${colors.text} leading-tight`}>
                                          {classAtTime.materia}
                                        </p>
                                        {classAtTime.profesor_nombre && (
                                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {classAtTime.profesor_nombre}
                                          </p>
                                        )}
                                        {classAtTime.aula && (
                                          <p className="text-xs text-slate-500 mt-0.5">
                                            {classAtTime.aula}
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                  );
                                } else {
                                  // This cell is covered by rowSpan, don't render
                                  return null;
                                }
                              }
                              
                              return (
                                <td key={day.id} className="px-2 py-3 text-center text-slate-300 border-r border-slate-100">
                                  -
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  Mis Asignaturas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(schedules.map(s => s.materia))].map(subject => {
                    const colors = getSubjectColor(subject);
                    return (
                      <span 
                        key={subject}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${colors.bg} ${colors.text}`}
                      >
                        {subject}
                      </span>
                    );
                  })}
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
