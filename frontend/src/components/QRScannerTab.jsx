import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  QrCode, Camera, Check, AlertTriangle, X, Clock, 
  User, Loader2, History, RefreshCw, Volume2, VolumeX,
  Shield, ExternalLink, Settings, SwitchCamera, Ban,
  Zap, Hand, ListChecks
} from "lucide-react";
import { toast } from "sonner";
import { useScannerQueue } from "@/hooks/useScannerQueue";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SCAN_COOLDOWN = 30000; // 30 seconds cooldown per QR

// Camera error types and messages
const CAMERA_ERROR_TYPES = {
  NOT_SECURE: {
    title: "Conexión no segura",
    message: "La cámara requiere una conexión segura (HTTPS)",
    icon: Shield,
    color: "amber",
    action: "openSecure"
  },
  PERMISSION_DENIED: {
    title: "Permiso denegado",
    message: "Activa los permisos de cámara en tu navegador",
    icon: Settings,
    color: "red",
    action: "retry"
  },
  NOT_SUPPORTED: {
    title: "Entorno no soportado",
    message: "La cámara no funciona en este entorno (iframe/preview)",
    icon: ExternalLink,
    color: "blue",
    action: "openFullWindow"
  },
  NOT_FOUND: {
    title: "Cámara no encontrada",
    message: "No se detectó ninguna cámara en este dispositivo",
    icon: Camera,
    color: "slate",
    action: "retry"
  },
  GENERIC: {
    title: "Error de cámara",
    message: "No se pudo acceder a la cámara",
    icon: X,
    color: "red",
    action: "retry"
  }
};

export default function QRScannerTab({ token, roleFilter, user }) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [availableCameras, setAvailableCameras] = useState([]);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [scanMode, setScanMode] = useState("auto");
  const [annulModal, setAnnulModal] = useState(null);
  const [annulType, setAnnulType] = useState("both");
  const [annulReason, setAnnulReason] = useState("");
  const [annulling, setAnnulling] = useState(false);
  const [scanToasts, setScanToasts] = useState([]);

  const scannedCacheRef = useRef(new Map());
  const processingRef = useRef(false);

  const isAdmin = user?.is_owner || user?.role === "owner" || user?.role === "admin" || user?.role === "director";
  
  const headers = { Authorization: `Bearer ${token}` };

  // Check environment on mount - but DON'T block, just detect
  useEffect(() => {
    // Detect iframe (for informational purposes only)
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
    enumerateCameras();
  }, []);

  // Clean expired cache entries every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cache = scannedCacheRef.current;
      for (const [key, ts] of cache) {
        if (now - ts > SCAN_COOLDOWN) cache.delete(key);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Try to enumerate available cameras
  const enumerateCameras = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
    } catch (e) {
      console.log("Could not enumerate devices:", e);
    }
  };

  // Open in new window (break out of iframe)
  const openInNewWindow = () => {
    const currentUrl = window.location.href;
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  // Try to redirect parent to break out of iframe
  const breakOutOfIframe = () => {
    try {
      if (window.self !== window.top) {
        window.top.location.href = window.location.href;
      }
    } catch (e) {
      // Cross-origin, can't redirect parent - open new window instead
      openInNewWindow();
    }
  };

  // Request camera permission explicitly - ALWAYS TRY FIRST
  const requestCameraPermission = async () => {
    setCheckingCamera(true);
    setCameraError(null);
    
    try {
      // Check if mediaDevices API exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError({
          ...CAMERA_ERROR_TYPES.NOT_SUPPORTED,
          message: "Tu navegador no soporta acceso a la cámara"
        });
        return false;
      }
      
      // Check HTTPS (localhost is allowed)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        setCameraError(CAMERA_ERROR_TYPES.NOT_SECURE);
        return false;
      }
      
      // TRY TO GET CAMERA - Let the browser handle permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: cameraFacing } 
      });
      
      // SUCCESS! Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      
      // Enumerate cameras again after permission granted
      await enumerateCameras();
      
      return true;
    } catch (err) {
      console.error("Camera permission error:", err.name, err.message);
      
      // Determine the type of error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // Check if it might be an iframe issue (permission denied immediately)
        if (isInIframe) {
          setCameraError({
            title: "Permiso bloqueado por iframe",
            message: "El navegador bloquea la cámara en este contexto. Abre en ventana completa.",
            icon: ExternalLink,
            color: "blue",
            action: "breakIframe"
          });
        } else {
          setCameraError(CAMERA_ERROR_TYPES.PERMISSION_DENIED);
        }
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError(CAMERA_ERROR_TYPES.NOT_FOUND);
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError({
          ...CAMERA_ERROR_TYPES.GENERIC,
          title: "Cámara ocupada",
          message: "La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo."
        });
      } else if (err.name === 'SecurityError' || err.name === 'AbortError') {
        // SecurityError often means iframe restrictions
        if (isInIframe) {
          setCameraError({
            title: "Restricción de seguridad",
            message: "La cámara no puede usarse dentro de un iframe. Abre en ventana completa.",
            icon: ExternalLink,
            color: "blue",
            action: "breakIframe"
          });
        } else {
          setCameraError(CAMERA_ERROR_TYPES.NOT_SECURE);
        }
      } else if (err.name === 'OverconstrainedError') {
        setCameraError({
          ...CAMERA_ERROR_TYPES.NOT_FOUND,
          message: "No se encontró una cámara compatible con los requisitos"
        });
      } else {
        // Generic error - check if in iframe
        if (isInIframe) {
          setCameraError({
            title: "Error de acceso a cámara",
            message: "Puede ser una restricción del iframe. Intenta abrir en ventana completa.",
            icon: Camera,
            color: "amber",
            action: "breakIframe"
          });
        } else {
          setCameraError(CAMERA_ERROR_TYPES.GENERIC);
        }
      }
      
      return false;
    } finally {
      setCheckingCamera(false);
    }
  };

  // Start scanning
  const startScanning = async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setScanning(true);
    }
  };

  // Toggle camera (front/back)
  const toggleCamera = () => {
    setCameraFacing(prev => prev === "environment" ? "user" : "environment");
  };

  // Handle action button in error state
  const handleErrorAction = () => {
    if (!cameraError) return;
    
    switch (cameraError.action) {
      case "openSecure":
        // Try to redirect to HTTPS
        if (window.location.protocol === 'http:') {
          window.location.href = window.location.href.replace('http:', 'https:');
        }
        break;
      case "breakIframe":
        // Try to break out of iframe first, then open new window as fallback
        breakOutOfIframe();
        break;
      case "openFullWindow":
        // Open in new window
        openInNewWindow();
        break;
      case "retry":
      default:
        setCameraError(null);
        startScanning();
        break;
    }
  };

  // Load scan history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const roleParam = roleFilter ? `&role=${roleFilter}` : "";
      const res = await axios.get(`${API}/attendance/qr/history?limit=10${roleParam}`, { headers });
      setHistory(res.data.history || []);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Play success/error sound
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === "success") {
        oscillator.frequency.value = 880; // A5
        gainNode.gain.value = 0.3;
      } else if (type === "warning") {
        oscillator.frequency.value = 440; // A4
        gainNode.gain.value = 0.2;
      } else if (type === "queued") {
        // pip suave y corto para distinguir del beep de éxito
        oscillator.frequency.value = 660; // E5
        gainNode.gain.value = 0.12;
      } else {
        oscillator.frequency.value = 220; // A3
        gainNode.gain.value = 0.2;
      }
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), type === "queued" ? 70 : 150);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  // Add a scan toast (max 3 visible, auto-dismiss after 3s)
  const addScanToast = (type, data) => {
    const id = Date.now() + Math.random();
    setScanToasts(prev => {
      const next = [{ id, type, data, timestamp: Date.now() }, ...prev];
      return next.slice(0, 3);
    });
    setTimeout(() => {
      setScanToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Procesa un QR (llamada al backend). Es el callback del hook de cola.
  const processQR = useCallback(async (qrToken) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/attendance/qr/scan`, { qr_token: qrToken, mode: scanMode }, { headers });
      const data = res.data;

      if (data.status === "success") {
        playSound("success");
        addScanToast("success", data);
      } else if (data.status === "already_marked") {
        playSound("warning");
        addScanToast("warning", data);
      } else if (data.status === "error") {
        playSound("error");
        addScanToast("error", data);
      }
      loadHistory();
    } catch (err) {
      const errorData = err.response?.data?.detail;
      const msg = typeof errorData === 'object' ? (errorData.message || "Error al escanear") : (errorData || "Error al escanear el QR");
      playSound("error");
      addScanToast("error", { message: msg });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, token]);

  // Cola FIFO de escaneos — evita perder QRs cuando llegan varios alumnos rápido
  const { mode: queueMode, setMode: setQueueMode, queueSize, processing: queueProcessing, enqueue, processNext, clear: clearQueue } = useScannerQueue({
    onProcess: processQR,
    cooldownMs: 30000,
    onEnqueued: (_t, size) => {
      // Pip suave solo si quedan más detrás esperando turno
      if (size > 1) playSound("queued");
    },
  });

  // Handler que recibe la cámara — solo encola
  const handleScan = (detectedCodes) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const qrToken = detectedCodes[0]?.rawValue;
    if (qrToken) enqueue(qrToken);
  };

  // Reset scanner (used only for error dismissal now)
  const handleScanAnother = () => {
    setError(null);
  };

  // Annul attendance
  const openAnnulModal = (item) => {
    setAnnulModal(item);
    setAnnulType("both");
    setAnnulReason("");
  };

  const handleAnnul = async () => {
    if (!annulModal || !annulReason.trim()) return;
    setAnnulling(true);
    try {
      await axios.post(`${API}/attendance/${annulModal.attendance_id}/annul`, {
        annul_type: annulType,
        reason: annulReason.trim(),
      }, { headers });
      toast.success("Asistencia anulada correctamente");
      setAnnulModal(null);
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al anular");
    } finally {
      setAnnulling(false);
    }
  };


  const handleError = (err) => {
    console.error("Camera error:", err);
    
    // Parse the error
    const errorMessage = err?.message || err?.toString() || "";
    
    if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed')) {
      setCameraError(CAMERA_ERROR_TYPES.PERMISSION_DENIED);
    } else if (errorMessage.includes('NotFound') || errorMessage.includes('no camera')) {
      setCameraError(CAMERA_ERROR_TYPES.NOT_FOUND);
    } else if (errorMessage.includes('Secure') || errorMessage.includes('HTTPS')) {
      setCameraError(CAMERA_ERROR_TYPES.NOT_SECURE);
    } else {
      setCameraError(CAMERA_ERROR_TYPES.GENERIC);
    }
    
    setScanning(false);
  };

  return (
    <div className="space-y-6" data-testid="qr-scanner-tab">
      {/* Scanner Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Escanear QR</h3>
                  <p className="text-white/70 text-sm">Registra asistencia con código QR</p>
                </div>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
                data-testid="toggle-sound-btn"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white/50" />
                )}
              </button>
            </div>

            {/* Toggle Auto / Manual entre escaneos */}
            <div className="mt-3 flex items-center gap-2" data-testid="scan-queue-mode-selector">
              <span className="text-xs text-white/70 font-medium">Modo:</span>
              <div className="bg-white/10 rounded-lg p-0.5 inline-flex">
                <button
                  onClick={() => setQueueMode("auto")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    queueMode === "auto" ? "bg-white text-violet-700" : "text-white/80 hover:text-white"
                  }`}
                  data-testid="queue-mode-auto"
                  title="Escaneo continuo: si llegan varios alumnos, se encolan y procesan uno por uno automáticamente"
                >
                  <Zap className="w-3.5 h-3.5" /> Auto
                </button>
                <button
                  onClick={() => setQueueMode("manual")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    queueMode === "manual" ? "bg-white text-violet-700" : "text-white/80 hover:text-white"
                  }`}
                  data-testid="queue-mode-manual"
                  title="Escaneo paso a paso: cada alumno requiere confirmación con botón"
                >
                  <Hand className="w-3.5 h-3.5" /> Manual
                </button>
              </div>
              {queueSize > 0 && (
                <span
                  className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                  data-testid="scan-queue-counter"
                  title={`${queueSize} escaneo${queueSize === 1 ? "" : "s"} en cola`}
                >
                  <ListChecks className="w-3 h-3" /> {queueSize} en cola
                </span>
              )}
            </div>
            {/* Scan Mode Selector */}
            <div className="flex gap-2 mt-3" data-testid="scan-mode-selector">
              {[
                { id: "auto", label: "Automático" },
                { id: "entry", label: "Solo Entrada" },
                { id: "exit", label: "Solo Salida" }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setScanMode(mode.id)}
                  data-testid={`scan-mode-${mode.id}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    scanMode === mode.id
                      ? "bg-white text-violet-700"
                      : "bg-white/20 text-white/80 hover:bg-white/30"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-6">
            {!scanning ? (
              <div className="text-center py-12">
                {cameraError ? (
                  // Camera Error State
                  <div className="space-y-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                      cameraError.color === 'amber' ? 'bg-amber-100' :
                      cameraError.color === 'red' ? 'bg-red-100' :
                      cameraError.color === 'blue' ? 'bg-blue-100' :
                      'bg-slate-100'
                    }`}>
                      {cameraError.icon && <cameraError.icon className={`w-10 h-10 ${
                        cameraError.color === 'amber' ? 'text-amber-600' :
                        cameraError.color === 'red' ? 'text-red-600' :
                        cameraError.color === 'blue' ? 'text-blue-600' :
                        'text-slate-600'
                      }`} />}
                    </div>
                    <div>
                      <h4 className={`text-xl font-bold mb-2 ${
                        cameraError.color === 'amber' ? 'text-amber-700' :
                        cameraError.color === 'red' ? 'text-red-700' :
                        cameraError.color === 'blue' ? 'text-blue-700' :
                        'text-slate-700'
                      }`}>{cameraError.title}</h4>
                      <p className="text-slate-600 mb-6 max-w-sm mx-auto">{cameraError.message}</p>
                    </div>
                    
                    {/* Instructions for permission denied */}
                    {cameraError.action === "retry" && (
                      <div className="bg-slate-50 rounded-xl p-4 mb-4 text-left max-w-sm mx-auto">
                        <p className="text-sm font-medium text-slate-700 mb-2">Para activar la cámara:</p>
                        <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                          <li>Haz clic en el ícono de candado/cámara en la barra de direcciones</li>
                          <li>Selecciona "Permitir" en Cámara</li>
                          <li>Recarga la página si es necesario</li>
                        </ol>
                      </div>
                    )}
                    
                    {/* Instructions for iframe issues */}
                    {cameraError.action === "breakIframe" && (
                      <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left max-w-sm mx-auto">
                        <p className="text-sm font-medium text-blue-700 mb-2">¿Por qué ocurre esto?</p>
                        <p className="text-sm text-blue-600 mb-2">
                          Los navegadores modernos bloquean el acceso a la cámara dentro de ciertos contextos (iframes) por seguridad.
                        </p>
                        <p className="text-sm text-blue-600">
                          Al abrir en ventana completa, la cámara funcionará correctamente.
                        </p>
                      </div>
                    )}
                    
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button
                        onClick={handleErrorAction}
                        disabled={checkingCamera}
                        className={`px-6 py-3 text-white rounded-xl font-semibold transition-all flex items-center gap-2 ${
                          cameraError.color === 'amber' ? 'bg-amber-500 hover:bg-amber-600' :
                          cameraError.color === 'red' ? 'bg-red-500 hover:bg-red-600' :
                          cameraError.color === 'blue' ? 'bg-blue-500 hover:bg-blue-600' :
                          'bg-slate-500 hover:bg-slate-600'
                        }`}
                      >
                        {checkingCamera ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : cameraError.action === "breakIframe" || cameraError.action === "openFullWindow" ? (
                          <ExternalLink className="w-5 h-5" />
                        ) : cameraError.action === "openSecure" ? (
                          <Shield className="w-5 h-5" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                        {cameraError.action === "breakIframe" ? "Abrir en ventana completa" :
                         cameraError.action === "openFullWindow" ? "Abrir en ventana nueva" :
                         cameraError.action === "openSecure" ? "Ir a versión segura" : 
                         "Reintentar"}
                      </button>
                      
                      <button
                        onClick={() => setCameraError(null)}
                        className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Initial State - No error
                  <>
                    <div className="w-24 h-24 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-12 h-12 text-violet-600" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Cámara desactivada</h4>
                    <p className="text-slate-500 mb-4">Activa la cámara para escanear códigos QR de estudiantes y profesores</p>
                    
                    {/* Camera count indicator */}
                    {availableCameras.length > 0 && (
                      <p className="text-sm text-slate-400 mb-4">
                        {availableCameras.length} cámara{availableCameras.length !== 1 ? 's' : ''} detectada{availableCameras.length !== 1 ? 's' : ''}
                      </p>
                    )}
                    
                    {/* Iframe warning - informational only, doesn't block */}
                    {isInIframe && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 max-w-sm mx-auto">
                        <p className="text-sm text-blue-700 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          <span>Si la cámara no funciona, prueba <button onClick={openInNewWindow} className="underline font-medium">abrir en ventana nueva</button></span>
                        </p>
                      </div>
                    )}
                    
                    <button
                      data-testid="start-scanner-btn"
                      onClick={startScanning}
                      disabled={checkingCamera}
                      className="px-8 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-purple-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                      {checkingCamera ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verificando cámara...
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          Activar Cámara
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <>
                  {/* Camera container - centered with better visual guides */}
                  <div className="flex flex-col items-center">
                    {/* Instructions */}
                    <p className="text-slate-600 text-center mb-4">
                      Escaneo continuo activo — los alumnos pueden pasar uno tras otro
                    </p>
                    
                    {/* Camera view */}
                    <div className="relative w-full max-w-sm mx-auto">
                      {/* Scanner container */}
                      <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-violet-500 shadow-lg">
                        <Scanner
                          key={cameraFacing}
                          onScan={handleScan}
                          onError={handleError}
                          formats={["qr_code", "aztec", "data_matrix"]}
                          constraints={{
                            facingMode: cameraFacing,
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                          }}
                          scanDelay={500}
                          components={{
                            audio: false,
                            torch: true,
                            finder: true
                          }}
                          styles={{
                            container: { width: '100%', height: '100%' },
                            video: { objectFit: 'cover' }
                          }}
                        />
                        
                        {/* Processing overlay - brief flash */}
                        {loading && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 pointer-events-none">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                          </div>
                        )}

                        {/* Modo manual: overlay que indica que el escaneo está pausado */}
                        {queueMode === "manual" && !queueProcessing && (
                          <div className="absolute top-2 left-2 right-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 z-10 pointer-events-none shadow-sm">
                            <Hand className="w-3.5 h-3.5" /> Modo manual {queueSize > 0 ? `· ${queueSize} en cola` : "· acerca un QR para encolar"}
                          </div>
                        )}

                        {/* Floating toasts over camera */}
                        <div className="absolute top-2 left-2 right-2 z-20 flex flex-col gap-2 pointer-events-none">
                          {scanToasts.map((t) => (
                            <div
                              key={t.id}
                              className={`rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
                                t.type === "success" ? "bg-emerald-600/90 text-white" :
                                t.type === "warning" ? "bg-amber-500/90 text-white" :
                                "bg-red-600/90 text-white"
                              }`}
                              data-testid={`scan-toast-${t.type}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                t.type === "success" ? "bg-white/20" :
                                t.type === "warning" ? "bg-white/20" : "bg-white/20"
                              }`}>
                                {t.type === "success" ? <Check className="w-4 h-4" /> :
                                 t.type === "warning" ? <AlertTriangle className="w-4 h-4" /> :
                                 <X className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm truncate">
                                  {t.data?.student?.full_name || t.data?.message || "Error"}
                                </p>
                                <p className="text-xs opacity-80">
                                  {t.type === "success"
                                    ? (t.data?.action === "exit" ? "Salida registrada" : "Entrada registrada")
                                    : t.type === "warning" ? "Ya registrado"
                                    : "Error"}
                                  {t.data?.attendance?.entry_time && ` · ${t.data.attendance.entry_time}`}
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
                  </div>
                  
                  {/* Control buttons */}
                  <div className="flex justify-center flex-wrap gap-3">
                    {/* Botón Escanear siguiente — visible solo en modo manual */}
                    {queueMode === "manual" && (
                      <button
                        onClick={processNext}
                        disabled={queueProcessing || queueSize === 0}
                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl text-white font-semibold flex items-center gap-2 transition-colors shadow-md"
                        data-testid="scan-next-btn"
                        title={queueSize === 0 ? "No hay QRs en cola" : `Procesar siguiente (${queueSize} en cola)`}
                      >
                        {queueProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hand className="w-4 h-4" />}
                        {queueProcessing ? "Procesando..." : queueSize > 0 ? `Escanear siguiente (${queueSize})` : "Escanear siguiente"}
                      </button>
                    )}
                    {queueSize > 1 && (
                      <button
                        onClick={clearQueue}
                        className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 rounded-xl text-amber-700 font-medium flex items-center gap-2 transition-colors"
                        data-testid="clear-queue-btn"
                        title="Vaciar la cola de escaneos pendientes"
                      >
                        <X className="w-4 h-4" /> Vaciar cola
                      </button>
                    )}
                    {availableCameras.length > 1 && (
                      <button
                        onClick={toggleCamera}
                        className="px-4 py-2.5 bg-violet-100 hover:bg-violet-200 rounded-xl text-violet-700 font-medium flex items-center gap-2 transition-colors"
                        title={cameraFacing === "environment" ? "Cambiar a cámara frontal" : "Cambiar a cámara trasera"}
                      >
                        <SwitchCamera className="w-4 h-4" />
                        {cameraFacing === "environment" ? "Frontal" : "Trasera"}
                      </button>
                    )}
                    
                    <button
                      onClick={() => setScanning(false)}
                      className="px-6 py-2.5 bg-red-100 hover:bg-red-200 rounded-xl text-red-700 font-medium flex items-center gap-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Detener cámara
                    </button>
                  </div>
                </>
              </div>
            )}
          </div>
        </div>

        {/* Result & Status */}
        <div className="space-y-6">
          {/* Status Panel */}
          <div className="rounded-2xl shadow-lg overflow-hidden bg-white">
            <div className="p-6">
              {scanning ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-lg font-bold text-slate-800">Modo continuo activo</p>
                  <p className="text-slate-500 text-sm mt-1">Los resultados aparecen sobre la cámara</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{history.filter(h => !h.status?.includes("anulad")).length}</p>
                      <p className="text-xs text-emerald-700">Registrados hoy</p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-violet-600">{scannedCacheRef.current.size}</p>
                      <p className="text-xs text-violet-700">En cache (30s)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">Esperando escaneo...</p>
                  <p className="text-sm text-slate-400 mt-1">Activa la cámara para iniciar</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats for today */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-600" />
                Hoy
              </h4>
              <span className="text-sm text-slate-500">
                {new Date().toLocaleDateString("es-PE", { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{history.length}</p>
                <p className="text-sm text-emerald-700">Escaneados por QR</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-violet-600">
                  {scanning ? "🟢" : "⚪"}
                </p>
                <p className="text-sm text-violet-700">{scanning ? "Escaneando" : "Detenido"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scans History */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-violet-600" />
            Últimos escaneos de hoy
          </h4>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-slate-500 ${loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((item, idx) => {
              const entryAnulado = item.entry_status === "anulado";
              const exitAnulado = item.exit_status === "anulado";
              const bothAnulado = entryAnulado && (exitAnulado || !item.exit_time);
              const isAnulado = bothAnulado || item.status?.includes("anulad");
              const isIncomplete = (entryAnulado && !exitAnulado && item.exit_time) || (!entryAnulado && exitAnulado);
              const badgeLabel = isAnulado ? "Anulado" : isIncomplete ? "Incompleto" : "Presente";
              const badgeClass = isAnulado ? "bg-red-100 text-red-600" : isIncomplete ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-700";
              return (
              <div key={item.id || idx} className={`px-6 py-3 flex items-center gap-4 hover:bg-slate-50 ${isAnulado ? "opacity-60" : ""}`}>
                {item.photo_url ? (
                  <img src={item.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    item.role === "teacher" 
                      ? "bg-gradient-to-br from-indigo-400 to-purple-500" 
                      : "bg-gradient-to-br from-violet-400 to-purple-500"
                  }`}>
                    {item.student_name?.charAt(0) || item.name?.charAt(0) || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold truncate ${isAnulado ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.student_name || item.name}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      item.role === "teacher" ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"
                    }`}>
                      {item.role === "teacher" ? "Prof" : "Est"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {item.grade_name ? `${item.grade_name} - Sección ${item.section_name}` : (item.role === "teacher" ? "Docente" : "Estudiante")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Entrada</p>
                    <p className={`text-base font-bold ${entryAnulado ? "text-red-400 line-through" : "text-slate-800"}`}>{item.entry_time || item.time || "—"}</p>
                  </div>
                  {item.exit_time && (
                    <>
                      <span className="text-slate-300">→</span>
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Salida</p>
                        <p className={`text-base font-bold ${exitAnulado ? "text-red-400 line-through" : "text-blue-600"}`}>{item.exit_time}</p>
                      </div>
                    </>
                  )}
                  <span className={`px-2 py-1 ${badgeClass} rounded-full text-xs font-medium ml-2`}>
                    {badgeLabel}
                  </span>
                  {isAdmin && item.attendance_id && !(entryAnulado && exitAnulado) && (
                    <button
                      onClick={() => openAnnulModal(item)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                      title="Anular asistencia"
                      data-testid={`annul-btn-${item.id}`}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500">No hay escaneos registrados hoy</p>
          </div>
        )}
      </div>

      {/* Annul Modal */}
      {annulModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" data-testid="annul-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Anular Asistencia</h3>
                <p className="text-white/70 text-xs mt-0.5">{annulModal.student_name || annulModal.name}</p>
              </div>
              <button onClick={() => setAnnulModal(null)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Entrada</p>
                  <p className="font-bold text-slate-700">{annulModal.entry_time || "—"}</p>
                </div>
                {annulModal.exit_time && (
                  <>
                    <span className="text-slate-300">→</span>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 uppercase">Salida</p>
                      <p className="font-bold text-blue-600">{annulModal.exit_time}</p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de anulacion</label>
                <div className="flex gap-2">
                  {[
                    { id: "entry", label: "Solo entrada" },
                    { id: "exit", label: "Solo salida", disabled: !annulModal.exit_time },
                    { id: "both", label: "Ambas" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => setAnnulType(opt.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        annulType === opt.id
                          ? "bg-red-50 border-red-300 text-red-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      } ${opt.disabled ? "opacity-30 cursor-not-allowed" : ""}`}
                      data-testid={`annul-type-${opt.id}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  placeholder="Ej: Doble escaneo, error de QR, correccion administrativa..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all resize-none"
                  data-testid="annul-reason-input"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setAnnulModal(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAnnul}
                  disabled={annulling || annulReason.trim().length < 3}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  data-testid="annul-confirm-btn"
                >
                  {annulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Confirmar Anulacion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
