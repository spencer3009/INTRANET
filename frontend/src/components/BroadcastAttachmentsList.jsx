import { useEffect, useState } from "react";
import axios from "axios";
import {
  Paperclip, FileText, Image as ImageIcon, Video, Music,
  Download, Loader2, Play, Eye,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Renders the attachments of an institutional message with INLINE previews
 * (image/video/pdf/audio) plus a download button. Used by every messages page
 * (admin/teacher/parent/student) so previews are consistent across portals.
 *
 * Strategy:
 *  - Image  → auto-loads (small files, instant gratification).
 *  - Video  → user clicks "Reproducir" to fetch the blob and mount <video>.
 *  - PDF    → user clicks "Ver PDF" to fetch and mount <iframe>.
 *  - Audio  → user clicks "Reproducir" to fetch and mount <audio>.
 *  - Other  → download-only button.
 *
 * We fetch via authenticated XHR (axios) so the Drive token stays on the
 * server. The blob URL is revoked when the component unmounts.
 */
export default function BroadcastAttachmentsList({ message, token }) {
  if (!message?.attachments?.length) return null;
  return (
    <div className="mt-6 pt-6 border-t border-gray-100" data-testid="broadcast-attachments">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Archivos adjuntos ({message.attachments.length})
      </h4>
      <div className="space-y-3">
        {message.attachments.map((att, idx) => (
          <AttachmentCard
            key={att.file_id || idx}
            idx={idx}
            messageId={message.id}
            att={att}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

function classifyMime(mime, name) {
  const m = (mime || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  return "other";
}

function humanSize(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function AttachmentCard({ idx, messageId, att, token }) {
  const kind = classifyMime(att.mime_type, att.name);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoStarted, setAutoStarted] = useState(false);

  const fetchBlob = async () => {
    if (blobUrl || loading) return blobUrl;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `${API}/api/messaging/attachments/${messageId}/${att.file_id}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: att.mime_type || res.data.type });
      const url = window.URL.createObjectURL(blob);
      setBlobUrl(url);
      return url;
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo cargar el adjunto");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Auto-load images on mount (they're small).
  useEffect(() => {
    if (kind === "image" && !autoStarted) {
      setAutoStarted(true);
      fetchBlob();
    }
    return () => {
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const handleDownload = async () => {
    const url = await fetchBlob();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = att.name || "archivo";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const Icon =
    kind === "image" ? ImageIcon :
    kind === "video" ? Video :
    kind === "audio" ? Music :
    kind === "pdf" ? FileText :
    Paperclip;

  return (
    <div
      className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
      data-testid={`attachment-card-${idx}`}
    >
      {/* Header row: icon + name + size + download button */}
      <div className="flex items-center gap-3 p-3">
        <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{att.name || "Archivo"}</div>
          {att.size ? (
            <div className="text-xs text-gray-500">{humanSize(att.size)}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          data-testid={`attachment-download-${idx}`}
        >
          {loading && !blobUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar
        </button>
      </div>

      {/* Preview area */}
      {kind === "image" && (
        <div className="px-3 pb-3" data-testid={`attachment-image-${idx}`}>
          {loading && !blobUrl ? (
            <div className="flex items-center justify-center h-40 bg-gray-100 rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : blobUrl ? (
            <a href={blobUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={blobUrl}
                alt={att.name || "imagen"}
                className="max-w-full max-h-96 rounded-lg border border-gray-200 mx-auto"
              />
            </a>
          ) : null}
        </div>
      )}

      {kind === "video" && (
        <div className="px-3 pb-3" data-testid={`attachment-video-${idx}`}>
          {blobUrl ? (
            <video
              src={blobUrl}
              controls
              className="w-full max-h-96 rounded-lg bg-black"
            >
              Tu navegador no soporta reproducción de video.
            </video>
          ) : (
            <button
              type="button"
              onClick={fetchBlob}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-8 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-700 text-white rounded-lg transition-colors"
              data-testid={`attachment-video-play-${idx}`}
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Cargando video…</>
              ) : (
                <><Play className="w-5 h-5" /> Reproducir video</>
              )}
            </button>
          )}
        </div>
      )}

      {kind === "audio" && (
        <div className="px-3 pb-3" data-testid={`attachment-audio-${idx}`}>
          {blobUrl ? (
            <audio src={blobUrl} controls className="w-full" />
          ) : (
            <button
              type="button"
              onClick={fetchBlob}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-lg transition-colors"
              data-testid={`attachment-audio-play-${idx}`}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cargando audio…</>
              ) : (
                <><Play className="w-4 h-4" /> Reproducir audio</>
              )}
            </button>
          )}
        </div>
      )}

      {kind === "pdf" && (
        <div className="px-3 pb-3" data-testid={`attachment-pdf-${idx}`}>
          {blobUrl ? (
            <iframe
              src={blobUrl}
              title={att.name || "PDF"}
              className="w-full h-[600px] rounded-lg border border-gray-200 bg-white"
            />
          ) : (
            <button
              type="button"
              onClick={fetchBlob}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 disabled:bg-red-50 text-red-700 rounded-lg transition-colors"
              data-testid={`attachment-pdf-view-${idx}`}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cargando PDF…</>
              ) : (
                <><Eye className="w-4 h-4" /> Ver PDF</>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="px-3 pb-3 text-xs text-red-600" data-testid={`attachment-error-${idx}`}>
          {error}
        </div>
      )}
    </div>
  );
}
