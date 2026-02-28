import { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldOff, Clock, CalendarDays, CalendarClock } from "lucide-react";

function getState(expDate) {
  if (!expDate) return null;
  const now = new Date();
  const exp = new Date(expDate);
  const diffMs = exp - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  if (days <= 0) return { id: "suspended", days: 0, hours: 0, mins: 0 };
  if (days <= 5) return { id: "critical", days, hours, mins };
  if (days <= 10) return { id: "warning", days, hours, mins };
  return { id: "active", days, hours, mins };
}

function calcProgress(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end), n = new Date();
  const total = e - s;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((n - s) / total) * 100)));
}

const T = {
  active:    { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Activo", Icon: Shield, iconCls: "text-emerald-500", countdown: "text-slate-600" },
  warning:   { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",     label: "Proximo a vencer", Icon: ShieldAlert, iconCls: "text-amber-500", countdown: "text-amber-600" },
  critical:  { bar: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-1 ring-red-200",           label: "Vence pronto",     Icon: ShieldAlert, iconCls: "text-red-500", countdown: "text-red-600" },
  suspended: { bar: "bg-slate-400",   badge: "bg-slate-700 text-white",                               label: "Suspendido",       Icon: ShieldOff, iconCls: "text-slate-400", countdown: "text-slate-500" },
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function SubscriptionCard({ token }) {
  const [school, setSchool] = useState(null);
  const [state, setState] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
    fetch(`${API}/dashboard/school`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSchool(d); setState(getState(d.expiration_date)); setProgress(calcProgress(d.created_at, d.expiration_date)); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!school?.expiration_date) return;
    const i = setInterval(() => { setState(getState(school.expiration_date)); }, 60000);
    return () => clearInterval(i);
  }, [school]);

  if (!school || !state) return null;

  const t = T[state.id];
  const Icon = t.Icon;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl px-5 py-3.5 shadow-sm" data-testid="subscription-card">
      <div className="flex items-center gap-5 flex-wrap">
        {/* Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 ${t.iconCls} flex-shrink-0`} />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Suscripcion</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.badge} whitespace-nowrap`}>{t.label}</span>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-6 bg-slate-200" />

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">Inicio:</span>
            <span className="font-semibold text-slate-600">{fmtDate(school.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">Pago:</span>
            <span className="font-semibold text-slate-600">{fmtDate(school.expiration_date)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-6 bg-slate-200" />

        {/* Progress bar */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${t.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] font-bold text-slate-400 w-7 text-right">{progress}%</span>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-6 bg-slate-200" />

        {/* Countdown */}
        {state.id !== "suspended" ? (
          <div className={`flex items-center gap-1.5 ${t.countdown} whitespace-nowrap`}>
            <Clock className="w-3 h-3" />
            <span className="text-xs font-semibold">{state.days}d {state.hours}h {state.mins}m</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 font-medium">Contacte soporte</span>
        )}
      </div>
    </div>
  );
}
