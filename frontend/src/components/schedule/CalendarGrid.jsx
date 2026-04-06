import { useState, useCallback, useMemo } from "react";
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

export function CalendarGrid({ schedules, settings, onEdit, onDelete, onCellClick, teachers, sections, breaks, onAddBreak, onEditBreak, onDeleteBreak }) {
  const visibleDays = getVisibleDays(settings);
  const viewMode = settings?.view_mode || "horizontal";
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const gridStart = useMemo(() => timeToMinutes(settings?.start_hour || "07:00"), [settings]);
  const gridEnd = useMemo(() => timeToMinutes(settings?.end_hour || "18:00"), [settings]);
  const totalMinutes = gridEnd - gridStart;
  const totalHeightPx = (totalMinutes / 60) * HOUR_HEIGHT_PX + 40; // +40px bottom padding
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
      lines.push({ minutes: mins, time: minutesToTime(mins), topPx: ((mins - gridStart) / totalMinutes) * totalHeightPx });
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

  const getColorStyle = (color) => ({
    backgroundColor: color || "#6366F1",
    borderLeft: `4px solid ${color ? darkenColor(color, 20) : "#4338CA"}`,
  });

  function darkenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
  }

  const getTeacherInfo = (schedule) => {
    const teacher = teachers?.find(t => t.id === schedule.profesor_id);
    const section = sections?.find(s => s.id === schedule.seccion_id);
    return {
      teacherFullName: teacher ? `${teacher.name} ${teacher.last_name || ""}`.trim() : "",
      teacherPhoto: teacher?.profile_image || teacher?.photo_url,
      studentCount: section?.student_count || section?.students_count || 0,
    };
  };

  // ── Hover actions (shared) ───────────────────────────────────
  const HoverActions = ({ id }) => (
    <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
      <button data-testid={`schedule-edit-btn-${id}`} onClick={(e) => { e.stopPropagation(); onEdit(schedules.find(s => s.id === id)); }} className="p-1 bg-white/90 rounded shadow hover:bg-white"><Pencil className="w-3 h-3 text-slate-700" /></button>
      <button data-testid={`schedule-delete-btn-${id}`} onClick={(e) => { e.stopPropagation(); onDelete(schedules.find(s => s.id === id)); }} className="p-1 bg-white/90 rounded shadow hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-500" /></button>
    </div>
  );

  // ── Context menu ─────────────────────────────────────────────
  const ContextMenuComponent = () => {
    if (!contextMenu) return null;
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
        <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[180px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
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
    break: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", icon: "☕" },
    lunch: { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", icon: "🍽️" },
    event: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", icon: "🎉" },
  }[type] || { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800", icon: "⏸️" });

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
      const { teacherFullName, teacherPhoto, studentCount } = getTeacherInfo(schedule);
      const [sH] = schedule.hora_inicio.split(":").map(Number);
      const [eH] = schedule.hora_fin.split(":").map(Number);
      const spanRows = Math.max(eH - sH, 1);

      return (
        <div key={schedule.id} data-testid={`schedule-block-${schedule.id}`}
          className="rounded-xl shadow-sm overflow-hidden cursor-pointer group transition-all hover:shadow-lg relative"
          style={{ ...getColorStyle(schedule.color), minHeight: spanRows > 1 ? `${spanRows * 64 - 8}px` : "70px" }}
          onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
        >
          <div className="h-full p-2.5 flex flex-col text-white">
            <p className="font-bold text-sm truncate mb-1">{schedule.materia}</p>
            {teacherFullName && (
              <div className="flex items-center gap-2 mb-1">
                {teacherPhoto ? (
                  <img src={teacherPhoto} alt="" className="w-6 h-6 rounded-full object-cover border border-white/30 flex-shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><Users className="w-3 h-3 text-white/80" /></div>
                )}
                <span className="text-xs opacity-95 truncate">{teacherFullName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] opacity-80 mt-auto">
              {studentCount > 0 && <span className="flex items-center gap-1 bg-white/15 px-1.5 py-0.5 rounded"><GraduationCap className="w-3 h-3" />{studentCount} alumnos</span>}
              {schedule.aula && <span className="truncate">{schedule.aula}</span>}
            </div>
          </div>
          <HoverActions id={schedule.id} />
        </div>
      );
    };

    const renderBreakRow = (time, breakItem) => {
      const bc = breakConfig(breakItem.type);
      return (
        <div key={time} className={`flex border-b ${bc.border} min-h-[64px] ${bc.bg}`}>
          <div className={`w-36 flex-shrink-0 px-2 py-2 border-r ${bc.border} sticky left-0 z-10 flex items-center justify-center ${bc.bg}`}>
            <span className={`text-xs font-medium ${bc.text}`}>{formatSlotRange(time)}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-3 px-4 cursor-pointer group" onClick={() => onEditBreak(breakItem)}>
            <span className="text-2xl">{bc.icon}</span>
            <span className={`font-bold text-lg ${bc.text}`}>{breakItem.label}</span>
            <span className={`text-sm ${bc.text} opacity-70`}>({breakItem.start_time} - {breakItem.end_time})</span>
            <button onClick={(e) => { e.stopPropagation(); onDeleteBreak(breakItem); }} className="opacity-0 group-hover:opacity-100 p-1.5 bg-white rounded-lg shadow hover:bg-red-50 transition-all ml-2">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
        <ContextMenuComponent />
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          <div className="w-36 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center"><Clock className="w-5 h-5 text-slate-400" /></div>
          {visibleDays.map(day => (
            <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[140px]">
              <p className="font-bold text-slate-800">{day.label}</p>
              <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
            </div>
          ))}
        </div>
        <div>
          {timeSlots.map((time) => {
            const brk = getBreakForSlot(time);
            if (brk) return renderBreakRow(time, brk);
            if (isTimeBlocked(time)) return null;
            return (
              <div key={time} className="flex border-b border-slate-100 min-h-[64px]">
                <div className="w-36 flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group relative"
                  data-testid={`schedule-time-slot-${time.replace(":", "")}`}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, time }); }}
                >
                  <span className="text-xs font-medium text-slate-600 text-center leading-tight">{formatSlotRange(time)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time }); }}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 bg-white rounded shadow hover:bg-blue-50 transition-all" title="Bloquear fila">
                    <Plus className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
                {visibleDays.map(day => {
                  const slotSchedules = getSchedulesForSlot(day.id, time);
                  return (
                    <div key={`${day.id}-${time}`} data-testid={`schedule-cell-${day.id}-${time.replace(":", "")}`}
                      className="flex-1 min-w-[140px] border-r last:border-r-0 border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors p-1"
                      onClick={() => onCellClick(day.id, time)}>
                      {slotSchedules.map(s => startsAtSlot(s, time) ? renderHorizBlock(s) : null)}
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

  // ═══════════════════════════════════════════════════════════════
  // VERTICAL MODE — Proportional absolute positioning
  // ═══════════════════════════════════════════════════════════════
  const renderBlock = (item) => {
    const { teacherFullName, teacherPhoto, studentCount } = getTeacherInfo(item);
    const duration = item._end - item._start;
    const isShort = duration <= 30;
    const topPx = ((item._start - gridStart) / totalMinutes) * totalHeightPx;
    const heightPx = Math.max((duration / totalMinutes) * totalHeightPx, 24);
    const widthPct = 100 / item._totalCols;
    const leftPct = item._col * widthPct;

    return (
      <div key={item.id} data-testid={`schedule-block-${item.id}`}
        className="absolute rounded-lg shadow-sm overflow-hidden cursor-pointer group transition-all hover:shadow-lg hover:brightness-105 z-20"
        style={{ ...getColorStyle(item.color), top: `${topPx}px`, height: `${heightPx}px`, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <div className="h-full px-2 py-1 flex flex-col text-white relative overflow-hidden">
          <p className="font-bold text-xs sm:text-sm truncate leading-tight">{item.materia}</p>
          {!isShort && teacherFullName && (
            <div className="flex items-center gap-1 mt-0.5">
              {teacherPhoto ? (
                <img src={teacherPhoto} alt="" className="w-4 h-4 rounded-full object-cover border border-white/30 flex-shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><Users className="w-2.5 h-2.5 text-white/80" /></div>
              )}
              <span className="text-[10px] opacity-90 truncate">{teacherFullName}</span>
            </div>
          )}
          {!isShort && (
            <div className="flex items-center gap-1.5 text-[10px] opacity-80 mt-auto">
              <span>{formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}</span>
              {item.aula && <span className="bg-black/15 rounded px-1">{item.aula}</span>}
            </div>
          )}
          {!isShort && studentCount > 0 && heightPx > 70 && (
            <div className="flex items-center gap-1 text-[10px] opacity-75"><GraduationCap className="w-3 h-3" /><span>{studentCount}</span></div>
          )}
        </div>
        {isShort && hoveredId === item.id && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 text-white rounded-lg shadow-xl p-2.5 min-w-[180px] text-xs pointer-events-none">
            <p className="font-bold">{item.materia}</p>
            {teacherFullName && <p className="opacity-80 mt-0.5">{teacherFullName}</p>}
            <p className="opacity-70 mt-0.5">{formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}</p>
            {item.aula && <p className="opacity-70">Aula: {item.aula}</p>}
            {studentCount > 0 && <p className="opacity-70">{studentCount} alumnos</p>}
          </div>
        )}
        <HoverActions id={item.id} />
      </div>
    );
  };

  const renderBreakOverlay = (breakItem) => {
    const bStart = timeToMinutes(breakItem.start_time);
    const bEnd = timeToMinutes(breakItem.end_time);
    const topPx = ((bStart - gridStart) / totalMinutes) * totalHeightPx;
    const heightPx = ((bEnd - bStart) / totalMinutes) * totalHeightPx;
    const bc = breakConfig(breakItem.type);
    return (
      <div key={breakItem.id || breakItem.start_time}
        className={`absolute left-0 right-0 ${bc.bg}/90 ${bc.border} border-y flex items-center justify-center gap-2 z-30 cursor-pointer group`}
        style={{ top: `${topPx}px`, height: `${heightPx}px` }}
        onClick={() => onEditBreak(breakItem)}>
        <span className="text-lg">{bc.icon}</span>
        <span className={`font-bold text-sm ${bc.text}`}>{breakItem.label}</span>
        <span className={`text-xs ${bc.text} opacity-70`}>({formatTime(breakItem.start_time)} - {formatTime(breakItem.end_time)})</span>
        <button onClick={(e) => { e.stopPropagation(); onDeleteBreak(breakItem); }} className="opacity-0 group-hover:opacity-100 p-1 bg-white rounded shadow hover:bg-red-50 transition-all ml-1">
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    );
  };

  const handleDayClick = (e, dayId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const yPx = e.clientY - rect.top;
    const clickedMins = gridStart + (yPx / totalHeightPx) * totalMinutes;
    const snapped = Math.round(clickedMins / guideInterval) * guideInterval;
    onCellClick(dayId, minutesToTime(Math.max(gridStart, Math.min(gridEnd, snapped))));
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
      <ContextMenuComponent />
      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="w-20 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center"><Clock className="w-5 h-5 text-slate-400" /></div>
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[140px]">
            <p className="font-bold text-slate-800">{day.label}</p>
            <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="w-20 flex-shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 relative" style={{ height: `${totalHeightPx}px` }}>
          {guideLines.map((gl, idx) => (
            <div key={gl.time} className="absolute w-full flex items-start justify-center cursor-pointer group"
              style={{ top: `${gl.topPx}px`, height: idx < guideLines.length - 1 ? `${guideLines[idx + 1].topPx - gl.topPx}px` : "auto" }}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); }}
              onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); }}>
              <span className="text-[11px] font-medium text-slate-500 pt-1 select-none">{formatTime(gl.time)}</span>
              <button onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, time: gl.time }); }}
                className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 p-0.5 bg-white rounded shadow hover:bg-blue-50 transition-all" title="Bloquear franja">
                <Plus className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`schedule-day-column-${day.id}`}
            className="flex-1 min-w-[140px] border-r last:border-r-0 border-slate-200 relative"
            style={{ height: `${totalHeightPx}px` }}
            onClick={(e) => handleDayClick(e, day.id)}>
            {guideLines.map(gl => (
              <div key={gl.time} className="absolute w-full border-t border-slate-100" style={{ top: `${gl.topPx}px` }} />
            ))}
            {breaks?.filter(b => { const s = timeToMinutes(b.start_time); const e = timeToMinutes(b.end_time); return e > gridStart && s < gridEnd; }).map(b => renderBreakOverlay(b))}
            {layoutByDay[day.id]?.map(item => renderBlock(item))}
          </div>
        ))}
      </div>
    </div>
  );
}
