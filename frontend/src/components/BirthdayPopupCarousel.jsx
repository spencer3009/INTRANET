import { useState, useEffect, useRef } from "react";
import axios from "axios";
import confetti from "canvas-confetti";
import { ChevronLeft, ChevronRight, X, PartyPopper } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SESSION_KEY = "birthdays_popup_shown";

/**
 * BirthdayPopupCarousel
 *
 * Global welcome modal that greets the user when someone on the school
 * (students with active enrollment in the current school year, or any
 * teacher) has their birthday today. Parents are never shown.
 *
 * Shown ONCE per browser session (tracked via sessionStorage). Requires a
 * valid auth token — no-op for anonymous navigation.
 */
export default function BirthdayPopupCarousel({ token, user }) {
  const [people, setPeople] = useState([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Reset when the user logs out or changes
    if (!token || !user) {
      setVisible(false);
      setPeople([]);
      fetchedRef.current = false;
      return;
    }

    // Only show once per session
    if (typeof window !== "undefined" && window.sessionStorage?.getItem(SESSION_KEY)) {
      return;
    }

    // Guard against duplicate fetches during react strict mode / fast refresh
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;
    axios
      .get(`${API}/birthdays/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length === 0) return;
        setPeople(list);
        setIndex(0);
        setVisible(true);
      })
      .catch(() => {
        // Silent failure — this is a best-effort enhancement, not critical
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const handleClose = () => {
    setVisible(false);
    try {
      window.sessionStorage?.setItem(SESSION_KEY, "1");
    } catch (e) {
      /* storage disabled — safe to ignore */
    }
  };

  // Fire a celebratory confetti burst from both sides the first time the
  // popup becomes visible. Does NOT re-fire when the user navigates between
  // carousel cards (that's what the fired ref is for).
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      confettiFiredRef.current = false;
      return;
    }
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    const timer = setTimeout(() => {
      const colors = ["#EC4899", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6"];
      const commonOpts = {
        particleCount: 80,
        spread: 70,
        colors,
        shapes: ["square", "circle"],
        ticks: 200,
        // Sit above the modal backdrop (z-300) so the confetti is visible
        // and not dimmed by the background blur.
        zIndex: 400,
      };
      // Left burst
      confetti({ ...commonOpts, angle: 60, origin: { x: 0, y: 0.8 } });
      // Right burst
      confetti({ ...commonOpts, angle: 120, origin: { x: 1, y: 0.8 } });
    }, 300);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible || people.length === 0) return null;

  const current = people[index];
  const total = people.length;
  const hasNav = total > 1;
  const initial = (current?.name || "?").trim().charAt(0).toUpperCase();
  const roleLabel = current?.person_type === "student" ? "Alumno" : current?.person_type === "teacher" ? "Profesor" : "";

  const handlePrev = () => setIndex((i) => (i - 1 + total) % total);
  const handleNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      data-testid="birthday-popup-carousel"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti ribbon */}
        <div className="h-2 bg-gradient-to-r from-pink-400 via-rose-400 via-amber-300 to-violet-400" />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10"
          data-testid="birthday-popup-close"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Carousel body */}
        <div className="relative px-8 pt-8 pb-6 text-center">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 text-pink-500">
            <PartyPopper className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Cumpleaños</span>
          </div>

          {/* Avatar */}
          {current?.avatar_url ? (
            <img
              src={current.avatar_url}
              alt={current.name}
              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-pink-100 shadow-md"
              data-testid="birthday-popup-avatar"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 via-rose-400 to-amber-400 text-white text-3xl font-bold flex items-center justify-center mx-auto mb-4 shadow-md"
              data-testid="birthday-popup-avatar-initial"
            >
              {initial}
            </div>
          )}

          <p
            className="text-xl font-bold text-slate-800 leading-tight"
            style={{ fontFamily: "Manrope, sans-serif" }}
            data-testid="birthday-popup-name"
          >
            {current?.name}
          </p>

          {roleLabel && (
            <span
              className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mt-2 ${
                current.person_type === "student"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-indigo-100 text-indigo-700"
              }`}
              data-testid="birthday-popup-role"
            >
              {roleLabel}
            </span>
          )}

          <p className="text-lg font-semibold text-slate-700 mt-4">
            🎂 ¡Feliz cumpleaños!
          </p>
          <p className="text-sm text-slate-500 mt-1.5">
            Todo el equipo de EduNet te desea un día maravilloso.
          </p>

          {/* Nav arrows */}
          {hasNav && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow transition-all"
                data-testid="birthday-popup-prev"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow transition-all"
                data-testid="birthday-popup-next"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </>
          )}
        </div>

        {/* Position indicator + dots */}
        {hasNav && (
          <div className="px-6 pb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 tabular-nums" data-testid="birthday-popup-counter">
              {index + 1} / {total}
            </span>
            <div className="flex items-center gap-1.5">
              {people.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-pink-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Ir a ${i + 1}`}
                  data-testid={`birthday-popup-dot-${i}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            data-testid="birthday-popup-close-btn"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
