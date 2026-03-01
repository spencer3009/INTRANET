import { useState } from "react";
import { Calendar, Filter, X } from "lucide-react";

function getDefaultDates() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, "0")}`
  };
}

export { getDefaultDates };

export default function AccountingDateFilter({ dateFrom, dateTo, onFilter, onClear }) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  const handleFilter = () => {
    onFilter(localFrom, localTo);
  };

  const handleClear = () => {
    const defaults = getDefaultDates();
    setLocalFrom(defaults.from);
    setLocalTo(defaults.to);
    onClear();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 justify-end" data-testid="date-range-filter">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400 hidden sm:block" />
        <span className="text-sm font-medium text-gray-500 hidden sm:block">Desde:</span>
        <input
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent"
          data-testid="date-from-input"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-500 hidden sm:block">Hasta:</span>
        <input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent"
          data-testid="date-to-input"
        />
      </div>
      <button
        onClick={handleFilter}
        className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2"
        data-testid="filter-btn"
      >
        <Filter className="w-4 h-4" />
        Filtrar
      </button>
      <button
        onClick={handleClear}
        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
        data-testid="clear-filter-btn"
      >
        <X className="w-4 h-4" />
        Limpiar
      </button>
    </div>
  );
}
