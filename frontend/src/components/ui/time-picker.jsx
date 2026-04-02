import React, { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";

// Time Picker Component with circular clock design
export function TimePicker({ value, onChange, label, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("hours"); // "hours" or "minutes"
  const [tempHour, setTempHour] = useState(7);
  const [tempMinute, setTempMinute] = useState(0);
  const [period, setPeriod] = useState("AM");

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      setTempHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
      setTempMinute(m || 0);
      setPeriod(h >= 12 ? "PM" : "AM");
    }
  }, [value]);

  // Format display time
  const formatDisplayTime = () => {
    if (!value) return "Seleccionar...";
    const [h, m] = value.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m.padStart(2, "0")} ${ampm}`;
  };

  // Get 24h format
  const get24HourFormat = (hour, minute, ampm) => {
    let h = hour;
    if (ampm === "PM" && hour !== 12) h = hour + 12;
    if (ampm === "AM" && hour === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  // Handle hour click on clock
  const handleHourClick = (hour) => {
    setTempHour(hour);
    setMode("minutes");
  };

  // Handle minute click on clock
  const handleMinuteClick = (minute) => {
    setTempMinute(minute);
  };

  // Confirm selection
  const handleConfirm = () => {
    const time24 = get24HourFormat(tempHour, tempMinute, period);
    onChange(time24);
    setIsOpen(false);
  };

  // Calculate position on clock
  const getPosition = (value, max, radius = 90) => {
    const angle = (value / max) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius + 110,
      y: Math.sin(rad) * radius + 110,
    };
  };

  // Hours array (1-12)
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  
  // Minutes array (0, 5, 10, ... 55)
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs text-slate-500 mb-1">{label}</label>
      )}
      
      {/* Input trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-left"
      >
        <span className={value ? "text-slate-800" : "text-slate-400"}>
          {formatDisplayTime()}
        </span>
        <Clock className="w-5 h-5 text-slate-400" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/70 text-sm font-medium">Seleccionar hora</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Time Display */}
              <div className="flex items-center justify-center gap-1 text-white">
                <button
                  onClick={() => setMode("hours")}
                  className={`text-5xl font-light transition-opacity ${
                    mode === "hours" ? "opacity-100" : "opacity-50"
                  }`}
                >
                  {tempHour.toString().padStart(2, "0")}
                </button>
                <span className="text-5xl font-light">:</span>
                <button
                  onClick={() => setMode("minutes")}
                  className={`text-5xl font-light transition-opacity ${
                    mode === "minutes" ? "opacity-100" : "opacity-50"
                  }`}
                >
                  {tempMinute.toString().padStart(2, "0")}
                </button>
                
                {/* AM/PM */}
                <div className="flex flex-col ml-3 gap-1">
                  <button
                    onClick={() => setPeriod("AM")}
                    className={`text-sm font-semibold px-2 py-0.5 rounded transition-all ${
                      period === "AM"
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    onClick={() => setPeriod("PM")}
                    className={`text-sm font-semibold px-2 py-0.5 rounded transition-all ${
                      period === "PM"
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Clock Face */}
            <div className="p-4">
              <div className="relative w-[220px] h-[220px] mx-auto">
                {/* Clock background */}
                <div className="absolute inset-0 rounded-full bg-slate-100" />
                
                {/* Center dot */}
                <div className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-blue-600" />
                
                {/* Clock hand */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 220">
                  {mode === "hours" ? (
                    <line
                      x1="110"
                      y1="110"
                      x2={getPosition(hours.indexOf(tempHour), 12, 65).x}
                      y2={getPosition(hours.indexOf(tempHour), 12, 65).y}
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                  ) : (
                    <line
                      x1="110"
                      y1="110"
                      x2={getPosition(tempMinute, 60, 75).x}
                      y2={getPosition(tempMinute, 60, 75).y}
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                  )}
                </svg>

                {/* Hours or Minutes */}
                {mode === "hours" ? (
                  // Hour numbers
                  hours.map((hour, idx) => {
                    const pos = getPosition(idx, 12, 85);
                    const isSelected = tempHour === hour;
                    return (
                      <button
                        key={hour}
                        onClick={() => handleHourClick(hour)}
                        className={`absolute w-9 h-9 -ml-4 -mt-4 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
                        style={{ left: pos.x, top: pos.y }}
                      >
                        {hour}
                      </button>
                    );
                  })
                ) : (
                  // Minute numbers
                  minutes.map((minute, idx) => {
                    const pos = getPosition(idx, 12, 85);
                    const isSelected = tempMinute === minute;
                    return (
                      <button
                        key={minute}
                        onClick={() => handleMinuteClick(minute)}
                        className={`absolute w-9 h-9 -ml-4 -mt-4 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-200 text-slate-700"
                        }`}
                        style={{ left: pos.x, top: pos.y }}
                      >
                        {minute.toString().padStart(2, "0")}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Mode indicator */}
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={() => setMode("hours")}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                    mode === "hours"
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Horas
                </button>
                <button
                  onClick={() => setMode("minutes")}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                    mode === "minutes"
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Minutos
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
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
