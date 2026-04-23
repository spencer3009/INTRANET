import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "../../api/coordinacion";
import {
  BarChart3, Users, Presentation, TrendingUp, FileSpreadsheet, FileText, Loader2,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const TABS = [
  { key: "incidencias-por-grado", label: "Por grado", icon: BarChart3 },
  { key: "reincidentes", label: "Reincidentes", icon: Users },
  { key: "cobertura-charlas", label: "Cobertura charlas", icon: Presentation },
  { key: "efectividad-seguimientos", label: "Efectividad", icon: TrendingUp },
];

const SEV_COLORS = {
  baja:    { bar: "#10b981", badge: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70" },
  media:   { bar: "#f59e0b", badge: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70" },
  alta:    { bar: "#f97316", badge: "bg-gradient-to-br from-orange-100/70 to-orange-50/50 text-orange-700 border-orange-200/70" },
  critica: { bar: "#ef4444", badge: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70" },
};

const inputCls = "px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" data-testid="report-empty">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <BarChart3 className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
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
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border disabled:opacity-50 bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70 hover:shadow-sm"
        data-testid="export-xlsx-btn">
        {exporting === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        XLSX
      </button>
      <button onClick={() => doExport("pdf")} disabled={!!exporting}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border disabled:opacity-50 bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70 hover:shadow-sm"
        data-testid="export-pdf-btn">
        {exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TAB: Incidencias por Grado                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay incidencias registradas" />;

  const maxCount = Math.max(...data.items.map(i => i.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={severidad} onChange={(e) => setSeveridad(e.target.value)}
          className={inputCls} data-testid="filter-severidad">
          <option value="">Todas las severidades</option>
          <option value="baja">Baja</option><option value="media">Media</option>
          <option value="alta">Alta</option><option value="critica">Critica</option>
        </select>
        <ExportButtons reportType="incidencias-por-grado" token={token} filters={filters} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
        <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
             style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
          <div className="col-span-3">Grado / Sección</div>
          <div className="col-span-1 text-center">Total</div>
          <div className="col-span-6">Distribución</div>
          <div className="col-span-2 text-center">Por severidad</div>
        </div>
        {data.items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors" data-testid={`grade-row-${idx}`}>
            <div className="col-span-3 text-sm font-semibold text-slate-800">{item.label}</div>
            <div className="col-span-1 text-center text-sm font-bold text-slate-700 tabular-nums">{item.count}</div>
            <div className="col-span-6">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                {["baja", "media", "alta", "critica"].map(s => {
                  const c = item.by_severity?.[s] || 0;
                  const pct = (c / maxCount) * 100;
                  return pct > 0 ? <div key={s} className="h-full" style={{ width: `${pct}%`, background: SEV_COLORS[s].bar }} title={`${s}: ${c}`} /> : null;
                })}
              </div>
            </div>
            <div className="col-span-2 flex gap-1.5 justify-center flex-wrap">
              {["baja", "media", "alta", "critica"].filter(s => item.by_severity?.[s]).map(s => (
                <span key={s} className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${SEV_COLORS[s].badge}`}>{item.by_severity[s]}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 text-right tabular-nums">Total: {data.total} incidencias</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TAB: Reincidentes                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */
function TabReincidentes({ token, subdomain }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "reincidentes", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay estudiantes reincidentes en los últimos 30 días" />;

  const basePath = subdomain ? `/${subdomain}/coordinacion` : '/coordinacion';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <p className="text-sm text-slate-500">{data.total} estudiante(s) con <strong className="text-slate-700">{data.umbral}+</strong> incidencias en {data.periodo_dias} días</p>
        <ExportButtons reportType="reincidentes" token={token} filters={{}} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
        <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
             style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
          <div className="col-span-5">Estudiante</div>
          <div className="col-span-3">Grado</div>
          <div className="col-span-2 text-center">Incidencias</div>
          <div className="col-span-2 text-center">Acción</div>
        </div>
        {data.items.map((r, idx) => (
          <div key={r.student_id} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors" data-testid={`reincident-row-${idx}`}>
            <div className="col-span-5 text-sm font-semibold text-slate-800">{r.full_name}</div>
            <div className="col-span-3 text-xs text-slate-500">{r.grade}</div>
            <div className="col-span-2 text-center">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70 tabular-nums">{r.count}</span>
            </div>
            <div className="col-span-2 text-center">
              <button onClick={() => navigate(`${basePath}/estudiantes/${r.student_id}`)}
                className="flex items-center gap-1 mx-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                data-testid={`view-ficha-${r.student_id}`}>
                Ver ficha <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TAB: Cobertura Charlas                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
function TabCoberturaCharlas({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "cobertura-charlas", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;
  if (!data?.items?.length) return <EmptyState message="No hay charlas realizadas para calcular cobertura" />;

  const MINI_KPIS = [
    { label: "Charlas", val: data.total_charlas, from: "#6366f1", to: "#4f46e5", rgb: "99,102,241" },
    { label: "Convocados", val: data.total_convocados, from: "#3b82f6", to: "#2563eb", rgb: "59,130,246" },
    { label: "Asistentes", val: data.total_asistentes, from: "#10b981", to: "#059669", rgb: "16,185,129" },
    { label: "Cobertura", val: `${data.cobertura_pct}%`, from: "#8b5cf6", to: "#7c3aed", rgb: "139,92,246" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons reportType="cobertura-charlas" token={token} filters={{}} />
      </div>

      {/* Mini KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MINI_KPIS.map(({ label, val, from, to, rgb }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02]"
               style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, boxShadow: `0 4px 16px rgba(${rgb}, 0.20)` }}>
            <div className="absolute pointer-events-none rounded-full" style={{ width: "100px", height: "100px", top: "-20px", right: "-30px", background: "rgba(255,255,255,0.12)" }} />
            <span className="text-[11px] font-semibold text-white/80">{label}</span>
            <div className="text-2xl font-bold text-white tabular-nums mt-1">{val}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
        <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
             style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
          <div className="col-span-4">Charla</div>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-2 text-center">Convocados</div>
          <div className="col-span-2 text-center">Asistentes</div>
          <div className="col-span-2 text-center">Cobertura</div>
        </div>
        {data.items.map((c, idx) => (
          <div key={c.charla_id} className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors" data-testid={`charla-coverage-row-${idx}`}>
            <div className="col-span-4 text-sm font-semibold text-slate-800 truncate">{c.title}</div>
            <div className="col-span-2 text-xs text-slate-500">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString("es-PE") : ""}</div>
            <div className="col-span-2 text-center text-sm text-slate-700 tabular-nums">{c.convocados}</div>
            <div className="col-span-2 text-center text-sm text-emerald-600 font-semibold tabular-nums">{c.asistentes}</div>
            <div className="col-span-2 text-center">
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border tabular-nums ${
                c.cobertura_pct >= 80
                  ? "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70"
                  : c.cobertura_pct >= 50
                    ? "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70"
                    : "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70"
              }`}>
                {c.cobertura_pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TAB: Efectividad                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
function TabEfectividad({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coordinacionApi.getReport(token, "efectividad-seguimientos", {}).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;
  if (!data || data.total === 0) return <EmptyState message="No hay incidencias para calcular efectividad" />;

  const pct = data.efectividad_pct;
  const pctFrom = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const pctTo   = pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#dc2626";
  const pctRgb  = pct >= 70 ? "16,185,129" : pct >= 40 ? "245,158,11" : "239,68,68";
  const ringStroke = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  const METRIC_CARDS = [
    { label: "Total incidencias", val: data.total, from: "#6366f1", to: "#4f46e5", rgb: "99,102,241" },
    { label: "Cerradas/Resueltas", val: data.cerradas, from: "#10b981", to: "#059669", rgb: "16,185,129" },
    { label: "Abiertas", val: data.abiertas, from: "#f59e0b", to: "#d97706", rgb: "245,158,11" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <ExportButtons reportType="efectividad-seguimientos" token={token} filters={{}} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Ring chart card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <svg className="w-36 h-36" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={ringStroke} strokeWidth="10"
              strokeDasharray={`${pct * 3.14} ${(100 - pct) * 3.14}`}
              strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <div className="relative overflow-hidden rounded-xl px-6 py-2.5 mt-3"
               style={{ background: `linear-gradient(135deg, ${pctFrom} 0%, ${pctTo} 100%)`, boxShadow: `0 4px 12px rgba(${pctRgb}, 0.25)` }}>
            <span className="text-2xl font-bold text-white tabular-nums">{pct}%</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Efectividad de cierre</p>
        </div>

        {/* Metrics */}
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {METRIC_CARDS.map(({ label, val, from, to, rgb }) => (
              <div key={label} className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]"
                   style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, boxShadow: `0 4px 16px rgba(${rgb}, 0.20)` }}>
                <div className="absolute pointer-events-none rounded-full" style={{ width: "100px", height: "100px", top: "-20px", right: "-30px", background: "rgba(255,255,255,0.12)" }} />
                <span className="text-[11px] font-semibold text-white/80">{label}</span>
                <div className="text-[28px] font-bold text-white tabular-nums mt-1">{val}</div>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">Desglose por estado</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.by_status || {}).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-sm text-slate-600 capitalize">{status.replace("_", " ")}</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="reportes-page">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Reportes</h1>
          <p className="text-sm text-slate-500 mt-1">Metricas y analisis del módulo de coordinación</p>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.key ? "text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={activeTab === tab.key ? {
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                boxShadow: "0 2px 8px rgba(99,102,241,0.30)"
              } : {}}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {renderTab()}
      </div>
    </CoordinacionLayout>
  );
}
