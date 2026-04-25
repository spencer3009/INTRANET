import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, X, RefreshCw, Info } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatNumber = (n) =>
  Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ParentOptionalServices({ token, selectedChild, children }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [applyToAll, setApplyToAll] = useState({ concept: null, otherChildIds: [] });

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

  const handleToggle = async (concept) => {
    if (!selectedChild?.id) return;
    setSavingId(concept.concept_id);
    try {
      if (concept.is_subscribed) {
        await axios.delete(`${API}/parent-payments/concept-subscriptions/${selectedChild.id}/${concept.concept_id}`, { headers });
        toast.success("Servicio desactivado.");
        await load();
      } else {
        await axios.post(`${API}/parent-payments/concept-subscriptions/${selectedChild.id}/${concept.concept_id}`, {}, { headers });
        toast.success("Servicio activado. El cobro se generará a partir del próximo mes.");
        await load();
        // Si hay más hijos, ofrecer aplicar a los demás
        const otherChildren = (children || []).filter(c => c.id !== selectedChild.id);
        if (otherChildren.length > 0) {
          setApplyToAll({ concept, otherChildIds: otherChildren.map(c => c.id) });
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    } finally {
      setSavingId(null);
    }
  };

  const handleApplyToOtherChildren = async () => {
    const { concept, otherChildIds } = applyToAll;
    if (!concept || otherChildIds.length === 0) return;
    setSavingId(`bulk-${concept.concept_id}`);
    try {
      await Promise.all(
        otherChildIds.map(cid =>
          axios.post(`${API}/parent-payments/concept-subscriptions/${cid}/${concept.concept_id}`, {}, { headers })
        )
      );
      toast.success(`Servicio activado en ${otherChildIds.length} hijo(s) más.`);
      setApplyToAll({ concept: null, otherChildIds: [] });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al aplicar a otros hijos");
    } finally {
      setSavingId(null);
    }
  };

  const toggleChildInBulk = (cid) => {
    setApplyToAll(prev => {
      const exists = prev.otherChildIds.includes(cid);
      return {
        ...prev,
        otherChildIds: exists ? prev.otherChildIds.filter(id => id !== cid) : [...prev.otherChildIds, cid],
      };
    });
  };

  if (!selectedChild) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6" data-testid="parent-optional-services">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Servicios Opcionales</h3>
          <p className="text-xs text-slate-500">Activa o desactiva servicios mensuales para {selectedChild.name}</p>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : concepts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No hay servicios opcionales configurados por el colegio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {concepts.map((c) => (
              <div
                key={c.concept_id}
                className={`flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-colors ${
                  c.is_subscribed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
                }`}
                data-testid={`optional-service-${c.concept_id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{c.name}</p>
                    {c.is_subscribed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider">
                        Activo
                      </span>
                    )}
                    {c.activated_by === "admin" && c.is_subscribed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        Asignado por colegio
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Cobro mensual de <span className="font-bold text-slate-700">S/ {formatNumber(c.amount)}</span>
                  </p>
                  {!c.is_subscribed && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Al activar este servicio, se generará un cobro mensual de S/ {formatNumber(c.amount)} a partir del próximo mes.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(c)}
                  disabled={savingId === c.concept_id}
                  className={`shrink-0 relative w-14 h-8 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                    c.is_subscribed ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  data-testid={`optional-toggle-${c.concept_id}`}
                >
                  {savingId === c.concept_id ? (
                    <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-white" />
                  ) : (
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                      c.is_subscribed ? "translate-x-6" : "translate-x-0"
                    }`} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply to other children modal */}
      {applyToAll.concept && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setApplyToAll({ concept: null, otherChildIds: [] })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">¿Aplicar a otros hijos?</h3>
              <button onClick={() => setApplyToAll({ concept: null, otherChildIds: [] })} className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/20">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600">
                Has activado <strong>{applyToAll.concept.name}</strong> para {selectedChild.name}.
                ¿Deseas activarlo también para tus otros hijos?
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(children || []).filter(c => c.id !== selectedChild.id).map(child => (
                  <label key={child.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={applyToAll.otherChildIds.includes(child.id)}
                      onChange={() => toggleChildInBulk(child.id)}
                      className="w-4 h-4 accent-amber-600"
                      data-testid={`bulk-check-${child.id}`}
                    />
                    <span className="text-sm font-semibold text-slate-700">{child.name} {child.last_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setApplyToAll({ concept: null, otherChildIds: [] })}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                No, gracias
              </button>
              <button
                onClick={handleApplyToOtherChildren}
                disabled={applyToAll.otherChildIds.length === 0 || savingId?.startsWith("bulk-")}
                className="px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                data-testid="bulk-apply-btn"
              >
                {savingId?.startsWith("bulk-") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aplicar a {applyToAll.otherChildIds.length} hijo(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
