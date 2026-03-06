import { CalendarDays, Clock, MapPin, ChevronRight } from "lucide-react";

const today = new Date();
const MOCK_EVENTS = [
  {
    id: "e1",
    title: "Reunión de padres de familia",
    type: "meeting",
    start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 16, 0).toISOString(),
    location: "Auditorio principal",
  },
  {
    id: "e2",
    title: "Feria de ciencias",
    type: "academic",
    start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 9, 0).toISOString(),
    location: "Patio central",
  },
  {
    id: "e3",
    title: "Entrega de boletas",
    type: "administrative",
    start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8, 10, 0).toISOString(),
    location: "Oficina de coordinación",
  },
];

const TYPE_STYLES = {
  meeting: { bg: "bg-violet-100", text: "text-violet-600", accent: "border-l-violet-500" },
  academic: { bg: "bg-emerald-100", text: "text-emerald-600", accent: "border-l-emerald-500" },
  academico: { bg: "bg-emerald-100", text: "text-emerald-600", accent: "border-l-emerald-500" },
  administrative: { bg: "bg-amber-100", text: "text-amber-600", accent: "border-l-amber-500" },
  administrativo: { bg: "bg-amber-100", text: "text-amber-600", accent: "border-l-amber-500" },
  exam: { bg: "bg-red-100", text: "text-red-600", accent: "border-l-red-500" },
  holiday: { bg: "bg-sky-100", text: "text-sky-600", accent: "border-l-sky-500" },
  evento: { bg: "bg-violet-100", text: "text-violet-600", accent: "border-l-violet-500" },
  cultural: { bg: "bg-purple-100", text: "text-purple-600", accent: "border-l-purple-500" },
};

function formatEventDate(event) {
  // Handle real API events: { start_date: "2026-03-10", start_time: "08:00" }
  // Handle mock events: { start_time: "2026-03-10T16:00:00.000Z" }
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  let d;
  let timeStr;

  if (event.start_date && typeof event.start_time === "string" && event.start_time.length <= 5) {
    // API format: start_date = "2026-03-10", start_time = "08:00"
    const parts = event.start_date.split("-");
    d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    timeStr = event.start_time;
  } else {
    // ISO format or mock
    const isoStr = event.start_time || event.date || new Date().toISOString();
    d = new Date(isoStr);
    timeStr = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  return {
    dayName: dayNames[d.getDay()],
    dayNum: d.getDate(),
    month: monthNames[d.getMonth()],
    time: timeStr,
  };
}

export default function CalendarWidget({ events = [] }) {
  const items = events.length > 0 ? events.slice(0, 3) : MOCK_EVENTS;
  const isMock = events.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col" data-testid="calendar-widget">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-violet-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Calendario</h3>
        </div>
        {isMock && (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">DEMO</span>
        )}
      </div>

      <div className="flex-1 divide-y divide-slate-100">
        {items.map((event) => {
          const style = TYPE_STYLES[event.type] || TYPE_STYLES.meeting;
          const dateInfo = formatEventDate(event);
          return (
            <div
              key={event.id || event._id}
              className={`px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center gap-4 border-l-[3px] ${style.accent}`}
              data-testid={`calendar-event-${event.id || event._id}`}
            >
              <div className="text-center flex-shrink-0 w-12">
                <p className="text-[10px] font-medium text-slate-400 uppercase">{dateInfo.dayName}</p>
                <p className="text-xl font-bold text-slate-800 leading-tight">{dateInfo.dayNum}</p>
                <p className="text-[10px] text-slate-400">{dateInfo.month}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 line-clamp-1">{event.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateInfo.time}
                  </span>
                  {event.location && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[120px]">{event.location}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <button className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors flex items-center gap-1" data-testid="calendar-view-all">
          Ver calendario completo <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
