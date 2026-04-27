import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, Info } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatNumber = (n) =>
  Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ParentOptionalServices({ token, selectedChild }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedChild?.id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/parent-payments/available-concepts/${selectedChild.id}`, { headers });
      setConcepts(res.data.concepts || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al cargar servicios");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id, token]);

  useEffect(() => { load(); }, [load]);

  if (!selectedChild) return null;

  // Read-only view: show only active subscriptions (informative for the parent).
  const activeConcepts = concepts.filter(c => c.is_subscribed);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6" data-testid="parent-optional-services">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Servicios Opcionales</h3>
          <p className="text-xs text-slate-500">
            Cobros adicionales activados por el colegio para {selectedChild.name}
          </p>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : activeConcepts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Tu hijo(a) no tiene servicios opcionales activos por el momento.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Si deseas activar o desactivar algún servicio, comunícate con la administración del colegio.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConcepts.map((c) => (
              <div
                key={c.concept_id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50"
                data-testid={`optional-service-${c.concept_id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{c.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider">
                      Activo
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Cobro mensual de <span className="font-bold text-slate-700">S/ {formatNumber(c.amount)}</span>
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-400 pt-2 px-1 leading-relaxed">
              Estos cobros son administrados por el colegio. Si deseas modificar tu suscripción, comunícate con la administración.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
