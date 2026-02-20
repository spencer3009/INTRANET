import { useState, useCallback } from "react";
import { Clock, Plus, Pencil, Trash2, Users, GraduationCap } from "lucide-react";
import { ALL_DAYS, getVisibleDays } from "./constants";

export function CalendarGrid({ schedules, settings, onEdit, onDelete, onCellClick, teachers, sections, breaks, onAddBreak, onEditBreak, onDeleteBreak }) {
  const visibleDays = getVisibleDays(settings);
  const viewMode = settings?.view_mode || "horizontal";
  const [contextMenu, setContextMenu] = useState(null);
  
  // Check if a time slot is blocked by a break
  const isTimeBlocked = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      const [endH] = b.end_time.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  }, [breaks]);

  // Get break for a time slot
  const getBreakForSlot = useCallback((timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return breaks?.find(b => {
      const [startH] = b.start_time.split(':').map(Number);
      return slotHour === startH;
    });
  }, [breaks]);
  
  // Generate time slots based on settings
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const endHour = parseInt(settings?.end_hour?.split(':')[0] || '18');
    
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, [settings]);

  const timeSlots = generateTimeSlots();

  // Format time for display based on mode
  const formatTime = (time) => {
    if (!time) return time;
    if (settings?.time_format === "12h") {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    }
    return time;
  };

  // Format time range for horizontal mode
  const formatTimeRange = (time) => {
    const [h] = time.split(':');
    const hour = parseInt(h);
    const nextHour = hour + 1;
    
    if (settings?.time_format === "12h") {
      const ampm1 = hour >= 12 ? 'PM' : 'AM';
      const ampm2 = nextHour >= 12 ? 'PM' : 'AM';
      const hour12_1 = hour % 12 || 12;
      const hour12_2 = nextHour % 12 || 12;
      return `${hour12_1}:00 ${ampm1} - ${hour12_2}:00 ${ampm2}`;
    }
    return `${time} - ${nextHour.toString().padStart(2, '0')}:00`;
  };

  // Get color style
  const getColorStyle = (color) => ({
    backgroundColor: color || '#6366F1',
    borderColor: color || '#6366F1'
  });

  // Calculate block position and height (for vertical mode)
  const getBlockStyle = (schedule) => {
    const startHour = parseInt(settings?.start_hour?.split(':')[0] || '7');
    const [startH, startM] = schedule.hora_inicio.split(':').map(Number);
    const [endH, endM] = schedule.hora_fin.split(':').map(Number);
    
    const startMinutes = (startH - startHour) * 60 + startM;
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    
    const top = (startMinutes / 60) * 64;
    const height = Math.max((duration / 60) * 64, 32);
    
    return {
      top: `${top}px`,
      height: `${height}px`,
      minHeight: '32px'
    };
  };

  // Group schedules by day
  const schedulesByDay = {};
  ALL_DAYS.forEach(d => { schedulesByDay[d.id] = []; });
  schedules.forEach(s => {
    if (schedulesByDay[s.dia]) {
      schedulesByDay[s.dia].push(s);
    }
  });

  // Get schedules for a specific time slot and day
  const getSchedulesForSlot = (day, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    return schedulesByDay[day].filter(s => {
      const [startH] = s.hora_inicio.split(':').map(Number);
      const [endH] = s.hora_fin.split(':').map(Number);
      return slotHour >= startH && slotHour < endH;
    });
  };

  // Check if schedule starts at this slot
  const scheduleStartsAtSlot = (schedule, timeSlot) => {
    const [slotHour] = timeSlot.split(':').map(Number);
    const [startH] = schedule.hora_inicio.split(':').map(Number);
    return slotHour === startH;
  };

  // Render schedule block
  const renderScheduleBlock = (schedule, isHorizontal = true) => {
    const teacher = teachers?.find(t => t.id === schedule.profesor_id);
    const section = sections?.find(s => s.id === schedule.seccion_id);
    const studentCount = section?.student_count || section?.students_count || 0;
    const teacherFullName = teacher ? `${teacher.name} ${teacher.last_name || ''}`.trim() : '';
    const teacherPhoto = teacher?.profile_image || teacher?.photo_url;
    
    const [startH] = schedule.hora_inicio.split(':').map(Number);
    const [endH] = schedule.hora_fin.split(':').map(Number);
    const spanRows = endH - startH;

    return (
      <div
        key={schedule.id}
        data-testid={`schedule-block-${schedule.id}`}
        className={`rounded-xl shadow-sm overflow-hidden cursor-pointer group transition-all hover:shadow-lg ${isHorizontal ? '' : 'absolute left-1 right-1 hover:scale-[1.02] z-20'}`}
        style={{
          ...getColorStyle(schedule.color),
          ...(isHorizontal ? { minHeight: spanRows > 1 ? `${spanRows * 64 - 8}px` : '70px' } : getBlockStyle(schedule))
        }}
        onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
      >
        <div className={`h-full ${isHorizontal ? 'p-2.5' : 'p-2'} flex flex-col text-white`}>
          <p className={`font-bold ${isHorizontal ? 'text-sm' : 'text-sm leading-tight'} truncate ${isHorizontal ? 'mb-1' : 'mb-0.5'}`}>{schedule.materia}</p>
          
          {teacher && (
            <div className={`flex items-center gap-${isHorizontal ? '2' : '1.5'} ${isHorizontal ? 'mb-1' : 'mb-0.5'}`}>
              {teacherPhoto ? (
                <img 
                  src={teacherPhoto} 
                  alt={teacherFullName}
                  className={`${isHorizontal ? 'w-6 h-6' : 'w-5 h-5'} rounded-full object-cover border border-white/30 flex-shrink-0`}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className={`${isHorizontal ? 'w-6 h-6' : 'w-5 h-5'} rounded-full bg-white/20 flex items-center justify-center flex-shrink-0`}>
                  <Users className={`${isHorizontal ? 'w-3 h-3' : 'w-2.5 h-2.5'} text-white/80`} />
                </div>
              )}
              <span className={`text-${isHorizontal ? 'xs' : '[11px]'} opacity-95 truncate`}>{teacherFullName}</span>
            </div>
          )}
          
          {isHorizontal ? (
            <div className="flex items-center gap-2 text-[10px] opacity-80 mt-auto">
              {studentCount > 0 && (
                <span className="flex items-center gap-1 bg-white/15 px-1.5 py-0.5 rounded">
                  <GraduationCap className="w-3 h-3" />
                  {studentCount} alumnos
                </span>
              )}
              {schedule.aula && <span className="truncate">{schedule.aula}</span>}
            </div>
          ) : (
            <>
              {studentCount > 0 && (
                <div className="flex items-center gap-1 text-[10px] opacity-80">
                  <GraduationCap className="w-3 h-3" />
                  <span>{studentCount} alumnos</span>
                </div>
              )}
              <div className="absolute bottom-1 right-1 flex items-center gap-1">
                {schedule.aula && <span className="bg-black/20 rounded px-1 py-0.5 text-[9px]">{schedule.aula}</span>}
                <span className="bg-black/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {schedule.hora_inicio} - {schedule.hora_fin}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Hover actions */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            data-testid={`schedule-edit-btn-${schedule.id}`}
            onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
            className={`p-${isHorizontal ? '1' : '1.5'} bg-white/90 rounded${isHorizontal ? '' : '-lg'} shadow hover:bg-white`}
          >
            <Pencil className="w-3 h-3 text-slate-700" />
          </button>
          <button
            data-testid={`schedule-delete-btn-${schedule.id}`}
            onClick={(e) => { e.stopPropagation(); onDelete(schedule); }}
            className={`p-${isHorizontal ? '1' : '1.5'} bg-white/90 rounded${isHorizontal ? '' : '-lg'} shadow hover:bg-red-50`}
          >
            <Trash2 className="w-3 h-3 text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  // Context menu component
  const ContextMenuComponent = () => {
    if (!contextMenu) return null;
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
        <div 
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <p className="px-3 py-1 text-xs text-slate-500 font-medium">Bloquear fila</p>
          <button
            onClick={() => { onAddBreak(contextMenu.time, "break"); setContextMenu(null); }}
            className="w-full px-3 py-2 text-left hover:bg-yellow-50 flex items-center gap-2 text-sm"
          >
            <span>☕</span> Marcar como Recreo
          </button>
          <button
            onClick={() => { onAddBreak(contextMenu.time, "lunch"); setContextMenu(null); }}
            className="w-full px-3 py-2 text-left hover:bg-orange-50 flex items-center gap-2 text-sm"
          >
            <span>🍽️</span> Marcar como Almuerzo
          </button>
          <button
            onClick={() => { onAddBreak(contextMenu.time, "event"); setContextMenu(null); }}
            className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
          >
            <span>🎉</span> Marcar como Evento
          </button>
        </div>
      </>
    );
  };

  // Break row component
  const renderBreakRow = (time, breakItem) => {
    const breakTypeConfig = {
      break: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", icon: "☕" },
      lunch: { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", icon: "🍽️" },
      event: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", icon: "🎉" }
    }[breakItem.type] || { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800", icon: "⏸️" };
    
    return (
      <div key={time} className={`flex border-b ${breakTypeConfig.border} min-h-[64px] ${breakTypeConfig.bg}`}>
        <div className={`w-36 flex-shrink-0 px-2 py-2 border-r ${breakTypeConfig.border} sticky left-0 z-10 flex items-center justify-center ${breakTypeConfig.bg}`}>
          <span className={`text-xs font-medium ${breakTypeConfig.text}`}>{formatTimeRange(time)}</span>
        </div>
        <div 
          className="flex-1 flex items-center justify-center gap-3 px-4 cursor-pointer group"
          onClick={() => onEditBreak(breakItem)}
        >
          <span className="text-2xl">{breakTypeConfig.icon}</span>
          <span className={`font-bold text-lg ${breakTypeConfig.text}`}>{breakItem.label}</span>
          <span className={`text-sm ${breakTypeConfig.text} opacity-70`}>({breakItem.start_time} - {breakItem.end_time})</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteBreak(breakItem); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 bg-white rounded-lg shadow hover:bg-red-50 transition-all ml-2"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  // HORIZONTAL MODE
  if (viewMode === "horizontal") {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
        <ContextMenuComponent />

        {/* Header - Days */}
        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          <div className="w-36 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          {visibleDays.map(day => (
            <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[140px]">
              <p className="font-bold text-slate-800">{day.label}</p>
              <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
            </div>
          ))}
        </div>

        {/* Grid Body */}
        <div className="overflow-x-auto">
          {timeSlots.map((time) => {
            const breakItem = getBreakForSlot(time);
            const isBlocked = isTimeBlocked(time);
            
            if (breakItem) return renderBreakRow(time, breakItem);
            if (isBlocked) return null;
            
            return (
              <div key={time} className="flex border-b border-slate-100 min-h-[64px]">
                <div 
                  className="w-36 flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group relative"
                  data-testid={`schedule-time-slot-${time.replace(':', '')}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, time });
                  }}
                >
                  <span className="text-xs font-medium text-slate-600 text-center leading-tight">{formatTimeRange(time)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, time });
                    }}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 bg-white rounded shadow hover:bg-blue-50 transition-all"
                    title="Bloquear fila"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              
                {visibleDays.map(day => {
                  const slotSchedules = getSchedulesForSlot(day.id, time);
                  
                  return (
                    <div 
                      key={`${day.id}-${time}`}
                      data-testid={`schedule-cell-${day.id}-${time.replace(':', '')}`}
                      className="flex-1 min-w-[180px] border-r last:border-r-0 border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors p-1"
                      onClick={() => onCellClick(day.id, time)}
                    >
                      {slotSchedules.map(schedule => {
                        if (!scheduleStartsAtSlot(schedule, time)) return null;
                        return renderScheduleBlock(schedule, true);
                      })}
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

  // VERTICAL MODE
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200" data-testid="schedule-calendar-grid">
      {/* Header - Days */}
      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="w-20 flex-shrink-0 p-3 border-r border-slate-200 flex items-center justify-center">
          <Clock className="w-5 h-5 text-slate-400" />
        </div>
        {visibleDays.map(day => (
          <div key={day.id} data-testid={`schedule-day-header-${day.id}`} className="flex-1 p-3 text-center border-r last:border-r-0 border-slate-200 min-w-[120px]">
            <p className="font-bold text-slate-800">{day.label}</p>
            <p className="text-xs text-slate-500">{schedulesByDay[day.id].length} clases</p>
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="flex overflow-x-auto">
        {/* Time column */}
        <div className="w-20 flex-shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-10" data-testid="schedule-time-column">
          {timeSlots.map((time) => (
            <div 
              key={time} 
              className="h-16 px-2 flex items-start justify-center pt-1 border-b border-slate-100 text-xs font-medium text-slate-500"
              data-testid={`schedule-time-slot-${time.replace(':', '')}`}
            >
              {formatTime(time)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {visibleDays.map(day => (
          <div 
            key={day.id} 
            data-testid={`schedule-day-column-${day.id}`}
            className="flex-1 min-w-[160px] border-r last:border-r-0 border-slate-200 relative"
            style={{ height: `${timeSlots.length * 64}px` }}
          >
            {/* Hour lines */}
            {timeSlots.map((time, idx) => (
              <div 
                key={time}
                data-testid={`schedule-cell-${day.id}-${time.replace(':', '')}`}
                className="absolute w-full h-16 border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                style={{ top: `${idx * 64}px` }}
                onClick={() => onCellClick(day.id, time)}
              />
            ))}

            {/* Schedule blocks */}
            {schedulesByDay[day.id].map(schedule => renderScheduleBlock(schedule, false))}
          </div>
        ))}
      </div>
    </div>
  );
}
