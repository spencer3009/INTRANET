import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "../../api/coordinacion";
import {
  BarChart3, Users, Presentation, TrendingUp, Download, FileSpreadsheet, FileText, Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const TABS = [
  { key: "incidencias-por-grado", label: "Por grado", icon: BarChart3 },
  { key: "reincidentes", label: "Reincidentes", icon: Users },
  { key: "cobertura-charlas", label: "Cobertura charlas", icon: Presentation },
  { key: "efectividad-seguimientos", label: "Efectividad", icon: TrendingUp },
];

const SEV_COLORS = { baja: "bg-green-200", media: "bg-amber-200", alta: "bg-orange-300", critica: "bg-red-300" };

function EmptyState({ message }) {
  return <div className="text-center py-12 text-slate-400 text-sm" data-testid="report-empty">{message}</div>;
}

function ExportButtons({ reportType, token, filters }) {
  const [exporting, setExporting] = useState(null);

  const doExport = async (format) => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format, ...filters });
      const res = await fetch(`${API}/api/coordinacion/reportes/${reportType}/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${reportType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => doExport("xlsx")} disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
        data-testid="export-xlsx-btn">
        {exporting === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        XLSX
      </button>
      <button onClick={() => doExport("pdf")} disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
        data-testid="export-pdf-btn">
        {exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}

// ── TAB: Incidencias por Grado ──────────────────────────────────────────────
function TabIncidenciasPorGrado({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severidad, setSeveridad] = useState("");
  const filters = {};
  if (severidad) filters.severidad = severidad;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (severidad) params.severidad = severidad;
      const res = await coordinacionApi.getReport(token, "incidencias-por-grado", params);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token, severidad]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay incidencias registradas" />;

  const maxCount = Math.max(...data.items.map(i => i.count), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <select value={severidad} onChange={(e) => setSeveridad(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" data-testid="filter-severidad">
          <option value="">Todas las severidades</option>
          <option value="baja">Baja</option><option value="media">Media</option>
          <option value="alta">Alta</option><option value="critica">Crítica</option>
        </select>
        <ExportButtons reportType="incidencias-por-grado" token={token} filters={filters} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b">
          <div className="col-span-3">Grado / Seccion</div>
          <div className="col-span-1 text-center">Total</div>
          <div className="col-span-6">Distribucion</div>
          <div className="col-span-2 text-center">Por severidad</div>
        </div>
        {data.items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 items-center" data-testid={`grade-row-${idx}`}>
            <div className="col-span-3 text-sm font-medium text-slate-800">{item.label}</div>
            <div className="col-span-1 text-center text-sm font-bold text-slate-700">{item.count}</div>
            <div className="col-span-6">
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                {["baja", "media", "alta", "critica"].map(s => {
                  const c = item.by_severity?.[s] || 0;
                  const pct = (c / maxCount) * 100;
                  return pct > 0 ? <div key={s} className={`h-full ${SEV_COLORS[s]}`} style={{ width: `${pct}%` }} title={`${s}: ${c}`} /> : null;
                })}
              </div>
            </div>
            <div className="col-span-2 flex gap-1 justify-center flex-wrap">
              {["baja", "media", "alta", "critica"].filter(s => item.by_severity?.[s]).map(s => (
                <span key={s} className={`px-1.5 py-0.5 rounded text-xs font-medium ${SEV_COLORS[s]}`}>{item.by_severity[s]}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2 text-right">Total: {data.total} incidencias</p>
    </div>
  );
}

// ── TAB: Reincidentes ───────────────────────────────────────────────────────
function TabReincidentes({ token, subdomain }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "reincidentes", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay estudiantes reincidentes en los ultimos 30 dias" />;

  // Build absolute path with subdomain for navigation
  const basePath = subdomain ? `/${subdomain}/coordinacion` : '/coordinacion';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">{data.total} estudiante(s) con {data.umbral}+ incidencias en {data.periodo_dias} dias</p>
        <ExportButtons reportType="reincidentes" token={token} filters={{}} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b">
          <div className="col-span-5">Estudiante</div>
          <div className="col-span-3">Grado</div>
          <div className="col-span-2 text-center">Incidencias</div>
          <div className="col-span-2 text-center">Acción</div>
        </div>
        {data.items.map((r, idx) => (
          <div key={r.student_id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 items-center" data-testid={`reincident-row-${idx}`}>
            <div className="col-span-5 text-sm font-medium text-slate-800">{r.full_name}</div>
            <div className="col-span-3 text-xs text-slate-500">{r.grade}</div>
            <div className="col-span-2 text-center">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{r.count}</span>
            </div>
            <div className="col-span-2 text-center">
              <button onClick={() => navigate(`${basePath}/estudiantes/${r.student_id}`)}
                className="text-xs text-indigo-600 hover:underline font-medium" data-testid={`view-ficha-${r.student_id}`}>
                Ver ficha
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB: Cobertura Charlas ──────────────────────────────────────────────────
function TabCoberturaCharlas({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "cobertura-charlas", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay charlas realizadas para calcular cobertura" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">Charlas: <strong className="text-slate-800">{data.total_charlas}</strong></span>
          <span className="text-slate-500">Convocados: <strong className="text-slate-800">{data.total_convocados}</strong></span>
          <span className="text-slate-500">Asistentes: <strong className="text-green-600">{data.total_asistentes}</strong></span>
          <span className="text-slate-500">Cobertura: <strong className="text-indigo-600">{data.cobertura_pct}%</strong></span>
        </div>
        <ExportButtons reportType="cobertura-charlas" token={token} filters={{}} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b">
          <div className="col-span-4">Charla</div>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-2 text-center">Convocados</div>
          <div className="col-span-2 text-center">Asistentes</div>
          <div className="col-span-2 text-center">Cobertura</div>
        </div>
        {data.items.map((c, idx) => (
          <div key={c.charla_id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 items-center" data-testid={`charla-coverage-row-${idx}`}>
            <div className="col-span-4 text-sm font-medium text-slate-800 truncate">{c.title}</div>
            <div className="col-span-2 text-xs text-slate-500">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString("es-PE") : ""}</div>
            <div className="col-span-2 text-center text-sm text-slate-700">{c.convocados}</div>
            <div className="col-span-2 text-center text-sm text-green-600 font-medium">{c.asistentes}</div>
            <div className="col-span-2 text-center">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.cobertura_pct >= 80 ? "bg-green-100 text-green-700" : c.cobertura_pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                {c.cobertura_pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB: Efectividad ────────────────────────────────────────────────────────
function TabEfectividad({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "efectividad-seguimientos", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!data || data.total === 0) return <EmptyState message="No hay incidencias para calcular efectividad" />;

  const pct = data.efectividad_pct;
  const pctColor = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  const ringColor = pct >= 70 ? "stroke-green-500" : pct >= 40 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <ExportButtons reportType="efectividad-seguimientos" token={token} filters={{}} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ring chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center">
          <svg className="w-32 h-32" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" className={ringColor} strokeWidth="10"
              strokeDasharray={`${pct * 3.14} ${(100 - pct) * 3.14}`}
              strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <p className={`text-3xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
          <p className="text-xs text-slate-500">Efectividad de cierre</p>
        </div>

        {/* Metrics */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">{data.total}</p>
              <p className="text-xs text-slate-500">Total incidencias</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{data.cerradas}</p>
              <p className="text-xs text-slate-500">Cerradas/Resueltas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{data.abiertas}</p>
              <p className="text-xs text-slate-500">Abiertas</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-2">Desglose por estado</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.by_status || {}).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-slate-600 capitalize">{status.replace("_", " ")}</span>
                  <span className="font-bold text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function ReportesPage({ token, subdomain, user, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "incidencias-por-grado";

  const setTab = (tab) => setSearchParams({ tab }, { replace: true });

  const renderTab = () => {
    switch (activeTab) {
      case "incidencias-por-grado": return <TabIncidenciasPorGrado token={token} />;
      case "reincidentes": return <TabReincidentes token={token} subdomain={subdomain} />;
      case "cobertura-charlas": return <TabCoberturaCharlas token={token} />;
      case "efectividad-seguimientos": return <TabEfectividad token={token} />;
      default: return <TabIncidenciasPorGrado token={token} />;
    }
  };

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="reportes">
    <div className="p-4 md:p-6" data-testid="reportes-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-violet-600" />
          Reportes
        </h1>
        <p className="text-sm text-slate-500 mt-1">Metricas y analisis del modulo de coordinacion</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
    </CoordinacionLayout>
  );
}
