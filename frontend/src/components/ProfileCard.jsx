import { useState, useEffect } from "react";
import { Crown, Shield, ShieldCheck, ShieldAlert, ShieldOff, Clock, CalendarDays, CalendarClock, CreditCard, Loader2 } from "lucide-react";
import PaymentBlockModal from "./PaymentBlockModal";

function DefaultAvatar({ name, size = "w-20 h-20", textSize = "text-2xl" }) {
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };
  
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#001f4b] to-[#003366] flex items-center justify-center text-white font-bold ${textSize} border-3 border-white shadow-md`}>
      {getInitials(name)}
    </div>
  );
}

const ROLE_DISPLAY_MAP = {
  owner: { label: "PROPIETARIO", colors: "bg-amber-100 text-amber-700 border-amber-200" },
  super_admin: { label: "SUPER ADMIN", colors: "bg-purple-100 text-purple-700 border-purple-200" },
  director: { label: "DIRECTOR", colors: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  admin: { label: "ADMINISTRADOR", colors: "bg-blue-100 text-blue-700 border-blue-200" },
  teacher: { label: "PROFESOR", colors: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  student: { label: "ALUMNO", colors: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  parent: { label: "PADRE", colors: "bg-orange-100 text-orange-700 border-orange-200" },
  profesor: { label: "PROFESOR", colors: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  alumno: { label: "ALUMNO", colors: "bg-cyan-100 text-cyan-700 border-cyan-200" },
};

function getRoleDisplay(role, isOwner, isSuperAdmin) {
  if (isOwner || role === "owner") return ROLE_DISPLAY_MAP.owner.label;
  if (isSuperAdmin || role === "super_admin") return ROLE_DISPLAY_MAP.super_admin.label;
  return ROLE_DISPLAY_MAP[role]?.label || role?.toUpperCase() || "USUARIO";
}

function getRoleBadgeColors(role, isOwner, isSuperAdmin) {
  if (isOwner || role === "owner") return ROLE_DISPLAY_MAP.owner.colors;
  if (isSuperAdmin || role === "super_admin") return ROLE_DISPLAY_MAP.super_admin.colors;
  return ROLE_DISPLAY_MAP[role]?.colors || "bg-slate-100 text-slate-600 border-slate-200";
}

function getSubState(expDate) {
  if (!expDate) return null;
  const now = new Date();
  const exp = new Date(expDate);
  const diffMs = exp - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return { id: "suspended", days: 0, label: "Suspendido", color: "text-red-600", bar: "bg-red-500", badge: "bg-red-600 text-white" };
  if (days <= 5) return { id: "critical", days, label: "Vence pronto", color: "text-red-600", bar: "bg-red-500", badge: "bg-red-50 text-red-700 ring-1 ring-red-200" };
  if (days <= 10) return { id: "warning", days, label: "Proximo a vencer", color: "text-amber-600", bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
  return { id: "active", days, label: "Activo", color: "text-emerald-600", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
}

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function ProfileCard({ user, stats, ownerStats, schoolName, token }) {
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Usuario";
  const userEmail = user?.email || "";
  const roleDisplay = getRoleDisplay(user?.role, user?.is_owner, user?.is_super_admin);
  const badgeColors = getRoleBadgeColors(user?.role, user?.is_owner, user?.is_super_admin);
  const isOwner = user?.is_owner || user?.role === "owner" || user?.is_support_session;
  const isAdmin = user?.role === "admin";
  const showSub = isOwner || isAdmin;

  const [school, setSchool] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  useEffect(() => {
    if (!showSub || !token) return;
    const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
    const hdrs = { Authorization: `Bearer ${token}` };
    fetch(`${API}/dashboard/school`, { headers: hdrs })
      .then(r => r.json())
      .then(d => setSchool(d))
      .catch(() => {});
    fetch(`${API}/membership/payment-status`, { headers: hdrs })
      .then(r => r.json())
      .then(d => { if (d.pending_request) setPendingRequest(d.pending_request); })
      .catch(() => {});
  }, [token, showSub]);

  const subState = school ? getSubState(school.expiration_date) : null;
  const p = school?.pricing;
  const progress = (() => {
    if (!school?.created_at || !school?.expiration_date) return 0;
    const s = new Date(school.created_at), e = new Date(school.expiration_date), n = new Date();
    const total = e - s;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(2, Math.round(((n - s) / total) * 100)));
  })();

  return (
    <>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center" data-testid="profile-card">
      <div className="relative w-20 h-20 mx-auto mb-3">
        {userPhoto ? (
          <>
            <img
              src={userPhoto}
              alt={userName}
              className="w-full h-full object-cover rounded-full border-3 border-white shadow-md"
              onError={(e) => { 
                e.target.style.display = 'none';
                e.target.nextSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden">
              <DefaultAvatar name={userName} />
            </div>
          </>
        ) : (
          <DefaultAvatar name={userName} />
        )}
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="En linea" />
      </div>

      {/* Role Badge */}
      <div className="mb-2 flex justify-center">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${badgeColors}`}>
          {(user?.is_owner || user?.role === "owner") && <Crown className="w-3 h-3" />}
          {(user?.is_super_admin || user?.role === "super_admin") && !user?.is_owner && user?.role !== "owner" && <Shield className="w-3 h-3" />}
          {roleDisplay}
        </span>
      </div>
      
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {userName}
      </h4>
      <p className="text-xs text-slate-500 mt-1">{userEmail}</p>
      {user?.username && (
        <p className="text-[10px] text-slate-400 mt-0.5">@{user.username}</p>
      )}

      {/* Nombre del colegio - solo propietario */}
      {isOwner && schoolName && (
        <p className="text-xs text-slate-400 mt-1.5">{schoolName}</p>
      )}

      {/* Subscription info for owner/admin */}
      {showSub && subState ? (
        <div className="mt-4 space-y-3 text-left" data-testid="subscription-card">
          {/* Status + Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-700">Suscripcion</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${subState.badge}`}>{subState.label}</span>
            </div>
          </div>
          {p && (
            <div className="flex items-center justify-end">
              <span className="text-base font-extrabold text-slate-800" data-testid="subscription-price">S/ {p.calculated_price?.toFixed(2)}</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${subState.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400">{progress}%</span>
          </div>

          {/* Dates + Countdown */}
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">{fmtDate(school.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">{fmtDate(school.expiration_date)}</span>
            </div>
          </div>

          {/* Countdown */}
          {subState.id !== "suspended" ? (
            <div className={`flex items-center justify-center gap-1 ${subState.color}`}>
              <Clock className="w-3 h-3" />
              <span className="text-xs font-semibold">{subState.days} dias restantes</span>
            </div>
          ) : (
            <p className="text-xs text-center text-slate-500 font-medium">Contacte soporte</p>
          )}

          {/* Payment button / pending badge */}
          {pendingRequest ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg" data-testid="payment-pending-indicator">
              <Loader2 className="w-3.5 h-3.5 text-yellow-600 animate-spin" />
              <span className="text-xs font-semibold text-yellow-700">Pago en verificacion</span>
            </div>
          ) : (
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-white transition-colors"
              style={{ backgroundColor: "#7B1FA2" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#6A1B8A"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#7B1FA2"}
              data-testid="pay-renewal-btn"
            >
              <img src="/yape_logo.png" alt="Yape" className="w-9 h-9 rounded" />
              <span className="text-sm">Pagar renovacion</span>
            </button>
          )}
        </div>
      ) : !showSub ? (
        /* Non-owner stats */
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats?.subjects || 0}</p>
            <p className="text-[11px] text-slate-500">Cursos</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{stats?.students || 0}</p>
            <p className="text-[11px] text-slate-500">Alumnos</p>
          </div>
        </div>
      ) : null}
    </div>

    {/* Payment Modal */}
    {showPayModal && (
      <PaymentBlockModal
        token={token}
        onClose={() => setShowPayModal(false)}
      />
    )}
    </>
  );
}
