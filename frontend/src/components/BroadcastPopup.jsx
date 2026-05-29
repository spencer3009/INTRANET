import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Megaphone, CheckCircle, Loader2 } from "lucide-react";
import BroadcastAttachmentsList from "./BroadcastAttachmentsList";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BroadcastPopup({ token }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [marking, setMarking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/broadcast/unread`, { headers });
        setBroadcasts(res.data.broadcasts || []);
      } catch (err) {
        console.error("Error loading broadcasts:", err);
      }
    };
    load();
  }, [token]);

  const current = broadcasts[currentIndex];

  const handleMarkRead = async () => {
    if (!current) return;
    setMarking(true);
    try {
      await axios.post(`${API}/api/broadcast/${current.id}/read`, {}, { headers });
      const next = broadcasts.filter((_, i) => i !== currentIndex);
      setBroadcasts(next);
      if (next.length === 0) setDismissed(true);
      else setCurrentIndex(0);
    } catch (err) {
      console.error("Error marking broadcast:", err);
    } finally {
      setMarking(false);
    }
  };

  if (dismissed || !current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" data-testid="broadcast-popup">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Comunicado Institucional</p>
              <h2 className="text-lg font-bold text-white mt-0.5">{current.subject}</h2>
            </div>
          </div>
          {broadcasts.length > 1 && (
            <p className="text-xs text-white/70 mt-2">
              {currentIndex + 1} de {broadcasts.length} comunicados pendientes
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            {current.sender_photo ? (
              <img src={current.sender_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-amber-600" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">{current.sender_name}</p>
              <p className="text-xs text-slate-400">
                {new Date(current.created_at).toLocaleDateString("es-PE", {
                  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </p>
            </div>
          </div>

          <div
            className="prose prose-sm max-w-none text-slate-700"
            dangerouslySetInnerHTML={{ __html: current.body }}
          />

          {/* Adjuntos del comunicado: video (reproductor), imágenes (inline), PDF y audio */}
          <BroadcastAttachmentsList message={current} token={token} />
        </div>

        {/* Footer - No close button, only mark as read */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={handleMarkRead}
            disabled={marking}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            data-testid="broadcast-mark-read-btn"
          >
            {marking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Marcar como leido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
