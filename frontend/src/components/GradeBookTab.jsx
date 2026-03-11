import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Save, Lock, Unlock, Loader2, AlertTriangle, CheckCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const GRADE_FIELDS = [
  { key: "attitude_grade", label: "Actitudinal", shortLabel: "ACT", weight: "10%" },
  { key: "worksheets_grade", label: "Rev. Fichas", shortLabel: "R.F.", weight: "25%" },
  { key: "competency_grade", label: "Competencia", shortLabel: "COMP", weight: "5%" },
  { key: "participation_grade", label: "Participación", shortLabel: "PART", weight: "25%" },
  { key: "monthly_exam_grade", label: "Ex. Mensual", shortLabel: "E.M.", weight: "15%" },
  { key: "bimestral_exam_grade", label: "Ex. Bimestral", shortLabel: "E.B.", weight: "20%" },
];

function getGradeColor(val) {
  if (val === null || val === undefined || val === "") return "";
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  if (n < 10) return "bg-red-100 text-red-700 border-red-300";
  if (n <= 13) return "bg-yellow-50 text-yellow-700 border-yellow-300";
  return "bg-green-50 text-green-700 border-green-300";
}

function getFinalColor(val) {
  if (val === null || val === undefined) return "";
  if (val < 10) return "bg-red-500 text-white";
  if (val <= 13) return "bg-yellow-400 text-yellow-900";
  return "bg-green-500 text-white";
}

function calculateFinal(student, config) {
  const fields = [
    ["attitude_grade", config.attitude_weight || 0.10],
    ["worksheets_grade", config.worksheets_weight || 0.25],
    ["competency_grade", config.competency_weight || 0.05],
    ["participation_grade", config.participation_weight || 0.25],
    ["monthly_exam_grade", config.monthly_exam_weight || 0.15],
    ["bimestral_exam_grade", config.bimestral_exam_weight || 0.20],
  ];
  let total = 0, totalWeight = 0;
  for (const [field, weight] of fields) {
    const val = student[field];
    if (val !== null && val !== undefined && val !== "") {
      total += parseFloat(val) * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((total / totalWeight) * 10) / 10;
}

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
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'error' | null
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  // Load periods
  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const res = await axios.get(`${API}/api/academic/periods`, { headers });
        setPeriods(res.data || []);
        if (res.data?.length > 0) {
          // Select first active period
          const active = res.data.find(p => p.activo) || res.data[0];
          setSelectedPeriod(active.id);
        }
      } catch (err) {
        console.error("Error loading periods:", err);
      }
    };
    loadPeriods();
  }, []);

  // Load register data when period changes
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
      } catch (err) {
        console.error("Error loading register:", err);
      } finally {
        setLoading(false);
      }
    };
    loadRegister();
  }, [selectedPeriod, subjectId, sectionId]);

  // Auto-save every 10 seconds if dirty
  useEffect(() => {
    if (dirty && status === "open") {
      autoSaveTimer.current = setTimeout(() => {
        handleSave(true);
      }, 10000);
    }
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, students]);

  const handleGradeChange = useCallback((studentIdx, field, value) => {
    if (status !== "open") return;
    const val = value === "" ? null : parseInt(value);
    if (val !== null && (isNaN(val) || val < 0 || val > 20)) return;

    setStudents(prev => {
      const updated = [...prev];
      updated[studentIdx] = { ...updated[studentIdx], [field]: val };
      updated[studentIdx].final_grade = calculateFinal(updated[studentIdx], config);
      return updated;
    });
    setDirty(true);
  }, [config, status]);

  const handleCellBlur = useCallback(() => {
    if (dirty) {
      clearTimeout(autoSaveTimer.current);
      handleSave(true);
    }
  }, [dirty, students]);

  const handleSave = async (isAuto = false) => {
    if (!selectedPeriod || students.length === 0) return;
    setSaving(true);
    try {
      const grades = students.map(s => ({
        student_id: s.student_id,
        attitude_grade: s.attitude_grade,
        worksheets_grade: s.worksheets_grade,
        competency_grade: s.competency_grade,
        participation_grade: s.participation_grade,
        monthly_exam_grade: s.monthly_exam_grade,
        bimestral_exam_grade: s.bimestral_exam_grade,
      }));
      const endpoint = isAuto ? "autosave" : "save";
      await axios.post(`${API}/api/grades/${endpoint}`, {
        subject_id: subjectId,
        section_id: sectionId,
        period_id: selectedPeriod,
        grades,
      }, { headers });
      setDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleLock = async () => {
    if (!window.confirm("¿Cerrar el registro bimestral? Las notas ya no se podran editar.")) return;
    try {
      await axios.post(`${API}/api/grades/lock_period`, {
        subject_id: subjectId, section_id: sectionId, period_id: selectedPeriod
      }, { headers });
      setStatus("closed");
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cerrar registro");
    }
  };

  const handleUnlock = async () => {
    try {
      await axios.post(`${API}/api/grades/unlock_period`, {
        subject_id: subjectId, section_id: sectionId, period_id: selectedPeriod
      }, { headers });
      setStatus("open");
    } catch (err) {
      alert(err.response?.data?.detail || "Error al reabrir registro");
    }
  };

  const isLocked = status !== "open";
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-500">Cargando registro...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="grade-book">
      {/* Header with period selector and actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Registro Auxiliar</h2>
              <p className="text-sm text-gray-500">{subjectName} - {periodName}</p>
            </div>
            <select
              value={selectedPeriod || ""}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              data-testid="period-selector"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Save status */}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" /> Guardado
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4" /> Error al guardar
              </span>
            )}
            {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}

            {/* Status badge */}
            {isLocked ? (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg">
                <Lock className="w-4 h-4" /> Cerrado
              </span>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                <Unlock className="w-4 h-4" /> Abierto
              </span>
            )}

            {/* Action buttons */}
            {!isLocked && (
              <>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !dirty}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
                  data-testid="save-grades-btn"
                >
                  <Save className="w-4 h-4" /> Guardar
                </button>
                <button
                  onClick={handleLock}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  data-testid="lock-btn"
                >
                  <Lock className="w-4 h-4" /> Cerrar
                </button>
              </>
            )}
            {isLocked && isAdmin && (
              <button
                onClick={handleUnlock}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                data-testid="unlock-btn"
              >
                <Unlock className="w-4 h-4" /> Reabrir
              </button>
            )}
          </div>
        </div>

        {/* Weight legend */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          {GRADE_FIELDS.map(f => (
            <span key={f.key} className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{f.shortLabel}</span> {f.weight}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded bg-red-400" /> 0-9
            <span className="w-3 h-3 rounded bg-yellow-400" /> 10-13
            <span className="w-3 h-3 rounded bg-green-400" /> 14-20
          </span>
        </div>
      </div>

      {/* Grade Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="grade-table">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="sticky left-0 z-20 bg-slate-800 px-3 py-3 text-center text-xs font-semibold w-12 border-r border-slate-700">N°</th>
                <th className="sticky left-12 z-20 bg-slate-800 px-4 py-3 text-left text-xs font-semibold min-w-[220px] border-r border-slate-700">Apellidos y Nombres</th>
                {GRADE_FIELDS.map(f => (
                  <th key={f.key} className="px-2 py-3 text-center text-xs font-semibold min-w-[90px] border-r border-slate-700">
                    <div>{f.shortLabel}</div>
                    <div className="text-[10px] font-normal text-slate-400">{f.weight}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-bold min-w-[80px] bg-slate-900">PROM.</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => (
                <tr key={student.student_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-indigo-50/50 transition-colors`}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 text-center text-sm text-gray-500 border-r border-gray-200 font-medium">
                    {student.number}
                  </td>
                  <td className="sticky left-12 z-10 bg-inherit px-4 py-1.5 text-sm text-gray-900 font-medium border-r border-gray-200 whitespace-nowrap">
                    {student.student_name}
                  </td>
                  {GRADE_FIELDS.map(f => (
                    <td key={f.key} className="px-1 py-1 text-center border-r border-gray-200">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={student[f.key] ?? ""}
                        onChange={e => handleGradeChange(idx, f.key, e.target.value)}
                        onBlur={handleCellBlur}
                        disabled={isLocked}
                        className={`w-full px-2 py-1.5 text-center text-sm font-medium border rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${getGradeColor(student[f.key])}`}
                        data-testid={`grade-${student.student_id}-${f.key}`}
                      />
                    </td>
                  ))}
                  <td className={`px-2 py-1.5 text-center text-sm font-bold rounded-md ${getFinalColor(student.final_grade)}`}>
                    {student.final_grade !== null && student.final_grade !== undefined ? student.final_grade : "-"}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={GRADE_FIELDS.length + 3} className="px-4 py-12 text-center text-gray-400">
                    No hay alumnos registrados en esta seccion
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
