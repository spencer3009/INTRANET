import { CalendarDays, Clock } from "lucide-react";

const categoryIcons = {
  reunion: "bg-[#001f4b]",
  examen: "bg-[#e1b82c]",
  evento: "bg-[#5c85d6]",
  academico: "bg-[#10b981]",
};

export default function EventsList({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="events-list">
        <h3 className="text-base font-bold text-[#001f4b] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Próximos Eventos
        </h3>
        <p className="text-sm text-slate-500">No hay eventos programados</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="events-list">
      <h3 className="text-base font-bold text-[#001f4b] mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Próximos Eventos
      </h3>
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
            data-testid={`event-item-${event.id}`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                categoryIcons[event.category] || "bg-[#001f4b]"
              }`}
            >
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">{formatDate(event.date)}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {event.time}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
