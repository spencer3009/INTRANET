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

        <footer className="text-center text-xs text-slate-400 pb-8">
          Herramienta temporal de diagnóstico — solo lectura. No modifica datos.
        </footer>
      </div>
    </div>
  );
}
