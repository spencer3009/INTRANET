import { useState, useRef } from "react";
import axios from "axios";
import { Upload, X, FileText, Image, Film, Link2, Loader2, AlertCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const CLOUD_FOLDER = "edunet/coordinacion/charlas";

const TYPE_CONFIG = {
  image: { accept: ".jpg,.jpeg,.png,.webp", maxMB: 5, resource: "image", label: "Imagen", icon: Image },
  pdf: { accept: ".pdf", maxMB: 15, resource: "raw", label: "PDF", icon: FileText },
  video: { accept: ".mp4", maxMB: 50, resource: "video", label: "Video", icon: Film },
};

export default function CharlaMaterialUploader({ token, charlaId, onMaterialAdded }) {
  const [mode, setMode] = useState(null); // "file" | "link"
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [linkForm, setLinkForm] = useState({ url: "", name: "" });
  const fileRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const detectFileType = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (ext === "mp4") return "video";
    return null;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const fileType = detectFileType(file);
    if (!fileType) {
      setError("Formato no soportado. Use JPG, PNG, WebP, PDF o MP4.");
      return;
    }
    const config = TYPE_CONFIG[fileType];
    if (file.size > config.maxMB * 1024 * 1024) {
      setError(`El archivo excede el límite de ${config.maxMB}MB para ${config.label}.`);
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);

    try {
      const resourceType = config.resource;
      const sigRes = await axios.get(
        `${API}/api/cloudinary/signature?folder=${CLOUD_FOLDER}&resource_type=${resourceType}`,
        { headers }
      );
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("signature", signature);
      fd.append("timestamp", timestamp);
      fd.append("api_key", api_key);
      fd.append("folder", folder);

      const uploadEndpoint = resourceType === "raw" ? "raw" : resourceType;
      const upRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/${uploadEndpoint}/upload`,
        fd,
        {
          onUploadProgress: (p) => setProgress(Math.round((p.loaded * 100) / p.total)),
        }
      );

      const { secure_url, public_id } = upRes.data;
      const materialRes = await axios.post(
        `${API}/api/coordinacion/charlas/${charlaId}/materiales`,
        {
          type: fileType,
          url: secure_url,
          public_id: public_id,
          name: file.name,
          size_bytes: file.size,
        },
        { headers }
      );
      onMaterialAdded(materialRes.data);
      setMode(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al subir archivo");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkForm.url.trim() || !linkForm.name.trim()) return;
    setError("");
    setUploading(true);
    try {
      const res = await axios.post(
        `${API}/api/coordinacion/charlas/${charlaId}/materiales`,
        {
          type: "link",
          url: linkForm.url,
          public_id: null,
          name: linkForm.name,
          size_bytes: null,
        },
        { headers }
      );
      onMaterialAdded(res.data);
      setLinkForm({ url: "", name: "" });
      setMode(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al agregar enlace");
    } finally {
      setUploading(false);
    }
  };

  if (!mode) {
    return (
      <div className="flex gap-2" data-testid="charla-material-uploader">
        <button
          onClick={() => setMode("file")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
          data-testid="upload-file-btn"
        >
          <Upload className="w-3.5 h-3.5" /> Subir archivo
        </button>
        <button
          onClick={() => setMode("link")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
          data-testid="add-link-btn"
        >
          <Link2 className="w-3.5 h-3.5" /> Agregar enlace
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200" data-testid="charla-uploader-form">
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs mb-3 bg-red-50 p-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </div>
      )}

      {mode === "file" && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            Formatos: JPG/PNG/WebP (5MB), PDF (15MB), MP4 (50MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="file-input"
          />
          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Subiendo... {progress}%
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                data-testid="select-file-btn"
              >
                Seleccionar archivo
              </button>
              <button onClick={() => { setMode(null); setError(""); }}
                className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "link" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Nombre del recurso (ej: Presentación sobre bullying)"
            value={linkForm.name}
            onChange={(e) => setLinkForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            data-testid="link-name-input"
          />
          <input
            type="url"
            placeholder="https://..."
            value={linkForm.url}
            onChange={(e) => setLinkForm((p) => ({ ...p, url: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            data-testid="link-url-input"
          />
          <div className="flex gap-2">
            <button
              onClick={handleLinkSubmit}
              disabled={uploading || !linkForm.url.trim() || !linkForm.name.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              data-testid="submit-link-btn"
            >
              {uploading ? "Guardando..." : "Agregar"}
            </button>
            <button onClick={() => { setMode(null); setError(""); setLinkForm({ url: "", name: "" }); }}
              className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
