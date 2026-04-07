import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { Calendar, ChevronLeft, ChevronRight, MessageSquare, ArrowRightLeft, ClipboardList, Clock } from "lucide-react";

const SOURCE_CONFIG = {
  reunion: { color: "bg-indigo-500", border: "border-indigo-200", text: "text-indigo-700", bg: "bg-indigo-50", icon: MessageSquare, label: "Reunion" },
  derivacion: { color: "bg-teal-500", border: "border-teal-200", text: "text-teal-700", bg: "bg-teal-50", icon: ArrowRightLeft, label: "Derivacion" },
  review: { color: "bg-amber-500", border: "border-amber-200", text: "text-amber-700", bg: "bg-amber-50", icon: ClipboardList, label: "Revision" },
  charla: { color: "bg-purple-500", border: "border-purple-200", text: "text-purple-700", bg: "bg-purple-50", icon: Calendar, label: "Charla" },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

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
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Group events by day
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
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="agenda-page">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6 text-indigo-600" /> Agenda
      </h1>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className={`w-3 h-3 rounded-full ${cfg.color}`}></div>
            {cfg.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="agenda-prev">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-lg font-bold text-slate-800" data-testid="agenda-month">{monthNames[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="agenda-next">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay[day] || [];
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`h-16 p-1 rounded-lg border cursor-pointer transition-all
                    ${isSelected ? "border-indigo-400 bg-indigo-50" : isToday ? "border-teal-300 bg-teal-50" : "border-slate-100 hover:border-slate-300"}`}
                  data-testid={`agenda-day-${day}`}
                >
                  <span className={`text-xs font-medium ${isToday ? "text-teal-700" : "text-slate-600"}`}>{day}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((e, idx) => {
                      const cfg = SOURCE_CONFIG[e.event_source] || SOURCE_CONFIG.reunion;
                      return <div key={idx} className={`w-2 h-2 rounded-full ${cfg.color}`} title={e.title}></div>;
                    })}
                    {dayEvents.length > 3 && <span className="text-[9px] text-slate-400">+{dayEvents.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event detail panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">
            {selectedDay ? `${selectedDay} ${monthNames[month]}` : "Selecciona un dia"}
          </h3>
          {!selectedDay ? (
            <p className="text-sm text-slate-400">Haz clic en un dia del calendario para ver sus eventos.</p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-400">No hay eventos para este dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, idx) => {
                const cfg = SOURCE_CONFIG[event.event_source] || SOURCE_CONFIG.reunion;
                const Icon = cfg.icon;
                return (
                  <div key={idx}
                    onClick={() => goToEvent(event)}
                    className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg} cursor-pointer hover:shadow-sm transition-all`}
                    data-testid={`agenda-event-${event.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${cfg.text}`} />
                      <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                      {event.status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-slate-500 border border-slate-200">
                          {event.status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {event.student_name && <span>{event.student_name}</span>}
                      {event.date && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(event.date).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary for month */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Resumen del mes</p>
            <div className="space-y-1">
              {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
                const count = events.filter(e => e.event_source === key).length;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <div className={`w-2 h-2 rounded-full ${cfg.color}`}></div>
                      {cfg.label}
                    </span>
                    <span className="font-medium text-slate-800">{count}</span>
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
