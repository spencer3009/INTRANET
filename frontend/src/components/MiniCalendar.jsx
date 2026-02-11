import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function MiniCalendar({ events = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = lastDay.getDate();
  const prevMonthLast = new Date(year, month, 0).getDate();

  // Get events for current month
  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      const eventDate = event.start_date || event.date;
      if (!eventDate) return false;
      return eventDate.startsWith(dateStr);
    });
  };

  const days = [];

  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, inactive: true, events: [] });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const dayEvents = getEventsForDay(d);
    days.push({ day: d, inactive: false, isToday, events: dayEvents });
  }

  // Next month days
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, inactive: true, events: [] });
  }

  const goToPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNext = () => setCurrentDate(new Date(year, month + 1, 1));

  // Count events in current month
  const monthEventsCount = events.filter(event => {
    const eventDate = event.start_date || event.date;
    if (!eventDate) return false;
    const eventMonth = new Date(eventDate).getMonth();
    const eventYear = new Date(eventDate).getFullYear();
    return eventMonth === month && eventYear === year;
  }).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="mini-calendar">
      {/* Header */}
      <div className="bg-[#001f4b] px-5 py-4 flex items-center justify-between">
        <button
          onClick={goToPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          data-testid="calendar-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold text-white capitalize" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {MONTHS_ES[month]} {year}
          </h3>
          {monthEventsCount > 0 && (
            <span className="text-[10px] text-white/60">
              {monthEventsCount} evento{monthEventsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={goToNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          data-testid="calendar-next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-0 mb-2">
          {DAYS_ES.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-slate-400 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-0.5 relative">
              <div
                className={`calendar-day ${d.inactive ? "inactive" : ""} ${d.isToday ? "today" : ""} ${d.events?.length > 0 ? "has-event" : ""}`}
                title={d.events?.length > 0 ? d.events.map(e => e.title).join(', ') : ''}
              >
                {d.day}
              </div>
              {/* Event indicator dots */}
              {d.events?.length > 0 && !d.inactive && (
                <div className="flex gap-0.5 mt-0.5 absolute -bottom-1">
                  {d.events.slice(0, 3).map((event, idx) => (
                    <span
                      key={idx}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: event.color || '#5c85d6' }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#e1b82c]" />
            <span className="text-[11px] font-medium text-slate-500">Hoy</span>
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#5c85d6]" />
              <span className="text-[11px] font-medium text-slate-500">Con eventos</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
