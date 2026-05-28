import { useState, useEffect, useRef } from "react";
import { X, Palette } from "lucide-react";

/**
 * Canva-style visual color editor — CELL BY CELL.
 * The user clicks ANY individual cell (header text line, info pill, table
 * header cell, area row cell, subject cell, attendance row, comment line,
 * etc.) and the popover opens to paint only that cell.
 *
 * Cell IDs are arbitrary strings; LibretaCard.jsx reads
 * metadata.color_palette[cell_id] for each cell and applies bg + auto-text.
 */

const PRESETS = [
  { hex: "",         label: "Default" },
  { hex: "#ffffff",  label: "Blanco" },
  { hex: "#dbeafe",  label: "Azul claro" },
  { hex: "#d1fae5",  label: "Verde menta" },
  { hex: "#fce7f3",  label: "Rosa pastel" },
  { hex: "#fef3c7",  label: "Amarillo suave" },
  { hex: "#e5e7eb",  label: "Gris claro" },
  { hex: "#1e3a8a",  label: "Azul oscuro" },
  { hex: "#6d28d9",  label: "Púrpura" },
];

function autoContrast(hex) {
  if (!hex || typeof hex !== "string") return "#000";
  const m = hex.trim().replace(/^#/, "");
  let r, g, b;
  if (m.length === 3) { r = parseInt(m[0]+m[0], 16); g = parseInt(m[1]+m[1], 16); b = parseInt(m[2]+m[2], 16); }
  else if (m.length === 6) { r = parseInt(m.slice(0,2), 16); g = parseInt(m.slice(2,4), 16); b = parseInt(m.slice(4,6), 16); }
  else return "#000";
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}

export default function LibretaPaletteEditor({ palette, onChangeColor, onResetAll, saving }) {
  const [open, setOpen] = useState(null); // { cellId, label, x, y } | null
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPopover = (cellId, label) => (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpen({ cellId, label, x: rect.left, y: rect.bottom + 6 });
  };

  const cellBg = (cellId) => {
    const bg = palette?.[cellId];
    if (!bg) return undefined;
    return { backgroundColor: bg, color: autoContrast(bg) };
  };

  const handlePick = (hex) => {
    if (!open) return;
    onChangeColor(open.cellId, hex);
    setOpen(null);
  };

  // Helper to wrap a clickable cell.
  const Cell = ({ id, label, children, style, as = "td", className = "", ...rest }) => {
    const Tag = as;
    const bg = cellBg(id);
    return (
      <Tag
        className={`palette-cell ${className}`}
        style={{ ...(style || {}), ...(bg || {}), cursor: "pointer" }}
        onClick={openPopover(id, label)}
        title={`Click para pintar: ${label}`}
        data-testid={`palette-cell-${id}`}
        {...rest}
      >
        {children}
      </Tag>
    );
  };

  return (
    <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-palette-editor">
      <style>{`
        .palette-cell { transition: outline 0.12s ease; position: relative; }
        .palette-cell:hover { outline: 2px dashed #db2777; outline-offset: 1px; z-index: 5; }
        .palette-cell:hover::after {
          content: "👆 Click";
          position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
          background: #db2777; color: #fff; font-size: 9px; font-weight: 700;
          padding: 1px 6px; border-radius: 4px; white-space: nowrap;
          pointer-events: none; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }
      `}</style>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-pink-100 text-pink-700">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Paleta de colores · Celda por celda</h3>
            <p className="text-xs text-slate-700 mt-0.5">
              <span className="inline-block px-2 py-0.5 rounded bg-pink-100 text-pink-800 font-bold">👆 HAZ CLIC</span>{" "}
              en cualquier celda individual de la libreta-muestra para pintarla. El texto se ajusta automáticamente al contraste.
            </p>
          </div>
        </div>
        <button type="button" onClick={onResetAll} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors disabled:opacity-50" data-testid="palette-restore-all">
          Restaurar todos
        </button>
      </div>

      <div className="relative rounded-2xl p-4 overflow-x-auto" style={{ background: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #fef3c7 100%)", boxShadow: "inset 0 0 30px rgba(168, 85, 247, 0.1)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none rounded-2xl" style={{ backgroundImage: "radial-gradient(#a855f7 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

        <div className="relative mx-auto bg-white rounded shadow-lg" style={{ width: "100%", maxWidth: "780px", padding: "16px 18px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: "10px" }}>

          {/* HEADER ROW */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cell id="header.logo" label="Logo del colegio" as="div" style={{ width: 50, height: 50, borderRadius: "50%", border: "2px solid #1a3a52", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a3a52", fontWeight: "bold", flexShrink: 0 }}>C</Cell>
            <div style={{ flex: 1, textAlign: "center" }}>
              <Cell id="header.line1" label="Línea superior" as="div" style={{ fontSize: 9, padding: "1px 4px" }}>INSTITUCIÓN EDUCATIVA PRIVADA</Cell>
              <Cell id="header.school_name" label="Nombre del colegio" as="div" style={{ fontSize: 14, fontWeight: "bold", fontFamily: "Times, serif", margin: "1px 0", padding: "1px 4px" }}>NOMBRE DEL COLEGIO</Cell>
              <Cell id="header.line3" label="Subtítulo" as="div" style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600, padding: "1px 4px" }}>Informe de Progreso del Estudiante - 2026</Cell>
              <Cell id="header.nivel" label="Grado · Sección" as="div" style={{ fontSize: 9, fontWeight: "bold", marginTop: 2, padding: "1px 4px" }}>GRADO · SECCIÓN</Cell>
              <Cell id="header.bimestre" label="Bimestre" as="div" style={{ fontSize: 9, fontWeight: "bold", padding: "1px 4px" }}>I BIMESTRE</Cell>
            </div>
            <Cell id="header.initials_box" label="Cuadro lateral (AB)" as="div" style={{ width: 42, height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 13, borderRadius: 2, flexShrink: 0, background: "#94a3b8", color: "#fff" }}>AB</Cell>
          </div>

          {/* STUDENT INFO PILLS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr 0.5fr", gap: 4, marginTop: 6 }}>
            <Cell id="info.codigo"    label="Pastilla: Código"           as="div" style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "2px 4px", textAlign: "center", fontSize: 8.5, fontWeight: 600 }}>STU-000001</Cell>
            <Cell id="info.apellidos" label="Pastilla: Apellidos y Nombres" as="div" style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "2px 4px", textAlign: "center", fontSize: 8.5, fontWeight: 600 }}>APELLIDOS NOMBRES</Cell>
            <Cell id="info.salon"     label="Pastilla: Salón"            as="div" style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "2px 4px", textAlign: "center", fontSize: 8.5, fontWeight: 600 }}>GRADO SECCIÓN</Cell>
            <Cell id="info.ord"       label="Pastilla: N° Orden"         as="div" style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "2px 4px", textAlign: "center", fontSize: 8.5, fontWeight: 600 }}>1</Cell>
          </div>

          {/* GRADES TABLE */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: 6, fontSize: 8.5 }}>
            <thead>
              <tr>
                <Cell id="th.areas"          label="Header: ÁREAS"          as="th" rowSpan={2} style={thStyle()}>ÁREAS</Cell>
                <Cell id="th.asignaturas"    label="Header: ASIGNATURAS"    as="th" rowSpan={2} style={thStyle()}>ASIGNATURAS</Cell>
                <Cell id="th.bimestres"      label="Header: BIMESTRES"      as="th" colSpan={4} style={thStyle()}>BIMESTRES</Cell>
                <Cell id="th.promedio_final" label="Header: Promedio Final" as="th" rowSpan={2} style={thStyle()}>Promedio Final</Cell>
              </tr>
              <tr>
                <Cell id="th.bim1" label="Header: I"   as="th" style={thStyle()}>I</Cell>
                <Cell id="th.bim2" label="Header: II"  as="th" style={thStyle()}>II</Cell>
                <Cell id="th.bim3" label="Header: III" as="th" style={thStyle()}>III</Cell>
                <Cell id="th.bim4" label="Header: IV"  as="th" style={thStyle()}>IV</Cell>
              </tr>
            </thead>
            <tbody>
              {/* Área 1 (single) */}
              <tr>
                <Cell id="td.area.0" label="Celda: Área 1" colSpan={2} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, fontWeight: "bold" }}>Área 1</Cell>
                <Cell id="td.area.0.bim1" label="Celda: Área 1 · I"   style={tdStyle()}>—</Cell>
                <Cell id="td.area.0.bim2" label="Celda: Área 1 · II"  style={tdStyle()}>—</Cell>
                <Cell id="td.area.0.bim3" label="Celda: Área 1 · III" style={tdStyle()}>—</Cell>
                <Cell id="td.area.0.bim4" label="Celda: Área 1 · IV"  style={tdStyle()}>—</Cell>
                <Cell id="td.area.0.final" label="Celda: Área 1 · Final" style={tdStyle()}>—</Cell>
              </tr>
              {/* Área 2 with 2 subjects */}
              <tr>
                <Cell id="td.area.1" label="Celda: Área 2" rowSpan={3} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, fontWeight: "bold" }}>Área 2</Cell>
                <Cell id="td.subject.0" label="Celda: Asignatura 1" style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6 }}>Asignatura 1</Cell>
                <Cell id="td.subject.0.bim1" label="Celda: Asignatura 1 · I"   style={tdStyle()}>—</Cell>
                <Cell id="td.subject.0.bim2" label="Celda: Asignatura 1 · II"  style={tdStyle()}>—</Cell>
                <Cell id="td.subject.0.bim3" label="Celda: Asignatura 1 · III" style={tdStyle()}>—</Cell>
                <Cell id="td.subject.0.bim4" label="Celda: Asignatura 1 · IV"  style={tdStyle()}>—</Cell>
                <Cell id="td.subject.0.final" label="Celda: Asignatura 1 · Final" style={tdStyle()}>—</Cell>
              </tr>
              <tr>
                <Cell id="td.subject.1" label="Celda: Asignatura 2" style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6 }}>Asignatura 2</Cell>
                <Cell id="td.subject.1.bim1" label="Celda: Asignatura 2 · I"   style={tdStyle()}>—</Cell>
                <Cell id="td.subject.1.bim2" label="Celda: Asignatura 2 · II"  style={tdStyle()}>—</Cell>
                <Cell id="td.subject.1.bim3" label="Celda: Asignatura 2 · III" style={tdStyle()}>—</Cell>
                <Cell id="td.subject.1.bim4" label="Celda: Asignatura 2 · IV"  style={tdStyle()}>—</Cell>
                <Cell id="td.subject.1.final" label="Celda: Asignatura 2 · Final" style={tdStyle()}>—</Cell>
              </tr>
              <tr>
                <Cell id="td.promedio.1" label="Celda: Promedio Área 2 (etiqueta)" style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, fontWeight: "bold" }}>Promedio Área:</Cell>
                <Cell id="td.promedio.1.bim1" label="Celda: Promedio Área 2 · I"   style={{ ...tdStyle(), fontWeight: "bold" }}>—</Cell>
                <Cell id="td.promedio.1.bim2" label="Celda: Promedio Área 2 · II"  style={{ ...tdStyle(), fontWeight: "bold" }}>—</Cell>
                <Cell id="td.promedio.1.bim3" label="Celda: Promedio Área 2 · III" style={{ ...tdStyle(), fontWeight: "bold" }}>—</Cell>
                <Cell id="td.promedio.1.bim4" label="Celda: Promedio Área 2 · IV"  style={{ ...tdStyle(), fontWeight: "bold" }}>—</Cell>
                <Cell id="td.promedio.1.final" label="Celda: Promedio Área 2 · Final" style={{ ...tdStyle(), fontWeight: "bold" }}>—</Cell>
              </tr>
            </tbody>
          </table>

          {/* CONDUCTA + ESTADÍSTICA */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: 8 }}>
              <thead><tr><Cell id="conducta.header" label="Header: EVALUACIÓN CONDUCTUAL" as="th" colSpan={6} style={thStyle()}>EVALUACIÓN CONDUCTUAL</Cell></tr></thead>
              <tbody>
                {[
                  ["Asistencia y puntualidad", "conducta.row.0"],
                  ["Presentación personal",    "conducta.row.1"],
                  ["Cumplimiento de normas",   "conducta.row.2"],
                ].map(([label, id]) => (
                  <tr key={id}>
                    <Cell id={id} label={`Conducta: ${label}`} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{label}</Cell>
                    {[1,2,3,4,5].map(i => <Cell key={i} id={`${id}.c${i}`} label={`${label} · col ${i}`} style={tdStyle()}>—</Cell>)}
                  </tr>
                ))}
              </tbody>
            </table>

            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: 8 }}>
              <thead><tr><Cell id="estadistica.header" label="Header: ESTADÍSTICA" as="th" colSpan={6} style={thStyle()}>ESTADÍSTICA</Cell></tr></thead>
              <tbody>
                {[
                  ["Puntaje",        "estadistica.row.0"],
                  ["Promedio",       "estadistica.row.1"],
                  ["Orden de Mérito","estadistica.row.2"],
                ].map(([label, id]) => (
                  <tr key={id}>
                    <Cell id={id} label={`Estadística: ${label}`} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{label}</Cell>
                    {[1,2,3,4,5].map(i => <Cell key={i} id={`${id}.c${i}`} label={`${label} · col ${i}`} style={tdStyle()}>—</Cell>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ASISTENCIA */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: 8, marginTop: 4 }}>
            <thead><tr><Cell id="attendance.header" label="Header: ASISTENCIAS Y TARDANZAS" as="th" colSpan={6} style={thStyle()}>ASISTENCIAS Y TARDANZAS</Cell></tr></thead>
            <tbody>
              {[
                ["Presente",          "attendance.row.0"],
                ["Tardanza",          "attendance.row.1"],
                ["Falta justificada", "attendance.row.2"],
              ].map(([label, id]) => (
                <tr key={id}>
                  <Cell id={id} label={`Asistencia: ${label}`} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{label}</Cell>
                  {[1,2,3,4,5].map(i => <Cell key={i} id={`${id}.c${i}`} label={`${label} · col ${i}`} style={tdStyle()}>—</Cell>)}
                </tr>
              ))}
            </tbody>
          </table>

          {/* COMENTARIOS */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: 8, marginTop: 4 }}>
            <thead>
              <tr>
                <Cell id="comments.header.bim" label="Header: BIM (comentarios)" as="th" style={{ ...thStyle(), width: 30 }}>BIM</Cell>
                <Cell id="comments.header"     label="Header: COMENTARIOS DEL TUTOR (A)" as="th" style={thStyle()}>COMENTARIOS DEL TUTOR (A)</Cell>
              </tr>
            </thead>
            <tbody>
              {["I", "II"].map((p, idx) => (
                <tr key={p}>
                  <Cell id={`comments.bim.${idx}`} label={`Comentarios: ${p}`} style={tdStyle()}>{p}</Cell>
                  <Cell id={`comments.text.${idx}`} label={`Comentarios: texto ${p}`} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4, height: 18 }}>—</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-pink-900">
        <b>💡 Tip:</b> ahora puedes pintar <b>celda por celda</b>. Si quieres todas las celdas de una columna del mismo color, píntalas una por una — el sistema guarda cada decisión individualmente.
      </div>

      {/* POPOVER */}
      {open && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white border-2 border-pink-300 rounded-xl shadow-2xl p-3"
          style={{
            left: Math.max(8, Math.min(open.x, window.innerWidth - 320)),
            top: open.y + 220 > window.innerHeight ? Math.max(8, open.y - 240) : open.y,
            width: 300,
          }}
          data-testid="palette-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-800 truncate pr-2">🎨 {open.label}</div>
            <button type="button" onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0" data-testid="palette-popover-close" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1.5 mb-2">
            {PRESETS.map((p) => {
              const selected = (palette?.[open.cellId] || "") === p.hex;
              return (
                <button key={p.hex || "default"} type="button" onClick={() => handlePick(p.hex)} disabled={saving} title={p.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${selected ? "border-slate-900 ring-2 ring-pink-300 scale-110" : "border-slate-300 hover:scale-110"} disabled:opacity-50`}
                  style={{ background: p.hex || "repeating-linear-gradient(45deg, #fff, #fff 4px, #e5e7eb 4px, #e5e7eb 8px)" }}
                  data-testid={`palette-popover-preset-${p.hex.replace("#", "") || "default"}`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 text-xs text-slate-600">
              <span>Personalizado:</span>
              <input type="color"
                value={palette?.[open.cellId] && /^#[0-9a-fA-F]{6}$/.test(palette[open.cellId]) ? palette[open.cellId] : "#ffffff"}
                disabled={saving}
                onChange={(e) => handlePick(e.target.value)}
                className="w-9 h-7 rounded border border-slate-300 cursor-pointer"
                data-testid="palette-popover-custom"
              />
            </label>
            <button type="button" onClick={() => handlePick("")} disabled={saving}
              className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 disabled:opacity-50"
              data-testid="palette-popover-reset">
              Quitar color
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function thStyle() { return { border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold" }; }
function tdStyle() { return { border: "1px solid #000", padding: "2px 4px", textAlign: "center", height: 14 }; }
