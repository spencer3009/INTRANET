import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Loader2, FileSpreadsheet, FileText, Printer } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ConsolidatedGradesPage({ user, token }) {
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
  const tableRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [lRes, gRes, sRes, pRes] = await Promise.all([
          axios.get(`${API}/api/academic/levels`, { headers }),
          axios.get(`${API}/api/academic/grades`, { headers }),
          axios.get(`${API}/api/academic/sections`, { headers }),
          axios.get(`${API}/api/academic/periods`, { headers }),
        ]);
        setLevels(lRes.data || []);
        setGrades(gRes.data || []);
        setSections(sRes.data || []);
        setPeriods(pRes.data || []);
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

  const handlePrint = () => window.print();

  // Build flat column list for the table
  // In the Excel, all subjects (areas + sub-subjects) are at the same header level
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

  // Detect if this column is an "area" type (should be styled differently)
  const isAreaColumn = (col) => col.type === "area";

  return (
    <div className="cns-page" data-testid="consolidated-grades">
      <style>{`
        .cns-page { background:#e8e8e8; min-height:100vh; padding:10px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; }
        .cns-filters { background:#fff; border:1px solid #aaa; padding:8px 12px; margin-bottom:8px; display:flex; flex-wrap:wrap; align-items:flex-end; gap:10px; }
        .cns-filters label { font-size:10px; font-weight:700; color:#333; display:block; margin-bottom:1px; text-transform:uppercase; letter-spacing:0.3px; }
        .cns-filters select { padding:4px 6px; border:1px solid #999; font-size:11px; min-width:140px; background:#fff; }
        .cns-export { margin-left:auto; display:flex; gap:6px; }
        .cns-export button { padding:5px 12px; font-size:11px; font-weight:700; border:1px solid #666; cursor:pointer; display:flex; align-items:center; gap:4px; border-radius:2px; }
        .cns-btn-xl { background:#217346; color:#fff; border-color:#217346!important; }
        .cns-btn-xl:hover { background:#1a5c38; }
        .cns-btn-pr { background:#f5f5f5; color:#333; }
        .cns-btn-pr:hover { background:#ddd; }

        .cns-sheet { background:#fff; border:2px solid #666; overflow:auto; max-height:calc(100vh - 90px); position:relative; }
        .cns-tbl { border-collapse:collapse; font-size:9px; width:max-content; min-width:100%; }
        .cns-tbl th, .cns-tbl td { border:1px solid #777; padding:2px 3px; text-align:center; vertical-align:middle; }

        /* === INSTITUTIONAL HEADER (no borders) === */
        .cns-tbl .ih td { border:none; padding:1px 4px; }
        .cns-ih-school { text-align:left!important; font-weight:bold; font-size:11px; color:#1a1a1a; }
        .cns-ih-system { text-align:left!important; font-weight:bold; font-size:10px; color:#333; }
        .cns-ih-label { text-align:right!important; font-size:9px; font-weight:bold; color:#444; }
        .cns-ih-val { text-align:left!important; font-size:9px; color:#222; }
        .cns-ih-title { text-align:center!important; font-weight:bold; font-size:13px; color:#000; padding:5px 4px!important; letter-spacing:0.5px; }
        .cns-ih-ctx-lbl { text-align:left!important; font-weight:bold; font-size:9px; color:#333; }
        .cns-ih-ctx-val { text-align:left!important; font-size:9px; color:#111; }

        /* === COLUMN HEADERS === */
        .cns-hdr-asig { background:#D9E1F2!important; font-weight:bold!important; font-size:9px!important; color:#1a1a1a; text-align:center!important; vertical-align:bottom!important; }
        .cns-hdr-num { background:#D9E1F2!important; font-weight:bold!important; font-size:9px!important; }
        .cns-hdr-name { background:#D9E1F2!important; font-weight:bold!important; font-size:9px!important; text-align:center!important; }

        /* Vertical text for subject/area/summary headers */
        .cns-hdr-vert { height:160px; width:32px; min-width:32px; max-width:32px; padding:4px 2px!important; vertical-align:bottom!important; }
        .cns-hdr-vert .cns-vtext { writing-mode:vertical-rl; transform:rotate(180deg); white-space:nowrap; font-size:9px; display:inline-block; text-align:left; line-height:1.1; }
        /* Area column headers (bold) */
        .cns-hdr-area { background:#B4C6E7!important; }
        .cns-hdr-area .cns-vtext { font-weight:bold; color:#111; text-transform:uppercase; }
        /* Sub-subject column headers */
        .cns-hdr-subj { background:#D9E1F2!important; }
        .cns-hdr-subj .cns-vtext { font-weight:500; color:#222; }
        /* Summary column headers */
        .cns-hdr-summ { background:#E2EFDA!important; }
        .cns-hdr-summ .cns-vtext { font-weight:bold; color:#222; }

        /* === FROZEN COLUMNS === */
        .cns-fn { position:sticky; z-index:2; }
        .cns-fn-num { left:0; min-width:28px; width:28px; max-width:28px; background:inherit; }
        .cns-fn-name { left:28px; min-width:200px; text-align:left!important; padding-left:5px!important; background:inherit; }
        thead .cns-fn { z-index:4; }

        /* === DATA ROWS === */
        .cns-dr td { font-size:9px; padding:2px 2px; }
        .cns-dr td.cns-dcol { width:32px; min-width:32px; max-width:32px; }
        .cns-dr:nth-child(odd) { background:#fff; }
        .cns-dr:nth-child(even) { background:#f7f8fa; }
        .cns-dr:nth-child(odd) .cns-fn { background:#fff; }
        .cns-dr:nth-child(even) .cns-fn { background:#f7f8fa; }
        .cns-dr:hover { background:#eef3ff; }
        .cns-dr:hover .cns-fn { background:#eef3ff; }
        .cns-grade-fail { color:#cc0000; font-weight:bold; }
        .cns-grade-area { font-weight:bold; background:#edf1fa; }
        .cns-summ-cell { background:#f0f4e8; font-weight:600; }
        .cns-prom-cell { background:#e3ebd5; font-weight:bold; }

        /* === FOOTER ROWS === */
        .cns-fr td { font-size:8px; background:#f9f9f0; padding:1px 3px; }
        .cns-fr-lbl { text-align:left!important; font-weight:bold; padding-left:5px!important; white-space:nowrap; }

        /* === EMPTY & LOADING === */
        .cns-loading { display:flex; align-items:center; justify-content:center; padding:60px; color:#666; font-size:13px; gap:8px; }
        .cns-empty { text-align:center; padding:80px 20px; color:#999; }

        /* === PRINT === */
        @media print {
          .cns-filters, .cns-export { display:none!important; }
          .cns-page { padding:0; background:#fff; }
          .cns-sheet { border:none; max-height:none; overflow:visible; }
          .cns-tbl th, .cns-tbl td { font-size:7px; padding:1px 1px; }
          .cns-fn { position:static!important; }
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
          <div className="cns-export">
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
        <div className="cns-sheet" ref={tableRef}>
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
              </tr>
              {/* ROW 3-4: Title */}
              <tr className="ih">
                <td colSpan={3 + allColumns.length + summaryHeaders.length} className="cns-ih-title">{data.title}</td>
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
              </tr>

              {/* ROW 6: ASIGNATURAS header + all subject headers (rowSpan=2) + summary headers (rowSpan=2) */}
              <tr>
                <th colSpan={3} rowSpan={1} className="cns-hdr-asig cns-fn cns-fn-num" style={{left:0, minWidth:228, verticalAlign:"bottom"}}>
                  <span className="cns-vtext" style={{writingMode:"vertical-rl", transform:"rotate(180deg)", display:"inline-block", fontWeight:"bold", fontSize:10}}>ASIGNATURAS</span>
                </th>
                {allColumns.map((col) => (
                  <th
                    key={col.id}
                    rowSpan={2}
                    className={`cns-hdr-vert ${isAreaColumn(col) ? "cns-hdr-area" : "cns-hdr-subj"}`}
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
              </tr>
              {/* ROW 7: N° + APELLIDOS Y NOMBRES */}
              <tr>
                <th className="cns-hdr-num cns-fn cns-fn-num">N&deg;</th>
                <th colSpan={2} className="cns-hdr-name cns-fn cns-fn-name">APELLIDOS Y NOMBRES</th>
              </tr>
            </thead>
            <tbody>
              {/* Student data rows */}
              {data.students?.map((student) => (
                <tr key={student.student_id} className="cns-dr" data-testid={`student-row-${student.number}`}>
                  <td className="cns-fn cns-fn-num">{student.number}</td>
                  <td colSpan={2} className="cns-fn cns-fn-name">{student.student_name}</td>
                  {allColumns.map((col) => {
                    const val = student.grades[col.id];
                    const isFail = val !== null && val !== undefined && val < 11;
                    const cls = ["cns-dcol", isFail ? "cns-grade-fail" : "", isAreaColumn(col) ? "cns-grade-area" : ""].filter(Boolean).join(" ");
                    return <td key={col.id} className={cls}>{val ?? ""}</td>;
                  })}
                  <td className="cns-dcol cns-summ-cell">{student.conducta ?? ""}</td>
                  <td className="cns-dcol cns-prom-cell">{student.promedio != null ? student.promedio.toFixed(2) : ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.puntaje ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.n_desaprobados || ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.orden_merito ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.tercio ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.tardanza_injustificada ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.tardanza_justificada ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.falta_injustificada ?? ""}</td>
                  <td className="cns-dcol cns-summ-cell">{student.falta_justificada ?? ""}</td>
                </tr>
              ))}

              {data.students?.length === 0 && (
                <tr>
                  <td colSpan={3 + allColumns.length + summaryHeaders.length} style={{ padding: 30, color: "#999", fontSize: 12 }}>
                    No hay alumnos registrados en esta secci&oacute;n
                  </td>
                </tr>
              )}

              {/* Spacer */}
              {data.students?.length > 0 && (
                <tr><td colSpan={3 + allColumns.length + summaryHeaders.length} style={{height:4, border:"none", background:"#fff"}}></td></tr>
              )}

              {/* Summary footer rows */}
              {data.students?.length > 0 && summaryFooterRows.map((fr) => (
                <tr key={fr.key} className="cns-fr">
                  <td className="cns-fn cns-fn-num"></td>
                  <td colSpan={2} className="cns-fr-lbl cns-fn cns-fn-name">{fr.label}</td>
                  {allColumns.map((col) => {
                    const stats = data.summary_stats?.[col.id];
                    const val = stats?.[fr.key];
                    return <td key={col.id}>{val != null ? val : ""}</td>;
                  })}
                  {summaryHeaders.map((sh) => <td key={sh.key}></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
