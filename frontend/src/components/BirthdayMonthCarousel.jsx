import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Gift, ChevronLeft, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AUTO_ADVANCE_MS = 4000;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * BirthdayMonthCarousel — compact widget to show upcoming birthdays for the
 * current calendar month (from today through month end). Designed to slot
 * inside the "Próximos Eventos" sidebar card on the admin dashboard.
 *
 * Data source: GET /api/birthdays/calendar?month=<m>&year=<y>&from_day=<d>
 * Business rules (who is included / excluded) live in the backend.
 *
 * Auto-advances every AUTO_ADVANCE_MS unless the user interacts with the
 * navigation arrows (or paginator dots), in which case auto-advance stops
 * for the session.
 */
export default function BirthdayMonthCarousel({ token, standalone = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const intervalRef = useRef(null);

  // Feature flag: read tenant-level birthday module flag from cached user.
  // Defaults to true for new/legacy tenants without the field.
  const moduleEnabled = useMemo(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage?.getItem("user") : null;
      if (!raw) return true;
      const u = JSON.parse(raw);
      return u?.birthday_module_enabled !== false;
    } catch (_) {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!token || !moduleEnabled) {
      setLoading(false);
      setItems([]);
      return;
    }
    let cancelled = false;
    const now = new Date();
    const params = {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
    setLoading(true);
    axios
      .get(`${API}/birthdays/calendar`, { headers: { Authorization: `Bearer ${token}` }, params })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(list);
        setIndex(0);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Ordering: by day ascending; on ties, students first then teachers (A-Z).
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.person_type !== b.person_type) {
        if (a.person_type === "student") return -1;
        if (b.person_type === "student") return 1;
      }
      return (a.name || "").localeCompare(b.name || "", "es");
    });
  }, [items]);

  const total = sorted.length;
  const hasNav = total > 1;
  const current = sorted[index];

  // Auto-advance
  useEffect(() => {
    if (!hasNav || autoPaused) return;
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(intervalRef.current);
  }, [hasNav, autoPaused, total]);

  const handlePrev = () => {
    setAutoPaused(true);
    setIndex((i) => (i - 1 + total) % total);
  };
  const handleNext = () => {
    setAutoPaused(true);
    setIndex((i) => (i + 1) % total);
  };
  const handleDot = (i) => {
    setAutoPaused(true);
    setIndex(i);
  };

  const today = new Date();
  const isToday = current && current.day === today.getDate() && current.month === today.getMonth() + 1;
  const dayLabel = current ? `${current.day} de ${MONTHS[current.month - 1]}` : "";
  const initial = (current?.name || "?").trim().charAt(0).toUpperCase();

  // Feature flag off -> render nothing (no section, no placeholder).
  if (!moduleEnabled) return null;

  return (
    <div
      className={standalone ? "bg-white rounded-xl border border-slate-200 shadow-sm p-6" : ""}
      data-testid="birthday-month-carousel"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center">
            <Gift className="w-4 h-4 text-pink-500" />
          </div>
          <h4 className="text-sm font-bold text-[#001f4b]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Cumpleaños del mes
          </h4>
        </div>
        {total > 0 && (
          <span className="text-[10px] text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full font-semibold">
            {total}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-24 rounded-xl bg-slate-50 animate-pulse" data-testid="birthday-month-skeleton" />
      ) : total === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3" data-testid="birthday-month-empty">
          Sin cumpleaños próximos este mes.
        </p>
      ) : (
        <>
          <div className="relative">
            <div
              className="bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 border border-pink-100 rounded-xl p-4"
              data-testid="birthday-month-card"
            >
              <div className="flex items-center gap-3">
                {current.avatar_url ? (
                  <img
                    src={current.avatar_url}
                    alt={current.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 via-rose-400 to-amber-400 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {initial}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate" data-testid="birthday-month-name">
                      {current.name}
                    </p>
                    {isToday && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider bg-pink-500 text-white px-1.5 py-0.5 rounded-full"
                        data-testid="birthday-month-today-badge"
                      >
                        🎂 ¡Hoy!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        current.person_type === "student"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {current.person_type === "student" ? "Alumno" : "Profesor"}
                    </span>
                    <span className="text-[11px] text-slate-500">{dayLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {hasNav && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
                  data-testid="birthday-month-prev"
                  aria-label="Cumpleaños anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
                  data-testid="birthday-month-next"
                  aria-label="Cumpleaños siguiente"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </>
            )}
          </div>

          {hasNav && (
            <div className="flex items-center justify-between mt-2.5">
              <span
                className="text-[10px] text-slate-400 font-medium tabular-nums"
                data-testid="birthday-month-counter"
              >
                {index + 1} / {total}
              </span>
              <div className="flex items-center gap-1">
                {sorted.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleDot(i)}
                    className={`h-1 rounded-full transition-all ${
                      i === index ? "w-4 bg-pink-500" : "w-1 bg-slate-300 hover:bg-slate-400"
                    }`}
                    aria-label={`Ir a ${i + 1}`}
                    data-testid={`birthday-month-dot-${i}`}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
