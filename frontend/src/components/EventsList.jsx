import { CalendarDays, Clock, MapPin } from "lucide-react";

const categoryIcons = {
  reunion: "bg-[#001f4b]",
  examen: "bg-[#e1b82c]",
  evento: "bg-[#5c85d6]",
  academico: "bg-[#10b981]",
  // Calendar event types
  academic: "bg-[#3B82F6]",
  meeting: "bg-[#8B5CF6]",
  exam: "bg-[#EF4444]",
  holiday: "bg-[#10B981]",
  sports: "bg-[#F59E0B]",
  cultural: "bg-[#EC4899]",
  administrative: "bg-[#64748B]",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatTime(timeStr, startDate) {
  // If timeStr is provided (old format), use it
  if (timeStr) return timeStr;
  
  // If we have a start_date with time, extract the time
  if (startDate && startDate.includes('T')) {
    const date = new Date(startDate);
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  
  return "";
}

export default function EventsList({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="events-list">
        <h3 className="text-base font-bold text-[#001f4b] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Próximos Eventos
        </h3>
        <div className="text-center py-6">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No hay eventos programados</p>
          <p className="text-xs text-slate-400 mt-1">Los eventos del calendario aparecerán aquí</p>
        </div>
      </div>
    );
  }

  // Sort events by date and take only the first 5
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.start_date || a.date);
    const dateB = new Date(b.start_date || b.date);
    return dateA - dateB;
  }).slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="events-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Próximos Eventos
        </h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
          {events.length} evento{events.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {sortedEvents.map((event) => {
          // Handle both old format (date, time, category) and new format (start_date, type, color)
          const eventDate = event.start_date || event.date;
          const eventTime = formatTime(event.time, event.start_date);
          const eventCategory = event.type || event.category;
          const eventColor = event.color || categoryIcons[eventCategory] || "bg-[#001f4b]";
          
          return (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
              data-testid={`event-item-${event.id}`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  eventColor.startsWith('bg-') ? eventColor : ''
                }`}
                style={!eventColor.startsWith('bg-') ? { backgroundColor: eventColor } : {}}
              >
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#001f4b] transition-colors">
                  {event.title}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500">{formatDate(eventDate)}</span>
                  {eventTime && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {eventTime}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{event.location}</span>
                    </span>
                  )}
                </div>
                {event.type_label && (
                  <span 
                    className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: event.color || '#64748B' }}
                  >
                    {event.type_label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {events.length > 5 && (
        <button className="w-full mt-4 py-2 text-sm font-medium text-[#5c85d6] hover:text-[#001f4b] hover:bg-slate-50 rounded-lg transition-colors">
          Ver todos los eventos →
        </button>
      )}
    </div>
  );
}
