import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_BACKEND_URL;
const SubscriptionContext = createContext(null);

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export default function SubscriptionProvider({ token, children }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSub(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh every 5 minutes
  useEffect(() => {
    if (!token) return;
    const i = setInterval(refresh, 300000);
    return () => clearInterval(i);
  }, [token, refresh]);

  const isBlocked = sub?.plan_estado === "SUSPENDIDO" || sub?.plan_estado === "PAGO_OBLIGATORIO";
  const isRestricted = sub?.plan_estado === "RESTRICCION_PARCIAL";
  const showBanner = sub && !["ACTIVO", "PAGO_EN_VERIFICACION"].includes(sub.plan_estado) && sub.plan_estado;
  const isPendingVerification = sub?.plan_estado === "PAGO_EN_VERIFICACION";

  return (
    <SubscriptionContext.Provider value={{ sub, loading, refresh, isBlocked, isRestricted, showBanner, isPendingVerification }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
