import { useState, useEffect } from "react";
import { Calendar, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getMonthRange(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, "0");
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(lastDay).padStart(2, "0")}` };
}

function getYearRange(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function getDefaultDates() {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth() + 1);
}

export { getDefaultDates };

export default function AccountingDateFilter({ dateFrom, dateTo, onFilter, onClear }) {
  const now = new Date();
  const [mode, setMode] = useState("month"); // month | day | year
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [dayFrom, setDayFrom] = useState(dateFrom);
  const [dayTo, setDayTo] = useState(dateTo);

  // When mode changes, auto-apply the range
  useEffect(() => {
    if (mode === "month") {
      const r = getMonthRange(selectedYear, selectedMonth);
      onFilter(r.from, r.to);
    } else if (mode === "year") {
      const r = getYearRange(selectedYear);
      onFilter(r.from, r.to);
    }
  }, [mode, selectedYear, selectedMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const handleDayFilter = () => {
    onFilter(dayFrom, dayTo);
  };

  const handleReset = () => {
    const n = new Date();
    setSelectedYear(n.getFullYear());
    setSelectedMonth(n.getMonth() + 1);
    setMode("month");
    const r = getMonthRange(n.getFullYear(), n.getMonth() + 1);
    setDayFrom(r.from);
    setDayTo(r.to);
    onClear();
  };

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="date-range-filter">
      {/* Mode buttons */}
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {[
          { key: "month", label: "Mes" },
          { key: "day", label: "Rango" },
          { key: "year", label: "Año" },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              mode === m.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            data-testid={`filter-mode-${m.key}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Month selector */}
      {mode === "month" && (
        <div className="flex items-center gap-1.5">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" data-testid="prev-month-btn">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[140px] text-center" data-testid="current-month-label">
            {MONTHS[selectedMonth - 1]} {selectedYear}
          </span>
          <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" data-testid="next-month-btn">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Day range selector */}
      {mode === "day" && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={dayFrom}
              onChange={(e) => setDayFrom(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              data-testid="date-from-input"
            />
          </div>
          <span className="text-xs text-gray-400 font-medium">a</span>
          <input
            type="date"
            value={dayTo}
            onChange={(e) => setDayTo(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            data-testid="date-to-input"
          />
          <button
            onClick={handleDayFilter}
            className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            data-testid="filter-btn"
          >
            <Filter className="w-3 h-3" />
            Filtrar
          </button>
        </div>
      )}

      {/* Year selector */}
      {mode === "year" && (
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSelectedYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" data-testid="prev-year-btn">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[60px] text-center" data-testid="current-year-label">
            {selectedYear}
          </span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" data-testid="next-year-btn">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={handleReset}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Restablecer"
        data-testid="clear-filter-btn"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
