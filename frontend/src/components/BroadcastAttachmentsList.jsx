import axios from "axios";
import { Paperclip } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Renders an institutional message's attachments list. Each row downloads
 * the file from the authenticated /api/messaging/attachments endpoint
 * (which streams from Google Drive) and opens it in a new tab.
 *
 * Used in MessagesPage, ParentMessagesPage, StudentMessagesPage and
 * TeacherMessagesPage. Centralized here so a future change to the
 * download flow (e.g., signed URLs) only touches one file.
 */
export default function BroadcastAttachmentsList({ message, token }) {
  if (!message?.attachments?.length) return null;

  const openAttachment = async (att) => {
    try {
      const res = await axios.get(
        `${API}/api/messaging/attachments/${message.id}/${att.file_id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );
      const blob = new Blob([res.data], { type: att.mime_type || res.data.type });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (e) {
      alert(e?.response?.data?.detail || "No se pudo abrir el adjunto");
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100" data-testid="broadcast-attachments">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Archivos adjuntos ({message.attachments.length})
      </h4>
      <div className="space-y-2">
        {message.attachments.map((att, idx) => (
          <button
            key={att.file_id || idx}
            type="button"
            onClick={() => openAttachment(att)}
            className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
            data-testid={`attachment-link-${idx}`}
          >
            <Paperclip className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-700 truncate">{att.name || "Archivo"}</span>
            {att.size && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                {(att.size / 1024).toFixed(0)} KB
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
