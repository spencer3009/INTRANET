import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import {
  Calendar, Filter, Search, User, ChevronRight, Clock, Tag
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaSesionesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/psychology/sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.student_name || "").toLowerCase().includes(q) ||
      (s.session_type || "").toLowerCase().includes(q) ||
      (s.reason_category || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q)
    );
  });

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="sesiones">
      <div data-testid="psicologia-sesiones">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <h1 className="text-lg font-bold text-slate-800">Historial de Sesiones</h1>
        <p className="text-xs text-slate-500">{sessions.length} sesiones registradas</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar sesiones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            data-testid="search-sessions"
          />
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded"></div>
                    <div className="h-3 w-60 bg-slate-100 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay sesiones registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((session) => (
                <button
                  key={session.id}
                  onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${session.student_id}`))}
                  className="w-full px-5 py-4 flex items-start gap-4 hover:bg-violet-50/50 transition-colors text-left"
                  data-testid={`session-item-${session.id}`}
                >
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-violet-100 flex items-center justify-center">
                    {session.student_photo ? (
                      <img src={session.student_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-violet-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800">{session.student_name || "Estudiante"}</p>
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{session.session_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {session.date?.slice(0, 10)}
                      </span>
                      {session.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.duration_minutes} min
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {session.reason_category}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-slate-500 line-clamp-2">{session.notes}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </PsicologiaLayout>
  );
}
