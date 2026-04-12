import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Clock, Plus, Pencil, Trash2, Users, GraduationCap } from "lucide-react";
import { ALL_DAYS, getVisibleDays } from "./constants";

const HOUR_HEIGHT_PX = 80;

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function CalendarGrid({ schedules, settings, onEdit, onDelete, onCellClick, teachers, sections, breaks, onAddBreak, onEditBreak, onDeleteBreak, readOnly = false, showTeacherPhoto = true, showAulaBadge = true, highlightProfesorId = null }) {
  const visibleDays = getVisibleDays(settings);
  const viewMode = settings?.view_mode || "horizontal";
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  // Sync header and body horizontal scroll
  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;
    const onBodyScroll = () => { header.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", onBodyScroll, { passive: true });
    return () => body.removeEventListener("scroll", onBodyScroll);
  }, []);

  const gridStart = useMemo(() => timeToMinutes(settings?.start_hour || "07:00"), [settings]);
  const gridEnd = useMemo(() => timeToMinutes(settings?.end_hour || "18:00"), [settings]);
  const totalMinutes = gridEnd - gridStart;
  const gridHeightPx = (totalMinutes / 60) * HOUR_HEIGHT_PX; // height for proportional calcs
  const totalHeightPx = gridHeightPx + 60; // container height with bottom padding
  const guideInterval = settings?.block_duration || 60;

  const formatTime = useCallback((time) => {
    if (!time) return time;
    if (settings?.time_format === "12h") {
      const [h, m] = time.split(":");
      const hour = parseInt(h);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m || "00"} ${ampm}`;
    }
    return time;
  }, [settings]);

  // Horizontal mode: generate time slots as fixed rows
  const timeSlots = useMemo(() => {
    const slots = [];
    const startH = parseInt(settings?.start_hour?.split(":")[0] || "7");
    const endH = parseInt(settings?.end_hour?.split(":")[0] || "18");
    for (let h = startH; h < endH; h++) {
      slots.push(`${h.toString().padStart(2, "0")}:00`);
    }
    return slots;
  }, [settings]);

  const formatSlotRange = useCallback((time) => {
    const [h] = time.split(":"); const hour = parseInt(h); const next = hour + 1;
    if (settings?.time_format === "12h") {
      const f = (hr) => { const a = hr >= 12 ? "PM" : "AM"; return `${hr % 12 || 12}:00 ${a}`; };
      return `${f(hour)} - ${f(next)}`;
    }
    return `${time} - ${next.toString().padStart(2, "0")}:00`;
  }, [settings]);

  // Vertical mode: guide lines
  const guideLines = useMemo(() => {
    const lines = [];
    for (let mins = gridStart; mins <= gridEnd; mins += guideInterval) {
      lines.push({ minutes: mins, time: minutesToTime(mins), topPx: ((mins - gridStart) / totalMinutes) * gridHeightPx });
    }
    return lines;
  }, [gridStart, gridEnd, guideInterval, totalMinutes, totalHeightPx]);

  const schedulesByDay = useMemo(() => {
    const map = {}; ALL_DAYS.forEach(d => { map[d.id] = []; });
    schedules.forEach(s => { if (map[s.dia]) map[s.dia].push(s); });
    return map;
  }, [schedules]);

  // Overlap layout for vertical mode
  const layoutByDay = useMemo(() => {
    const result = {};
    for (const dayId of Object.keys(schedulesByDay)) {
      const items = schedulesByDay[dayId].map(s => ({ ...s, _start: timeToMinutes(s.hora_inicio), _end: timeToMinutes(s.hora_fin) }))
        .sort((a, b) => a._start - b._start || a._end - b._end);
      const columns = [];
      const assigned = items.map(item => {
        let col = columns.findIndex(endMin => endMin <= item._start);
        if (col === -1) { col = columns.length; columns.push(0); }
        columns[col] = item._end;
        return { ...item, _col: col };
      });
      const withTotal = assigned.map(item => {
        const overlapping = assigned.filter(o => o._start < item._end && o._end > item._start);
        return { ...item, _totalCols: Math.max(...overlapping.map(o => o._col)) + 1 };
      });
      result[dayId] = withTotal;
    }
    return result;
  }, [schedulesByDay]);

  function hexToRgb(hex) {
    const num = parseInt((hex || "#6366F1").replace("#", ""), 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  const getPastelStyle = (color, hover = false) => {
    const { r, g, b } = hexToRgb(color);
    const alpha = hover ? 0.22 : 0.13;
    return {
      backgroundColor: `rgba(${r},${g},${b},${alpha})`,
      borderLeft: `4px solid ${color || "#6366F1"}`,
    };
  };

  const getTeacherInfo = (schedule) => {
    const teacher = teachers?.find(t => t.id === schedule.profesor_id);
    const section = sections?.find(s => s.id === schedule.seccion_id);
    return {
      teacherFullName: teacher ? `${teacher.name} ${teacher.last_name || ""}`.trim() : (schedule.profesor_nombre || ""),
      teacherPhoto: teacher?.profile_image || teacher?.photo_url || schedule.profesor_foto || null,
      studentCount: section?.student_count || section?.students_count || 0,
    };
  };

  // ── Hover actions (shared) ───────────────────────────────────
  const HoverActions = ({ id }) => {
    if (readOnly) return null;
    return (
      <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <button data-testid={`schedule-edit-btn-${id}`} onClick={(e) => { e.stopPropagation(); onEdit(schedules.find(s => s.id === id)); }} className="p-1 bg-white/90 rounded shadow hover:bg-white"><Pencil className="w-3 h-3 text-slate-700" /></button>
        <button data-testid={`schedule-delete-btn-${id}`} onClick={(e) => { e.stopPropagation(); onDelete(schedules.find(s => s.id === id)); }} className="p-1 bg-white/90 rounded shadow hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-500" /></button>
      </div>
    );
  };

  // ── Context menu ─────────────────────────────────────────────
  const ContextMenuComponent = () => {
    if (readOnly || !contextMenu) return null;
    return (
      <>
        <div className="fixed inset-0 z-[200]" onClick={() => setContextMenu(null)} />
        <div className="fixed z-[200] bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[180px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <p className="px-3 py-1 text-xs text-slate-500 font-medium">Bloquear franja</p>
          {[["break", "☕", "Recreo", "yellow"], ["lunch", "🍽️", "Almuerzo", "orange"], ["event", "🎉", "Evento", "blue"]].map(([t, icon, label, c]) => (
            <button key={t} onClick={() => { onAddBreak(contextMenu.time, t); setContextMenu(null); }} className={`w-full px-3 py-2 text-left hover:bg-${c}-50 flex items-center gap-2 text-sm`}>
              <span>{icon}</span> Marcar como {label}
            </button>
          ))}
        </div>
      </>
    );
  };

  // ── Break rendering helpers ──────────────────────────────────
  const breakConfig = (type) => ({
    break: { bg: "#FEF9C3", border: "border-yellow-400", text: "text-yellow-800", icon: "☕" },
    lunch: { bg: "#FFEDD5", border: "border-orange-400", text: "text-orange-800", icon: "🍽️" },
    event: { bg: "#DBEAFE", border: "border-blue-400", text: "text-blue-800", icon: "🎉" },
  }[type] || { bg: "#F1F5F9", border: "border-slate-400", text: "text-slate-800", icon: "⏸️" });

  const isTimeBlocked = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(":").map(Number);
    return breaks?.find(b => {
      const [sH] = b.start_time.split(":").map(Number);
      const [eH] = b.end_time.split(":").map(Number);
      return slotHour >= sH && slotHour < eH;
    });
  }, [breaks]);

  const getBreakForSlot = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(":").map(Number);
    return breaks?.find(b => {
      const [sH] = b.start_time.split(":").map(Number);
      return slotHour === sH;
    });
  }, [breaks]);

  // ═══════════════════════════════════════════════════════════════
  // HORIZONTAL MODE — Classic row-based layout
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === "horizontal") {
    const getSchedulesForSlot = (day, timeSlot) => {
      const [slotH] = timeSlot.split(":").map(Number);
      return schedulesByDay[day].filter(s => {
        const [sH] = s.hora_inicio.split(":").map(Number);
        const [eH] = s.hora_fin.split(":").map(Number);
        return slotH >= sH && slotH < eH;
      });
    };
    const startsAtSlot = (s, timeSlot) => {
      const [slotH] = timeSlot.split(":").map(Number);
      const [sH] = s.hora_inicio.split(":").map(Number);
      return slotH === sH;
    };

    const renderHorizBlock = (schedule) => {
      const { teacherFullName, teacherPhoto } = getTeacherInfo(schedule);
      const [sH] = schedule.hora_inicio.split(":").map(Number);
      const [eH] = schedule.hora_fin.split(":").map(Number);
      const spanRows = Math.max(eH - sH, 1);
      const isHighlighted = highlightProfesorId && schedule.profesor_id === highlightProfesorId;

      return (
        <div key={schedule.id} data-testid={`schedule-block-${schedule.id}`}
          className={`overflow-hidden group relative ${readOnly ? "cursor-default" : "cursor-pointer"} ${isHighlighted ? "ring-2 ring-violet-300" : ""}`}
          style={{
            ...getPastelStyle(schedule.color),
            minHeight: spanRows > 1 ? `${spanRows * 56 - 8}px` : "48px",
            borderRadius: 0,
            transition: "all 0.15s ease",
          }}
          onClick={(e) => { if (!readOnly) { e.stopPropagation(); onEdit(schedule); } }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = getPastelStyle(schedule.color, true).backgroundColor; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = getPastelStyle(schedule.color).backgroundColor; e.currentTarget.style.boxShadow = "none"; }}
        >
          <div className="h-full flex flex-col" style={{ padding: "4px 6px" }}>
            <p className="font-semibold text-xs sm:text-sm truncate text-slate-800">{schedule.materia}</p>
            {teacherFullName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {showTeacherPhoto && teacherPhoto && (
                  <img src={teacherPhoto} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-slate-200 hidden sm:block" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <p className="text-[11px] sm:text-[12px] text-slate-500 truncate">{teacherFullName}</p>
              </div>
            )}
            <div className="flex items-center gap-1 sm:gap-1.5 mt-auto">
              <p className="text-[11px] sm:text-[13px] font-medium text-slate-600">
                {formatTime(schedule.hora_inicio)} - {formatTime(schedule.hora_fin)}
              </p>
              {showAulaBadge && schedule.aula && (
                <span className="text-[9px] sm:text-[10px] bg-black/10 text-slate-600 px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline">{schedule.aula}</span>
              )}
            </div>
          </div>
          <HoverActions id={schedule.id} />
        </div>
      );
    };


    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
        <ContextMenuComponent />
        {/* Header row */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className="w-20 sm:w-36 flex-shrink-0 p-2 sm:p-3 border-r border-slate-200 flex items-center justify-center">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <div className="flex-1 flex overflow-x-auto hide-scrollbar" ref={headerScrollRef} data-testid="schedule-header-scroll">
            {visibleDays.map(day => (
              <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-2 sm:p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[100px] sm:min-w-[140px]">
                <p className="font-bold text-slate-800 text-sm sm:text-base">{day.label}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
              </div>
            ))}
          </div>
        </div>
        {/* Body rows: fixed time column + scrollable day columns */}
        <div className="flex">
          {/* Time column — OUTSIDE scroll container, never overlapped */}
          <div className="w-20 sm:w-36 flex-shrink-0 border-r border-slate-200 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
            {timeSlots.map((time) => {
              const brk = getBreakForSlot(time);
              if (brk) {
                const bc = breakConfig(brk.type);
                return (
                  <div key={time} className={`min-h-[56px] sm:min-h-[64px] px-1 sm:px-2 py-2 border-b ${bc.border} flex items-center justify-center`} style={{ backgroundColor: bc.bg }}>
                    <span className={`text-[10px] sm:text-xs font-medium ${bc.text}`}>{formatSlotRange(time)}</span>
                  </div>
                );
              }
              if (isTimeBlocked(time)) return null;
              return (
                <div key={time}
                  className={`min-h-[56px] sm:min-h-[64px] px-1 sm:px-2 py-2 border-b border-slate-100 flex items-center justify-center ${!readOnly ? "cursor-pointer hover:bg-slate-50 group" : ""} transition-colors relative`}
                  data-testid={`schedule-time-slot-${time.replace(":", "")}`}
                  onContextMenu={!readOnly ? (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, time }); } : undefined}
                >
                  <span className="text-[10px] sm:text-xs font-medium text-slate-600 text-center leading-tight">{formatSlotRange(time)}</span>
                  {!readOnly && (
                    <button onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time }); }}
                      className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 bg-white rounded shadow hover:bg-blue-50 transition-all" title="Bloquear fila">
                      <Plus className="w-3 h-3 text-slate-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Day columns — scrollable */}
          <div className="flex-1 overflow-x-auto relative" ref={bodyScrollRef} data-testid="schedule-body-scroll">
            {timeSlots.map((time) => {
              const brk = getBreakForSlot(time);
              if (brk) {
                const bc = breakConfig(brk.type);
                return (
                  <div key={time} className={`flex border-b ${bc.border} min-h-[56px] sm:min-h-[64px]`} style={{ backgroundColor: bc.bg }}>
                    <div className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-4 ${!readOnly ? "cursor-pointer group" : ""}`} onClick={() => { if (!readOnly) onEditBreak(brk); }}>
                      <span className="text-lg sm:text-2xl">{bc.icon}</span>
                      <span className={`font-bold text-sm sm:text-lg ${bc.text}`}>{brk.label}</span>
                      <span className={`text-[10px] sm:text-sm ${bc.text} opacity-70 hidden sm:inline`}>({brk.start_time} - {brk.end_time})</span>
                      {!readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); onDeleteBreak(brk); }} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white rounded-lg shadow hover:bg-red-50 transition-all ml-2">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
              if (isTimeBlocked(time)) return null;
              return (
                <div key={time} className="flex border-b border-slate-100 min-h-[56px] sm:min-h-[64px]">
                  {visibleDays.map(day => {
                    const slotSchedules = getSchedulesForSlot(day.id, time);
                    return (
                      <div key={`${day.id}-${time}`} data-testid={`schedule-cell-${day.id}-${time.replace(":", "")}`}
                        className={`flex-1 min-w-[100px] sm:min-w-[140px] border-r last:border-r-0 border-slate-100 ${!readOnly ? "hover:bg-blue-50/30 cursor-pointer" : ""} transition-colors p-0.5 sm:p-1`}
                        onClick={!readOnly ? () => onCellClick(day.id, time) : undefined}>
                        {slotSchedules.map(s => startsAtSlot(s, time) ? renderHorizBlock(s) : null)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Scroll shadow indicator */}
            <div className="absolute top-0 right-0 bottom-0 w-4 bg-gradient-to-l from-black/5 to-transparent pointer-events-none sm:hidden" />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERTICAL MODE — Proportional absolute positioning
  // ═══════════════════════════════════════════════════════════════
  const renderBlock = (item) => {
    const { teacherFullName, teacherPhoto } = getTeacherInfo(item);
    const duration = item._end - item._start;
    const sizeClass = duration >= 90 ? "tall" : duration >= 45 ? "medium" : "short";
    const topPx = ((item._start - gridStart) / totalMinutes) * gridHeightPx;
    const heightPx = Math.max((duration / totalMinutes) * gridHeightPx, 22);
    const widthPct = 100 / item._totalCols;
    const leftPct = item._col * widthPct;
    const isHovered = hoveredId === item.id;
    const showTooltip = isHovered && sizeClass !== "tall";
    const isHighlighted = highlightProfesorId && item.profesor_id === highlightProfesorId;

    return (
      <div key={item.id} data-testid={`schedule-block-${item.id}`}
        className={`absolute overflow-hidden group z-20 ${readOnly ? "cursor-default" : "cursor-pointer"} ${isHighlighted ? "ring-2 ring-violet-300" : ""}`}
        style={{
          ...getPastelStyle(item.color, isHovered),
          top: `${topPx + 1}px`,
          height: `${heightPx - 2}px`,
          left: `calc(${leftPct}% + 1px)`,
          width: `calc(${widthPct}% - 2px)`,
          borderRadius: 0,
          transition: "all 0.15s ease",
          boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        }}
        onClick={(e) => { if (!readOnly) { e.stopPropagation(); onEdit(item); } }}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* Tall: materia + profesor + horario */}
        {sizeClass === "tall" && (
          <div className="h-full flex flex-col overflow-hidden" style={{ padding: "8px 10px" }}>
            <p className="font-semibold text-sm truncate text-slate-800">{item.materia}</p>
            {teacherFullName && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {showTeacherPhoto && teacherPhoto && (
                  <img src={teacherPhoto} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-slate-200" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <p className="text-[12px] text-slate-500 truncate">{teacherFullName}</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-auto">
              <p className="text-[13px] font-medium text-slate-600">
                {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
              </p>
              {showAulaBadge && item.aula && (
                <span className="text-[10px] bg-black/10 text-slate-600 px-2 py-0.5 rounded-full">{item.aula}</span>
              )}
            </div>
          </div>
        )}

        {/* Medium: materia + horario (compact) */}
        {sizeClass === "medium" && (
          <div className="h-full flex flex-col justify-center overflow-hidden" style={{ padding: "4px 10px" }}>
            <p className="font-semibold text-[13px] truncate text-slate-800 leading-tight">{item.materia}</p>
            <p className="text-[12px] font-medium text-slate-500 truncate mt-0.5">
              {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
            </p>
          </div>
        )}

        {/* Short: materia only */}
        {sizeClass === "short" && (
          <div className="h-full flex items-center overflow-hidden" style={{ padding: "2px 10px" }}>
            <p className="font-semibold text-[12px] truncate text-slate-800">{item.materia}</p>
          </div>
        )}

        {/* Tooltip on hover for medium/short */}
        {showTooltip && (
          <div className="absolute left-0 top-full mt-1 z-[200] bg-slate-800 text-white rounded-md shadow-xl p-2.5 min-w-[180px] text-xs pointer-events-none">
            <p className="font-semibold">{item.materia}</p>
            {teacherFullName && <p className="opacity-80 mt-0.5">{teacherFullName}</p>}
            <p className="opacity-70 mt-0.5">{formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}</p>
            {item.aula && <p className="opacity-70">Aula: {item.aula}</p>}
          </div>
        )}
        <HoverActions id={item.id} />
      </div>
    );
  };

  const renderBreakOverlay = (breakItem) => {
    const bStart = timeToMinutes(breakItem.start_time);
    const bEnd = timeToMinutes(breakItem.end_time);
    const topPx = ((bStart - gridStart) / totalMinutes) * gridHeightPx;
    const heightPx = ((bEnd - bStart) / totalMinutes) * gridHeightPx;
    const bc = breakConfig(breakItem.type);
    return (
      <div key={breakItem.id || breakItem.start_time}
        className={`absolute left-0 right-0 ${bc.border} border-y flex items-center justify-center gap-2 z-30 ${!readOnly ? "cursor-pointer group" : ""}`}
        style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: bc.bg }}
        onClick={() => { if (!readOnly) onEditBreak(breakItem); }}>
        <span className="text-lg">{bc.icon}</span>
        <span className={`font-bold text-sm ${bc.text}`}>{breakItem.label}</span>
        <span className={`text-xs ${bc.text} opacity-70`}>({formatTime(breakItem.start_time)} - {formatTime(breakItem.end_time)})</span>
        {!readOnly && (
          <button onClick={(e) => { e.stopPropagation(); onDeleteBreak(breakItem); }} className="opacity-0 group-hover:opacity-100 p-1 bg-white rounded shadow hover:bg-red-50 transition-all ml-1">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
      </div>
    );
  };

  const handleDayClick = (e, dayId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const yPx = e.clientY - rect.top;
    const clickedMins = gridStart + (yPx / gridHeightPx) * totalMinutes;
    const snapped = Math.round(clickedMins / guideInterval) * guideInterval;
    onCellClick(dayId, minutesToTime(Math.max(gridStart, Math.min(gridEnd, snapped))));
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
      <ContextMenuComponent />
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="min-w-0">
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="w-16 sm:w-20 flex-shrink-0 p-2 sm:p-3 border-r border-slate-200 flex items-center justify-center"><Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" /></div>
              {visibleDays.map(day => (
                <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-2 sm:p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[100px] sm:min-w-[140px]">
                  <p className="font-bold text-slate-800 text-sm sm:text-base">{day.label}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
                </div>
              ))}
            </div>
            <div className="flex relative">
              {/* Break overlays — full width across all columns */}
              {breaks?.filter(b => {
                const s = timeToMinutes(b.start_time);
                const e = timeToMinutes(b.end_time);
                return e > gridStart && s < gridEnd;
              }).map(b => renderBreakOverlay(b))}

              <div className="w-16 sm:w-20 flex-shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 relative" style={{ height: `${totalHeightPx}px` }}>
          {guideLines.map((gl, idx) => (
            <div key={gl.time} className={`absolute w-full flex items-start justify-center ${!readOnly ? "cursor-pointer group" : ""}`}
              style={{ top: `${gl.topPx}px`, height: idx < guideLines.length - 1 ? `${guideLines[idx + 1].topPx - gl.topPx}px` : "auto" }}
              onContextMenu={!readOnly ? (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); } : undefined}
              onClick={!readOnly ? (e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); } : undefined}>
              <span className="text-[13px] font-semibold text-slate-400 pt-1 select-none">{formatTime(gl.time)}</span>
              {!readOnly && (
                <button onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); }}
                  className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 p-0.5 bg-white rounded shadow hover:bg-blue-50 transition-all" title="Bloquear franja">
                  <Plus className="w-3 h-3 text-slate-500" />
                </button>
              )}
            </div>
          ))}
        </div>
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`schedule-day-column-${day.id}`}
            className="flex-1 min-w-[100px] sm:min-w-[140px] border-r last:border-r-0 border-slate-200 relative"
            style={{ height: `${totalHeightPx}px` }}
            onClick={!readOnly ? (e) => handleDayClick(e, day.id) : undefined}>
            {guideLines.map(gl => (
              <div key={gl.time} className="absolute w-full border-t border-slate-100" style={{ top: `${gl.topPx}px` }} />
            ))}
            {layoutByDay[day.id]?.map(item => renderBlock(item))}
          </div>
        ))}
            </div>
          </div>
        </div>
        {/* Scroll shadow indicator */}
        <div className="absolute top-0 right-0 bottom-0 w-4 bg-gradient-to-l from-black/5 to-transparent pointer-events-none sm:hidden" />
      </div>
    </div>
  );
}
