import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, Save, AlertCircle, CheckCircle2, ClipboardList } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * ConductaExtendidaTab — Tab del tutor (y admin) para llenar las notas
 * de la plantilla configurable de Evaluación Conductual.
 *
 * Tabla: alumnos × criterios (filtrados a un bimestre).
 * - Numérico 0-20 con autoguardado al hacer blur.
 * - Botón "Guardar todo" para batch.
 * - Si el colegio NO tiene mode=extended, muestra mensaje informativo.
 */
export default function ConductaExtendidaTab({ headers, sectionId, periodId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("default");
  const [template, setTemplate] = useState({ secciones: [] });
  const [students, setStudents] = useState([]);
  const [periodName, setPeriodName] = useState("");
  const [dirty, setDirty] = useState(new Set()); // student_ids modified
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Flatten template into ordered list of {criterioId, label, sectionId, sectionName}
  const allCriterios = useMemo(() => {
    const out = [];
    for (const sec of (template.secciones || [])) {
      for (const crit of (sec.criterios || [])) {
        out.push({ id: crit.id, label: crit.nombre, sectionId: sec.id, sectionName: sec.nombre });
      }
    }
    return out;
  }, [template]);

  const load = async () => {
    if (!sectionId || !periodId) return;
    setLoading(true);
    setError("");
    try {
      const r = await axios.get(`${API}/conducta-extendida`, {
        headers,
        params: { section_id: sectionId, period_id: periodId },
      });
      setMode(r.data.mode || "default");
      setTemplate(r.data.template || { secciones: [] });
      setStudents(r.data.students || []);
      setPeriodName(r.data.period_name || "");
      setDirty(new Set());
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al cargar la conducta extendida");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sectionId, periodId]);

  const onScoreChange = (studentId, criterioId, value) => {
    const max = 20;
    let v = value;
    if (v === "" || v === null || v === undefined) v = null;
    else {
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > max) return;
      v = n;
    }
    setStudents(prev => prev.map(s => {
      if (s.student_id !== studentId) return s;
      const scores = { ...(s.scores || {}) };
      if (v === null) delete scores[criterioId]; else scores[criterioId] = v;
      return { ...s, scores };
    }));
    setDirty(prev => new Set(prev).add(studentId));
  };

  const saveAll = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const entries = students
        .filter(s => dirty.has(s.student_id))
        .map(s => ({ student_id: s.student_id, scores: s.scores || {} }));
      await axios.post(`${API}/conducta-extendida`, {
        section_id: sectionId,
        period_id: periodId,
        entries,
      }, { headers });
      setDirty(new Set());
      setSuccess(`${entries.length} alumno${entries.length === 1 ? "" : "s"} guardado${entries.length === 1 ? "" : "s"}.`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const promedio = (s) => {
    const nums = allCriterios
      .map(c => s.scores?.[c.id])
      .filter(v => v !== null && v !== undefined && v !== "")
      .map(Number)
      .filter(n => !Number.isNaN(n));
    if (!nums.length) return null;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500" data-testid="conducta-ext-tab-loading">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  if (mode !== "extended") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-6 text-amber-900 text-sm" data-testid="conducta-ext-tab-disabled">
        <p className="font-semibold mb-1 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Conducta Extendida desactivada</p>
        <p className="text-xs">
          Esta pestaña aparece sólo cuando el colegio activa el modo <b>Extendido</b> en Ajustes → Libretas → Formato de Evaluación Conductual. Mientras tanto, sigue usando la pestaña <b>Conducta &amp; Comentarios</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="conducta-ext-tab">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Evaluación Conductual — {periodName}</h3>
          <p className="text-xs text-slate-500">Notas 0–20. Se autoguarda en lote al hacer clic en <b>Guardar</b>.</p>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || dirty.size === 0}
          className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-40"
          data-testid="conducta-ext-tab-save"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar {dirty.size > 0 && `(${dirty.size})`}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        <table className="text-xs w-full" style={{ borderCollapse: "collapse" }} data-testid="conducta-ext-table">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="sticky left-0 bg-slate-100 px-2 py-2 text-left border-r border-slate-200 z-10" style={{ minWidth: 220 }}>
                Alumno
              </th>
              {(template.secciones || []).map(sec => (
                <th key={sec.id} colSpan={sec.criterios?.length || 1} className="px-2 py-1.5 text-center border-l border-slate-300 bg-slate-200 text-[11px] font-bold uppercase tracking-wide">
                  {sec.nombre}
                </th>
              ))}
              <th rowSpan={2} className="px-2 py-2 text-center bg-emerald-100 border-l border-slate-300 text-[11px] font-bold text-emerald-800">PROM.</th>
            </tr>
            <tr className="bg-slate-50">
              {(template.secciones || []).flatMap(sec => (sec.criterios || []).map(c => (
                <th key={c.id} className="px-1.5 py-1.5 text-center border-l border-slate-200 text-[10px] font-semibold text-slate-700 leading-tight" style={{ minWidth: 70, maxWidth: 90 }}>
                  <div className="truncate" title={c.nombre}>{c.nombre}</div>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => {
              const isDirty = dirty.has(s.student_id);
              const prom = promedio(s);
              return (
                <tr key={s.student_id} className={`border-t border-slate-100 ${idx % 2 ? "bg-slate-50/40" : ""} ${isDirty ? "bg-amber-50/60" : ""}`} data-testid={`conducta-ext-row-${idx}`}>
                  <td className="sticky left-0 bg-inherit px-2 py-1 border-r border-slate-200 font-medium text-slate-800 z-10">
                    {s.full_name || `${s.last_name || ""} ${s.name || ""}`.trim()}
                  </td>
                  {allCriterios.map(c => (
                    <td key={c.id} className="border-l border-slate-100 p-0 text-center">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step="0.01"
                        value={s.scores?.[c.id] ?? ""}
                        onChange={(e) => onScoreChange(s.student_id, c.id, e.target.value)}
                        className="w-full px-1 py-1 text-center bg-transparent outline-none focus:bg-violet-50 text-[12px]"
                        data-testid={`conducta-ext-input-${s.student_id}-${c.id}`}
                      />
                    </td>
                  ))}
                  <td className="border-l border-slate-200 px-2 py-1 text-center font-bold text-emerald-800 bg-emerald-50/40">
                    {prom === null ? "-" : prom}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={allCriterios.length + 2} className="text-center py-6 text-slate-400 text-sm">Sin alumnos en esta sección.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
