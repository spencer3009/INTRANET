// LibretaCard — Estructura fiel al modelo "Informe de Progreso del Estudiante"
// del Colegio El Roble. Mantiene la lógica de edición (conducta, comentarios,
// situación final) + lockdown por bimestre cerrado + permisos por rol.
import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { toast } from "sonner";
import "./LibretaCard.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LETRAS = ["AD", "A", "B", "C"];

const romano = (n) => (n === 1 ? "I" : n === 2 ? "II" : n === 3 ? "III" : n === 4 ? "IV" : String(n));

// Letter grades render blue by default (AD/A/B). "C" renders red.
// Returns the CSS modifier class to merge onto .lr-grade / .lr-grade-final.
const letterModifier = (letter) => ((letter || "").toUpperCase() === "C" ? "is-c" : "");

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export default function LibretaCard({ data, token, canEdit, userRole, onReload }) {
  const headers = { Authorization: `Bearer ${token}` };
  const periods = data?.all_periods || [];

  // Closed periods (snapshots) — lockdown por bimestre
  const [closedSet, setClosedSet] = useState(new Set());
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/libreta/closed-periods/${data.student.id}`, { headers });
        setClosedSet(new Set((r.data?.closed_periods || []).map(p => p.period_id)));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.student.id]);

  // Estado local para edición optimista
  const [conduct, setConduct] = useState(data.conducta || {});
  const [comments, setComments] = useState(data.tutor_comments || {});
  const [finalStatus, setFinalStatus] = useState(data.final_status || { situacion: null, cursos_para_recuperar: [] });

  useEffect(() => {
    setConduct(data.conducta || {});
    setComments(data.tutor_comments || {});
    setFinalStatus(data.final_status || { situacion: null, cursos_para_recuperar: [] });
  }, [data]);

  // Conducta Extendida (opt-in por colegio). Si el modo está "extended", la
  // libreta muestra una tabla configurable de criterios (4+3 por defecto) en
  // lugar de la fila CONDUCTA tradicional.
  const conductaTemplateMode = data?.metadata?.conducta_template_mode || "default";
  const isExtendedMode = conductaTemplateMode === "extended";
  const extTemplate = data?.conducta_extendida?.template || { secciones: [] };
  const extByPeriod = data?.conducta_extendida?.by_period || {};

  // Per-school visibility toggles set in Ajustes → Libretas. Both default to
  // showing the section; the admin can hide each independently. Storage stays
  // intact regardless — toggling them on/off only affects rendering.
  const hideConducta = Boolean(data?.metadata?.hide_conducta_in_libreta);
  const hideTutorComments = Boolean(data?.metadata?.hide_tutor_comments_in_libreta);
  const hideAsistencia = Boolean(data?.metadata?.hide_asistencia_in_libreta);

  // Print format options (school-level customization in Ajustes → Libreta).
  const pf = data?.metadata?.print_format || {};
  const fmtClass = [
    `lr-fs-${pf.font_scale || "normal"}`,
    `lr-dens-${pf.row_density || "comfortable"}`,
    `lr-ts-${pf.table_style || "thin"}`,
    `lr-paper-${pf.paper_size || "a4"}`,
    `lr-orient-${pf.orientation || "portrait"}`,
  ].join(" ");

  // Header template (editable in Ajustes → Libreta → "Plantilla del encabezado").
  // Falls back to system defaults when the school hasn't customized.
  const headerTpl = data?.metadata?.header_template || {};
  const interpolate = (str, vars) =>
    String(str || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
  const headerVars = {
    year: data?.year || "",
    roman: data?.period_active?.orden ? romano(data.period_active.orden) : "",
    bimestre: data?.period_active?.orden ? romano(data.period_active.orden) : "",
    grado: (data?.section?.display || data?.section?.nivel || "").toUpperCase(),
    seccion: data?.section?.nombre || "",
  };
  const headerLine1 = interpolate(
    headerTpl.line1 || "INSTITUCIÓN EDUCATIVA PRIVADA",
    headerVars,
  );
  const headerSchoolName = ((headerTpl.school_name_override && String(headerTpl.school_name_override).trim()) || data.school?.legal_name || data.school?.name || "").toUpperCase();
  const headerLine3 = interpolate(
    headerTpl.line3 || "Informe de Progreso del Estudiante - {year}",
    headerVars,
  );
  const headerBimestre = interpolate(
    headerTpl.bimestre_label || "{roman} BIMESTRE",
    headerVars,
  );
  const showInitialsBox = headerTpl.show_initials_box !== false;
  const lineStyle = (bold, sizeMul) => {
    const out = { fontWeight: bold ? "bold" : "normal" };
    if (sizeMul && Number(sizeMul) !== 1) out.fontSize = `${Number(sizeMul) * 100}%`;
    return out;
  };
  const logoScale = Number(headerTpl.logo_scale) || 1;

  // Inject a dynamic <style> tag with the matching @page rule so the printer
  // / "Save as PDF" dialog uses the right paper size + orientation. Browsers
  // do not allow @page to read CSS variables or attribute selectors, so we
  // emit a fresh stylesheet whenever the print_format changes.
  useEffect(() => {
    const paper = pf.paper_size || "a4";
    const orient = pf.orientation || "portrait";
    const sizeMap = {
      a4: "A4",
      letter: "letter",
      legal: "legal",
    };
    const css = `@page { size: ${sizeMap[paper] || "A4"} ${orient}; margin: 0.8cm; }`;
    let tag = document.getElementById("libreta-print-page-rule");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "libreta-print-page-rule";
      document.head.appendChild(tag);
    }
    tag.textContent = css;
    return () => {
      // Don't remove on unmount — other libretas may still be visible.
    };
  }, [pf.paper_size, pf.orientation]);

  const bim4Id = periods.find(p => p.orden === 4)?.id;
  const bim4Closed = bim4Id ? closedSet.has(bim4Id) : false;
  // Feature flag: extra "Padres" (Participación) row in CONDUCTA table.
  const showPadresGrade = !!data?.metadata?.show_padres_grade;
  // Grade rendering format ("numeric" | "letters" | "mixed").
  // Defaults to "numeric" — matches backend default and prevents the bug where
  // an undefined metadata field silently rendered letters when "Mixto" was
  // selected by the school.
  const gradeFormat = data?.metadata?.libreta_grade_format || "numeric";
  const isMixed = gradeFormat === "mixed";

  // Render helpers — keep cell DOM stable regardless of mode.
  const formatNum = (n) => (n === null || n === undefined ? "" : Number.isInteger(n) ? n : Math.round(n));
  // MINEDU scale: 0-10 → C | 11-13 → B | 14-17 → A | 18-20 → AD
  const numToLetterMinedu = (n) => {
    if (n === null || n === undefined || n === "") return "";
    const v = Number(n);
    if (Number.isNaN(v)) return "";
    if (v >= 18) return "AD";
    if (v >= 14) return "A";
    if (v >= 11) return "B";
    return "C";
  };
  const renderCellContent = (cell) => {
    if (!cell) return "-";
    const num = cell.numeric ?? cell.number;
    const letter = cell.letter;
    if (gradeFormat === "numeric") return formatNum(num) || "-";
    return letter || "-"; // default to letters (legacy)
  };
  /**
   * Render one or two <td> cells for a grade slot.
   * - numeric / letters → 1 td
   * - mixed             → 2 td (Nota | Nivel de logro)
   * `keyBase` must be unique within the row.
   */
  const renderGradeCells = (cell, baseClass, keyBase, extraStyle) => {
    const num = cell?.numeric ?? cell?.number;
    const letter = cell?.letter;
    const letterMod = letterModifier(letter);
    if (isMixed) {
      return (
        <Fragment key={keyBase}>
          <td className={`${baseClass} ${letterMod}`} style={extraStyle}>{num !== null && num !== undefined ? formatNum(num) : "-"}</td>
          <td className={`${baseClass} ${letterMod}`} style={extraStyle}>{letter || "-"}</td>
        </Fragment>
      );
    }
    return <td key={keyBase} className={`${baseClass} ${letterMod}`} style={extraStyle}>{renderCellContent(cell)}</td>;
  };

  const saveConduct = async (period_id, letra) => {
    try {
      // Send both fields so we don't blow away the parent grade when saving conducta
      const existing = conduct[period_id] || {};
      const body = {
        student_id: data.student.id,
        period_id,
        letra,
      };
      if (existing.padres_letra) body.padres_letra = existing.padres_letra;
      await axios.put(`${API}/conduct`, body, { headers });
      toast.success("Conducta actualizada");
    } catch (err) {
      if (err.response?.status === 423) toast.error("Bimestre cerrado. No se puede modificar la conducta.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar la conducta.");
      onReload && onReload();
    }
  };

  const savePadresGrade = async (period_id, padres_letra) => {
    try {
      const existing = conduct[period_id] || {};
      const body = {
        student_id: data.student.id,
        period_id,
        // Conducta letra is required by the upsert validator. Keep the current one if present.
        letra: existing.letra || "A",
        padres_letra,
      };
      await axios.put(`${API}/conduct`, body, { headers });
      toast.success("Nota a padres actualizada");
    } catch (err) {
      if (err.response?.status === 423) toast.error("Bimestre cerrado. No se puede modificar la nota a padres.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar la nota a padres.");
      onReload && onReload();
    }
  };

  const saveComment = debounce(async (period_id, comment) => {
    try {
      await axios.put(`${API}/tutor-comments`, { student_id: data.student.id, period_id, comment }, { headers });
      toast.success("Comentario guardado");
    } catch (err) {
      if (err.response?.status === 423) toast.error("Bimestre cerrado. No se puede modificar el comentario.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar el comentario.");
    }
  }, 600);

  const saveFinalStatus = async (situacion, cursos_para_recuperar) => {
    try {
      const r = await axios.put(`${API}/final-status`, {
        student_id: data.student.id,
        year: data.year,
        situacion,
        cursos_para_recuperar,
      }, { headers });
      setFinalStatus(r.data?.final_status || { situacion, cursos_para_recuperar });
      toast.success("Situación final actualizada");
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo guardar la situación final.");
    }
  };

  // Iniciales para foto placeholder
  const initials = (() => {
    const parts = (data.student.apellidos_nombres || "").replace(",", "").split(" ").filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  })();

  // ───── Renderizado de filas de áreas ─────
  // Reglas para imitar el HTML:
  //   - Área con 1 sola asignatura cuyo nombre coincide con el área → colspan=2
  //     (caso INGLES, EDUCACIÓN FISICA)
  //   - Área con N>1 asignaturas → rowspan en celda ÁREA + fila "Promedio Área:"
  //     al final
  //   - Área con 1 asignatura cuyo nombre difiere → área y asignatura en
  //     celdas separadas, SIN fila promedio
  const areasList = data.areas || [];
  const orphans = data.subjects_without_area || [];

  // Las asignaturas sin área NUNCA se renderizan en la tabla de notas
  // para mantener la libreta limpia para padres y alumnos.
  const isStaff = ["owner", "admin", "director"].includes(userRole);

  // Subjects para multi-select de "cursos a recuperar"
  // (incluye huérfanas porque el staff debe poder marcarlas como recuperación
  //  aunque no se muestren en la tabla principal).
  const subjectsForRecovery = [
    ...areasList.flatMap(a => (a.subjects || []).map(s => ({ id: s.id, name: s.name }))),
    ...orphans.map(s => ({ id: s.id, name: s.name })),
  ];

  const renderArea = (area) => {
    const subs = area.subjects || [];
    if (subs.length === 0) return null;

    // CASO 1: área con 1 asignatura
    if (subs.length === 1) {
      const s = subs[0];
      const sameName = (s.name || "").trim().toLowerCase() === (area.name || "").trim().toLowerCase();
      if (sameName) {
        // Una sola fila, colspan=2 (área = asignatura)
        return (
          <tr key={area.id}>
            <td className="lr-asig" colSpan={2} style={{ fontWeight: "bold" }}>{area.name}</td>
            {periods.map(p => renderGradeCells(s.grades?.[p.id] || {}, "lr-grade", `${area.id}-${p.id}`))}
            {renderGradeCells(s.promedio_final, "lr-grade-final", `${area.id}-final`)}
          </tr>
        );
      }
      // Distintos: área a la izq + asignatura a la der, sin fila promedio
      return (
        <tr key={area.id}>
          <td className="lr-area" style={{ textAlign: "left", paddingLeft: 6 }}>{area.name}</td>
          <td className="lr-asig">{s.name}</td>
          {periods.map(p => renderGradeCells(s.grades?.[p.id] || {}, "lr-grade", `${area.id}-${p.id}`))}
          {renderGradeCells(s.promedio_final, "lr-grade-final", `${area.id}-final`)}
        </tr>
      );
    }

    // CASO 2: área con varias asignaturas → rowspan + fila Promedio Área
    return (
      <Fragment key={area.id}>
        {subs.map((s, idx) => (
          <tr key={s.id}>
            {idx === 0 && (
              <td className="lr-area" rowSpan={subs.length + 1}>{area.name}</td>
            )}
            <td className="lr-asig">{s.name}</td>
            {periods.map(p => renderGradeCells(s.grades?.[p.id] || {}, "lr-grade", `${s.id}-${p.id}`))}
            {renderGradeCells(s.promedio_final, "lr-grade-final", `${s.id}-final`)}
          </tr>
        ))}
        <tr className="lr-prom-row">
          <td className="lr-asig lr-prom-area">Promedio Área:</td>
          {periods.map(p => renderGradeCells(area.promedio_area?.[p.id] || {}, "lr-grade", `${area.id}-prom-${p.id}`, { fontWeight: "bold" }))}
          {renderGradeCells(area.promedio_area?.final, "lr-grade-final", `${area.id}-prom-final`)}
        </tr>
      </Fragment>
    );
  };

  const showGrades = areasList.length > 0;
  const tutorFullName = data?.tutor?.nombres_completos || "";

  return (
    <div className={`libreta-card ${fmtClass}`} data-testid="libreta-card">
      {/* ── Header ── */}
      <header className="lr-header">
        <div className="lr-logo" style={logoScale !== 1 ? { width: `${65 * logoScale}px`, height: `${65 * logoScale}px` } : undefined}>
          {data.school.logo_url ? (
            <img src={data.school.logo_url} alt="Logo" />
          ) : (
            <div style={{ width: 65 * logoScale, height: 65 * logoScale, border: "2px solid #1a3a52", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a3a52", fontWeight: "bold", fontSize: 9 * Math.sqrt(logoScale) }}>
              {(data.school.short_name || data.school.name || "")[0] || "C"}
            </div>
          )}
        </div>
        <div className="lr-header-center">
          <div className="lr-privada" style={lineStyle(headerTpl.line1_bold, headerTpl.line1_size)} data-testid="libreta-header-line1">{headerLine1}</div>
          <div className="lr-colegio" style={lineStyle(headerTpl.school_name_bold !== false, headerTpl.school_name_size)}>{headerSchoolName}</div>
          <div className="lr-informe" style={lineStyle(headerTpl.line3_bold !== false, headerTpl.line3_size)} data-testid="libreta-header-line3">{headerLine3}</div>
          <div className="lr-nivel" style={lineStyle(headerTpl.nivel_bold !== false, headerTpl.nivel_size)}>{(data.section?.display || data.section?.nivel || "").toUpperCase()}</div>
          {data.period_active?.orden && (
            <div className="lr-bimestre" style={lineStyle(headerTpl.bimestre_bold !== false, headerTpl.bimestre_size)} data-testid="libreta-header-bimestre">{headerBimestre}</div>
          )}
        </div>
        {showInitialsBox && (
        <div className="lr-photo">
          {data.student.photo_url
            ? <img src={data.student.photo_url} alt="Foto" />
            : <div className="lr-photo-placeholder" data-testid="libreta-photo-placeholder">{initials}</div>
          }
        </div>
        )}
      </header>

      {/* ── Datos del estudiante (boxes) ── */}
      <div className="lr-student-info" data-testid="libreta-student-info">
        <div><div className="lr-label">Código</div></div>
        <div><div className="lr-label">Apellidos y Nombres</div></div>
        <div><div className="lr-label">Salón</div></div>
        <div><div className="lr-label">N°Ord</div></div>
        <div className="lr-value-box">{data.student.student_code || "—"}</div>
        <div className="lr-value-box">{data.student.apellidos_nombres || "—"}</div>
        <div className="lr-value-box">{(data.section?.display || "—").toUpperCase()}</div>
        <div className="lr-value-box">{data.student.n_orden ?? "—"}</div>
      </div>

      {/* ── Tabla de calificaciones ── */}
      {!showGrades ? (
        <div className="lr-empty" data-testid="libreta-empty-grades">
          Aún no hay calificaciones registradas para este alumno.
        </div>
      ) : (
        <table className="lr-grades" data-testid="libreta-grades-table">
          <thead>
            {isMixed ? (
              <>
                <tr>
                  <th rowSpan={3} className="lr-col-areas">ÁREAS</th>
                  <th rowSpan={3} className="lr-col-asig">ASIGNATURAS</th>
                  <th colSpan={periods.length * 2}>BIMESTRES</th>
                  <th colSpan={2} className="lr-col-final">Promedio<br/>Final</th>
                </tr>
                <tr>
                  {periods.map(p => <th key={p.id} colSpan={2} className="lr-col-bim">{romano(p.orden)}</th>)}
                  <th colSpan={2} />
                </tr>
                <tr>
                  {periods.flatMap(p => [
                    <th key={`${p.id}-num`} className="lr-col-bim-sub">Nota</th>,
                    <th key={`${p.id}-let`} className="lr-col-bim-sub">Nivel de logro</th>,
                  ])}
                  <th className="lr-col-bim-sub">Nota</th>
                  <th className="lr-col-bim-sub">Nivel de logro</th>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <th rowSpan={2} className="lr-col-areas">ÁREAS</th>
                  <th rowSpan={2} className="lr-col-asig">ASIGNATURAS</th>
                  <th colSpan={periods.length}>BIMESTRES</th>
                  <th rowSpan={2} className="lr-col-final">Promedio<br/>Final</th>
                </tr>
                <tr>
                  {periods.map(p => <th key={p.id} className="lr-col-bim">{romano(p.orden)}</th>)}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {areasList.map(renderArea)}
          </tbody>
        </table>
      )}

      {/* ── 2 columnas: Conducta+Asistencias | Estadística ── */}
      <div className="lr-info-tables">
        <div>
          {/* Conducta */}
          {!hideConducta && !isExtendedMode && (
          <table className="lr-info" data-testid="libreta-conducta-table">
            <thead>
              <tr>
                <th>{showPadresGrade ? "CONDUCTA / PADRES" : "CONDUCTA"}</th>
                {periods.map(p => <th key={p.id}>{romano(p.orden)}</th>)}
                <th>N.F.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="lr-label">{showPadresGrade ? "CONDUCTA" : "PROMEDIO"}</td>
                {periods.map(p => {
                  const c = conduct[p.id];
                  const closed = closedSet.has(p.id);
                  if (canEdit && !closed) {
                    return (
                      <td key={p.id} style={{ padding: 0 }}>
                        <select
                          value={c?.letra || ""}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setConduct(prev => ({ ...prev, [p.id]: { letra: v } }));
                            if (v) saveConduct(p.id, v);
                          }}
                          data-testid={`libreta-conduct-${p.orden}`}
                        >
                          <option value="">-</option>
                          {LETRAS.map(L => <option key={L} value={L}>{L}</option>)}
                        </select>
                      </td>
                    );
                  }
                  return <td key={p.id} title={closed ? "Bimestre cerrado" : ""}>{c?.letra || "-"}</td>;
                })}
                <td style={{ fontWeight: "bold" }}>{(() => {
                  const ls = periods.map(p => conduct[p.id]?.letra).filter(Boolean);
                  if (!ls.length) return "-";
                  const order = { AD: 4, A: 3, B: 2, C: 1 };
                  const avg = ls.reduce((s, l) => s + (order[l] || 0), 0) / ls.length;
                  return avg >= 3.5 ? "AD" : avg >= 2.5 ? "A" : avg >= 1.5 ? "B" : "C";
                })()}</td>
              </tr>
              {showPadresGrade && (
                <tr data-testid="libreta-padres-row">
                  <td className="lr-label">PADRES</td>
                  {periods.map(p => {
                    const c = conduct[p.id];
                    const closed = closedSet.has(p.id);
                    if (canEdit && !closed) {
                      return (
                        <td key={p.id} style={{ padding: 0 }}>
                          <select
                            value={c?.padres_letra || ""}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              setConduct(prev => ({
                                ...prev,
                                [p.id]: { ...(prev[p.id] || {}), padres_letra: v },
                              }));
                              if (v) savePadresGrade(p.id, v);
                            }}
                            data-testid={`libreta-padres-${p.orden}`}
                          >
                            <option value="">-</option>
                            {LETRAS.map(L => <option key={L} value={L}>{L}</option>)}
                          </select>
                        </td>
                      );
                    }
                    return <td key={p.id} title={closed ? "Bimestre cerrado" : ""}>{c?.padres_letra || "-"}</td>;
                  })}
                  <td style={{ fontWeight: "bold" }}>{(() => {
                    const ls = periods.map(p => conduct[p.id]?.padres_letra).filter(Boolean);
                    if (!ls.length) return "-";
                    const order = { AD: 4, A: 3, B: 2, C: 1 };
                    const avg = ls.reduce((s, l) => s + (order[l] || 0), 0) / ls.length;
                    return avg >= 3.5 ? "AD" : avg >= 2.5 ? "A" : avg >= 1.5 ? "B" : "C";
                  })()}</td>
                </tr>
              )}
            </tbody>
          </table>
          )}

          {/* Conducta Extendida (cuando el colegio activa el modo extendido) */}
          {!hideConducta && isExtendedMode && (extTemplate.secciones || []).map((sec) => (
            <table
              key={sec.id}
              className="lr-info lr-conducta-ext"
              style={{ marginBottom: 6 }}
              data-testid={`libreta-conducta-ext-${sec.id}`}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{sec.nombre}</th>
                  {periods.map(p => (
                    isMixed ? (
                      <Fragment key={p.id}>
                        <th>{romano(p.orden)}</th>
                        <th>NL</th>
                      </Fragment>
                    ) : (
                      <th key={p.id}>{romano(p.orden)}</th>
                    )
                  ))}
                  <th>PROM</th>
                </tr>
              </thead>
              <tbody>
                {(sec.criterios || []).map((crit) => {
                  // Per-period values for this criterio
                  const perPeriodVals = periods.map(p => {
                    const scores = extByPeriod?.[p.id] || {};
                    const v = scores ? scores[crit.id] : null;
                    return (v === undefined || v === null || v === "") ? null : Number(v);
                  });
                  const nums = perPeriodVals.filter(n => n !== null && !Number.isNaN(n));
                  const avg = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length) : null;
                  return (
                    <tr key={crit.id}>
                      <td className="lr-label" style={{ textAlign: "left" }}>{crit.nombre}</td>
                      {periods.map((p, idx) => {
                        const val = perPeriodVals[idx];
                        const letter = val === null ? "" : numToLetterMinedu(val);
                        const letterMod = letterModifier(letter);
                        if (gradeFormat === "numeric") {
                          return <td key={p.id} className={letterMod}>{val === null ? "-" : formatNum(val)}</td>;
                        }
                        if (gradeFormat === "letters") {
                          return <td key={p.id} className={letterMod}>{letter || "-"}</td>;
                        }
                        // mixed
                        return (
                          <Fragment key={p.id}>
                            <td className={letterMod}>{val === null ? "-" : formatNum(val)}</td>
                            <td className={letterMod}>{letter || "-"}</td>
                          </Fragment>
                        );
                      })}
                      <td style={{ fontWeight: "bold" }}>
                        {avg === null
                          ? "-"
                          : gradeFormat === "letters"
                            ? numToLetterMinedu(avg)
                            : gradeFormat === "mixed"
                              ? `${formatNum(avg)} / ${numToLetterMinedu(avg)}`
                              : formatNum(avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}

          {/* Asistencias y tardanzas */}
          {!hideAsistencia && (
          <table className="lr-info" style={{ marginTop: 4 }} data-testid="libreta-attendance-table">
            <thead>
              <tr>
                <th>ASISTENCIAS Y TARDANZAS</th>
                {periods.map(p => <th key={p.id}>{romano(p.orden)}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Presente", "presente"],
                ["Tardanza Injustificada", "tardanza"],
                ["Tardanza Justificada", "tardanza_justificada"],
                ["Falta Injustificada", "falta"],
                ["Falta Justificada", "justificada"],
              ].map(([label, key]) => {
                const total = periods.reduce((s, p) => s + (Number(data.asistencia?.[p.id]?.[key]) || 0), 0);
                return (
                  <tr key={key}>
                    <td className="lr-label">{label}</td>
                    {periods.map(p => {
                      const v = data.asistencia?.[p.id]?.[key];
                      return <td key={p.id}>{v ? v : "-"}</td>;
                    })}
                    <td style={{ fontWeight: "bold" }}>{total || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        <div>
          {/* Estadística */}
          <table className="lr-info" data-testid="libreta-stats-table">
            <thead>
              <tr>
                <th>ESTADÍSTICA</th>
                {periods.map(p => <th key={p.id}>{romano(p.orden)}</th>)}
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Puntaje", "puntaje"],
                ["Promedio", "promedio"],
                ["Cursos Desaprobados", "cursos_desaprobados"],
                ["Orden de Mérito", "orden_merito"],
                ["Tercio por Salón", "tercio"],
              ].map(([label, key]) => (
                <tr key={key}>
                  <td className="lr-label">{label}</td>
                  {periods.map(p => {
                    const v = data.ranking?.[p.id]?.[key];
                    return <td key={p.id}>{v ?? "-"}</td>;
                  })}
                  <td style={{ fontWeight: "bold" }}>{data.ranking?.final?.[key] ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comentarios de la tutora ── */}
      {!hideTutorComments && (
      <table className="lr-comentarios" data-testid="libreta-comments-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>BIM.</th>
            <th>COMENTARIOS DEL TUTOR (A)</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => {
            const val = comments[p.id] || "";
            const closed = closedSet.has(p.id);
            const readonly = !canEdit || closed;
            return (
              <tr key={p.id}>
                <td className="lr-bim">{romano(p.orden)}</td>
                <td style={{ padding: 0 }}>
                  <textarea
                    value={val}
                    placeholder={closed ? "(Bimestre cerrado)" : "Sin comentarios para este bimestre"}
                    readOnly={readonly}
                    onChange={(e) => { setComments(prev => ({ ...prev, [p.id]: e.target.value })); saveComment(p.id, e.target.value); }}
                    data-testid={`libreta-comment-${p.orden}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}

      {/* ── Situación final ── */}
      <table className="lr-situacion" data-testid="libreta-final-status-table">
        <thead>
          <tr>
            <th>SITUACIÓN FINAL</th>
            <th className="lr-x">(X)</th>
            <th>CURSOS PARA RECUPERAR / PREPARACIÓN</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["PROMOVIDO", "PROMOVIDO"],
            ["REQ_RECUPERACION", "REQ. RECUPERACIÓN"],
            ["REPITE", "REPITE"],
          ].map(([sit, label], idx) => {
            const checked = finalStatus.situacion === sit;
            const disabled = !canEdit || !bim4Closed;
            return (
              <tr key={sit}>
                <td>{label}</td>
                <td className="lr-x">
                  {disabled ? (checked ? "X" : "") : (
                    <input
                      type="radio"
                      checked={checked}
                      onChange={() => saveFinalStatus(sit, sit === "PROMOVIDO" ? [] : (finalStatus.cursos_para_recuperar || []))}
                      data-testid={`libreta-final-${sit}`}
                    />
                  )}
                </td>
                {idx === 0 && (
                  <td rowSpan={3}>
                    {finalStatus.situacion === "REQ_RECUPERACION" && (
                      <>
                        {(finalStatus.cursos_para_recuperar || []).length === 0
                          ? <span style={{ fontStyle: "italic", color: "#666" }}>Selecciona cursos a recuperar.</span>
                          : <span>{(finalStatus.cursos_para_recuperar || []).map(c => c.name || c).join(", ")}</span>}
                        {canEdit && bim4Closed && (
                          <select
                            multiple
                            value={(finalStatus.cursos_para_recuperar || []).map(c => c.id || c)}
                            onChange={(e) => {
                              const ids = Array.from(e.target.selectedOptions).map(o => o.value);
                              saveFinalStatus("REQ_RECUPERACION", ids);
                            }}
                            style={{ marginTop: 4, width: "100%", padding: 2 }}
                            data-testid="libreta-final-cursos-select"
                          >
                            {subjectsForRecovery.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!bim4Closed && (
        <div style={{ marginTop: 4, fontSize: 8, fontStyle: "italic", color: "#666" }}>
          La situación final se habilita después de cerrar el cuarto bimestre.
        </div>
      )}

      {/* ── Página 2: firmas ── */}
      <section className={`lr-page2 lr-paper-${pf.paper_size || "a4"} lr-orient-${pf.orientation || "portrait"}`}>
        <div className="lr-page-header">
          <span>{data.student.apellidos_nombres}</span>
          <span>Página 2</span>
        </div>
        <div className="lr-signatures">
          <div className="lr-signature-box">
            {tutorFullName && <div className="lr-name">{tutorFullName}</div>}
            <div className="lr-title">TUTOR (A)</div>
          </div>
          <div className="lr-signature-box">
            <div className="lr-title">DIRECTOR (A)</div>
          </div>
        </div>
      </section>
    </div>
  );
}
