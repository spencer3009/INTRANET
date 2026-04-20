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

function formatSubjectDetail(detail) {
  if (!detail) return null;
  const parts = [];
  if (detail.subject_name) parts.push(detail.subject_name);
  const gradeLine = [detail.grade, detail.level].filter(Boolean).join(" ");
  if (gradeLine) parts.push(gradeLine);
  if (detail.section) parts.push(`Sección ${detail.section}`);
  return parts.length ? parts.join(" · ") : null;
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
    <div className="space-y-4 md:space-y-6 pb-6" data-testid="support-sessions-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="truncate">Sesiones Activas</span>
          </h1>
          <p className="text-[11px] md:text-sm text-slate-500 mt-1 leading-snug">
            WebSocket en tiempo real · actualización cada 30s
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdate && (
            <span className="text-[11px] text-slate-400 hidden md:inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(lastUpdate.toISOString())}
            </span>
          )}
          <button
            onClick={() => fetchSessions(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-all shadow-sm active:scale-95"
            data-testid="refresh-sessions-btn"
            aria-label="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Stats — compactas en móvil, 3 columnas siempre */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-100 shadow-sm" data-testid="stat-total-users">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
            </div>
            <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-emerald-500" />
            </span>
          </div>
          <p className="text-xl md:text-3xl font-bold text-slate-800 leading-none">{totalConnected}</p>
          <p className="text-[10px] md:text-sm text-slate-500 mt-1 leading-tight">Conectados</p>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-100 shadow-sm" data-testid="stat-total-connections">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-50 flex items-center justify-center mb-1 md:mb-2">
            <Wifi className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          </div>
          <p className="text-xl md:text-3xl font-bold text-slate-800 leading-none">{totalConnections}</p>
          <p className="text-[10px] md:text-sm text-slate-500 mt-1 leading-tight">WebSockets</p>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-slate-100 shadow-sm" data-testid="stat-total-schools">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-50 flex items-center justify-center mb-1 md:mb-2">
            <SchoolIcon className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
          </div>
          <p className="text-xl md:text-3xl font-bold text-slate-800 leading-none">{bySchool.length}</p>
          <p className="text-[10px] md:text-sm text-slate-500 mt-1 leading-tight">Colegios</p>
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
        <div className="space-y-3 md:space-y-4">
          {bySchool.map((school) => (
            <div key={school.school_id || "no-school"} className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid={`school-bucket-${school.school_id || "none"}`}>
              {/* School header */}
              <div className="px-3 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <SchoolIcon className="w-4 h-4 md:w-[18px] md:h-[18px] text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate text-sm md:text-base">{school.school_name || "(sin nombre)"}</p>
                    {school.school_id && <p className="text-[10px] md:text-[11px] text-slate-400 truncate">{school.school_id}</p>}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Users className="w-3 h-3" /> {school.connected_users.length}
                </span>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-slate-100">
                {school.connected_users.map((u) => {
                  const reqCount = u.page_requests || 0;
                  const reqClass = reqCount === 0
                    ? "bg-slate-100 text-slate-400 border-slate-200"
                    : reqCount < 6
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : reqCount <= 12
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200";
                  return (
                    <div key={u.user_id} className="px-3 py-3 active:bg-slate-50 transition-colors" data-testid={`session-row-${u.user_id}`}>
                      {/* Row 1: name + role */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm truncate">{u.name || "(sin nombre)"}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.user_id}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_STYLES[u.role] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {ROLE_LABELS[u.role] || (u.role || "—").toUpperCase()}
                        </span>
                      </div>

                      {/* Row 2: current page pill */}
                      {u.current_page && (
                        <div className="mb-2" data-testid={`session-page-${u.user_id}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-full">
                              {u.current_page}
                            </span>
                            {u.last_activity && (
                              <span className="text-[10px] text-slate-400 shrink-0">{formatConnectedSince(u.last_activity)}</span>
                            )}
                          </div>
                          {formatSubjectDetail(u.subject_detail) && (
                            <p className="text-[11px] text-slate-500 mt-1 leading-tight" data-testid={`session-subject-${u.user_id}`}>
                              {formatSubjectDetail(u.subject_detail)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Row 3: footer metrics */}
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium text-slate-600">{formatTime(u.connected_at)}</span>
                          <span className="text-slate-400">· {formatConnectedSince(u.connected_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${reqClass}`}
                            title="Llamadas HTTP"
                            data-testid={`session-requests-${u.user_id}`}
                          >
                            {reqCount}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Wifi className="w-2.5 h-2.5" /> {u.connection_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-semibold">Usuario</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Rol</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Página actual</th>
                      <th className="px-5 py-2.5 text-center font-semibold">Llamadas</th>
                      <th className="px-5 py-2.5 text-left font-semibold">Conectado desde</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Conexiones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {school.connected_users.map((u) => {
                      const reqCount = u.page_requests || 0;
                      const reqClass = reqCount === 0
                        ? "bg-slate-100 text-slate-400 border-slate-200"
                        : reqCount < 6
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : reqCount <= 12
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200";
                      return (
                      <tr key={u.user_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-800">{u.name || "(sin nombre)"}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{u.user_id}</p>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${ROLE_STYLES[u.role] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {ROLE_LABELS[u.role] || (u.role || "—").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          {u.current_page ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {u.current_page}
                              </span>
                              {formatSubjectDetail(u.subject_detail) && (
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight" data-testid={`session-subject-${u.user_id}`}>
                                  {formatSubjectDetail(u.subject_detail)}
                                </p>
                              )}
                              {u.last_activity && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{formatConnectedSince(u.last_activity)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-[11px] font-bold border ${reqClass}`} title="Estimado de llamadas HTTP que dispara la página al cargar">
                            {reqCount}
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
                      );
                    })}
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
