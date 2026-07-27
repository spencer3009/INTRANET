import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Loader2, FileSpreadsheet, FileText, Printer, BookMarked, Archive, Eye, Lock } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import RightDrawer from "@/components/RightDrawer";
import AdminCurricularAreasPage from "@/pages/AdminCurricularAreasPage";
import AdminCierreBimestrePage from "@/pages/AdminCierreBimestrePage";
import BulkLibretaZipButton from "@/components/libreta/BulkLibretaZipButton";
import LibretasUploadDrawer from "@/components/LibretasUploadDrawer";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ConsolidatedGradesPage({ user, token, onLogout }) {
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(null); // 'areas' | 'cierre' | null
  const [libretasDrawerOpen, setLibretasDrawerOpen] = useState(false);
  const [reportCardSource, setReportCardSource] = useState("generated");
  const [closedPeriodIds, setClosedPeriodIds] = useState([]); // bimestres recién cerrados
  const tableRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };
  const canManageAreas = ["owner", "admin", "director"].includes(user?.role);
  const canCloseBim = user?.role === "owner";
  const canUploadLibretas = user?.is_owner || ["owner", "admin", "director"].includes(user?.role);

  useEffect(() => {
    const loadReportCardSettings = async () => {
      try {
        const r = await axios.get(`${API}/api/report-cards/settings`, { headers });
        setReportCardSource(r.data?.report_card_source || "generated");
      } catch { /* keep default */ }
    };
    loadReportCardSettings();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [lRes, gRes, sRes, pRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/academic/levels`, { headers }),
          axios.get(`${API}/api/academic/grades`, { headers }),
          axios.get(`${API}/api/academic/sections`, { headers }),
          axios.get(`${API}/api/academic/periods`, { headers }),
          axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
        ]);
        setLevels(lRes.data || []);
        setGrades(gRes.data || []);
        setSections(sRes.data || []);
        setPeriods(pRes.data || []);
        if (settingsRes.data) setSettings(settingsRes.data);
        if (pRes.data?.length > 0) {
          const active = pRes.data.find((p) => p.activo) || pRes.data[0];
          setSelectedPeriod(active.id);
        }
      } catch (err) {
        console.error("Error loading structure:", err);
      }
    };
    load();
  }, []);

  const filteredGrades = selectedLevel ? grades.filter((g) => g.nivel_id === selectedLevel) : [];
  const filteredSections = selectedGrade ? sections.filter((s) => s.grado_id === selectedGrade) : [];

  useEffect(() => {
    if (!selectedSection || !selectedPeriod) return;
    const loadReport = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API}/api/grades/consolidated-report/${selectedSection}/${selectedPeriod}`,
          { headers }
        );
        setData(res.data);
      } catch (err) {
        console.error("Error loading consolidated:", err);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [selectedSection, selectedPeriod]);

  const handleExportExcel = async () => {
    try {
      const res = await axios.get(
        `${API}/api/grades/consolidated-report/${selectedSection}/${selectedPeriod}/export/excel`,
        { headers, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `consolidado_${data?.section_display}_${data?.period_name}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting:", err);
    }
  };

  const handlePrint = () => {
    const sheet = tableRef.current;
    if (!sheet) { window.print(); return; }
    // Reunir los estilos del componente (bloques que contienen reglas .cns-)
    const styleText = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent || "")
      .filter((t) => t.includes(".cns-"))
      .join("\n");
    const win = window.open("", "_blank", "width=1280,height=800");
    if (!win) { window.print(); return; } // popup bloqueado → fallback
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Consolidado de Notas</title>
      <style>
        @page { size: A4 landscape; margin: 6mm; }
        html, body { margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        ${styleText}
        .cns-sheet { border:none!important; max-height:none!important; overflow:visible!important; box-shadow:none!important; }
        .cns-fn { position:static!important; }
        .cns-libreta-col { display:none!important; }
        .cns-tbl { width:100%; table-layout:auto; }
        .cns-tbl th, .cns-tbl td { font-size:8px; padding:1px 2px; }
        .cns-hdr-vert { height:120px; }
        .cns-hdr-vert .cns-vtext { font-size:8px; }
        tr, td, th { page-break-inside:avoid; }
      </style></head><body>${sheet.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch (e) { /* noop */ } }, 400);
  };

  // Build flat column list for the table
  // In the Excel, all subjects (áreas + sub-subjects) are at the same header level
  const allColumns = data?.columns || [];

  const summaryHeaders = [
    { key: "conducta", label: "CONDUCTA" },
    { key: "promedio", label: "PROMEDIO" },
    { key: "puntaje", label: "PUNTAJE" },
    { key: "n_desaprobados", label: "N\u00b0 DESAPROBADOS" },
    { key: "orden_merito", label: "ORDEN DE\nM\u00c9RITO" },
    { key: "tercio", label: "TERCIO" },
    { key: "tardanza_injustificada", label: "Tardanza\nInjustificada" },
    { key: "tardanza_justificada", label: "Tardanza\nJustificada" },
    { key: "falta_injustificada", label: "Falta\nInjustificada" },
    { key: "falta_justificada", label: "Falta\nJustificada" },
  ];

  const summaryFooterRows = [
    { label: "Promedio del curso:", key: "promedio" },
    { label: "N\u00b0 de alumnos Aprobados:", key: "aprobados" },
    { label: "N\u00b0 de alumnos Desaprobados:", key: "desaprobados" },
    { label: "% de alumnos Aprobados:", key: "pct_aprobados" },
    { label: "% de alumnos Desaprobados:", key: "pct_desaprobados" },
    { label: "Nota M\u00e1xima:", key: "nota_maxima" },
    { label: "Nota M\u00ednima:", key: "nota_minima" },
  ];

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Detect if this column is an "área" type (should be styled differently)
  const isAreaColumn = (col) => col.type === "area";

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;
  const subdomain = user?.subdomain;

  const hasStudents = data?.students?.length > 0;
  const PLACEHOLDER_ROWS = 30;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="consolidated-grades">
      <Sidebar
        active="consolidado-notas"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
        />

        <main className="flex-1 overflow-y-auto custom-scroll pb-20 lg:pb-0">
          {/* === ACTION BAR (Top — Áreas / Cerrar Bimestre / Excel) === */}
          <div className="px-3 pt-3" data-testid="consolidated-actions-bar">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Consolidado de Notas <span className="text-slate-400 font-normal">— {new Date().getFullYear()}</span></h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageAreas && (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen("areas")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                    data-testid="open-areas-drawer-btn"
                  >
                    <BookMarked className="w-4 h-4" /> Áreas Curriculares
                  </button>
                )}
                {canCloseBim && (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen("cierre")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                    data-testid="open-cierre-drawer-btn"
                  >
                    <Archive className="w-4 h-4" /> Cerrar Bimestre
                  </button>
                )}
                {data && (
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition-colors"
                    data-testid="export-excel-top-btn"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Descargar Excel
                  </button>
                )}
                {data && (user?.role === "owner" || user?.role === "admin") && (
                  <BulkLibretaZipButton
                    sectionId={selectedSection}
                    periodId={selectedPeriod}
                    headers={headers}
                    token={token}
                    user={user}
                    labels={{
                      level: levels.find(l => l.id === selectedLevel)?.nombre,
                      grade: grades.find(g => g.id === selectedGrade)?.nombre,
                      section: sections.find(s => s.id === selectedSection)?.nombre,
                      period: periods.find(p => p.id === selectedPeriod)?.nombre,
                    }}
                    size="md"
                  />
                )}
                {canUploadLibretas && reportCardSource === "pdf_upload" && (
                  <button
                    type="button"
                    onClick={() => setLibretasDrawerOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-700 text-white text-sm font-medium hover:bg-violet-800 transition-colors"
                    data-testid="open-libretas-upload-btn"
                  >
                    <FileText className="w-4 h-4" /> Cargar libretas
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="cns-page">
      <style>{`
        .cns-page { background:#F8FAFC; padding:12px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; }
        .cns-filters { background:#fff; border:1px solid #bbb; padding:10px 16px; margin-bottom:10px; display:flex; flex-wrap:wrap; align-items:flex-end; gap:14px; border-radius:4px; }
        .cns-filters label { font-size:12px; font-weight:700; color:#333; display:block; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.3px; }
        .cns-filters select { padding:6px 10px; border:1px solid #999; font-size:13px; min-width:150px; background:#fff; border-radius:3px; }
        .cns-export { margin-left:auto; display:flex; gap:8px; }
        .cns-export button { padding:7px 16px; font-size:13px; font-weight:700; border:1px solid #666; cursor:pointer; display:flex; align-items:center; gap:5px; border-radius:3px; }
        .cns-btn-xl { background:#217346; color:#fff; border-color:#217346!important; }
        .cns-btn-xl:hover { background:#1a5c38; }
        .cns-btn-pr { background:#f5f5f5; color:#333; }
        .cns-btn-pr:hover { background:#ddd; }

        .cns-sheet { background:#fff; border:2px solid #888; overflow-x:auto; position:relative; border-radius:2px; }
        .cns-tbl { border-collapse:collapse; font-size:12px; width:100%; table-layout:auto; }
        .cns-tbl th, .cns-tbl td { border:1px solid #999; padding:4px 6px; text-align:center; vertical-align:middle; }

        /* === INSTITUTIONAL HEADER (no borders) === */
        .cns-tbl .ih td { border:none; padding:3px 8px; }
        .cns-ih-school { text-align:left!important; font-weight:bold; font-size:14px; color:#1a1a1a; }
        .cns-ih-system { text-align:left!important; font-weight:bold; font-size:13px; color:#444; }
        .cns-ih-label { text-align:right!important; font-size:12px; font-weight:bold; color:#444; }
        .cns-ih-val { text-align:left!important; font-size:12px; color:#222; }
        .cns-ih-title { text-align:center!important; font-weight:bold; font-size:16px; color:#000; padding:8px 4px!important; letter-spacing:0.5px; text-decoration:underline; }
        .cns-ih-ctx-lbl { text-align:left!important; font-weight:bold; font-size:12px; color:#333; }
        .cns-ih-ctx-val { text-align:left!important; font-size:12px; color:#111; }

        /* === COLUMN HEADERS === */
        .cns-hdr-asig { background:#D9E1F2!important; font-weight:bold!important; font-size:12px!important; color:#1a1a1a; text-align:center!important; vertical-align:bottom!important; }
        .cns-hdr-num { background:#D9E1F2!important; font-weight:bold!important; font-size:12px!important; }
        .cns-hdr-name { background:#D9E1F2!important; font-weight:bold!important; font-size:12px!important; text-align:center!important; }

        /* Vertical text for subject/área/summary headers */
        .cns-hdr-vert { height:170px; padding:6px 3px!important; vertical-align:bottom!important; }
        .cns-hdr-vert .cns-vtext { writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; font-size:12px; display:inline-block; text-align:left; line-height:1.2; }
        /* Área column headers (bold) */
        .cns-hdr-área { background:#B4C6E7!important; }
        .cns-hdr-área .cns-vtext { font-weight:bold; color:#111; text-transform:uppercase; }
        /* Sub-subject column headers */
        .cns-hdr-subj { background:#D9E1F2!important; }
        .cns-hdr-subj .cns-vtext { font-weight:500; color:#222; }
        /* Summary column headers */
        .cns-hdr-summ { background:#E2EFDA!important; }
        .cns-hdr-summ .cns-vtext { font-weight:bold; color:#222; }

        /* === FROZEN COLUMNS === */
        .cns-fn { position:sticky; z-index:2; }
        .cns-fn-num { left:0; width:36px; min-width:36px; max-width:36px; background:inherit; }
        .cns-fn-name { left:36px; text-align:left!important; padding-left:8px!important; background:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        thead .cns-fn { z-index:4; }

        /* === DATA ROWS === */
        .cns-dr td { font-size:12px; padding:4px 5px; }
        .cns-dr:nth-child(odd) { background:#fff; }
        .cns-dr:nth-child(even) { background:#f5f7fa; }
        .cns-dr:nth-child(odd) .cns-fn { background:#fff; }
        .cns-dr:nth-child(even) .cns-fn { background:#f5f7fa; }
        .cns-dr:hover { background:#e8eeff; }
        .cns-dr:hover .cns-fn { background:#e8eeff; }
        .cns-grade-fail { color:#cc0000; font-weight:bold; }
        .cns-grade-área { font-weight:bold; background:#edf1fa; }
        .cns-summ-cell { background:#f0f4e8; font-weight:600; }
        .cns-prom-cell { background:#e3ebd5; font-weight:bold; }

        /* === FOOTER ROWS === */
        .cns-fr td { font-size:11px; background:#f9f9f0; padding:3px 5px; }
        .cns-fr-lbl { text-align:left!important; font-weight:bold; padding-left:8px!important; white-space:nowrap; }

        /* === EMPTY & LOADING === */
        .cns-loading { display:flex; align-items:center; justify-content:center; padding:80px; color:#666; font-size:15px; gap:10px; }
        .cns-empty { text-align:center; padding:100px 20px; color:#999; }

        /* === PLACEHOLDER ROWS (no students) === */
        .cns-placeholder td { color:#ccc; font-size:11px; background:#fafafa; }
        .cns-placeholder:nth-child(odd) td { background:#fafafa; }
        .cns-placeholder:nth-child(even) td { background:#f5f5f5; }
        .cns-placeholder .cns-fn { background:inherit; }
        .cns-placeholder:nth-child(odd) .cns-fn { background:#fafafa; }
        .cns-placeholder:nth-child(even) .cns-fn { background:#f5f5f5; }

        /* === NO-STUDENTS WARNING === */
        .cns-warning { background:#FFFBEB; border:1px solid #F59E0B; border-radius:8px; padding:14px 20px; margin-bottom:12px; display:flex; align-items:center; gap:12px; }
        .cns-warning-icon { width:36px; height:36px; border-radius:50%; background:#FEF3C7; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .cns-warning-text { font-size:13px; color:#92400E; line-height:1.5; }
        .cns-warning-text strong { font-weight:700; display:block; font-size:13px; color:#78350F; }

        /* === PRINT (landscape, robusto contra contenedores con overflow) === */
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          html, body { margin:0!important; padding:0!important; background:#fff!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
          /* Ocultar todo y mostrar solo el consolidado */
          body * { visibility:hidden!important; }
          #cns-printable, #cns-printable * { visibility:visible!important; }
          #cns-printable {
            position:absolute!important; left:0!important; top:0!important;
            width:100%!important; max-height:none!important; overflow:visible!important;
            border:none!important; box-shadow:none!important; border-radius:0!important;
          }
          .cns-filters, .cns-export { display:none!important; }
          .cns-libreta-col { display:none!important; }
          .cns-tbl { table-layout:auto; width:100%; }
          .cns-tbl th, .cns-tbl td { font-size:8px; padding:1px 2px; }
          .cns-fn { position:static!important; }
          .cns-fn-name { white-space:normal; overflow:visible; text-overflow:clip; }
          .cns-hdr-vert { height:120px; }
          .cns-hdr-vert .cns-vtext { font-size:8px; }
          tr, td, th { page-break-inside:avoid; }
        }
      `}</style>

      {/* === FILTER BAR === */}
      <div className="cns-filters" data-testid="consolidated-filters">
        <div>
          <label>Nivel</label>
          <select value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); setSelectedGrade(""); setSelectedSection(""); setData(null); }} data-testid="level-selector">
            <option value="">Seleccionar</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        <div>
          <label>Grado</label>
          <select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); setData(null); }} data-testid="grade-selector">
            <option value="">Seleccionar</option>
            {filteredGrades.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div>
          <label>Secci&oacute;n</label>
          <select value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); setData(null); }} data-testid="section-selector">
            <option value="">Seleccionar</option>
            {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label>Periodo</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} data-testid="period-selector">
            <option value="">Seleccionar</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {data && (
          <div className="cns-export" data-testid="export-buttons">
            <button className="cns-btn-xl" onClick={handleExportExcel} data-testid="export-excel-btn"><FileSpreadsheet size={13} /> Excel</button>
            <button className="cns-btn-pr" onClick={handlePrint} data-testid="print-btn"><Printer size={13} /> Imprimir</button>
          </div>
        )}
      </div>

      {/* === CONTENT === */}
      {loading ? (
        <div className="cns-loading"><Loader2 className="w-5 h-5 animate-spin" /> Cargando consolidado...</div>
      ) : !data ? (
        <div className="cns-empty">
          <FileText size={44} style={{ margin: "0 auto 10px", opacity: 0.25 }} />
          <p style={{ fontSize: 13 }}>Selecciona nivel, grado y secci&oacute;n para ver el consolidado</p>
        </div>
      ) : (
        <>
          {/* Warning banner when no students */}
          {data && !hasStudents && (
            <div className="cns-warning" data-testid="no-students-warning">
              <div className="cns-warning-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="cns-warning-text">
                <strong>No hay alumnos registrados en esta sección.</strong>
                Registre alumnos para generar el consolidado de notas.
              </div>
            </div>
          )}

        <div className="cns-sheet" id="cns-printable" ref={tableRef}>
          <table className="cns-tbl" data-testid="consolidated-table">
            <thead>
              {/* ROW 1: School name + Fecha */}
              <tr className="ih">
                <td colSpan={3} className="cns-ih-school cns-fn cns-fn-num" style={{left:0, minWidth:228}}>{data.school_name?.toUpperCase()}</td>
                {allColumns.length > 4 ? (
                  <>
                    <td colSpan={allColumns.length - 4}></td>
                    <td className="cns-ih-label" colSpan={2}>Fecha:</td>
                    <td className="cns-ih-val" colSpan={2}>{dateStr}</td>
                    {summaryHeaders.length > 0 && <td colSpan={summaryHeaders.length}></td>}
                  </>
                ) : (
                  <>
                    <td colSpan={allColumns.length + summaryHeaders.length - 2}></td>
                    <td className="cns-ih-label">Fecha:</td>
                    <td className="cns-ih-val">{dateStr}</td>
                  </>
                )}
                <td></td>
              </tr>
              {/* ROW 2: System name + Hora */}
              <tr className="ih">
                <td colSpan={3} className="cns-ih-system cns-fn cns-fn-num" style={{left:0, minWidth:228}}>{data.system_name}</td>
                {allColumns.length > 4 ? (
                  <>
                    <td colSpan={allColumns.length - 4}></td>
                    <td className="cns-ih-label" colSpan={2}>Hora:</td>
                    <td className="cns-ih-val" colSpan={2}>{timeStr}</td>
                    {summaryHeaders.length > 0 && <td colSpan={summaryHeaders.length}></td>}
                  </>
                ) : (
                  <>
                    <td colSpan={allColumns.length + summaryHeaders.length - 2}></td>
                    <td className="cns-ih-label">Hora:</td>
                    <td className="cns-ih-val">{timeStr}</td>
                  </>
                )}
                <td></td>
              </tr>
              {/* ROW 3-4: Title */}
              <tr className="ih">
                <td colSpan={3 + allColumns.length + summaryHeaders.length + 1} className="cns-ih-title">{data.title}</td>
              </tr>
              {/* ROW 5: Salon, Periodo, Tutor */}
              <tr className="ih">
                <td className="cns-ih-ctx-lbl cns-fn cns-fn-num" style={{left:0}}>Sal&oacute;n:</td>
                <td colSpan={2} className="cns-ih-ctx-val cns-fn cns-fn-name" style={{left:28}}>{data.section_display}</td>
                <td className="cns-ih-ctx-lbl" colSpan={1}>Periodo:</td>
                <td className="cns-ih-ctx-val" colSpan={2}>{data.period_name}</td>
                {allColumns.length > 5 ? (
                  <>
                    <td colSpan={allColumns.length - 5}></td>
                    <td className="cns-ih-ctx-lbl" colSpan={1}>Tutor:</td>
                    <td className="cns-ih-ctx-val" colSpan={summaryHeaders.length + 1}>{data.tutor_name || "Sin asignar"}</td>
                  </>
                ) : (
                  <>
                    <td className="cns-ih-ctx-lbl">Tutor:</td>
                    <td className="cns-ih-ctx-val" colSpan={allColumns.length + summaryHeaders.length - 5}>{data.tutor_name || "Sin asignar"}</td>
                  </>
                )}
                <td></td>
              </tr>

              {/* ROW 6: ASIGNATURAS header + all subject headers (rowSpan=2) + summary headers (rowSpan=2) */}
              <tr>
                <th colSpan={3} rowSpan={1} className="cns-hdr-asig cns-fn" style={{left:0, minWidth:228, verticalAlign:"bottom", position:"sticky", zIndex:4}}>
                  <span className="cns-vtext" style={{writingMode:"vertical-rl", transform:"rotate(180deg)", display:"inline-block", fontWeight:"bold", fontSize:13}}>ASIGNATURAS</span>
                </th>
                {allColumns.map((col) => (
                  <th
                    key={col.id}
                    rowSpan={2}
                    className={`cns-hdr-vert ${isAreaColumn(col) ? "cns-hdr-área" : "cns-hdr-subj"}`}
                    title={col.name}
                  >
                    <span className="cns-vtext">{col.name}</span>
                  </th>
                ))}
                {summaryHeaders.map((sh) => (
                  <th key={sh.key} rowSpan={2} className="cns-hdr-vert cns-hdr-summ">
                    <span className="cns-vtext">{sh.label.replace("\n", " ")}</span>
                  </th>
                ))}
                <th rowSpan={2} className="cns-hdr-vert cns-hdr-summ cns-libreta-col" title="Abrir libreta del alumno">
                  <span className="cns-vtext">Libreta</span>
                </th>
              </tr>
              {/* ROW 7: N° + APELLIDOS Y NOMBRES */}
              <tr>
                <th className="cns-hdr-num cns-fn cns-fn-num">N&deg;</th>
                <th colSpan={2} className="cns-hdr-name cns-fn cns-fn-name">APELLIDOS Y NOMBRES</th>
              </tr>
            </thead>
            <tbody>
              {/* Student data rows OR placeholder rows */}
              {hasStudents ? (
                <>
                  {data.students.map((student) => (
                    <tr key={student.student_id} className="cns-dr" data-testid={`student-row-${student.number}`}>
                      <td className="cns-fn cns-fn-num">{student.number}</td>
                      <td colSpan={2} className="cns-fn cns-fn-name">
                        <Link
                          to={`/libreta/${student.student_id}?all_periods=true${selectedPeriod ? `&period_id=${selectedPeriod}` : ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-900 hover:text-indigo-700 hover:underline cursor-pointer"
                          title="Ver libreta del alumno (se abre en una pestaña nueva)"
                          data-testid={`consolidado-libreta-link-${student.number}`}
                        >
                          {student.student_name}
                        </Link>
                      </td>
                      {allColumns.map((col) => {
                        const val = student.grades[col.id];
                        const isFail = val !== null && val !== undefined && val < 11;
                        const cls = [isFail ? "cns-grade-fail" : "", isAreaColumn(col) ? "cns-grade-área" : ""].filter(Boolean).join(" ");
                        return <td key={col.id} className={cls}>{val ?? ""}</td>;
                      })}
                      <td className="cns-summ-cell">{student.conducta ?? ""}</td>
                      <td className="cns-prom-cell">{student.promedio != null ? student.promedio.toFixed(2) : ""}</td>
                      <td className="cns-summ-cell">{student.puntaje ?? ""}</td>
                      <td className="cns-summ-cell">{student.n_desaprobados || ""}</td>
                      <td className="cns-summ-cell">{student.orden_merito ?? ""}</td>
                      <td className="cns-summ-cell">{student.tercio ?? ""}</td>
                      <td className="cns-summ-cell">{student.tardanza_injustificada ?? ""}</td>
                      <td className="cns-summ-cell">{student.tardanza_justificada ?? ""}</td>
                      <td className="cns-summ-cell">{student.falta_injustificada ?? ""}</td>
                      <td className="cns-summ-cell">{student.falta_justificada ?? ""}</td>
                      <td className="cns-summ-cell cns-libreta-col" style={{padding:"2px 4px"}}>
                        <Link
                          to={`/libreta/${student.student_id}?all_periods=true${selectedPeriod ? `&period_id=${selectedPeriod}` : ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            closedPeriodIds.includes(selectedPeriod)
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-slate-900 text-white hover:bg-slate-700"
                          }`}
                          title={closedPeriodIds.includes(selectedPeriod) ? "Libreta cerrada — abrir en pestaña nueva" : "Ver libreta del alumno en una pestaña nueva"}
                          data-testid={`consolidado-libreta-btn-${student.number}`}
                        >
                          {closedPeriodIds.includes(selectedPeriod) ? <Lock className="w-3 h-3" /> : <Eye className="w-3 h-3" />} Ver
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {/* Spacer */}
                  <tr><td colSpan={4 + allColumns.length + summaryHeaders.length} style={{height:4, border:"none", background:"#fff"}}></td></tr>

                  {/* Summary footer rows */}
                  {summaryFooterRows.map((fr) => (
                    <tr key={fr.key} className="cns-fr">
                      <td className="cns-fn cns-fn-num"></td>
                      <td colSpan={2} className="cns-fr-lbl cns-fn cns-fn-name">{fr.label}</td>
                      {allColumns.map((col) => {
                        const stats = data.summary_stats?.[col.id];
                        const val = stats?.[fr.key];
                        return <td key={col.id}>{val != null ? val : ""}</td>;
                      })}
                      {summaryHeaders.map((sh) => <td key={sh.key}></td>)}
                      <td className="cns-libreta-col"></td>
                    </tr>
                  ))}
                </>
              ) : (
                /* 30 placeholder rows when no students */
                Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
                  <tr key={`ph-${i}`} className="cns-placeholder" data-testid={`placeholder-row-${i + 1}`}>
                    <td className="cns-fn cns-fn-num">{i + 1}</td>
                    <td colSpan={2} className="cns-fn cns-fn-name" style={{color:"#ddd"}}>&mdash;</td>
                    {allColumns.map((col) => (
                      <td key={col.id}>&mdash;</td>
                    ))}
                    {summaryHeaders.map((sh) => (
                      <td key={sh.key}>&mdash;</td>
                    ))}
                    <td className="cns-libreta-col">&mdash;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
          </div>
        </main>
      </div>

      {/* === DRAWER: Áreas Curriculares === */}
      <RightDrawer
        open={drawerOpen === "areas"}
        onClose={() => setDrawerOpen(null)}
        title="Áreas Curriculares"
        subtitle="Organiza las asignaturas según el currículo MINEDU"
        width="min(900px, 75vw)"
        testId="areas-drawer"
      >
        <AdminCurricularAreasPage user={user} token={token} subdomain={user?.subdomain} onLogout={onLogout} embedded />
      </RightDrawer>

      {/* === DRAWER: Cierre de Bimestre === */}
      <RightDrawer
        open={drawerOpen === "cierre"}
        onClose={() => setDrawerOpen(null)}
        title="Cierre de Bimestre"
        subtitle="Congela las libretas para que no se modifiquen"
        width="min(720px, 65vw)"
        testId="cierre-drawer"
      >
        <AdminCierreBimestrePage
          user={user}
          token={token}
          subdomain={user?.subdomain}
          onLogout={onLogout}
          embedded
          onClosePeriod={(result) => {
            const pid = result?.period_id;
            if (pid) setClosedPeriodIds((prev) => Array.from(new Set([...prev, pid])));
          }}
        />
      </RightDrawer>

      <LibretasUploadDrawer
        open={libretasDrawerOpen}
        onClose={() => setLibretasDrawerOpen(false)}
        token={token}
        levels={levels}
        grades={grades}
        sections={sections}
        periods={periods}
        defaultLevelId={selectedLevel}
        defaultGradeId={selectedGrade}
        defaultSectionId={selectedSection}
        defaultPeriodId={selectedPeriod}
      />
    </div>
  );
}
