import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, RefreshCw, Check, Loader2, SwitchCamera } from "lucide-react";

export default function CameraCaptureModal({ open, onClose, onSave, uploading }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [facing, setFacing] = useState("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (e) {
      if (e.name === "NotAllowedError") setError("Permiso de camara denegado. Activalo en tu navegador.");
      else if (e.name === "NotFoundError") setError("No se encontro camara en este dispositivo.");
      else setError("No se pudo acceder a la camara.");
    }
  }, [facing, stopCamera]);

  useEffect(() => {
    if (open) {
      setPreview(null);
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);
    canvas.toBlob((blob) => {
      if (blob) setPreview({ blob, url: URL.createObjectURL(blob) });
    }, "image/jpeg", 0.85);
  };

  const retake = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleSave = () => {
    if (preview?.blob) onSave(preview.blob);
  };

  const toggleFacing = () => {
    setFacing(f => f === "user" ? "environment" : "user");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="camera-capture-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">Capturar Foto</h3>
          <button onClick={onClose} className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button onClick={startCamera} className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                Reintentar
              </button>
            </div>
          ) : !preview ? (
            <>
              <div className="relative aspect-square rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={toggleFacing}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  title="Cambiar camara"
                >
                  <SwitchCamera className="w-5 h-5 text-slate-600" />
                </button>
                <button
                  onClick={capture}
                  disabled={!cameraReady}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                  data-testid="capture-photo-btn"
                >
                  <Camera className="w-5 h-5" />
                  Capturar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="aspect-square rounded-xl overflow-hidden bg-black">
                <img src={preview.url} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Repetir
                </button>
                <button
                  onClick={handleSave}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  data-testid="save-photo-btn"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
