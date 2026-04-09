import { useState, useRef, useCallback } from "react";
import { X, Camera, Upload, Loader2, Check, ImageIcon, SwitchCamera, RefreshCw } from "lucide-react";
import { processProfilePhoto, validateImageFile } from "@/utils/imageUtils";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PhotoUploadModal({ isOpen, onClose, user, token, onPhotoUpdated, selfUpdate = false }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState("upload"); // "upload" | "camera"
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraPreview, setCameraPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState("user");

  const headers = { Authorization: `Bearer ${token}` };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const reset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCameraPreview(null);
    setError("");
    setDragOver(false);
    setUploading(false);
    setMode("upload");
    stopCamera();
  }, [stopCamera]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    setError("");
    setCameraReady(false);
    setCameraPreview(null);
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
      if (e.name === "NotAllowedError") setError("Permiso de camara denegado");
      else if (e.name === "NotFoundError") setError("No se encontro camara");
      else setError("No se pudo acceder a la camara");
    }
  }, [facing, stopCamera]);

  const capturePhoto = () => {
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
      if (blob) {
        setCameraPreview({ blob, url: URL.createObjectURL(blob) });
        stopCamera();
      }
    }, "image/jpeg", 0.85);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    if (newMode === "camera") {
      setSelectedFile(null);
      setPreviewUrl(null);
      setTimeout(() => startCamera(), 100);
    } else {
      stopCamera();
      setCameraPreview(null);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const validation = validateImageFile(file, { maxSizeMB: 5 });
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError("");
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const handleSave = async () => {
    let fileToUpload = null;
    if (mode === "upload" && selectedFile) {
      fileToUpload = selectedFile;
    } else if (mode === "camera" && cameraPreview?.blob) {
      fileToUpload = new File([cameraPreview.blob], "camera.jpg", { type: "image/jpeg" });
    }
    if (!fileToUpload || !user) return;

    setUploading(true);
    setError("");

    try {
      const processed = await processProfilePhoto(fileToUpload, { maxWidth: 197, quality: 0.85 });
      const sigRes = await axios.get(`${API}/cloudinary/signature?resource_type=image&folder=edunet/users`, { headers });
      const sig = sigRes.data;

      const fd = new FormData();
      fd.append("file", processed);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", sig.timestamp);
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upData.secure_url) throw new Error("Error al subir imagen");

      await axios.put(
        selfUpdate ? `${API}/auth/profile` : `${API}/users/${user.id}`,
        { photo_url: upData.secure_url },
        { headers }
      );
      onPhotoUpdated(user.id, upData.secure_url);
      handleClose();
    } catch (err) {
      setError(err.message || "Error al subir la foto");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        data-testid="photo-upload-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Cambiar foto</h2>
              <p className="text-xs text-slate-500">{user.name} {user.last_name || ""}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            data-testid="photo-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button onClick={() => switchMode("upload")} className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${mode === "upload" ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-slate-500 hover:text-slate-700"}`} data-testid="photo-tab-upload">
            Subir foto
          </button>
          <button onClick={() => switchMode("camera")} className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${mode === "camera" ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-slate-500 hover:text-slate-700"}`} data-testid="photo-tab-camera">
            Tomar foto
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">
              {error}
            </div>
          )}

          {mode === "upload" ? (
            <>
              {previewUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-44 h-44 rounded-2xl overflow-hidden border-4 border-emerald-200 shadow-lg">
                      <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" data-testid="photo-preview-image" />
                    </div>
                    {user.photo_url && (
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-lg overflow-hidden border-2 border-white shadow-md">
                        <img src={user.photo_url} alt="Actual" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="text-sm text-slate-500 hover:text-red-500 transition-colors underline" data-testid="photo-change-btn">
                    Elegir otra imagen
                  </button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  data-testid="photo-drop-zone"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragOver ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <Upload className={`w-7 h-7 ${dragOver ? "text-emerald-500" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Haz clic o arrastra una imagen</p>
                      <p className="text-xs text-slate-400 mt-1">JPG, PNG o WebP. Max 5MB</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {cameraPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-44 h-44 rounded-2xl overflow-hidden border-4 border-emerald-200 shadow-lg">
                    <img src={cameraPreview.url} alt="Captura" className="w-full h-full object-cover" />
                  </div>
                  <button type="button" onClick={() => { setCameraPreview(null); startCamera(); }} className="text-sm text-slate-500 hover:text-red-500 transition-colors underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Repetir
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }} />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-3">
                    <button onClick={() => { setFacing(f => f === "user" ? "environment" : "user"); setTimeout(() => startCamera(), 100); }} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl" title="Cambiar camara">
                      <SwitchCamera className="w-5 h-5 text-slate-600" />
                    </button>
                    <button onClick={capturePhoto} disabled={!cameraReady} className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50" data-testid="capture-photo-btn">
                      <Camera className="w-5 h-5" /> Capturar
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} data-testid="photo-file-input" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            disabled={uploading}
            data-testid="photo-modal-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={(!previewUrl && !cameraPreview) || uploading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            data-testid="photo-modal-save"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar foto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
