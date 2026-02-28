import { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldOff, Clock, CalendarDays, CalendarClock } from "lucide-react";

function getSubscriptionState(expirationDate) {
  if (!expirationDate) return { status: "unknown", daysLeft: 0, hoursLeft: 0, minutesLeft: 0, percentage: 0 };

  const now = new Date();
  const exp = new Date(expirationDate);
  const diffMs = exp - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (daysLeft <= 0) return { status: "suspended", daysLeft: 0, hoursLeft: 0, minutesLeft: 0, percentage: 100 };
  if (daysLeft <= 5) return { status: "critical", daysLeft, hoursLeft, minutesLeft, percentage: 0 };
  if (daysLeft <= 10) return { status: "warning", daysLeft, hoursLeft, minutesLeft, percentage: 0 };
  return { status: "active", daysLeft, hoursLeft, minutesLeft, percentage: 0 };
}

function calcProgress(startDate, expirationDate) {
  if (!startDate || !expirationDate) return 0;
  const start = new Date(startDate);
  const end = new Date(expirationDate);
  const now = new Date();
  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

const THEME = {
  active: {
    bg: "bg-emerald-50", border: "border-emerald-200",
    bar: "bg-emerald-500", barBg: "bg-emerald-100",
    icon: Shield, iconColor: "text-emerald-600", iconBg: "bg-emerald-100",
    title: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700",
    badgeText: "Activo", countdown: "text-emerald-600",
  },
  warning: {
    bg: "bg-amber-50", border: "border-amber-200",
    bar: "bg-amber-500", barBg: "bg-amber-100",
    icon: ShieldAlert, iconColor: "text-amber-600", iconBg: "bg-amber-100",
    title: "text-amber-700", badge: "bg-amber-100 text-amber-700",
    badgeText: "Proximo a vencer", countdown: "text-amber-600",
  },
  critical: {
    bg: "bg-red-50", border: "border-red-200",
    bar: "bg-red-500", barBg: "bg-red-100",
    icon: ShieldAlert, iconColor: "text-red-600", iconBg: "bg-red-100",
    title: "text-red-700", badge: "bg-red-100 text-red-700",
    badgeText: "Vence muy pronto", countdown: "text-red-600",
  },
  suspended: {
    bg: "bg-slate-100", border: "border-slate-300",
    bar: "bg-slate-500", barBg: "bg-slate-200",
    icon: ShieldOff, iconColor: "text-slate-500", iconBg: "bg-slate-200",
    title: "text-slate-600", badge: "bg-red-900 text-white",
    badgeText: "Suspendido", countdown: "text-slate-500",
  },
};

export default function SubscriptionCard({ token }) {
  const [school, setSchool] = useState(null);
  const [state, setState] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
    fetch(`${API}/school-info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setSchool(data);
        setState(getSubscriptionState(data.expiration_date));
        setProgress(calcProgress(data.created_at, data.expiration_date));
      })
      .catch(() => {});
  }, [token]);

  // Update countdown every minute
  useEffect(() => {
    if (!school?.expiration_date) return;
    const interval = setInterval(() => {
      setState(getSubscriptionState(school.expiration_date));
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [school]);

  if (!school || !state) return null;

  const theme = THEME[state.status] || THEME.active;
  const Icon = theme.icon;

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className={`${theme.bg} ${theme.border} border rounded-2xl p-5 mb-6`} data-testid="subscription-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${theme.iconBg} rounded-xl flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${theme.iconColor}`} />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${theme.title}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
              Estado de Suscripcion
            </h3>
            {state.status === "warning" && (
              <p className="text-xs text-amber-600 mt-0.5">Su servicio esta proximo a vencer</p>
            )}
            {state.status === "critical" && (
              <p className="text-xs text-red-600 mt-0.5 font-medium">Su servicio vence muy pronto</p>
            )}
            {state.status === "suspended" && (
              <p className="text-xs text-slate-500 mt-0.5">Servicio suspendido por vencimiento</p>
            )}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${theme.badge}`}>
          {theme.badgeText}
        </span>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Fecha de inicio</p>
            <p className="text-xs font-semibold text-slate-700">{formatDate(school.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock className={`w-3.5 h-3.5 ${state.status === "active" ? "text-slate-400" : theme.iconColor}`} />
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Proximo pago</p>
            <p className={`text-xs font-semibold ${state.status === "active" ? "text-slate-700" : theme.title}`}>
              {formatDate(school.expiration_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Uso del periodo de servicio</span>
          <span className={`text-[10px] font-bold ${theme.title}`}>{progress}%</span>
        </div>
        <div className={`w-full h-2 ${theme.barBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${theme.bar} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Countdown */}
      {state.status !== "suspended" ? (
        <div className={`flex items-center gap-2 ${theme.countdown}`}>
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">
            Quedan: {state.daysLeft} dias, {state.hoursLeft} horas, {state.minutesLeft} minutos
          </span>
        </div>
      ) : (
        <div className="bg-slate-200/80 rounded-lg px-3 py-2 mt-1">
          <p className="text-xs text-slate-600 font-medium">
            Comuniquese con soporte para reactivacion.
          </p>
        </div>
      )}
    </div>
  );
}
