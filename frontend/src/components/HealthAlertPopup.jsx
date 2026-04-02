import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, HeartPulse, CheckCircle, Loader2, Eye, Stethoscope, Brain } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const INCIDENT_LABELS = {
  dolor: "Dolor",
  golpe: "Golpe",
  fiebre: "Fiebre",
  malestar_general: "Malestar General",
  emergencia: "Emergencia",
  otro: "Otro",
};

const RECORD_TYPE_LABELS = {
  conductual: "Conductual",
  emocional: "Emocional",
  academico_relacionado: "Académico Relacionado",
  otro: "Otro",
};

const ALERT_COLORS = {
  alto: "bg-red-100 text-red-700 border-red-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  bajo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function HealthAlertPopup({ token, selectedChildId, childName }) {
  const [alerts, setAlerts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { subdomain } = useParams();

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token || !selectedChildId) return;
    setDismissed(false);
    setCurrentIndex(0);
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/health/parent/alerts?student_id=${selectedChildId}`, { headers });
        setAlerts(res.data.alerts || []);
      } catch (err) {
        console.error("Error loading health alerts:", err);
      }
    };
    load();
  }, [token, selectedChildId]);

  const current = alerts[currentIndex];

  const handleAcknowledge = async (navigateAfter = false) => {
    if (!current) return;
    setAcknowledging(true);
    try {
      await axios.post(
        `${API}/api/health/parent/alerts/${current.id}/acknowledge`,
        { type: current.alert_type },
        { headers }
      );
      const remaining = alerts.filter((_, i) => i !== currentIndex);
      setAlerts(remaining);
      if (remaining.length === 0) {
        setDismissed(true);
        if (navigateAfter) {
          const base = subdomain ? `/${subdomain}` : "";
          navigate(`${base}/parent/salud-bienestar`);
        }
      } else {
        setCurrentIndex(0);
        if (navigateAfter) {
          setDismissed(true);
          const base = subdomain ? `/${subdomain}` : "";
          navigate(`${base}/parent/salud-bienestar`);
        }
      }
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (dismissed || !current) return null;

  const isTopico = current.alert_type === "topico";
  const typeLabel = isTopico
    ? INCIDENT_LABELS[current.incident_type] || current.incident_type
    : RECORD_TYPE_LABELS[current.record_type] || current.record_type;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" data-testid="health-alert-popup">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Alerta de Salud y Bienestar</p>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Se ha registrado una incidencia para {childName || "su hijo/a"}
              </h2>
            </div>
          </div>
          {alerts.length > 1 && (
            <p className="text-xs text-white/70 mt-2">
              {currentIndex + 1} de {alerts.length} alertas pendientes
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Type badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isTopico ? "bg-blue-100" : "bg-purple-100"
            }`}>
              {isTopico ? (
                <Stethoscope className={`w-5 h-5 text-blue-600`} />
              ) : (
                <Brain className={`w-5 h-5 text-purple-600`} />
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {isTopico ? "Registro de Tópico" : "Registro de Psicología"}
              </p>
              <p className="text-xs text-slate-500">
                {current.date} a las {current.time}
              </p>
            </div>
            {!isTopico && current.alert_level && (
              <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold border ${ALERT_COLORS[current.alert_level] || "bg-slate-100 text-slate-600"}`}>
                {current.alert_level?.toUpperCase()}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                {isTopico ? "Tipo de Incidencia" : "Tipo de Registro"}
              </p>
              <p className="text-sm font-semibold text-slate-800">{typeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">
                {isTopico ? "Descripción" : "Motivo"}
              </p>
              <p className="text-sm text-slate-700">
                {isTopico ? current.description : current.reason}
              </p>
            </div>
            {isTopico && current.action_taken && (
              <div>
                <p className="text-xs text-slate-500 font-medium">Acción Tomada</p>
                <p className="text-sm text-slate-700">{current.action_taken}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 font-medium">Estado</p>
              <p className="text-sm font-medium text-slate-700">{current.status?.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => handleAcknowledge(false)}
            disabled={acknowledging}
            className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            data-testid="health-alert-acknowledge-btn"
          >
            {acknowledging ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Enterado
          </button>
          <button
            onClick={() => handleAcknowledge(true)}
            disabled={acknowledging}
            className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            data-testid="health-alert-view-btn"
          >
            {acknowledging ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
            Ver información completa
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
