import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Users, RefreshCw, Activity, School as SchoolIcon, Clock, Wifi } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_STYLES = {
  owner: "bg-amber-100 text-amber-700 border-amber-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  director: "bg-indigo-100 text-indigo-700 border-indigo-200",
  coordinator: "bg-teal-100 text-teal-700 border-teal-200",
  teacher: "bg-emerald-100 text-emerald-700 border-emerald-200",
  student: "bg-cyan-100 text-cyan-700 border-cyan-200",
  parent: "bg-orange-100 text-orange-700 border-orange-200",
  psicologo: "bg-violet-100 text-violet-700 border-violet-200",
  auxiliar_asistencia: "bg-sky-100 text-sky-700 border-sky-200",
  auxiliar_alimentacion: "bg-pink-100 text-pink-700 border-pink-200",
  auxiliar_movilidad: "bg-lime-100 text-lime-700 border-lime-200",
  system_admin_global: "bg-slate-900 text-white border-slate-900",
};

const ROLE_LABELS = {
  owner: "Propietario",
  admin: "Admin",
  director: "Director",
  coordinator: "Coordinador",
  teacher: "Profesor",
  student: "Alumno",
  parent: "Padre",
  psicologo: "Psicólogo",
  auxiliar_asistencia: "Aux. Asistencia",
  auxiliar_alimentacion: "Aux. Alimentación",
  auxiliar_movilidad: "Aux. Movilidad",
  system_admin_global: "Soporte Global",
};

function formatConnectedSince(iso) {
  if (!iso) return "—";
  const now = new Date();
  const then = new Date(iso);
  const diffS = Math.max(0, Math.floor((now - then) / 1000));
  if (diffS < 60) return `hace ${diffS}s`;
  const m = Math.floor(diffS / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `hace ${h}h ${rm}m`;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export default function SupportSessionsPage({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchSessions = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/support/active-sessions`, { headers });
      setData(res.data);
      setLastUpdate(new Date());
      setError("");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Error al cargar sesiones";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => fetchSessions(), 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const totalConnected = data?.total_connected ?? 0;
  const totalConnections = data?.total_connections ?? 0;
  const bySchool = data?.by_school ?? [];

  return (
    <div className="space-y-6" data-testid="support-sessions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            Sesiones Activas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Usuarios con WebSocket conectado en tiempo real · actualización cada 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Actualizado: {formatTime(lastUpdate.toISOString())}
            </span>
          )}
          <button
            onClick={() => fetchSessions(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-all shadow-sm"
            data-testid="refresh-sessions-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm" data-testid="stat-total-users">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalConnected}</p>
          <p className="text-sm text-slate-500 mt-1">Usuarios conectados</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm" data-testid="stat-total-connections">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <Wifi className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalConnections}</p>
          <p className="text-sm text-slate-500 mt-1">Conexiones WebSocket abiertas</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm" data-testid="stat-total-schools">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-2">
            <SchoolIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{bySchool.length}</p>
          <p className="text-sm text-slate-500 mt-1">Colegios con actividad</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" data-testid="sessions-error">
          {error}
        </div>
      )}

      {/* Schools list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-sm text-slate-500">
          Cargando sesiones activas…
        </div>
      ) : bySchool.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center" data-testid="sessions-empty">
          <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold">No hay usuarios conectados</p>
          <p className="text-sm text-slate-400 mt-1">Cuando algún usuario abra la app aparecerá aquí en tiempo real.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bySchool.map((school) => (
            <div key={school.school_id || "no-school"} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid={`school-bucket-${school.school_id || "none"}`}>
              <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <SchoolIcon className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{school.school_name || "(sin nombre)"}</p>
                    {school.school_id && <p className="text-[11px] text-slate-400 truncate">{school.school_id}</p>}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Users className="w-3 h-3" /> {school.connected_users.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-semibold">Usuario</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Rol</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Conectado desde</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Conexiones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {school.connected_users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50/70 transition-colors" data-testid={`session-row-${u.user_id}`}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-800">{u.name || "(sin nombre)"}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{u.user_id}</p>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${ROLE_STYLES[u.role] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {ROLE_LABELS[u.role] || (u.role || "—").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-slate-600">
                          <span className="font-medium">{formatTime(u.connected_at)}</span>
                          <span className="text-[11px] text-slate-400 ml-2">· {formatConnectedSince(u.connected_at)}</span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Wifi className="w-3 h-3" /> {u.connection_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
