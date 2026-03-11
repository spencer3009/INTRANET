import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Save, Lock, Unlock, Loader2, AlertTriangle, CheckCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

/* ═══════════════════════════════════════════════════════════════
   COLUMN DEFINITIONS — exact Excel structure
   ═══════════════════════════════════════════════════════════════ */
const CRITERIA = [
  {
    id: "actitudinal", label: "ACTITUDINAL", weight: 10, color: "#FFD700",
    subs: [
      { key: "act_co", label: "CO" },
      { key: "act_re", label: "RE" },
    ],
  },
  {
    id: "rev_fichas", label: "REVISIÓN FICHAS", weight: 25, color: "#FFD700",
    subs: [
      { key: "rf_r1", label: "R1" },
      { key: "rf_r2", label: "R2" },
      { key: "rf_r3", label: "R3" },
      { key: "rf_r4", label: "R4" },
      { key: "rf_r5", label: "R5" },
    ],
  },
  {
    id: "competencia", label: "COMPETENCIA", weight: 5, color: "#FFD700",
    subs: [
      { key: "comp_c1", label: "C1" },
      { key: "comp_c2", label: "C2" },
    ],
  },
  {
    id: "participaciones", label: "PARTICIPACIONES", weight: 25, color: "#FFD700",
    subs: [
      { key: "part_p1", label: "P1" },
      { key: "part_p2", label: "P2" },
      { key: "part_p3", label: "P3" },
      { key: "part_exp", label: "EXP" },
      { key: "part_tg", label: "TG" },
      { key: "part_p", label: "P" },
    ],
  },
  {
    id: "exam_mensual", label: "EXAMEN MENSUAL", weight: 15, color: "#FFD700",
    subs: [{ key: "exam_mensual", label: "EM" }],
    noAvg: true,
  },
  {
    id: "exam_bimestral", label: "EXAMEN BIMESTRAL", weight: 20, color: "#FFD700",
    subs: [{ key: "exam_bimestral", label: "EB" }],
    noAvg: true,
  },
];

/* helpers */
function avg(vals) {
  const nums = vals.filter(v => v !== null && v !== undefined && v !== "");
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + Number(b), 0) / nums.length) * 10) / 10;
}

function calcFinal(s) {
  const actAvg = avg([s.act_co, s.act_re]);
  const rfAvg = avg([s.rf_r1, s.rf_r2, s.rf_r3, s.rf_r4, s.rf_r5]);
  const compAvg = avg([s.comp_c1, s.comp_c2]);
  const partAvg = avg([s.part_p1, s.part_p2, s.part_p3, s.part_exp, s.part_tg, s.part_p]);
  const em = s.exam_mensual;
  const eb = s.exam_bimestral;

  const parts = [
    [actAvg, 0.10], [rfAvg, 0.25], [compAvg, 0.05],
    [partAvg, 0.25], [em, 0.15], [eb, 0.20],
  ];
  let total = 0, tw = 0;
  for (const [v, w] of parts) {
    if (v !== null && v !== undefined) { total += v * w; tw += w; }
  }
  if (tw === 0) return null;
  return Math.round((tw < 1 ? total / tw : total) * 10) / 10;
}

function criterionAvg(student, criterion) {
  if (criterion.noAvg) return null;
  return avg(criterion.subs.map(s => student[s.key]));
}

/* total sub-columns count for the criteria header colspan */
const totalSubCols = CRITERIA.reduce((sum, c) => sum + c.subs.length + (c.noAvg ? 0 : 1), 0);

/* ═══════════════════════════════════════════════════════════════
   STYLES — matching the Excel exactly
   ═══════════════════════════════════════════════════════════════ */
const S = {
  table: {
    borderCollapse: "collapse",
    fontSize: "12px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    width: "max-content",
    minWidth: "100%",
  },
  thTop: {
    background: "#4472C4",
    color: "#fff",
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #2F5496",
    padding: "6px 4px",
    fontSize: "12px",
    letterSpacing: "0.5px",
  },
  thWeight: {
    background: "#FFD700",
    color: "#000",
    fontWeight: 800,
    textAlign: "center",
    border: "1px solid #C9A800",
    padding: "4px 2px",
    fontSize: "12px",
  },
  thGroup: {
    background: "#D9D9D9",
    color: "#000",
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #BFBFBF",
    padding: "4px 2px",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  thSub: {
    background: "#F2F2F2",
    color: "#333",
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #D0D0D0",
    padding: "4px 2px",
    fontSize: "10px",
    minWidth: "36px",
    writingMode: "horizontal-tb",
  },
  thSubVertical: {
    background: "#F2F2F2",
    color: "#333",
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #D0D0D0",
    padding: "4px 2px",
    fontSize: "10px",
    minWidth: "30px",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    height: "80px",
    whiteSpace: "nowrap",
  },
  thAvg: {
    background: "#E2EFDA",
    color: "#375623",
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #A9D18E",
    padding: "4px 2px",
    fontSize: "10px",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    height: "80px",
    whiteSpace: "nowrap",
    minWidth: "30px",
  },
  thFinal: {
    background: "#4472C4",
    color: "#fff",
    fontWeight: 800,
    textAlign: "center",
    border: "1px solid #2F5496",
    padding: "4px 2px",
    fontSize: "10px",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    height: "80px",
    whiteSpace: "nowrap",
    minWidth: "36px",
  },
  tdNum: {
    background: "#F8F8F8",
    textAlign: "center",
    border: "1px solid #D0D0D0",
    padding: "2px 4px",
    fontWeight: 600,
    width: "32px",
    minWidth: "32px",
  },
  tdName: {
    background: "#FFFFDD",
    textAlign: "left",
    border: "1px solid #D0D0D0",
    padding: "2px 6px",
    fontWeight: 500,
    minWidth: "200px",
    maxWidth: "240px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tdInput: {
    border: "1px solid #D0D0D0",
    padding: 0,
    textAlign: "center",
    width: "36px",
    minWidth: "36px",
  },
  tdAvg: {
    background: "#E2EFDA",
    border: "1px solid #A9D18E",
    textAlign: "center",
    padding: "2px",
    fontWeight: 700,
    fontSize: "11px",
    color: "#375623",
    minWidth: "36px",
  },
  tdFinal: {
    background: "#D6E4F0",
    border: "1px solid #4472C4",
    textAlign: "center",
    padding: "2px",
    fontWeight: 800,
    fontSize: "12px",
    color: "#1F3864",
    minWidth: "40px",
  },
  input: {
    width: "100%",
    border: "none",
    outline: "none",
    textAlign: "center",
    fontSize: "12px",
    padding: "4px 0",
    background: "transparent",
    fontFamily: "inherit",
  },
  stickyNum: { position: "sticky", left: 0, zIndex: 2 },
  stickyName: { position: "sticky", left: "32px", zIndex: 2 },
  stickyNumHeader: { position: "sticky", left: 0, zIndex: 4 },
  stickyNameHeader: { position: "sticky", left: "32px", zIndex: 4 },
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GradeBookTab({ subjectId, sectionId, token, user }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [students, setStudents] = useState([]);
  const [config, setConfig] = useState({});
  const [status, setStatus] = useState("open");
  const [subjectName, setSubjectName] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const res = await axios.get(`${API}/api/academic/periods`, { headers });
        setPeriods(res.data || []);
        if (res.data?.length > 0) {
          const active = res.data.find(p => p.activo) || res.data[0];
          setSelectedPeriod(active.id);
        }
      } catch (err) { console.error("Error loading periods:", err); }
    };
    loadPeriods();
  }, []);

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
        setConfig(res.data.config || {});
        setStatus(res.data.status || "open");
        setSubjectName(res.data.subject_name || "");
        setPeriodName(res.data.period_name || "");
      } catch (err) { console.error("Error loading register:", err); }
      finally { setLoading(false); }
    };
    loadRegister();
  }, [selectedPeriod, subjectId, sectionId]);

  useEffect(() => {
    if (dirty && status === "open") {
      autoSaveTimer.current = setTimeout(() => handleSave(true), 10000);
    }
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, students]);

  const handleGradeChange = useCallback((idx, key, value) => {
    if (status !== "open") return;
    const val = value === "" ? null : parseFloat(value);
    if (val !== null && (isNaN(val) || val < 0 || val > 20)) return;
    setStudents(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      updated[idx].final_grade = calcFinal(updated[idx]);
      return updated;
    });
    setDirty(true);
  }, [status]);

  const handleSave = async (isAuto = false) => {
    if (!selectedPeriod || students.length === 0) return;
    setSaving(true);
    try {
      const grades = students.map(s => {
        const entry = { student_id: s.student_id };
        for (const c of CRITERIA) {
          for (const sub of c.subs) entry[sub.key] = s[sub.key];
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
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="grade-book-loading">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-500">Cargando registro auxiliar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="grade-book">
      {/* ── TOOLBAR ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Registro Auxiliar</h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{subjectName} - {periodName}</p>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

      {/* ── EXCEL TABLE ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 240px)" }}>
          <table style={S.table} data-testid="grade-table">
            <thead>
              {/* ROW 1: Top header */}
              <tr>
                <th rowSpan={4} style={{ ...S.thTop, ...S.stickyNumHeader, width: 32, minWidth: 32 }}>N°</th>
                <th rowSpan={4} style={{ ...S.thTop, ...S.stickyNameHeader, minWidth: 200 }}>APELLIDOS Y NOMBRES</th>
                <th colSpan={totalSubCols} style={S.thTop}>CRITERIOS DE EVALUACIÓN</th>
                <th rowSpan={2} style={{ ...S.thFinal, background: "#FFD700", color: "#000", writingMode: "horizontal-tb", height: "auto", fontSize: 12, fontWeight: 800 }}>100%</th>
              </tr>
              {/* ROW 2: Percentage weights */}
              <tr>
                {CRITERIA.map(c => {
                  const cols = c.subs.length + (c.noAvg ? 0 : 1);
                  return (
                    <th key={c.id} colSpan={cols} style={S.thWeight}>{c.weight}%</th>
                  );
                })}
              </tr>
              {/* ROW 3: Category names */}
              <tr>
                {CRITERIA.map(c => {
                  const cols = c.subs.length + (c.noAvg ? 0 : 1);
                  return (
                    <th key={c.id} colSpan={cols} style={S.thGroup}>{c.label}</th>
                  );
                })}
                <th rowSpan={2} style={S.thFinal}>PROM. BIMESTRAL</th>
              </tr>
              {/* ROW 4: Sub-column headers */}
              <tr>
                {CRITERIA.map(c => (
                  <React.Fragment key={c.id}>
                    {c.subs.map(sub => (
                      <th key={sub.key} style={S.thSub}>{sub.label}</th>
                    ))}
                    {!c.noAvg && (
                      <th key={`${c.id}_avg`} style={S.thAvg}>PROMEDIO</th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={totalSubCols + 3} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                    No hay alumnos registrados en esta sección
                  </td>
                </tr>
              ) : students.map((student, idx) => {
                const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
                const final = calcFinal(student);
                return (
                  <tr key={student.student_id} style={{ background: rowBg }}>
                    <td style={{ ...S.tdNum, ...S.stickyNum, background: rowBg }}>{student.number}</td>
                    <td style={{ ...S.tdName, ...S.stickyName, background: idx % 2 === 0 ? "#FFFFDD" : "#FFFFC8" }} title={student.student_name}>
                      {student.student_name}
                    </td>
                    {CRITERIA.map(c => (
                      <React.Fragment key={`${student.student_id}_${c.id}`}>
                        {c.subs.map(sub => (
                          <td key={sub.key} style={{ ...S.tdInput, background: rowBg }}>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="1"
                              value={student[sub.key] ?? ""}
                              onChange={e => handleGradeChange(idx, sub.key, e.target.value)}
                              disabled={isLocked}
                              style={{ ...S.input, background: isLocked ? "#f1f5f9" : "transparent", cursor: isLocked ? "not-allowed" : "text" }}
                              data-testid={`grade-${student.student_id}-${sub.key}`}
                            />
                          </td>
                        ))}
                        {!c.noAvg && (
                          <td key={`${c.id}_avg_${idx}`} style={S.tdAvg}>
                            {criterionAvg(student, c) ?? ""}
                          </td>
                        )}
                      </React.Fragment>
                    ))}
                    <td style={{ ...S.tdFinal, background: final !== null && final < 11 ? "#FECACA" : final !== null && final >= 14 ? "#BBF7D0" : "#D6E4F0", color: final !== null && final < 11 ? "#991B1B" : final !== null && final >= 14 ? "#166534" : "#1F3864" }}>
                      {final ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
