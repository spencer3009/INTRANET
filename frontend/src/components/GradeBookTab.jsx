import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { Save, Lock, Unlock, Loader2, AlertTriangle, CheckCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  PLANTILLA_SISTEMA_FALLBACK,
  assignFieldKeys,
  calcularPromedioInput,
  calcularPromedioBimestral,
  calcularPromedioCriterio,
  getGradeValue,
} from "../utils/registroAuxiliarUtils";

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════════════════════════════════════════════════
   STYLES — matching the Excel exactly
   ═══════════════════════════════════════════════════════════════ */
const S = {
  table: { borderCollapse: "collapse", fontSize: "12px", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  thTop: { background: "#4472C4", color: "#fff", fontWeight: 700, textAlign: "center", border: "1px solid #2F5496", padding: "6px 4px", fontSize: "12px", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  thWeight: { background: "#FFD700", color: "#000", fontWeight: 800, textAlign: "center", border: "1px solid #C9A800", padding: "4px 2px", fontSize: "12px" },
  thGroup: { background: "#D9D9D9", color: "#000", fontWeight: 700, textAlign: "center", border: "1px solid #BFBFBF", padding: "4px 2px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  thSub: { background: "#F2F2F2", color: "#333", fontWeight: 700, textAlign: "center", border: "1px solid #D0D0D0", padding: "6px 4px", fontSize: "10px", whiteSpace: "nowrap", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis" },
  thAvg: { background: "#E2EFDA", color: "#375623", fontWeight: 700, textAlign: "center", border: "1px solid #A9D18E", padding: "6px 4px", fontSize: "10px", whiteSpace: "nowrap", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis" },
  thFinal: { background: "#4472C4", color: "#fff", fontWeight: 800, textAlign: "center", border: "1px solid #2F5496", padding: "8px 4px", fontSize: "10px", writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", height: "80px", verticalAlign: "middle" },
  thColFinal: { background: "#F59E0B", color: "#fff", fontWeight: 800, textAlign: "center", border: "1px solid #D97706", padding: "8px 4px", fontSize: "10px", writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", height: "80px", verticalAlign: "middle" },
  tdNum: { background: "#F8F8F8", textAlign: "center", border: "1px solid #D0D0D0", padding: "2px 4px", fontWeight: 600 },
  tdName: { background: "#FFFFDD", textAlign: "left", border: "1px solid #D0D0D0", padding: "2px 6px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdInput: { border: "1px solid #D0D0D0", padding: 0, textAlign: "center" },
  tdAvg: { background: "#E2EFDA", border: "1px solid #A9D18E", textAlign: "center", padding: "2px", fontWeight: 700, fontSize: "11px", color: "#375623" },
  tdColFinal: { border: "1px solid #D0D0D0", padding: 0, textAlign: "center" },
  tdFinal: { background: "#D6E4F0", border: "1px solid #4472C4", textAlign: "center", padding: "2px", fontWeight: 800, fontSize: "12px", color: "#1F3864" },
  input: { width: "100%", border: "none", outline: "none", textAlign: "center", fontSize: "12px", padding: "4px 0", background: "transparent", fontFamily: "inherit" },
  stickyNum: { position: "sticky", left: 0, zIndex: 2 },
  stickyName: { position: "sticky", zIndex: 2 },
  stickyNumHeader: { position: "sticky", left: 0, zIndex: 4 },
  stickyNameHeader: { position: "sticky", zIndex: 4 },
};

const ANCHO_NUM = 40;
const ANCHO_NOMBRE_DEFAULT = 220;
const ANCHO_COL_MIN = 40;

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GradeBookTab({ subjectId, sectionId, token, user }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState("open");
  const [subjectName, setSubjectName] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef(null);
  const tablaRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  // Plantilla dinámica
  const [plantilla, setPlantilla] = useState(null);
  const [plantillaLoading, setPlantillaLoading] = useState(true);
  const [plantillaNombre, setPlantillaNombre] = useState("Por defecto");

  // Responsive column sizing
  const [anchoNombre, setAnchoNombre] = useState(() => {
    const saved = localStorage.getItem("ra_ancho_nombre");
    return saved ? parseInt(saved, 10) : ANCHO_NOMBRE_DEFAULT;
  });
  const [containerWidth, setContainerWidth] = useState(0);

  const schoolId = user?.school_id;
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  // Persist column width
  useEffect(() => {
    localStorage.setItem("ra_ancho_nombre", String(anchoNombre));
  }, [anchoNombre]);

  // Observe container resize
  useEffect(() => {
    const el = tablaRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [plantilla]);

  /* ── Derived columns from plantilla ── */
  const totalSubCols = useMemo(() => {
    if (!plantilla) return 0;
    return plantilla.criterios.reduce((sum, c) => sum + c.subcolumnas.length, 0);
  }, [plantilla]);

  const totalNotaCols = useMemo(() => {
    if (!plantilla) return 0;
    return totalSubCols + plantilla.columnas_finales.length + 1;
  }, [plantilla, totalSubCols]);

  const anchoColNota = useMemo(() => {
    if (totalNotaCols === 0 || containerWidth === 0) return 50;
    const available = containerWidth - ANCHO_NUM - anchoNombre;
    const w = Math.floor(available / totalNotaCols);
    return Math.max(ANCHO_COL_MIN, w);
  }, [containerWidth, anchoNombre, totalNotaCols]);

  const useFixedLayout = anchoColNota > ANCHO_COL_MIN;
  const tableMinWidth = ANCHO_NUM + anchoNombre + totalNotaCols * ANCHO_COL_MIN;

  /* ── Drag handle for name column ── */
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = anchoNombre;
    const onMove = (ev) => {
      const newW = Math.max(120, Math.min(500, startW + ev.clientX - startX));
      setAnchoNombre(newW);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [anchoNombre]);

  /* ── Load plantilla ── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setPlantillaLoading(true);
      try {
        const res = await axios.get(
          `${API}/api/schools/${schoolId}/registro-auxiliar/plantillas?estado=activa`,
          { headers }
        );
        const plantillas = res.data?.plantillas || [];
        const predeterminada = plantillas.find(p => p.es_predeterminada && !p.es_sistema);
        const activa = predeterminada || plantillas.find(p => !p.es_sistema && p.estado === "activa");

        if (activa) {
          setPlantilla(assignFieldKeys(activa));
          setPlantillaNombre(activa.nombre);
        } else {
          setPlantilla(assignFieldKeys(PLANTILLA_SISTEMA_FALLBACK));
          setPlantillaNombre("Por defecto");
        }
      } catch (err) {
        console.error("Error loading plantilla, using fallback:", err);
        setPlantilla(assignFieldKeys(PLANTILLA_SISTEMA_FALLBACK));
        setPlantillaNombre("Por defecto (fallback)");
      } finally {
        setPlantillaLoading(false);
      }
    })();
  }, [schoolId]);

  /* ── Load periods ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/api/academic/periods`, { headers });
        setPeriods(res.data || []);
        if (res.data?.length > 0) {
          const active = res.data.find(p => p.activo) || res.data[0];
          setSelectedPeriod(active.id);
        }
      } catch (err) { console.error("Error loading periods:", err); }
    })();
  }, []);

  /* ── Load register data ── */
  useEffect(() => {
    if (!selectedPeriod || !subjectId || !sectionId) return;
    const loadRegister = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API}/api/grades/register/${subjectId}/${sectionId}/${selectedPeriod}`,
          { headers }
        );
        setStudents(res.data.students || []);
        setStatus(res.data.status || "open");
        setSubjectName(res.data.subject_name || "");
        setPeriodName(res.data.period_name || "");
      } catch (err) { console.error("Error loading register:", err); }
      finally { setLoading(false); }
    };
    loadRegister();
  }, [selectedPeriod, subjectId, sectionId]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (dirty && status === "open") {
      autoSaveTimer.current = setTimeout(() => handleSave(true), 10000);
    }
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, students]);

  /* ── Grade change handler ──
     `sub` can be either a subcolumna or a columna_final — both carry
     `id` and optionally `field_key`. We route the write to the static
     field when `field_key` exists, otherwise to `grades_dynamic[sub.id]`
     so notes attached to a custom-template column (Phase 5) persist. */
  const handleGradeChange = useCallback((idx, sub, value) => {
    if (status !== "open") return;
    const max = plantilla?.escala_maxima || 20;
    const val = value === "" ? null : parseFloat(value);
    if (val !== null && (isNaN(val) || val < 0 || val > max)) return;
    setStudents(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      if (sub.field_key) {
        row[sub.field_key] = val;
      } else {
        // Dynamic (custom template) — store under grades_dynamic.<id>
        row.grades_dynamic = { ...(row.grades_dynamic || {}), [sub.id]: val };
      }
      row.final_grade = calcularPromedioBimestral(row, plantilla);
      updated[idx] = row;
      return updated;
    });
    setDirty(true);
  }, [status, plantilla]);

  /* ── Save ── */
  const handleSave = async (isAuto = false) => {
    if (!selectedPeriod || students.length === 0 || !plantilla) return;
    setSaving(true);
    try {
      const grades = students.map(s => {
        const entry = { student_id: s.student_id };
        const dynamicEntry = {};
        for (const criterio of plantilla.criterios) {
          for (const sub of criterio.subcolumnas) {
            if (sub.tipo !== "input") continue;
            if (sub.field_key) {
              entry[sub.field_key] = s[sub.field_key];
            } else {
              // Phase 5 — column belongs to a custom template
              const val = s.grades_dynamic?.[sub.id];
              if (val !== undefined) dynamicEntry[sub.id] = val;
            }
          }
        }
        for (const col of plantilla.columnas_finales) {
          if (col.field_key) {
            entry[col.field_key] = s[col.field_key];
          } else {
            const val = s.grades_dynamic?.[col.id];
            if (val !== undefined) dynamicEntry[col.id] = val;
          }
        }
        if (Object.keys(dynamicEntry).length > 0) {
          entry.grades_dynamic = dynamicEntry;
        }
        return entry;
      });
      await axios.post(`${API}/api/grades/${isAuto ? "autosave" : "save"}`, {
        subject_id: subjectId, section_id: sectionId,
        period_id: selectedPeriod, grades,
      }, { headers });
      setDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 5000);
    } finally { setSaving(false); }
  };

  /* ── Lock / Unlock ── */
  const handleLock = async () => {
    if (!window.confirm("Cerrar el registro? Las notas ya no se podran editar.")) return;
    try {
      await axios.post(`${API}/api/grades/lock_period`, {
        subject_id: subjectId, section_id: sectionId, period_id: selectedPeriod
      }, { headers });
      setStatus("closed");
    } catch (err) { alert(err.response?.data?.detail || "Error al cerrar"); }
  };

  const handleUnlock = async () => {
    try {
      await axios.post(`${API}/api/grades/unlock_period`, {
        subject_id: subjectId, section_id: sectionId, period_id: selectedPeriod
      }, { headers });
      setStatus("open");
    } catch (err) { alert(err.response?.data?.detail || "Error al reabrir"); }
  };

  const isLocked = status !== "open";
  const hasStudents = students.length > 0;
  const PLACEHOLDER_COUNT = 30;

  if (loading || plantillaLoading || !plantilla) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="grade-book-loading">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-500">Cargando registro auxiliar...</span>
      </div>
    );
  }

  const { criterios, columnas_finales } = plantilla;
  const colFinalesCount = columnas_finales.length;

  return (
    <div className="space-y-3" data-testid="grade-book">
      {/* ── TOOLBAR ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Registro Auxiliar</h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{subjectName} - {periodName}</p>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <ClipboardList size={12} /> Plantilla: {plantillaNombre}
            </p>
          </div>
          <select
            value={selectedPeriod || ""}
            onChange={e => setSelectedPeriod(e.target.value)}
            data-testid="period-selector"
            style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, background: "#fff" }}
          >
            {periods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {saveStatus === "saved" && <span style={{ fontSize: 12, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={14} /> Guardado</span>}
          {saveStatus === "error" && <span style={{ fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={14} /> Error</span>}
          {saving && <Loader2 size={14} className="animate-spin" style={{ color: "#6366f1" }} />}
          {isLocked ? (
            <span style={{ fontSize: 12, padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Lock size={13} /> Cerrado</span>
          ) : (
            <span style={{ fontSize: 12, padding: "4px 10px", background: "#dcfce7", color: "#166534", borderRadius: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Unlock size={13} /> Abierto</span>
          )}
          {!isLocked && (
            <>
              <button onClick={() => handleSave(false)} disabled={saving || !dirty} data-testid="save-grades-btn"
                style={{ padding: "6px 14px", background: dirty ? "#4f46e5" : "#d1d5db", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: dirty ? "pointer" : "default", display: "flex", alignItems: "center", gap: 4 }}>
                <Save size={13} /> Guardar
              </button>
              <button onClick={handleLock} data-testid="lock-btn"
                style={{ padding: "6px 14px", background: "#dc2626", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Lock size={13} /> Cerrar
              </button>
            </>
          )}
          {isLocked && isAdmin && (
            <button onClick={handleUnlock} data-testid="unlock-btn"
              style={{ padding: "6px 14px", background: "#f59e0b", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Unlock size={13} /> Reabrir
            </button>
          )}
        </div>
      </div>

      {/* ── WARNING BANNER (no students) ── */}
      {!loading && !hasStudents && selectedPeriod && (
        <div style={{ background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }} data-testid="no-students-warning">
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={18} style={{ color: "#D97706" }} />
          </div>
          <div style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
            <strong style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#78350F" }}>No hay alumnos registrados en esta sección.</strong>
            El registro auxiliar se activara automaticamente cuando existan alumnos matriculados.
          </div>
        </div>
      )}

      {/* ── EXCEL TABLE (dynamic from plantilla) ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table ref={tablaRef} style={{ ...S.table, tableLayout: "fixed", width: useFixedLayout ? "100%" : tableMinWidth, minWidth: tableMinWidth }} data-testid="grade-table">
            <colgroup>
              <col style={{ width: ANCHO_NUM }} />
              <col style={{ width: anchoNombre }} />
              {criterios.flatMap(c =>
                c.subcolumnas.map(sub => (
                  <col key={`col_${sub.id}`} style={{ width: anchoColNota }} />
                ))
              )}
              {columnas_finales.map(col => (
                <col key={`col_f_${col.id}`} style={{ width: anchoColNota }} />
              ))}
              <col style={{ width: anchoColNota + 10 }} />
            </colgroup>
            <thead>
              {/* ROW 1: Top header */}
              <tr>
                <th rowSpan={4} style={{ ...S.thTop, ...S.stickyNumHeader }}>N°</th>
                <th rowSpan={4} style={{ ...S.thTop, ...S.stickyNameHeader, left: ANCHO_NUM, position: "sticky", zIndex: 4 }}>
                  APELLIDOS Y NOMBRES
                  <div
                    onMouseDown={handleResizeStart}
                    style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize", background: "transparent" }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    data-testid="name-col-resize-handle"
                  />
                </th>
                <th colSpan={totalSubCols + colFinalesCount} style={S.thTop}>CRITERIOS DE EVALUACIÓN</th>
                <th rowSpan={2} style={{ ...S.thFinal, background: "#FFD700", color: "#000", writingMode: "horizontal-tb", transform: "none", height: "auto", fontSize: 12, fontWeight: 800 }}>100%</th>
              </tr>
              {/* ROW 2: Percentage weights */}
              <tr>
                {criterios.map(c => (
                  <th key={c.id} colSpan={c.subcolumnas.length} style={{ ...S.thWeight, background: c.color || "#FFD700" }}>
                    {c.porcentaje}%
                  </th>
                ))}
                {columnas_finales.map(col => (
                  <th key={col.id} style={{ ...S.thWeight, background: "#F59E0B", border: "1px solid #D97706", color: "#fff" }}>
                    {col.porcentaje}%
                  </th>
                ))}
              </tr>
              {/* ROW 3: Category names */}
              <tr>
                {criterios.map(c => (
                  <th key={c.id} colSpan={c.subcolumnas.length} style={{ ...S.thGroup, background: c.color ? `${c.color}33` : "#D9D9D9" }}>
                    {c.nombre}
                  </th>
                ))}
                {columnas_finales.map(col => (
                  <th key={col.id} rowSpan={2} style={S.thColFinal}>
                    {col.label_corto || col.label}
                  </th>
                ))}
                <th rowSpan={2} style={S.thFinal}>{plantilla.label_promedio_final || "PROM. BIMESTRAL"}</th>
              </tr>
              {/* ROW 4: Sub-column headers (all vertical text) */}
              <tr style={{ height: 80 }}>
                {criterios.map(c => (
                  <React.Fragment key={c.id}>
                    {c.subcolumnas.map(sub => (
                      <th key={sub.id} style={sub.tipo === "promedio_auto" ? S.thAvg : S.thSub}>
                        {sub.label}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasStudents ? students.map((student, idx) => {
                const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
                const final = calcularPromedioBimestral(student, plantilla);
                return (
                  <tr key={student.student_id} style={{ background: rowBg }}>
                    <td style={{ ...S.tdNum, ...S.stickyNum, background: rowBg }}>{student.number}</td>
                    <td style={{ ...S.tdName, ...S.stickyName, left: ANCHO_NUM, background: idx % 2 === 0 ? "#FFFFDD" : "#FFFFC8" }} title={student.student_name}>
                      {student.student_name}
                    </td>
                    {/* Criterio columns */}
                    {criterios.map(c => (
                      <React.Fragment key={`${student.student_id}_${c.id}`}>
                        {c.subcolumnas.map(sub => {
                          if (sub.tipo === "promedio_auto") {
                            const avg = calcularPromedioCriterio(student, c);
                            return (
                              <td key={sub.id} style={S.tdAvg}>{avg ?? ""}</td>
                            );
                          }
                          return (
                            <td key={sub.id} style={{ ...S.tdInput, background: rowBg }}>
                              <input
                                type="number"
                                min="0"
                                max={plantilla.escala_maxima || 20}
                                step="1"
                                value={getGradeValue(student, sub) ?? ""}
                                onChange={e => handleGradeChange(idx, sub, e.target.value)}
                                disabled={isLocked}
                                style={{ ...S.input, background: isLocked ? "#f1f5f9" : "transparent", cursor: isLocked ? "not-allowed" : "text" }}
                                data-testid={`grade-${student.student_id}-${sub.field_key || sub.id}`}
                              />
                            </td>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    {/* Columnas finales */}
                    {columnas_finales.map(col => (
                      <td key={col.id} style={{ ...S.tdColFinal, background: rowBg }}>
                        <input
                          type="number"
                          min="0"
                          max={plantilla.escala_maxima || 20}
                          step="1"
                          value={getGradeValue(student, col) ?? ""}
                          onChange={e => handleGradeChange(idx, col, e.target.value)}
                          disabled={isLocked}
                          style={{ ...S.input, background: isLocked ? "#f1f5f9" : "transparent", cursor: isLocked ? "not-allowed" : "text" }}
                          data-testid={`grade-${student.student_id}-${col.field_key || col.id}`}
                        />
                      </td>
                    ))}
                    {/* Final grade */}
                    <td style={{ ...S.tdFinal, background: final !== null && final < 11 ? "#FECACA" : final !== null && final >= 14 ? "#BBF7D0" : "#D6E4F0", color: final !== null && final < 11 ? "#991B1B" : final !== null && final >= 14 ? "#166534" : "#1F3864" }}>
                      {final ?? ""}
                    </td>
                  </tr>
                );
              }) : (
                Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => {
                  const rowBg = i % 2 === 0 ? "#FAFAFA" : "#F5F5F5";
                  return (
                    <tr key={`ph-${i}`} style={{ background: rowBg }} data-testid={`placeholder-row-${i + 1}`}>
                      <td style={{ ...S.tdNum, ...S.stickyNum, background: rowBg, color: "#ccc" }}>{i + 1}</td>
                      <td style={{ ...S.tdName, ...S.stickyName, left: ANCHO_NUM, background: rowBg, color: "#ddd" }}>&mdash;</td>
                      {criterios.map(c => (
                        <React.Fragment key={`ph-${i}-${c.id}`}>
                          {c.subcolumnas.map(sub => (
                            <td key={sub.id} style={{ ...(sub.tipo === "promedio_auto" ? S.tdAvg : S.tdInput), background: rowBg, color: "#ddd", padding: "6px 0", fontSize: 11 }}>&mdash;</td>
                          ))}
                        </React.Fragment>
                      ))}
                      {columnas_finales.map(col => (
                        <td key={col.id} style={{ ...S.tdColFinal, background: rowBg, color: "#ddd", padding: "6px 0", fontSize: 11 }}>&mdash;</td>
                      ))}
                      <td style={{ ...S.tdFinal, background: rowBg, color: "#ccc" }}>&mdash;</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
