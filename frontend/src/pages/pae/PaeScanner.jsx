import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  QrCode, ArrowLeft, Check, XCircle, AlertTriangle,
  Keyboard, Camera, Users, Hand, Volume2, VolumeX,
  SwitchCamera, X, Loader2, RefreshCw, Shield, ExternalLink, Settings
} from "lucide-react";
import { toast } from "sonner";
import { getPaePreferences } from "../../components/PaeSettingsModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SCAN_DEBOUNCE_MS = 1500;

const CAMERA_ERROR_TYPES = {
  NOT_SECURE: { title: "Conexion no segura", message: "La camara requiere una conexion segura (HTTPS)", icon: Shield, color: "amber", action: "openSecure" },
  PERMISSION_DENIED: { title: "Permiso denegado", message: "Activa los permisos de camara en tu navegador", icon: Settings, color: "red", action: "retry" },
  NOT_FOUND: { title: "Camara no encontrada", message: "No se detecto ninguna camara en este dispositivo", icon: Camera, color: "slate", action: "retry" },
  GENERIC: { title: "Error de camara", message: "No se pudo acceder a la camara", icon: X, color: "red", action: "retry" },
};

export default function PaeScanner({ user, token }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const turnoId = searchParams.get("turno");

  const prefs = getPaePreferences() || {};
  const prefReadMode = prefs.modo_lectura || "continuo";
  const prefSounds = prefs.sonidos !== false;
  const prefVibration = prefs.vibracion !== false;

  const [turnoInfo, setTurnoInfo] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [totalTurno, setTotalTurno] = useState(0);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [cameraError, setCameraError] = useState(null);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(prefSounds);
  const [scanToasts, setScanToasts] = useState([]);
  const [pendingQR, setPendingQR] = useState(null);

  const scannedSetRef = useRef(new Set());
  const debounceRef = useRef(false);
  const processingRef = useRef(false);
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    try { setIsInIframe(window.self !== window.top); } catch { setIsInIframe(true); }
    enumerateCameras();
  }, []);

  useEffect(() => {
    if (!turnoId) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/pae/registro/dashboard`, { headers });
        const t = res.data.conteo_por_turno?.find(x => x.turno_id === turnoId);
        if (t) { setTurnoInfo(t); setTotalTurno(t.total); }
      } catch {}
    })();
  }, [turnoId]);

  const enumerateCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(devices.filter(d => d.kind === "videoinput"));
    } catch {}
  };

  const requestCameraPermission = async () => {
    setCheckingCamera(true);
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError({ ...CAMERA_ERROR_TYPES.GENERIC, message: "Tu navegador no soporta acceso a la camara" });
        return false;
      }
      const isSecure = window.location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (!isSecure) { setCameraError(CAMERA_ERROR_TYPES.NOT_SECURE); return false; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing } });
      stream.getTracks().forEach(t => t.stop());
      await enumerateCameras();
      return true;
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        if (isInIframe) {
          setCameraError({ title: "Permiso bloqueado", message: "El navegador bloquea la camara en este contexto. Abre en ventana completa.", icon: ExternalLink, color: "blue", action: "breakIframe" });
        } else { setCameraError(CAMERA_ERROR_TYPES.PERMISSION_DENIED); }
      } else if (err.name === "NotFoundError") { setCameraError(CAMERA_ERROR_TYPES.NOT_FOUND); }
      else { setCameraError(CAMERA_ERROR_TYPES.GENERIC); }
      return false;
    } finally { setCheckingCamera(false); }
  };

  const startScanning = async () => {
    const ok = await requestCameraPermission();
    if (ok) setScanning(true);
  };

  const toggleCamera = () => setCameraFacing(p => p === "environment" ? "user" : "environment");

  const handleErrorAction = () => {
    if (!cameraError) return;
    if (cameraError.action === "breakIframe") {
      try { window.top.location.href = window.location.href; } catch { window.open(window.location.href, "_blank"); }
    } else if (cameraError.action === "openSecure" && window.location.protocol === "http:") {
      window.location.href = window.location.href.replace("http:", "https:");
    } else { setCameraError(null); startScanning(); }
  };

  const addScanToast = (type, data) => {
    const id = Date.now() + Math.random();
    setScanToasts(prev => [{ id, type, data, timestamp: Date.now() }, ...prev].slice(0, 3));
    setTimeout(() => setScanToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const playBeep = (success) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = success ? 880 : 330;
      gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + (success ? 0.15 : 0.3));
    } catch {}
  };

  const vibrate = (success) => {
    if (!prefVibration || !navigator.vibrate) return;
    try { navigator.vibrate(success ? 100 : [100, 50, 100]); } catch {}
  };

  const sendRegistro = useCallback(async (qrData) => {
    if (!qrData || !turnoId || processingRef.current) return;
    if (scannedSetRef.current.has(qrData)) {
      addScanToast("warning", { message: "Ya registrado" });
      playBeep(false);
      return;
    }
    processingRef.current = true;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/pae/registro`, { qr_data: qrData, turno_id: turnoId }, { headers });
      const { estudiante, total_turno } = res.data;
      scannedSetRef.current.add(qrData);
      setTotalTurno(total_turno);
      addScanToast("success", { student: { full_name: estudiante.nombre }, grado: estudiante.grado, seccion: estudiante.seccion });
      playBeep(true);
      vibrate(true);
    } catch (err) {
      const detail = err.response?.data?.detail || "Error desconocido";
      if (err.response?.status === 409) scannedSetRef.current.add(qrData);
      addScanToast("error", { message: detail });
      playBeep(false);
      vibrate(false);
    } finally { setLoading(false); processingRef.current = false; }
  }, [turnoId, token, soundEnabled]);

  const processQR = useCallback((qrData) => {
    if (!qrData || !turnoId) return;
    const raw = qrData.trim();
    if (!raw) return;
    if (debounceRef.current) return;
    debounceRef.current = true;
    setTimeout(() => { debounceRef.current = false; }, SCAN_DEBOUNCE_MS);
    if (prefReadMode === "manual") { setPendingQR(raw); }
    else { sendRegistro(raw); }
  }, [turnoId, prefReadMode, sendRegistro]);

  const confirmManualScan = () => { if (pendingQR) { sendRegistro(pendingQR); setPendingQR(null); } };

  const handleCameraScan = (detectedCodes) => {
    if (detectedCodes?.length > 0) processQR(detectedCodes[0].rawValue);
  };

  const handleCameraError = (err) => {
    console.error("Camera error:", err);
    setCameraError(CAMERA_ERROR_TYPES.GENERIC);
    setScanning(false);
  };

  const goBack = () => {
    const basePath = subdomain ? `/${subdomain}/pae` : "/pae";
    navigate(basePath);
  };

  // --- THEME: Orange/Amber ---
  const GRADIENT = "from-orange-500 to-amber-500";
  const BORDER_COLOR = "border-orange-400";
  const ACCENT_BG = "bg-orange-100";
  const ACCENT_TEXT = "text-orange-600";
  const ACCENT_HOVER = "hover:bg-orange-200";
  const BADGE_BG = "bg-orange-500/20";
  const BADGE_TEXT = "text-orange-300";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col" data-testid="pae-scanner">
      {/* Header */}
      <header className={`bg-gradient-to-r ${GRADIENT} px-4 py-3 flex items-center justify-between z-10 shadow-md`}>
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors" data-testid="pae-scanner-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold text-base">Escaneo Alimentacion</h1>
            <p className="text-white/70 text-xs">{turnoInfo?.turno_nombre || "Cargando..."} ({turnoInfo?.hora_inicio} - {turnoInfo?.hora_fin})</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-white/50" />}
          </button>
          <div className={`${BADGE_BG} ${BADGE_TEXT} px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5`} data-testid="pae-scanner-count">
            <Users className="w-4 h-4" />
            {totalTurno}
          </div>
        </div>
      </header>

      {/* Scanner Content */}
      <div className="flex-1 flex flex-col p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex-1 flex flex-col">
          <div className="p-5 flex-1 flex flex-col">
            {!scanning ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                {cameraError ? (
                  <div className="space-y-4 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                      cameraError.color === "amber" ? "bg-amber-100" :
                      cameraError.color === "red" ? "bg-red-100" :
                      cameraError.color === "blue" ? "bg-blue-100" : "bg-slate-100"
                    }`}>
                      {cameraError.icon && <cameraError.icon className={`w-10 h-10 ${
                        cameraError.color === "amber" ? "text-amber-600" :
                        cameraError.color === "red" ? "text-red-600" :
                        cameraError.color === "blue" ? "text-blue-600" : "text-slate-600"
                      }`} />}
                    </div>
                    <h4 className="text-xl font-bold text-slate-700">{cameraError.title}</h4>
                    <p className="text-slate-600 max-w-sm mx-auto">{cameraError.message}</p>
                    {cameraError.action === "retry" && (
                      <div className="bg-slate-50 rounded-xl p-4 text-left max-w-sm mx-auto">
                        <p className="text-sm font-medium text-slate-700 mb-2">Para activar la camara:</p>
                        <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                          <li>Haz clic en el icono de candado en la barra de direcciones</li>
                          <li>Selecciona "Permitir" en Camara</li>
                          <li>Recarga la pagina si es necesario</li>
                        </ol>
                      </div>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button onClick={handleErrorAction} disabled={checkingCamera}
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2">
                        {checkingCamera ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        {cameraError.action === "breakIframe" ? "Abrir en ventana completa" : "Reintentar"}
                      </button>
                      <button onClick={() => setCameraError(null)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`w-24 h-24 ${ACCENT_BG} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      <Camera className={`w-12 h-12 ${ACCENT_TEXT}`} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Camara desactivada</h4>
                    <p className="text-slate-500 mb-2 text-center">Activa la camara para escanear codigos QR</p>
                    {turnoInfo && (
                      <p className="text-sm text-orange-600 font-medium mb-6">
                        Turno: {turnoInfo.turno_nombre} ({turnoInfo.hora_inicio} - {turnoInfo.hora_fin})
                      </p>
                    )}
                    {isInIframe && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 max-w-sm">
                        <p className="text-sm text-blue-700 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          <span>Si la camara no funciona, prueba <button onClick={() => window.open(window.location.href, "_blank")} className="underline font-medium">abrir en ventana nueva</button></span>
                        </p>
                      </div>
                    )}
                    <button onClick={startScanning} disabled={checkingCamera} data-testid="pae-start-camera"
                      className={`px-8 py-3 bg-gradient-to-r ${GRADIENT} text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center gap-2 mx-auto disabled:opacity-50`}>
                      {checkingCamera ? <><Loader2 className="w-5 h-5 animate-spin" /> Verificando camara...</> : <><Camera className="w-5 h-5" /> Activar Camara</>}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                <p className="text-slate-600 text-center text-sm">
                  Escaneo continuo activo — los alumnos pueden pasar uno tras otro
                </p>

                {/* Manual mode confirm */}
                {prefReadMode === "manual" && pendingQR && (
                  <button onClick={confirmManualScan} data-testid="pae-confirm-scan"
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 animate-pulse">
                    <Hand className="w-5 h-5" /> Confirmar Lectura
                  </button>
                )}

                {/* Camera view */}
                <div className="relative w-full max-w-sm mx-auto">
                  <div className={`relative aspect-square rounded-2xl overflow-hidden border-4 ${BORDER_COLOR} shadow-lg`}>
                    <Scanner
                      key={cameraFacing}
                      onScan={handleCameraScan}
                      onError={handleCameraError}
                      formats={["qr_code", "aztec", "data_matrix"]}
                      constraints={{ facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } }}
                      scanDelay={500}
                      components={{ audio: false, torch: true, finder: true }}
                      styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
                    />
                    {loading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 pointer-events-none">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                      </div>
                    )}
                    {/* Floating toasts */}
                    <div className="absolute top-2 left-2 right-2 z-20 flex flex-col gap-2 pointer-events-none">
                      {scanToasts.map((t) => (
                        <div key={t.id} className={`rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
                          t.type === "success" ? "bg-emerald-600/90 text-white" :
                          t.type === "warning" ? "bg-amber-500/90 text-white" :
                          "bg-red-600/90 text-white"
                        }`} data-testid={`scan-toast-${t.type}`}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/20">
                            {t.type === "success" ? <Check className="w-4 h-4" /> :
                             t.type === "warning" ? <AlertTriangle className="w-4 h-4" /> :
                             <X className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm truncate">{t.data?.student?.full_name || t.data?.message || "Error"}</p>
                            <p className="text-xs opacity-80">
                              {t.type === "success" ? `${t.data?.grado || ""} ${t.data?.seccion || ""}` :
                               t.type === "warning" ? "Ya registrado" : "Error"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Corner guides */}
                  <div className="absolute inset-0 pointer-events-none p-1">
                    <div className="relative w-full h-full">
                      <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white/80 rounded-tl-xl"></div>
                      <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white/80 rounded-tr-xl"></div>
                      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white/80 rounded-bl-xl"></div>
                      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white/80 rounded-br-xl"></div>
                    </div>
                  </div>
                </div>

                {/* Control buttons */}
                <div className="flex justify-center gap-3">
                  {availableCameras.length > 1 && (
                    <button onClick={toggleCamera}
                      className={`px-4 py-2.5 ${ACCENT_BG} ${ACCENT_HOVER} rounded-xl ${ACCENT_TEXT} font-medium flex items-center gap-2 transition-colors`}>
                      <SwitchCamera className="w-4 h-4" />
                      {cameraFacing === "environment" ? "Frontal" : "Trasera"}
                    </button>
                  )}
                  <button onClick={() => setScanning(false)}
                    className="px-6 py-2.5 bg-red-100 hover:bg-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2 transition-colors">
                    <X className="w-4 h-4" /> Detener camara
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back button */}
        <button onClick={goBack} data-testid="pae-scanner-back-bottom"
          className="w-full mt-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
          <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
        </button>
      </div>
    </div>
  );
}
