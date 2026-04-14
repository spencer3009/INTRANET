import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  QrCode, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Keyboard, Camera, Users, Hand
} from "lucide-react";
import { toast } from "sonner";
import { getMovilidadPreferences } from "../../components/MovilidadSettingsModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SCAN_DEBOUNCE_MS = 1500;

export default function MovilidadScanner({ user, token }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const turnoId = searchParams.get("turno");

  // Load preferences from localStorage
  const prefs = getMovilidadPreferences() || {};
  const prefMode = prefs.modo_escaneo || "auto";
  const prefReadMode = prefs.modo_lectura || "continuo";
  const prefSounds = prefs.sonidos !== false;
  const prefVibration = prefs.vibracion !== false;

  const [turnoInfo, setTurnoInfo] = useState(null);
  const [mode, setMode] = useState(prefMode === "usb" ? "usb" : prefMode === "camara" ? "camera" : "auto");
  const [hasCamera, setHasCamera] = useState(false);
  const [totalTurno, setTotalTurno] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Manual mode: pending QR waiting for confirmation
  const [pendingQR, setPendingQR] = useState(null);

  const scannedSetRef = useRef(new Set());
  const debounceRef = useRef(false);
  const usbInputRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  // Detect camera availability
  useEffect(() => {
    (async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter(d => d.kind === "videoinput");
          setHasCamera(cams.length > 0);
          if (prefMode === "auto") {
            setMode(cams.length > 0 ? "camera" : "usb");
          }
        } else {
          if (prefMode !== "camara") setMode("usb");
        }
      } catch {
        if (prefMode !== "camara") setMode("usb");
      }
    })();
  }, []);

  // Load turno info
  useEffect(() => {
    if (!turnoId) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/movilidad/registro/dashboard`, { headers });
        const t = res.data.conteo_por_turno?.find(x => x.turno_id === turnoId);
        if (t) {
          setTurnoInfo(t);
          setTotalTurno(t.total);
        }
      } catch {}
    })();
  }, [turnoId]);

  // Keep USB input focused
  useEffect(() => {
    if (mode === "usb") {
      const interval = setInterval(() => {
        if (usbInputRef.current && document.activeElement !== usbInputRef.current) {
          usbInputRef.current.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const sendRegistro = useCallback(async (qrData) => {
    if (!qrData || !turnoId) return;

    // Local cache check
    if (scannedSetRef.current.has(qrData)) {
      toast.warning("Ya registrado", { duration: 2000 });
      addAlert("warning", "Ya registrado (cache local)");
      return;
    }

    try {
      const res = await axios.post(`${API}/movilidad/registro`, { qr_data: qrData, turno_id: turnoId }, { headers });
      const { estudiante, total_turno } = res.data;
      scannedSetRef.current.add(qrData);
      setTotalTurno(total_turno);
      setLastResult({ type: "success", name: estudiante.nombre, grado: estudiante.grado, seccion: estudiante.seccion });
      toast.success(`${estudiante.nombre} - ${estudiante.grado} ${estudiante.seccion}`, { duration: 3000 });
      playBeep(true);
      vibrate(true);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "Error desconocido";

      if (status === 409) {
        scannedSetRef.current.add(qrData);
        setLastResult({ type: "duplicate", name: detail });
      } else {
        setLastResult({ type: "error", name: detail });
      }
      toast.error(detail, { duration: 3000 });
      addAlert("error", detail);
      playBeep(false);
      vibrate(false);
    }
  }, [turnoId, token]);

  const processQR = useCallback((qrData) => {
    if (!qrData || !turnoId) return;
    const raw = qrData.trim();
    if (!raw) return;

    // Debounce
    if (debounceRef.current) return;
    debounceRef.current = true;
    setTimeout(() => { debounceRef.current = false; }, SCAN_DEBOUNCE_MS);

    if (prefReadMode === "manual") {
      // Manual mode: set pending and wait for button press
      setPendingQR(raw);
    } else {
      // Continuous mode: send immediately
      sendRegistro(raw);
    }
  }, [turnoId, prefReadMode, sendRegistro]);

  const confirmManualScan = () => {
    if (pendingQR) {
      sendRegistro(pendingQR);
      setPendingQR(null);
    }
  };

  const addAlert = (type, msg) => {
    setAlerts(prev => [{ type, msg, time: new Date().toLocaleTimeString("es-PE") }, ...prev].slice(0, 10));
  };

  const playBeep = (success) => {
    if (!prefSounds) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = success ? 880 : 330;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.15 : 0.3));
    } catch {}
  };

  const vibrate = (success) => {
    if (!prefVibration || !navigator.vibrate) return;
    try {
      navigator.vibrate(success ? 100 : [100, 50, 100]);
    } catch {}
  };

  const handleUSBInput = (e) => {
    if (e.key === "Enter") {
      const val = e.target.value.trim();
      e.target.value = "";
      if (val) processQR(val);
    }
  };

  const handleCameraScan = (detectedCodes) => {
    if (detectedCodes?.length > 0) {
      processQR(detectedCodes[0].rawValue);
    }
  };

  const goBack = () => {
    const basePath = subdomain ? `/${subdomain}/movilidad` : '/movilidad';
    navigate(basePath);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col" data-testid="movilidad-scanner">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" data-testid="movilidad-scanner-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold text-sm">Escaneo Movilidad</h1>
            <p className="text-slate-400 text-xs">{turnoInfo?.turno_nombre || "Cargando..."} ({turnoInfo?.hora_inicio} - {turnoInfo?.hora_fin})</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasCamera && (
            <button
              onClick={() => setMode(m => m === "camera" ? "usb" : "camera")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-lg text-slate-300 hover:text-white text-xs transition-colors"
              data-testid="movilidad-mode-toggle"
            >
              {mode === "camera" ? <Keyboard className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {mode === "camera" ? "USB" : "Camara"}
            </button>
          )}
          <div className="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5" data-testid="movilidad-scanner-count">
            <Users className="w-4 h-4" />
            {totalTurno}
          </div>
        </div>
      </header>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col">
        {/* Top half: scanner */}
        <div className="flex-1 flex items-center justify-center bg-slate-900 min-h-[300px] relative">
          {mode === "camera" ? (
            <div className="w-full max-w-md aspect-square relative">
              <Scanner
                onScan={handleCameraScan}
                onError={(err) => console.warn("Scanner error:", err)}
                formats={["qr_code"]}
                components={{ audio: false, torch: true }}
                styles={{ container: { width: "100%", height: "100%" } }}
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-purple-400/50 rounded-2xl" />
              </div>
            </div>
          ) : (
            <div className="text-center px-6" data-testid="movilidad-usb-mode">
              <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Keyboard className="w-12 h-12 text-purple-400" />
              </div>
              <p className="text-white font-bold text-lg mb-1">Modo Lector USB</p>
              <p className="text-slate-400 text-sm mb-6">Escanea el codigo con la pistola lectora</p>
              <div className="relative max-w-sm mx-auto">
                <input
                  ref={usbInputRef}
                  type="text"
                  autoFocus
                  onKeyDown={handleUSBInput}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="Esperando escaneo..."
                  data-testid="movilidad-usb-input"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom half: result + info */}
        <div className="bg-slate-800 border-t border-slate-700 p-4 space-y-4">
          {/* Manual mode: confirm button */}
          {prefReadMode === "manual" && pendingQR && (
            <button
              onClick={confirmManualScan}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-violet-500 text-white font-bold text-lg rounded-2xl shadow-lg flex items-center justify-center gap-3 animate-pulse"
              data-testid="movilidad-confirm-scan"
            >
              <Hand className="w-6 h-6" />
              Confirmar Lectura
            </button>
          )}

          {/* Last result */}
          {lastResult && (
            <div className={`p-4 rounded-xl ${
              lastResult.type === "success" ? "bg-violet-500/10 border border-violet-500/30" :
              "bg-red-500/10 border border-red-500/30"
            }`} data-testid="movilidad-last-result">
              <div className="flex items-center gap-3">
                {lastResult.type === "success" ? (
                  <CheckCircle2 className="w-6 h-6 text-violet-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-bold text-sm ${lastResult.type === "success" ? "text-violet-300" : "text-red-300"}`}>
                    {lastResult.name}
                  </p>
                  {lastResult.grado && (
                    <p className="text-xs text-slate-400">{lastResult.grado} {lastResult.seccion}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-700/50">
                  {a.type === "error" ? <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                  <span className="text-slate-400 flex-1 truncate">{a.msg}</span>
                  <span className="text-slate-600 font-mono">{a.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* Back button */}
          <button
            onClick={goBack}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            data-testid="movilidad-scanner-back-bottom"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
