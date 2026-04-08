import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  Calendar, ChevronLeft, ChevronRight, MessageSquare, ArrowRightLeft,
  ClipboardList, Clock, Loader2, Presentation
} from "lucide-react";

const SOURCE_CONFIG = {
  reunion:    { from: "#6366f1", to: "#4f46e5", rgb: "99,102,241",  dot: "#6366f1", icon: MessageSquare,   label: "Reunion" },
  derivacion: { from: "#14b8a6", to: "#0d9488", rgb: "20,184,166",  dot: "#14b8a6", icon: ArrowRightLeft,  label: "Derivacion" },
  review:     { from: "#f59e0b", to: "#d97706", rgb: "245,158,11",  dot: "#f59e0b", icon: ClipboardList,   label: "Revision" },
  charla:     { from: "#a855f7", to: "#9333ea", rgb: "168,85,247",  dot: "#a855f7", icon: Presentation,    label: "Charla" },
};

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

export default function AgendaPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const base = subdomain ? `/${subdomain}` : "";

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const daysInMonth = getDaysInMonth(year, month);
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    try {
      const data = await coordinacionApi.getAgenda(token, { start_date: startDate, end_date: endDate });
      setEvents(data.events || []);
    } catch (err) {
      console.error("Error loading agenda:", err);
    } finally {
      setLoading(false);
    }
  }, [token, year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const eventsByDay = {};
  events.forEach(e => {
    const dateStr = (e.date || "").slice(0, 10);
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (!isNaN(day)) {
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  });

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  const goToEvent = (event) => {
    if (event.event_source === "reunion") navigate(`${base}/coordinacion/reuniones/${event.id}`);
    else if (event.event_source === "derivacion") navigate(`${base}/coordinacion/derivaciones/${event.id}`);
  };

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="agenda">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="agenda-page">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Agenda</h1>
          <p className="text-sm text-slate-500 mt-1">{monthNames[month]} {year} · {events.length} evento{events.length !== 1 ? "s" : ""}</p>
        </div>

        {/* ── Legend (Premium badges) ── */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white border border-slate-200"
                  style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ══════════ CALENDAR ══════════ */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            {/* Month navigation header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <button onClick={prevMonth} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors" data-testid="agenda-prev">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h2 className="text-lg font-bold text-slate-900 tabular-nums tracking-tight" data-testid="agenda-month">{monthNames[month]} {year}</h2>
              <button onClick={nextMonth} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors" data-testid="agenda-next">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-5">
              {/* Day names */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider py-1">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-[72px]" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = eventsByDay[day] || [];
                    const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                    const isSelected = day === selectedDay;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                        className={`h-[72px] p-2 rounded-xl border text-left transition-all duration-200 group relative
                          ${isSelected
                            ? "border-indigo-300 ring-2 ring-indigo-100"
                            : isToday
                              ? "border-teal-300"
                              : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                          }`}
                        style={
                          isSelected
                            ? { background: "linear-gradient(135deg, rgba(238,242,255,0.8) 0%, rgba(224,231,255,0.4) 100%)" }
                            : isToday
                              ? { background: "linear-gradient(135deg, rgba(240,253,250,0.8) 0%, rgba(204,251,241,0.3) 100%)" }
                              : { background: "white" }
                        }
                        data-testid={`agenda-day-${day}`}
                      >
                        <span className={`text-xs font-semibold block mb-1 ${
                          isSelected ? "text-indigo-700" : isToday ? "text-teal-700" : "text-slate-600"
                        }`}>
                          {day}
                        </span>
                        <div className="flex flex-wrap gap-[3px]">
                          {dayEvents.slice(0, 4).map((e, idx) => {
                            const cfg = SOURCE_CONFIG[e.event_source] || SOURCE_CONFIG.reunion;
                            return (
                              <span key={idx} className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                                    style={{ background: cfg.dot, boxShadow: `0 0 0 2px ${cfg.dot}22` }}
                                    title={e.title} />
                            );
                          })}
                          {dayEvents.length > 4 && (
                            <span className="text-[9px] text-slate-400 font-medium">+{dayEvents.length - 4}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ SIDE PANEL ══════════ */}
          <div className="space-y-5">
            {/* Events for selected day */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3"
                   style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}>
                  <Calendar className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {selectedDay ? `${selectedDay} de ${monthNames[month]}` : "Selecciona un dia"}
                </h3>
              </div>

              <div className="p-4">
                {!selectedDay ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-indigo-300" />
                    </div>
                    <p className="text-sm text-slate-400 text-center">Haz clic en un dia del calendario para ver sus eventos.</p>
                  </div>
                ) : selectedEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">No hay eventos para este dia.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedEvents.map((event, idx) => {
                      const cfg = SOURCE_CONFIG[event.event_source] || SOURCE_CONFIG.reunion;
                      const Icon = cfg.icon;
                      return (
                        <button key={idx}
                          onClick={() => goToEvent(event)}
                          className="w-full p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left group"
                          style={{ borderLeftWidth: "3px", borderLeftColor: cfg.dot }}
                          data-testid={`agenda-event-${event.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                 style={{ background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}>
                              <Icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-semibold" style={{ color: cfg.dot }}>{cfg.label}</span>
                            {event.status && (
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 font-medium">
                                {event.status.replace("_", " ")}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                            {event.student_name && <span>{event.student_name}</span>}
                            {event.date && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(event.date).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Monthly summary */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
              <div className="px-5 py-4 border-b border-slate-100"
                   style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
                <h3 className="text-[15px] font-semibold text-slate-900">Resumen del mes</h3>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
                  const count = events.filter(e => e.event_source === key).length;
                  return (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className="flex items-center gap-2.5 text-sm text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                        {cfg.label}
                      </span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CoordinacionLayout>
  );
}
