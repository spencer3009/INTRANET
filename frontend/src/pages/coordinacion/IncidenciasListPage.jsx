import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Search, Loader2, Filter, ChevronLeft, ChevronRight, AlertTriangle
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { SeverityBadge, StatusPill } from "@/components/coordinacion/SharedBadges";
import { coordinacionApi } from "@/api/coordinacion";

export default function IncidenciasListPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sub = user?.subdomain;

  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [enums, setEnums] = useState(null);

  // Filters from URL
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const severity = searchParams.get("severity") || "";
  const q = searchParams.get("q") || "";

  useEffect(() => {
    if (!token) return;
    coordinacionApi.getEnums(token).then(setEnums).catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (q) params.q = q;
      const res = await coordinacionApi.listIncidencias(token, params);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, page, status, severity, q]);

  useEffect(() => { load(); }, [load]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const totalPages = Math.ceil(data.total / 25) || 1;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="space-y-5" data-testid="incidencias-list-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Incidencias</h1>
            <p className="text-slate-500 text-sm mt-0.5">{data.total} registros</p>
          </div>
          {(user?.role === "coordinator" || user?.role === "admin") && (
            <button
              onClick={() => navigate(`/${sub}/coordinacion/incidencias/nueva`)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all"
              data-testid="new-incidencia-btn"
            >
              <Plus className="w-4 h-4" />
              Nueva incidencia
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por titulo o descripcion..."
                value={q}
                onChange={(e) => updateFilter("q", e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="search-input"
              />
            </div>
            <select
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              data-testid="filter-status"
            >
              <option value="">Todos los estados</option>
              {enums?.statuses?.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => updateFilter("severity", e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              data-testid="filter-severity"
            >
              <option value="">Todas las severidades</option>
              {enums?.severities?.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <AlertTriangle className="w-10 h-10 mb-3" />
              <p className="font-medium">No se encontraron incidencias</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.items.map(inc => (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/${sub}/coordinacion/incidencias/${inc.id}`)}
                  className="w-full px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-slate-50 transition-colors text-left"
                  data-testid={`incidencia-row-${inc.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{inc.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {inc.student_name} &middot; {new Date(inc.occurred_at).toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={inc.severity} />
                    <StatusPill status={inc.status} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.total > 25 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Pagina {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", String(page - 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                  data-testid="prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter("page", String(page + 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                  data-testid="next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CoordinacionLayout>
  );
}
