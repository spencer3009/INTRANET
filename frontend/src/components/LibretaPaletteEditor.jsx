import { useState, useEffect, useRef } from "react";
import { X, Palette } from "lucide-react";

/**
 * Canva-style visual color editor for the libreta.
 * Renders a complete mock libreta layout with placeholder data, and lets the
 * user click ANY zone to pop up a color picker right next to it. The whole
 * libreta repaints instantly. No separate cards, no guessing.
 *
 * Zone keys are the same ones consumed by LibretaCard.jsx metadata.color_palette:
 *   header_banner, header_logo, initials_box, table_headers, area_rows,
 *   subject_rows, promedio_rows, asistencia_table, conducta_table, tutor_comments
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

const ZONE_LABELS = {
  header_banner:   "Encabezado",
  header_logo:     "Logo del colegio",
  initials_box:    "Cuadro lateral",
  table_headers:   "Headers de tabla",
  area_rows:       "Filas de Área",
  subject_rows:    "Filas de Asignatura",
  promedio_rows:   "Filas de Promedio",
  asistencia_table:"Tabla de Asistencia",
  conducta_table:  "Tabla de Conducta",
  tutor_comments:  "Comentarios del Tutor",
};

function autoContrast(hex) {
  if (!hex || typeof hex !== "string") return "#000";
  const m = hex.trim().replace(/^#/, "");
  let r, g, b;
  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16); g = parseInt(m[1] + m[1], 16); b = parseInt(m[2] + m[2], 16);
  } else if (m.length === 6) {
    r = parseInt(m.slice(0, 2), 16); g = parseInt(m.slice(2, 4), 16); b = parseInt(m.slice(4, 6), 16);
  } else return "#000";
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}

export default function LibretaPaletteEditor({ palette, onChangeColor, onResetAll, saving }) {
  const [open, setOpen] = useState(null); // { zone, x, y } | null
  const popoverRef = useRef(null);

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Helper: make a zone clickable. Wraps the click handler + visual feedback.
  const zoneClick = (zone) => (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpen({
      zone,
      // position: fixed → coords are relative to the VIEWPORT, NOT the document.
      // Don't add scrollX/Y here or the popover will end up below the fold
      // when the user scrolled to reach the editor.
      x: rect.left,
      y: rect.bottom + 6,
    });
  };

  const zoneBg = (zone) => {
    const bg = palette[zone];
    if (!bg) return undefined;
    return { backgroundColor: bg, color: autoContrast(bg) };
  };
  const zoneRowBg = (zone) => {
    const bg = palette[zone];
    return bg ? { backgroundColor: bg } : undefined;
  };
  const zoneRowText = (zone) => {
    const bg = palette[zone];
    return bg ? { color: autoContrast(bg) } : undefined;
  };

  // Common style props for clickable zones.
  // The wrapping `.palette-zone` class adds a "Click para pintar" tooltip
  // bubble on hover so the user knows what to do instead of just hovering.
  const clickable = "palette-zone cursor-pointer transition-all hover:outline hover:outline-2 hover:outline-dashed hover:outline-pink-500 hover:outline-offset-1 relative";

  const handlePick = (hex) => {
    if (open) {
      onChangeColor(open.zone, hex);
      setOpen(null);
    }
  };

  return (
    <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-palette-editor">
      {/* Tooltip rule that appears next to the cursor on hover of every zone.
          Pure CSS — no extra JS state needed. */}
      <style>{`
        .palette-zone:hover::after {
          content: "👆 Click para pintar";
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%);
          background: #db2777;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 10;
          box-shadow: 0 4px 10px -4px rgba(0,0,0,0.4);
        }
      `}</style>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-pink-100 text-pink-700">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Paleta de colores</h3>
            <p className="text-xs text-slate-700 mt-0.5">
              <span className="inline-block px-2 py-0.5 rounded bg-pink-100 text-pink-800 font-bold">👆 HAZ CLIC</span>{" "}
              en cualquier zona de la libreta de muestra para abrir el selector de color. El texto se ajusta automáticamente al contraste.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetAll}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
          data-testid="palette-restore-all"
        >
          Restaurar todos
        </button>
      </div>

      {/* Canva-style canvas around the mock libreta */}
      <div
        className="relative rounded-2xl p-4 overflow-x-auto"
        style={{
          background: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #fef3c7 100%)",
          boxShadow: "inset 0 0 30px rgba(168, 85, 247, 0.1)",
        }}
      >
        {/* Subtle dotted background */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none rounded-2xl"
          style={{
            backgroundImage: "radial-gradient(#a855f7 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Mock libreta sheet */}
        <div
          className="relative mx-auto bg-white rounded shadow-lg"
          style={{ width: "100%", maxWidth: "780px", padding: "16px 18px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: "10px" }}
        >
          {/* ── HEADER ── */}
          <div
            className={clickable}
            onClick={zoneClick("header_banner")}
            style={{ ...(zoneBg("header_banner") || {}), display: "flex", alignItems: "center", gap: "8px", padding: "6px", borderRadius: "4px" }}
            data-testid="palette-zone-header_banner"
            title="Click para cambiar el color del encabezado"
          >
            <div
              className={clickable}
              onClick={zoneClick("header_logo")}
              style={{ ...(zoneBg("header_logo") || { backgroundColor: "#fff" }), width: "50px", height: "50px", borderRadius: "50%", border: "2px solid #1a3a52", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a3a52", fontWeight: "bold", flexShrink: 0 }}
              data-testid="palette-zone-header_logo"
              title="Click para cambiar el color del logo"
            >
              C
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "9px" }}>INSTITUCIÓN EDUCATIVA PRIVADA</div>
              <div style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "Times, serif", margin: "1px 0" }}>NOMBRE DEL COLEGIO</div>
              <div style={{ fontSize: "10px", color: zoneBg("header_banner") ? "inherit" : "#1d4ed8", fontWeight: 600 }}>Informe de Progreso del Estudiante - 2026</div>
              <div style={{ fontSize: "9px", fontWeight: "bold", marginTop: "2px" }}>GRADO · SECCIÓN</div>
              <div style={{ fontSize: "9px", fontWeight: "bold" }}>I BIMESTRE</div>
            </div>
            <div
              className={clickable}
              onClick={zoneClick("initials_box")}
              style={{ ...(zoneBg("initials_box") || { backgroundColor: "#94a3b8", color: "#fff" }), width: "42px", height: "56px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "13px", borderRadius: "2px", flexShrink: 0 }}
              data-testid="palette-zone-initials_box"
              title="Click para cambiar el color del cuadro lateral"
            >
              AB
            </div>
          </div>

          {/* Student info row (not editable visually for color palette) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr 0.5fr", gap: "4px", marginTop: "6px", opacity: 0.5 }}>
            {["STU-000001", "APELLIDOS NOMBRES", "GRADO SECCIÓN", "1"].map((v, i) => (
              <div key={i} style={{ border: "1px solid #cbd5e1", borderRadius: "999px", padding: "2px 4px", textAlign: "center", fontSize: "8.5px", fontWeight: 600 }}>{v}</div>
            ))}
          </div>

          {/* ── GRADES TABLE ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: "6px", fontSize: "8.5px" }}>
            <thead
              className={clickable}
              onClick={zoneClick("table_headers")}
              style={zoneBg("table_headers")}
              data-testid="palette-zone-table_headers"
              title="Click para cambiar el color de los headers"
            >
              <tr>
                <th rowSpan={2} style={thStyle()}>ÁREAS</th>
                <th rowSpan={2} style={thStyle()}>ASIGNATURAS</th>
                <th colSpan={4} style={thStyle()}>BIMESTRES</th>
                <th rowSpan={2} style={thStyle()}>Promedio Final</th>
              </tr>
              <tr>
                {["I", "II", "III", "IV"].map((p) => <th key={p} style={thStyle()}>{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {/* Area 1: single subject — area row style applies */}
              <tr className={clickable} onClick={zoneClick("area_rows")} style={zoneRowBg("area_rows")} data-testid="palette-zone-area_rows" title="Click para cambiar el color de las filas de Área">
                <td colSpan={2} style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, fontWeight: "bold", ...(zoneRowText("area_rows") || {}) }}>Área 1</td>
                {[1,2,3,4].map(i => <td key={i} style={tdStyle()}>—</td>)}
                <td style={tdStyle()}>—</td>
              </tr>

              {/* Area 2 with 2 subjects + promedio row */}
              <tr className={clickable} onClick={zoneClick("subject_rows")} style={zoneRowBg("subject_rows")} data-testid="palette-zone-subject_rows-1" title="Click para cambiar el color de las filas de Asignatura">
                <td rowSpan={3} style={{ ...tdStyle(), ...(zoneRowBg("area_rows") || {}), textAlign: "left", paddingLeft: 6, fontWeight: "bold", ...(zoneRowText("area_rows") || {}) }} onClick={zoneClick("area_rows")} className={clickable}>Área 2</td>
                <td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, ...(zoneRowText("subject_rows") || {}) }}>Asignatura 1</td>
                {[1,2,3,4].map(i => <td key={i} style={tdStyle()}>—</td>)}
                <td style={tdStyle()}>—</td>
              </tr>
              <tr className={clickable} onClick={zoneClick("subject_rows")} style={zoneRowBg("subject_rows")} data-testid="palette-zone-subject_rows-2">
                <td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, ...(zoneRowText("subject_rows") || {}) }}>Asignatura 2</td>
                {[1,2,3,4].map(i => <td key={i} style={tdStyle()}>—</td>)}
                <td style={tdStyle()}>—</td>
              </tr>
              <tr className={clickable} onClick={zoneClick("promedio_rows")} style={zoneRowBg("promedio_rows")} data-testid="palette-zone-promedio_rows" title="Click para cambiar el color de las filas de Promedio">
                <td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 6, fontWeight: "bold", ...(zoneRowText("promedio_rows") || {}) }}>Promedio Área:</td>
                {[1,2,3,4].map(i => <td key={i} style={{ ...tdStyle(), fontWeight: "bold" }}>—</td>)}
                <td style={{ ...tdStyle(), fontWeight: "bold" }}>—</td>
              </tr>
            </tbody>
          </table>

          {/* ── Info tables grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "6px" }}>
            {/* Conducta */}
            <table
              className={clickable}
              onClick={zoneClick("conducta_table")}
              style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "8px", ...(zoneBg("conducta_table") || {}) }}
              data-testid="palette-zone-conducta_table"
              title="Click para cambiar el color de la tabla de Conducta"
            >
              <thead>
                <tr><th colSpan={6} style={thStyle()}>EVALUACIÓN CONDUCTUAL</th></tr>
              </thead>
              <tbody>
                {["Asistencia y puntualidad", "Presentación personal", "Cumplimiento de normas"].map((t) => (
                  <tr key={t}><td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{t}</td>{[1,2,3,4,5].map(i => <td key={i} style={tdStyle()}>—</td>)}</tr>
                ))}
              </tbody>
            </table>

            {/* Estadística (uses table_headers color for header, body is default) */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "8px" }}>
              <thead><tr><th colSpan={6} style={thStyle()}>ESTADÍSTICA</th></tr></thead>
              <tbody>
                {["Puntaje", "Promedio", "Orden de Mérito"].map((t) => (
                  <tr key={t}><td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{t}</td>{[1,2,3,4,5].map(i => <td key={i} style={tdStyle()}>—</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Asistencia */}
          <table
            className={clickable}
            onClick={zoneClick("asistencia_table")}
            style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "8px", marginTop: "4px", ...(zoneBg("asistencia_table") || {}) }}
            data-testid="palette-zone-asistencia_table"
            title="Click para cambiar el color de la tabla de Asistencia"
          >
            <thead><tr><th colSpan={6} style={thStyle()}>ASISTENCIAS Y TARDANZAS</th></tr></thead>
            <tbody>
              {["Presente", "Tardanza", "Falta justificada"].map((t) => (
                <tr key={t}><td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4 }}>{t}</td>{[1,2,3,4,5].map(i => <td key={i} style={tdStyle()}>—</td>)}</tr>
              ))}
            </tbody>
          </table>

          {/* Comentarios del tutor */}
          <table
            className={clickable}
            onClick={zoneClick("tutor_comments")}
            style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "8px", marginTop: "4px", ...(zoneBg("tutor_comments") || {}) }}
            data-testid="palette-zone-tutor_comments"
            title="Click para cambiar el color de los Comentarios del Tutor"
          >
            <thead><tr><th style={{ ...thStyle(), width: 30 }}>BIM</th><th style={thStyle()}>COMENTARIOS DEL TUTOR (A)</th></tr></thead>
            <tbody>
              {["I", "II"].map((p) => (
                <tr key={p}><td style={tdStyle()}>{p}</td><td style={{ ...tdStyle(), textAlign: "left", paddingLeft: 4, height: 18 }}>—</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-pink-900">
        <b>💡 Tip:</b> usa colores SUAVES (pastel) para que la libreta siga viéndose como un documento serio. Los colores oscuros funcionan bien para el encabezado y los headers de tabla — el auto-contraste pondrá las letras en blanco automáticamente.
      </div>

      {/* ── Popover ── */}
      {open && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white border-2 border-pink-300 rounded-xl shadow-2xl p-3"
          style={{
            left: Math.max(8, Math.min(open.x, window.innerWidth - 320)),
            // If the click happens near the bottom, flip the popover up so it
            // doesn't get clipped by the viewport.
            top: open.y + 220 > window.innerHeight ? Math.max(8, open.y - 240) : open.y,
            width: 300,
          }}
          data-testid="palette-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-800">
              🎨 {ZONE_LABELS[open.zone] || open.zone}
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-slate-400 hover:text-slate-600"
              data-testid="palette-popover-close"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1.5 mb-2">
            {PRESETS.map((p) => {
              const selected = (palette[open.zone] || "") === p.hex;
              return (
                <button
                  key={p.hex || "default"}
                  type="button"
                  onClick={() => handlePick(p.hex)}
                  disabled={saving}
                  title={p.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    selected ? "border-slate-900 ring-2 ring-pink-300 scale-110" : "border-slate-300 hover:scale-110"
                  } disabled:opacity-50`}
                  style={{ background: p.hex || "repeating-linear-gradient(45deg, #fff, #fff 4px, #e5e7eb 4px, #e5e7eb 8px)" }}
                  data-testid={`palette-popover-preset-${p.hex.replace("#", "") || "default"}`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 text-xs text-slate-600">
              <span>Personalizado:</span>
              <input
                type="color"
                value={palette[open.zone] && /^#[0-9a-fA-F]{6}$/.test(palette[open.zone]) ? palette[open.zone] : "#ffffff"}
                disabled={saving}
                onChange={(e) => handlePick(e.target.value)}
                className="w-9 h-7 rounded border border-slate-300 cursor-pointer"
                data-testid="palette-popover-custom"
              />
            </label>
            <button
              type="button"
              onClick={() => handlePick("")}
              disabled={saving}
              className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 disabled:opacity-50"
              data-testid="palette-popover-reset"
            >
              Quitar color
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function thStyle() {
  return { border: "1px solid #000", padding: "2px 4px", textAlign: "center", fontWeight: "bold", background: "transparent" };
}
function tdStyle() {
  return { border: "1px solid #000", padding: "2px 4px", textAlign: "center", height: 14 };
}
