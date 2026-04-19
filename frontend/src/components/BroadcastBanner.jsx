import { useState, useEffect } from "react";
import axios from "axios";
import { Megaphone, ChevronRight, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BroadcastBanner({ token, onViewBroadcast }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/broadcast/unread`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBroadcasts(res.data.broadcasts || []);
      } catch (err) {
        console.error("Error loading broadcast banner:", err);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (hidden || broadcasts.length === 0) return null;

  const latest = broadcasts[0];

  return (
    <div
      className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 mt-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 shadow-sm"
      data-testid="broadcast-banner"
    >
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Megaphone className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
          Comunicado del Colegio
        </p>
        <p className="text-sm font-semibold text-slate-800 truncate">{latest.subject}</p>
      </div>
      <button
        onClick={() => onViewBroadcast?.(latest)}
        className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        data-testid="broadcast-banner-view-btn"
      >
        Ver <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => setHidden(true)}
        className="p-1.5 hover:bg-amber-200 rounded-lg transition-colors flex-shrink-0"
        data-testid="broadcast-banner-dismiss"
      >
        <X className="w-4 h-4 text-amber-600" />
      </button>
    </div>
  );
}
