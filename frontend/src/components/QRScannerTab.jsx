import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  QrCode, Camera, Check, AlertTriangle, X, Clock, 
  User, Loader2, History, RefreshCw, Volume2, VolumeX,
  Shield, ExternalLink, Settings, SwitchCamera
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export default function QRScannerTab({ token }) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [cameraFacing, setCameraFacing] = useState("environment"); // "environment" = back, "user" = front
  const [availableCameras, setAvailableCameras] = useState([]);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Check environment on mount - but DON'T block, just detect
  useEffect(() => {
    // Detect iframe (for informational purposes only)
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      // Cross-origin iframe, definitely blocked
      setIsInIframe(true);
    }
    
    // Try to enumerate cameras (won't work without permission but worth trying)
    enumerateCameras();
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
      const res = await axios.get(`${API}/attendance/qr/history?limit=10`, { headers });
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
      } else {
        oscillator.frequency.value = 220; // A3
        gainNode.gain.value = 0.2;
      }
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 150);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  // Handle QR scan
  const handleScan = async (detectedCodes) => {
    if (loading || !detectedCodes || detectedCodes.length === 0) return;
    
    const qrToken = detectedCodes[0].rawValue;
    if (!qrToken) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const res = await axios.post(`${API}/attendance/qr/scan`, { qr_token: qrToken }, { headers });
      setResult(res.data);
      
      if (res.data.status === "success") {
        playSound("success");
      } else if (res.data.status === "already_marked") {
        playSound("warning");
      }
      
      // Refresh history
      loadHistory();
      
      // Clear result after 5 seconds
      setTimeout(() => setResult(null), 5000);
      
    } catch (err) {
      const errorData = err.response?.data?.detail;
      if (typeof errorData === 'object') {
        setError(errorData.message || "Error al escanear");
      } else {
        setError(errorData || "Error al escanear el QR");
      }
      playSound("error");
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
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
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white/50" />
                )}
              </button>
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
                    <p className="text-slate-500 mb-4">Activa la cámara para escanear códigos QR de estudiantes</p>
                    
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
                      Centra el código QR dentro del recuadro
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
                          scanDelay={100}
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
                        
                        {/* Processing overlay */}
                        {loading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                            <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-xl">
                              <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                              <span className="font-medium">Procesando QR...</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Corner guides - outside scanner to not interfere */}
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
                  <div className="flex justify-center gap-3">
                    {/* Toggle Camera Button (only show if multiple cameras) */}
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
          {/* Current Result */}
          <div className={`rounded-2xl shadow-lg overflow-hidden transition-all ${
            result?.status === "success" ? "bg-emerald-50 border-2 border-emerald-500" :
            result?.status === "already_marked" ? "bg-amber-50 border-2 border-amber-500" :
            error ? "bg-red-50 border-2 border-red-500" :
            "bg-white"
          }`}>
            <div className="p-6">
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {result.status === "success" ? (
                      <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <p className={`text-lg font-bold ${result.status === "success" ? "text-emerald-700" : "text-amber-700"}`}>
                        {result.status === "success" ? "¡Asistencia Registrada!" : "Ya registrado hoy"}
                      </p>
                      <p className="text-sm text-slate-600">{result.attendance?.time}</p>
                    </div>
                  </div>
                  
                  {/* Student Info */}
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl">
                    {result.student?.photo_url ? (
                      <img 
                        src={result.student.photo_url} 
                        alt="" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                        {result.student?.name?.charAt(0) || "E"}
                      </div>
                    )}
                    <div>
                      <p className="text-xl font-bold text-slate-800">{result.student?.full_name}</p>
                      <p className="text-slate-500">
                        {result.student?.grade_name} - Sección {result.student?.section_name}
                      </p>
                    </div>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-700">Error</p>
                    <p className="text-red-600">{error}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">Esperando escaneo...</p>
                  <p className="text-sm text-slate-400 mt-1">El resultado aparecerá aquí</p>
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
            {history.map((item, idx) => (
              <div key={item.id || idx} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50">
                {item.photo_url ? (
                  <img src={item.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {item.student_name?.charAt(0) || "E"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{item.student_name}</p>
                  <p className="text-sm text-slate-500">
                    {item.grade_name} - Sección {item.section_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                    ✓ Presente
                  </span>
                  <p className="text-sm text-slate-500 mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500">No hay escaneos registrados hoy</p>
          </div>
        )}
      </div>
    </div>
  );
}
