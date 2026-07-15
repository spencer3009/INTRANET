import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';

/**
 * Temporary diagnostic page for Registro Auxiliar data.
 * Owner / support only. Read-only.
 *
 *   /diag/registro-auxiliar
 */
export default function DiagRegistroAuxiliarPage() {
  const API = process.env.REACT_APP_BACKEND_URL;
  const token = localStorage.getItem('token') || '';
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  // ── Plantilla section ──
  const [pNombre, setPNombre] = useState('Nueva Plantilla');
  const [pSchool, setPSchool] = useState('precursores tj');
  const [pLoading, setPLoading] = useState(false);
  const [pResult, setPResult] = useState(null);
  const [pError, setPError] = useState('');

  const fetchPlantilla = useCallback(async () => {
    setPLoading(true);
    setPError('');
    setPResult(null);
    try {
      const r = await axios.get(`${API}/api/diag/plantilla`, {
        headers: authHeaders,
        params: {
          nombre: pNombre,
          school_name: pSchool || undefined,
        },
      });
      setPResult(r.data);
    } catch (err) {
      setPError(err?.response?.data?.detail || err.message);
    } finally {
      setPLoading(false);
    }
  }, [API, authHeaders, pNombre, pSchool]);

  // ── Legacy-only docs section ──
  const [lSchoolId, setLSchoolId] = useState('');
  const [lLoading, setLLoading] = useState(false);
  const [lResult, setLResult] = useState(null);
  const [lError, setLError] = useState('');

  const fetchLegacyOnly = useCallback(async () => {
    setLLoading(true);
    setLError('');
    setLResult(null);
    try {
      const r = await axios.get(`${API}/api/diag/grades-legacy-only`, {
        headers: authHeaders,
        params: {
          school_id: lSchoolId || undefined,
          limit_samples: 5,
        },
      });
      setLResult(r.data);
    } catch (err) {
      setLError(err?.response?.data?.detail || err.message);
    } finally {
      setLLoading(false);
    }
  }, [API, authHeaders, lSchoolId]);

  const copy = (data) => {
    if (data == null) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  // ── Final grade diagnostic ──
  const [fgStudent, setFgStudent] = useState('');
  const [fgSubject, setFgSubject] = useState('');
  const [fgPeriod, setFgPeriod] = useState('');
  const [fgSchool, setFgSchool] = useState('precursores tj');
  const [fgLoading, setFgLoading] = useState(false);
  const [fgResult, setFgResult] = useState(null);
  const [fgError, setFgError] = useState('');

  const fetchFinalGrade = useCallback(async () => {
    setFgLoading(true);
    setFgError('');
    setFgResult(null);
    try {
      const r = await axios.get(`${API}/api/diag/final-grade`, {
        headers: authHeaders,
        params: {
          student_name: fgStudent,
          subject_name: fgSubject || undefined,
          period_name: fgPeriod || undefined,
          school_name: fgSchool || undefined,
        },
      });
      setFgResult(r.data);
    } catch (err) {
      setFgError(err?.response?.data?.detail || err.message);
    } finally {
      setFgLoading(false);
    }
  }, [API, authHeaders, fgStudent, fgSubject, fgPeriod, fgSchool]);

  // ── Recompute & persist final grades ──
  const [rcLoading, setRcLoading] = useState(false);
  const [rcResult, setRcResult] = useState(null);
  const [rcError, setRcError] = useState('');
  const [rcStudentQ, setRcStudentQ] = useState('');
  const [rcSubjectQ, setRcSubjectQ] = useState('');

  const runRecompute = useCallback(async (dryRun) => {
    if (!dryRun && !window.confirm('Esto RECALCULARÁ Y GUARDARÁ las notas finales de todo el colegio (no toca notas manuales). ¿Continuar?')) return;
    setRcLoading(true);
    setRcError('');
    if (dryRun) setRcResult(null);
    try {
      const params = new URLSearchParams({ dry_run: String(dryRun) });
      if (rcStudentQ.trim()) params.set('student_q', rcStudentQ.trim());
      if (rcSubjectQ.trim()) params.set('subject_q', rcSubjectQ.trim());
      const r = await axios.post(`${API}/api/grades/_maintenance/recompute-finals?${params.toString()}`, {}, { headers: authHeaders });
      setRcResult(r.data);
    } catch (err) {
      setRcError(err?.response?.data?.detail || err.message);
    } finally {
      setRcLoading(false);
    }
  }, [API, authHeaders, rcStudentQ, rcSubjectQ]);

  return (
    <div className="min-h-screen bg-slate-50 p-6" data-testid="diag-registro-page">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Diagnóstico — Registro Auxiliar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Solo lectura. Inspecciona plantillas y filas de <code>student_grades</code> sin tocar datos.
          </p>
        </header>

        {/* ──── PLANTILLA ──── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4">1. Ver plantilla</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre (parcial)</label>
              <input
                value={pNombre}
                onChange={(e) => setPNombre(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Nueva Plantilla"
                data-testid="diag-plantilla-nombre"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Colegio (parcial)</label>
              <input
                value={pSchool}
                onChange={(e) => setPSchool(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="precursores tj"
                data-testid="diag-plantilla-school"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchPlantilla}
                disabled={pLoading || !pNombre.trim()}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                data-testid="diag-plantilla-btn"
              >
                {pLoading ? 'Buscando…' : 'Buscar plantilla'}
              </button>
            </div>
          </div>
          {pError && (
            <div className="mt-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3" data-testid="diag-plantilla-error">
              {pError}
            </div>
          )}
          {pResult && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  Resultados: <b>{pResult.total_results}</b> · Colegios coincidentes: <b>{(pResult.matched_schools || []).length}</b>
                </span>
                <button
                  onClick={() => copy(pResult)}
                  className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
                  data-testid="diag-plantilla-copy"
                >
                  Copiar JSON
                </button>
              </div>
              <pre
                className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto max-h-[60vh]"
                data-testid="diag-plantilla-json"
              >
                {JSON.stringify(pResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* ──── LEGACY-ONLY DOCS ──── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-1">
            2. Filas con <code>grades_dynamic</code> vacío + campos legacy poblados
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Filtra documentos de <code>student_grades</code> donde el subdocumento <code>grades_dynamic</code>{' '}
            está ausente / vacío / null Y al menos uno de los campos planos legacy (
            <code>act_co</code>, <code>act_re</code>, <code>rf_r1..r5</code>, <code>comp_c1/c2</code>,{' '}
            <code>part_p1..p3/exp/tg/p</code>, <code>exam_mensual</code>, <code>exam_bimestral</code>) tiene un valor distinto de null.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                school_id (opcional, filtrar a un solo colegio)
              </label>
              <input
                value={lSchoolId}
                onChange={(e) => setLSchoolId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="UUID del colegio o vacío para todos"
                data-testid="diag-legacy-school-id"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={fetchLegacyOnly}
                disabled={lLoading}
                className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                data-testid="diag-legacy-btn"
              >
                {lLoading ? 'Contando…' : 'Contar y agrupar'}
              </button>
            </div>
          </div>
          {lError && (
            <div className="mt-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3" data-testid="diag-legacy-error">
              {lError}
            </div>
          )}
          {lResult && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">
                  Total filas afectadas: <b>{lResult.total_affected_docs}</b> · Grupos:{' '}
                  <b>{lResult.groups_returned}</b>
                </span>
                <button
                  onClick={() => copy(lResult)}
                  className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
                  data-testid="diag-legacy-copy"
                >
                  Copiar JSON
                </button>
              </div>
              <pre
                className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto max-h-[60vh]"
                data-testid="diag-legacy-json"
              >
                {JSON.stringify(lResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* ──── DIAGNÓSTICO NOTA FINAL ──── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-1">3. Diagnóstico de nota final (Consolidado vs Registro Auxiliar)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Ingresa el alumno (y opcionalmente curso/periodo) para ver la nota guardada, la
            recalculada y el desglose completo de la fórmula.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alumno (nombre o apellido)</label>
              <input value={fgStudent} onChange={(e) => setFgStudent(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Samuel" data-testid="diag-fg-student" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Curso (parcial, opcional)</label>
              <input value={fgSubject} onChange={(e) => setFgSubject(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Comunicaciones" data-testid="diag-fg-subject" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Periodo (parcial, opcional)</label>
              <input value={fgPeriod} onChange={(e) => setFgPeriod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="2do" data-testid="diag-fg-period" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Colegio (parcial)</label>
              <input value={fgSchool} onChange={(e) => setFgSchool(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="precursores tj" data-testid="diag-fg-school" />
            </div>
          </div>
          <button onClick={fetchFinalGrade} disabled={fgLoading || !fgStudent.trim()}
            className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            data-testid="diag-fg-btn">
            {fgLoading ? 'Calculando…' : 'Diagnosticar nota'}
          </button>
          {fgError && (
            <div className="mt-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3" data-testid="diag-fg-error">
              {fgError}
            </div>
          )}
          {fgResult && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">
                Plantilla: <b>{fgResult.template?.nombre || '—'}</b> · modo <b>{fgResult.template?.modo_ponderacion || '—'}</b> ·
                {fgResult.template?.is_custom ? ' CUSTOM' : ' Sistema'}
                <button onClick={() => copy(fgResult)} className="ml-3 text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded" data-testid="diag-fg-copy">Copiar JSON</button>
              </div>
              {(fgResult.students || []).map((st, i) => (
                <div key={i} className="mb-4 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-800">{st.student.name}</div>
                  {(st.grades || []).map((g, j) => (
                    <div key={j} className="px-4 py-3 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold">{g.subject_name || g.subject_id}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Guardada: <b>{g.display_stored ?? g.final_grade_stored ?? '—'}</b></span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Recalculada: <b>{g.display_recomputed ?? g.final_grade_recomputed ?? '—'}</b></span>
                        {g.final_grade_manual != null && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800">Manual: <b>{g.final_grade_manual}</b></span>}
                      </div>
                    </div>
                  ))}
                  {(!st.grades || st.grades.length === 0) && <div className="px-4 py-3 text-sm text-slate-400">Sin notas para el filtro dado</div>}
                </div>
              ))}
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto max-h-[60vh]" data-testid="diag-fg-json">
                {JSON.stringify(fgResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* ──── RECALCULAR Y GUARDAR ──── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-1">4. Recalcular y guardar notas finales</h2>
          <p className="text-sm text-slate-500 mb-4">
            Aplica la fórmula vigente a TODAS las notas guardadas del colegio (no toca notas
            manuales) para que el Consolidado, exportaciones y libretas muestren el mismo valor
            que el Registro Auxiliar. Primero usa <b>Previsualizar</b> para ver cuántas cambiarían.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrar por alumno (opcional)</label>
              <input value={rcStudentQ} onChange={(e) => setRcStudentQ(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ej: Herrera Ríos Emmy" data-testid="diag-recompute-student-q" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrar por curso (opcional)</label>
              <input value={rcSubjectQ} onChange={(e) => setRcSubjectQ(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ej: Comunicaciones" data-testid="diag-recompute-subject-q" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            La tabla es una <b>muestra</b>. Sin filtro muestra las primeras 20 filas que cambian;
            con filtro muestra hasta 200 coincidencias. <b>Aplicar y guardar</b> corrige TODAS las
            notas del colegio, aparezcan o no en la muestra.
          </p>
          <div className="flex gap-3">
            <button onClick={() => runRecompute(true)} disabled={rcLoading}
              className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              data-testid="diag-recompute-preview">
              {rcLoading ? 'Procesando…' : 'Previsualizar (sin guardar)'}
            </button>
            <button onClick={() => runRecompute(false)} disabled={rcLoading || !rcResult}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              data-testid="diag-recompute-apply">
              Aplicar y guardar
            </button>
          </div>
          {rcError && (
            <div className="mt-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3" data-testid="diag-recompute-error">
              {rcError}
            </div>
          )}
          {rcResult && (
            <div className="mt-4 text-sm">
              <div className="flex flex-wrap gap-3 mb-3">
                <span className="px-3 py-1 rounded bg-slate-100">Revisadas: <b>{rcResult.checked}</b></span>
                <span className="px-3 py-1 rounded bg-amber-100 text-amber-800">Cambiarían/cambiaron: <b>{rcResult.changed}</b></span>
                <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800">{rcResult.dry_run ? 'Modo previsualización' : `Guardadas: ${rcResult.applied}`}</span>
              </div>
              {rcResult.message && <p className="text-slate-500 mb-2">{rcResult.message}</p>}
              {rcResult.filtered && (rcResult.samples || []).length === 0 && (
                <p className="text-slate-500 mb-2" data-testid="diag-recompute-nomatch">
                  Ninguna fila que cambia coincide con el filtro (revisa el nombre escrito).
                </p>
              )}
              {rcResult.filtered && (rcResult.samples || []).length > 0 && (
                <p className="text-emerald-700 mb-2">Mostrando {rcResult.samples.length} coincidencia(s) del filtro.</p>
              )}
              {(rcResult.samples || []).length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100"><tr>
                      <th className="text-left px-3 py-1.5">Alumno</th>
                      <th className="text-left px-3 py-1.5">Curso</th>
                      <th className="text-left px-3 py-1.5">Periodo</th>
                      <th className="px-3 py-1.5 text-amber-700">Guardado en BD (antes)</th>
                      <th className="px-3 py-1.5 text-emerald-700">Recalculado / Registro Auxiliar</th>
                    </tr></thead>
                    <tbody>
                      {rcResult.samples.map((s, i) => (
                        <tr key={i} className="border-t border-slate-100" data-testid={`diag-recompute-row-${i}`}>
                          <td className="px-3 py-1.5">{s.student_name || (s.student_id || '').slice(0, 8)}</td>
                          <td className="px-3 py-1.5">{s.subject_name || (s.subject_id || '').slice(0, 8)}</td>
                          <td className="px-3 py-1.5 text-slate-500">{s.period_name || '—'}</td>
                          <td className="px-3 py-1.5 text-center text-amber-700">{s.old_display ?? s.old}</td>
                          <td className="px-3 py-1.5 text-center text-emerald-700 font-semibold">{s.new_display ?? s.new}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-slate-400 pb-8">
          Herramienta temporal de diagnóstico — solo lectura. No modifica datos.
        </footer>
      </div>
    </div>
  );
}
