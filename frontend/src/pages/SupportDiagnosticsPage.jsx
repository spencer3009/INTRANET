import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Shield, AlertTriangle, Trash2, CheckCircle2, Loader2, Search, RefreshCw } from "lucide-react";

/**
 * Support-only diagnostic: duplicate subjects per section.
 * Route: /support/diagnostico
 */
export default function SupportDiagnosticsPage() {
  const API = process.env.REACT_APP_BACKEND_URL;
  const token = localStorage.getItem("token") || "";
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/api/support/all-schools`, { headers });
        const list = Array.isArray(r.data) ? r.data : (r.data?.schools || r.data?.items || []);
        setSchools(list);
      } catch (e) {
        setError("No se pudo cargar la lista de colegios: " + (e?.response?.data?.detail || e.message));
      }
    };
    load();
  }, [API, headers]);

  const fetchDuplicates = useCallback(async () => {
    if (!schoolId) { setError("Selecciona un colegio primero"); return; }
    setLoading(true); setError(""); setResult(null); setNotice("");
    try {
      const r = await axios.get(`${API}/api/diag/duplicate-subjects`, {
        headers, params: { school_id: schoolId },
      });
      setResult(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [API, headers, schoolId]);

  const handleDelete = async (subjectId, name) => {
    if (!window.confirm(`¿Eliminar definitivamente la asignatura duplicada "${name}"?\n\nSe borrarán también sus asignaciones, notas y publicaciones asociadas. Esta acción no se puede deshacer.`)) return;
    setDeletingId(subjectId); setError(""); setNotice("");
    try {
      const r = await axios.delete(`${API}/api/diag/duplicate-subjects/${subjectId}`, {
        headers, params: { school_id: schoolId },
      });
      setNotice(`Asignatura "${r.data?.deleted_subject?.name}" eliminada correctamente.`);
      await fetchDuplicates();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6" data-testid="support-diagnostics-page">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Diagnóstico · Asignaturas duplicadas</h1>
          <p className="text-sm text-slate-500">Detecta y elimina asignaturas repetidas dentro de una misma sección. Solo soporte.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mt-5">
        <label className="block text-sm font-semibold text-slate-600 mb-2">Colegio</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            data-testid="diag-school-select"
          >
            <option value="">— Selecciona un colegio —</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.school_name || s.name || s.nombre || s.id}</option>
            ))}
          </select>
          <button
            onClick={fetchDuplicates}
            disabled={loading || !schoolId}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-medium flex items-center justify-center gap-2"
            data-testid="diag-scan-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm" data-testid="diag-error">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm" data-testid="diag-notice">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {notice}
        </div>
      )}

      {result && !result.has_duplicates && (
        <div className="mt-6 text-center py-10 bg-white rounded-2xl border border-slate-200" data-testid="diag-no-duplicates">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold">Sin duplicados</p>
          <p className="text-sm text-slate-500">No se encontraron asignaturas repetidas en {result.school_name}.</p>
        </div>
      )}

      {result?.has_duplicates && (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-slate-600 font-medium">
            {result.group_count} grupo(s) de asignaturas duplicadas en <b>{result.school_name}</b>
          </p>
          {result.groups.map((g, gi) => (
            <div key={gi} className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid={`dup-group-${gi}`}>
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <p className="font-bold text-slate-800">{g.name}</p>
                <p className="text-xs text-slate-500">{g.grade_name} · Sección {g.section_name} · {g.count} copias</p>
              </div>
              <div className="divide-y divide-slate-100">
                {g.subjects.map((s) => (
                  <div key={s.subject_id} className="px-5 py-4 flex items-start justify-between gap-4" data-testid={`dup-subject-${s.subject_id}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.role === "original" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {s.role === "original" ? "ORIGINAL" : "DUPLICADO"}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                        {s.code && <span className="text-xs text-slate-400">({s.code})</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{s.role_label}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Actividad: {s.impact.assignments} asignaciones · {s.impact.materials} materiales · {s.impact.tasks} tareas · {s.impact.exams} exámenes · {s.impact.grades} notas
                      </p>
                    </div>
                    {s.role === "duplicado" ? (
                      <button
                        onClick={() => handleDelete(s.subject_id, s.name)}
                        disabled={deletingId === s.subject_id}
                        className="shrink-0 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-medium flex items-center gap-1.5"
                        data-testid={`delete-dup-${s.subject_id}`}
                      >
                        {deletingId === s.subject_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Eliminar
                      </button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Mantener</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
