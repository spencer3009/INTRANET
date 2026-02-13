import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Clock, MapPin } from "lucide-react";

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Event colors palette
const EVENT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export default function MiniCalendar({ events = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const popupRef = useRef(null);
  const calendarRef = useRef(null);
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = lastDay.getDate();
  const prevMonthLast = new Date(year, month, 0).getDate();

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setSelectedDay(null);
      }
    };
    if (selectedDay) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedDay]);

  // Get events for a specific day
  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      const eventDate = event.start_date || event.date;
      if (!eventDate) return false;
      return eventDate.startsWith(dateStr);
    });
  };

  // Get color for event (use event color or assign from palette)
  const getEventColor = (event, index) => {
    return event.color || EVENT_COLORS[index % EVENT_COLORS.length];
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

  // Handle day click
  const handleDayClick = (d, e) => {
    if (d.inactive || d.events.length === 0) return;
    
    // Calculate popup position
    const rect = e.currentTarget.getBoundingClientRect();
    const calendarRect = calendarRef.current?.getBoundingClientRect();
    
    if (calendarRect) {
      setPopupPosition({
        top: rect.bottom - calendarRect.top + 8,
        left: Math.min(rect.left - calendarRect.left, calendarRect.width - 280)
      });
    }
    
    setSelectedDay(d);
  };

  // Format time
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible relative" ref={calendarRef} data-testid="mini-calendar">
      {/* Header */}
      <div className="bg-[#001f4b] px-5 py-4 flex items-center justify-between rounded-t-xl">
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

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => (
            <div 
              key={i} 
              className={`relative flex flex-col items-center py-1 rounded-lg transition-all ${
                d.events?.length > 0 && !d.inactive 
                  ? "cursor-pointer hover:bg-slate-100" 
                  : ""
              }`}
              onClick={(e) => handleDayClick(d, e)}
            >
              {/* Day number */}
              <div
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                  ${d.inactive ? "text-slate-300" : "text-slate-700"}
                  ${d.isToday ? "bg-[#e1b82c] text-white font-bold" : ""}
                  ${d.events?.length > 0 && !d.inactive && !d.isToday ? "bg-slate-50" : ""}
                `}
              >
                {d.day}
              </div>
              
              {/* Event indicator bar - More visible */}
              {d.events?.length > 0 && !d.inactive && (
                <div className="flex gap-0.5 mt-1 w-full justify-center">
                  {d.events.slice(0, 3).map((event, idx) => (
                    <div
                      key={idx}
                      className="h-1.5 rounded-full animate-pulse"
                      style={{ 
                        backgroundColor: getEventColor(event, idx),
                        width: d.events.length === 1 ? "20px" : d.events.length === 2 ? "12px" : "8px"
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#e1b82c]" />
            <span className="text-[11px] font-medium text-slate-500">Hoy</span>
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
              <span className="text-[11px] font-medium text-slate-500">Con actividades</span>
            </div>
          )}
        </div>
      </div>

      {/* Event Popup */}
      {selectedDay && selectedDay.events.length > 0 && (
        <div 
          ref={popupRef}
          className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-72 animate-fade-in-up"
          style={{ 
            top: popupPosition.top,
            left: Math.max(0, popupPosition.left),
            maxWidth: "calc(100vw - 40px)"
          }}
          data-testid="event-popup"
        >
          {/* Popup Header */}
          <div className="bg-gradient-to-r from-[#001f4b] to-[#003366] px-4 py-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#e1b82c]" />
              <span className="text-sm font-bold text-white">
                {selectedDay.day} de {MONTHS_ES[month]}
              </span>
            </div>
            <button 
              onClick={() => setSelectedDay(null)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Events List */}
          <div className="max-h-64 overflow-y-auto">
            {selectedDay.events.map((event, idx) => (
              <div 
                key={idx} 
                className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
              >
                {/* Event Color Bar + Title */}
                <div className="flex items-start gap-3">
                  <div 
                    className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: getEventColor(event, idx) }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm leading-tight">
                      {event.title}
                    </h4>
                    
                    {/* Time */}
                    {(event.start_date || event.start_time) && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {event.start_time || formatTime(event.start_date)}
                          {event.end_time && ` - ${event.end_time}`}
                        </span>
                      </div>
                    )}
                    
                    {/* Location */}
                    {event.location && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    {/* Description */}
                    {event.description && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Event Type Badge */}
                    {event.type && (
                      <span 
                        className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full text-white"
                        style={{ backgroundColor: getEventColor(event, idx) }}
                      >
                        {event.type.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 rounded-b-xl">
            <p className="text-[10px] text-slate-400 text-center">
              {selectedDay.events.length} actividad{selectedDay.events.length !== 1 ? 'es' : ''} programada{selectedDay.events.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
