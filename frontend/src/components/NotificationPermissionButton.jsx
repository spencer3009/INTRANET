import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission } from "../lib/firebase";

const API = process.env.REACT_APP_BACKEND_URL;

function detectPlatform() {
  const ua = (navigator.userAgent || "").toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "desktop";
}

const DENIED_INSTRUCTIONS = {
  android: "Ajustes de Android → Apps → El Roble (o el navegador) → Notificaciones → Activar. Luego vuelve aquí y pulsa \u201cActivar notificaciones\u201d.",
  ios: "Ajustes de iOS → [El Roble / Safari] → Notificaciones → Permitir. Luego vuelve aquí y pulsa \u201cActivar notificaciones\u201d.",
  desktop: "Haz clic en el candado 🔒 junto a la URL → Permisos del sitio → Notificaciones → Permitir. Luego recarga y pulsa \u201cActivar notificaciones\u201d.",
};

/**
 * Botón explícito para activar notificaciones desde un gesto del usuario.
 * Visible solo si el permiso aún NO es 'granted'. Registra el token FCM
 * únicamente tras conceder el permiso.
 */
export default function NotificationPermissionButton() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");
  const [busy, setBusy] = useState(false);
  const [showDenied, setShowDenied] = useState(false);

  // Mantener sincronizado el estado por si cambia desde Ajustes del SO.
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPerm(Notification.permission);
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [supported]);

  if (!supported) return null;
  if (perm === "granted") return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fcmToken = await requestNotificationPermission(); // pide permiso + getToken
      const current = Notification.permission;
      setPerm(current);

      if (current === "granted") {
        const authToken = localStorage.getItem("token");
        if (fcmToken && authToken) {
          try {
            await fetch(`${API}/api/notifications/register-device`, {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ fcm_token: fcmToken, platform: "web", user_agent: navigator.userAgent }),
            });
          } catch { /* registro best-effort */ }
        }
        toast.success("Notificaciones activadas ✓", { duration: 5000 });
      } else if (current === "denied") {
        setShowDenied(true);
      } else {
        toast.info("Permiso pendiente. Vuelve a pulsar y selecciona \u201cPermitir\u201d.", { duration: 6000 });
      }
    } catch (e) {
      toast.error("No se pudo solicitar el permiso de notificaciones.");
    } finally {
      setBusy(false);
    }
  };

  const platform = detectPlatform();

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors disabled:opacity-60"
        data-testid="enable-notifications-btn"
        title={`Estado del permiso: ${perm}`}
      >
        {busy ? <BellRing className="w-4 h-4 animate-pulse" /> : <Bell className="w-4 h-4" />}
        <span className="hidden sm:inline">Activar notificaciones</span>
        <span
          className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/70 text-amber-900"
          data-testid="notification-permission-status"
        >
          {perm}
        </span>
      </button>

      {showDenied && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          data-testid="notifications-denied-modal"
          onClick={() => setShowDenied(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500" /> Notificaciones bloqueadas
              </h3>
              <button onClick={() => setShowDenied(false)} className="text-slate-400 hover:text-slate-600" data-testid="close-denied-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Las notificaciones están <b>bloqueadas</b> en este dispositivo. No es posible reactivarlas
              por código una vez denegadas; debes habilitarlas manualmente:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
              {DENIED_INSTRUCTIONS[platform]}
            </div>
            <button
              onClick={() => setShowDenied(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#001f4b] text-white font-semibold hover:bg-[#003366] transition-colors"
              data-testid="denied-modal-ok"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
