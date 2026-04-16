import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Loader2, Zap, Calendar, DollarSign, Users, Check, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function GenerateBillingModal({ isOpen, onClose, token, onSuccess }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [mes, setMes] = useState(currentMonth);
  const [concepto, setConcepto] = useState("mensualidad");
  const [monto, setMonto] = useState(0);
  const [soloSinPago, setSoloSinPago] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [defaultMonto, setDefaultMonto] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!isOpen) return;
    setMes(currentMonth);
    setConcepto("mensualidad");
    setSoloSinPago(true);
    setPreview(null);
    loadInitialData();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && mes && concepto) loadPreview();
  }, [mes, concepto, isOpen]);

  const loadInitialData = async () => {
    try {
      const [settingsRes, conceptsRes] = await Promise.all([
        axios.get(`${API}/accounting/financial-settings`, { headers }),
        axios.get(`${API}/accounting/payment-concepts`, { headers }).catch(() => ({ data: [] })),
      ]);
      const pension = settingsRes.data?.pension_mensual || 0;
      setDefaultMonto(pension);
      setMonto(pension);
      setConcepts(Array.isArray(conceptsRes.data) ? conceptsRes.data.filter(c => c.status === "active") : []);
    } catch (err) {
      console.error("Error loading initial data:", err);
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/accounting/payments/generate-bulk/preview?mes=${mes}&concepto=${concepto}`,
        { headers }
      );
      setPreview(res.data);
    } catch (err) {
      console.error("Error loading preview:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConceptChange = (val) => {
    setConcepto(val);
    const found = concepts.find(c => c.name?.toLowerCase() === val.toLowerCase());
    if (found && found.amount > 0) {
      setMonto(found.amount);
    } else if (val === "mensualidad") {
      setMonto(defaultMonto);
    }
  };

  const handleGenerate = async () => {
    if (!monto || monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/accounting/payments/generate-bulk`, {
        mes,
        concepto,
        monto: parseFloat(monto),
        solo_sin_pago: soloSinPago,
      }, { headers });
      toast.success(res.data.message);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al generar cobranza");
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  const monthLabel = (() => {
    const [y, m] = mes.split("-");
    const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${names[parseInt(m) - 1] || m} ${y}`;
  })();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" data-testid="generate-billing-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <h3 className="text-lg font-bold">Generar cobranza del mes</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Month selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="w-4 h-4 inline mr-1.5 text-gray-400" />
              Mes a generar
            </label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
              data-testid="billing-month-input"
            />
          </div>

          {/* Concept selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Concepto</label>
            <select
              value={concepto}
              onChange={(e) => handleConceptChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
              data-testid="billing-concept-select"
            >
              <option value="mensualidad">Mensualidad</option>
              {concepts.filter(c => c.name?.toLowerCase() !== "mensualidad" && c.name?.toLowerCase() !== "matricula" && c.name?.toLowerCase() !== "matrisula").map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <DollarSign className="w-4 h-4 inline mr-1.5 text-gray-400" />
              Monto por alumno (S/)
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
              data-testid="billing-amount-input"
            />
          </div>

          {/* Solo sin pago checkbox */}
          <label className="flex items-center gap-3 cursor-pointer" data-testid="billing-solo-sin-pago">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${soloSinPago ? "bg-slate-700 border-slate-700" : "border-gray-300"}`}
              onClick={() => setSoloSinPago(!soloSinPago)}>
              {soloSinPago && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm text-gray-700">Solo alumnos sin pago registrado este mes</span>
          </label>

          {/* Preview */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">Calculando...</span>
            </div>
          ) : preview && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100" data-testid="billing-preview">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-slate-500" />
                <span>Alumnos activos: <strong>{preview.total_alumnos_activos}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Ya tienen pago este mes: <strong>{preview.ya_tienen_pago}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Se generaran: <strong className="text-lg">{preview.se_generarian}</strong> cuotas pendientes</span>
              </div>
              {preview.se_generarian > 0 && monto > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Total a cobrar: S/ {(preview.se_generarian * parseFloat(monto || 0)).toFixed(2)} ({monthLabel})
                </p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Las cuotas se crearan con estado "Pendiente". Puede ejecutar este proceso multiples veces sin duplicar.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !preview || preview.se_generarian === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl text-sm font-semibold hover:from-slate-800 hover:to-slate-900 transition-all shadow-md disabled:opacity-50"
            data-testid="billing-generate-btn"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? "Generando..." : `Generar ${preview?.se_generarian || 0} cuotas`}
          </button>
        </div>
      </div>
    </div>
  );
}
