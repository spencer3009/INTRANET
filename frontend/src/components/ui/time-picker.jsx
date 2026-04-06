import React, { useState, useRef } from "react";
import { Clock, X, ChevronUp, ChevronDown } from "lucide-react";

export function TimePicker({ value, onChange, label, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("hours");
  const [tempHour, setTempHour] = useState(7);
  const [tempMinute, setTempMinute] = useState(0);
  const [period, setPeriod] = useState("AM");
  const [minuteInput, setMinuteInput] = useState("00");
  const minuteRef = useRef(null);

  // Sync temp state from value ONLY when opening the picker
  const openPicker = () => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      setTempHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
      setTempMinute(m || 0);
      setMinuteInput((m || 0).toString().padStart(2, "0"));
      setPeriod(h >= 12 ? "PM" : "AM");
    } else {
      setTempHour(7);
      setTempMinute(0);
      setMinuteInput("00");
      setPeriod("AM");
    }
    setMode("hours");
    setIsOpen(true);
  };

  const formatDisplayTime = () => {
    if (!value) return "Seleccionar...";
    const [h, m] = value.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m.padStart(2, "0")} ${ampm}`;
  };

  const get24HourFormat = (hour, minute, ampm) => {
    let h = hour;
    if (ampm === "PM" && hour !== 12) h = hour + 12;
    if (ampm === "AM" && hour === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const handleHourClick = (hour) => {
    setTempHour(hour);
    setMode("minutes");
  };

  const handleMinuteClick = (minute) => {
    setTempMinute(minute);
    setMinuteInput(minute.toString().padStart(2, "0"));
  };

  const handleMinuteInputChange = (val) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 2);
    setMinuteInput(cleaned);
    const num = parseInt(cleaned);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setTempMinute(num);
    }
  };

  const handleMinuteInputBlur = () => {
    const num = parseInt(minuteInput);
    if (isNaN(num) || num < 0 || num > 59) {
      setMinuteInput(tempMinute.toString().padStart(2, "0"));
    } else {
      setTempMinute(num);
      setMinuteInput(num.toString().padStart(2, "0"));
    }
  };

  const nudgeMinute = (delta) => {
    const next = ((tempMinute + delta) % 60 + 60) % 60;
    setTempMinute(next);
    setMinuteInput(next.toString().padStart(2, "0"));
  };

  const nudgeHour = (delta) => {
    let next = tempHour + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    setTempHour(next);
  };

  const handleConfirm = () => {
    const time24 = get24HourFormat(tempHour, tempMinute, period);
    onChange(time24);
    setIsOpen(false);
  };

  const getPosition = (value, max, radius = 90) => {
    const angle = (value / max) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius + 110,
      y: Math.sin(rad) * radius + 110,
    };
  };

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const quickMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs text-slate-500 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => openPicker()}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-left"
      >
        <span className={value ? "text-slate-800" : "text-slate-400"}>
          {formatDisplayTime()}
        </span>
        <Clock className="w-5 h-5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/70 text-sm font-medium">Seleccionar hora</span>
                <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Editable time display with nudge arrows */}
              <div className="flex items-center justify-center gap-1 text-white">
                {/* Hour with arrows */}
                <div className="flex flex-col items-center">
                  <button onClick={() => nudgeHour(1)} className="text-white/50 hover:text-white p-0.5">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMode("hours")}
                    className={`text-5xl font-light transition-opacity ${mode === "hours" ? "opacity-100" : "opacity-50"}`}
                  >
                    {tempHour.toString().padStart(2, "0")}
                  </button>
                  <button onClick={() => nudgeHour(-1)} className="text-white/50 hover:text-white p-0.5">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-5xl font-light">:</span>

                {/* Minute with arrows + editable input */}
                <div className="flex flex-col items-center">
                  <button onClick={() => nudgeMinute(1)} className="text-white/50 hover:text-white p-0.5">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <input
                    ref={minuteRef}
                    type="text"
                    inputMode="numeric"
                    value={minuteInput}
                    onClick={() => setMode("minutes")}
                    onChange={(e) => handleMinuteInputChange(e.target.value)}
                    onBlur={handleMinuteInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") { e.preventDefault(); nudgeMinute(1); }
                      if (e.key === "ArrowDown") { e.preventDefault(); nudgeMinute(-1); }
                      if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
                    }}
                    className={`w-[72px] text-5xl font-light bg-transparent text-white text-center outline-none border-b-2 transition-all ${
                      mode === "minutes" ? "border-white opacity-100" : "border-transparent opacity-50"
                    }`}
                    maxLength={2}
                  />
                  <button onClick={() => nudgeMinute(-1)} className="text-white/50 hover:text-white p-0.5">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* AM/PM */}
                <div className="flex flex-col ml-3 gap-1">
                  <button
                    onClick={() => setPeriod("AM")}
                    className={`text-sm font-semibold px-2 py-0.5 rounded transition-all ${
                      period === "AM" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
                    }`}
                  >AM</button>
                  <button
                    onClick={() => setPeriod("PM")}
                    className={`text-sm font-semibold px-2 py-0.5 rounded transition-all ${
                      period === "PM" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
                    }`}
                  >PM</button>
                </div>
              </div>
            </div>

            {/* Clock / Minute grid */}
            <div className="p-4">
              {mode === "hours" ? (
                /* Clock face for hours */
                <div className="relative w-[220px] h-[220px] mx-auto">
                  <div className="absolute inset-0 rounded-full bg-slate-100" />
                  <div className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-blue-600" />
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 220">
                    <line
                      x1="110" y1="110"
                      x2={getPosition(hours.indexOf(tempHour), 12, 65).x}
                      y2={getPosition(hours.indexOf(tempHour), 12, 65).y}
                      stroke="#3B82F6" strokeWidth="2"
                    />
                  </svg>
                  {hours.map((hour, idx) => {
                    const pos = getPosition(idx, 12, 85);
                    return (
                      <button key={hour} onClick={() => handleHourClick(hour)}
                        className={`absolute w-9 h-9 -ml-4 -mt-4 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                          tempHour === hour ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
                        }`}
                        style={{ left: pos.x, top: pos.y }}
                      >{hour}</button>
                    );
                  })}
                </div>
              ) : (
                /* Minute grid - 5 min intervals + free input */
                <div>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {quickMinutes.map(m => (
                      <button key={m} onClick={() => handleMinuteClick(m)}
                        className={`py-2 rounded-lg text-sm font-medium transition-all ${
                          tempMinute === m
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >{m.toString().padStart(2, "0")}</button>
                    ))}
                  </div>
                  <p className="text-center text-xs text-slate-400">
                    Escribe cualquier minuto (0-59) en el campo de arriba
                  </p>
                </div>
              )}

              {/* Mode tabs */}
              <div className="flex justify-center gap-4 mt-4">
                <button onClick={() => setMode("hours")}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                    mode === "hours" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"
                  }`}>Horas</button>
                <button onClick={() => setMode("minutes")}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                    mode === "minutes" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"
                  }`}>Minutos</button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-4 pb-4">
              <button type="button" onClick={() => setIsOpen(false)}
                className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimePicker;
