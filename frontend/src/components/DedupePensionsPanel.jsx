import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * DedupePensionsPanel
 * - Allows the school owner to consolidate duplicate pension payments produced
 *   by case-sensitive matching (mensualidad / Mensualidad / Pension Abril 2026).
 * - Two-step UX: dry-run preview → confirmation → execute.
 */
export default function DedupePensionsPanel({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [executing, setExecuting] = useState(false);

  const runPreview = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const res = await axios.post(
        `${API}/accounting/maintenance/dedupe-pension-payments?dry_run=true`,
        {},
        { headers }
      );
      setPreview(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al ejecutar el análisis");
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!preview || preview.duplicates_found === 0) return;
    if (!window.confirm(
      `Vas a consolidar ${preview.duplicates_found} grupos con duplicados (${preview.would_cancel} pagos serán marcados como CANCELADOS). Esta acción NO elimina los registros y queda auditada. ¿Continuar?`
    )) return;
    setExecuting(true);
    try {
      const res = await axios.post(
        `${API}/accounting/maintenance/dedupe-pension-payments?dry_run=false`,
        {},
        { headers }
      );
      toast.success(`Consolidación completa: ${res.data.canceled} pagos cancelados, ${res.data.normalized} conceptos normalizados`);
      setPreview(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al ejecutar la consolidación");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden" data-testid="dedupe-pensions-panel">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 flex items-center gap-3">
        <ShieldCheck className="w-6 h-6" />
        <div>
          <h3 className="font-bold text-lg">Mantenimiento — Consolidar Mensualidades Duplicadas</h3>
          <p className="text-sm text-white/85">
            Detecta pagos del mismo mes con concepto duplicado por mayúsculas (mensualidad / Mensualidad / Pension)
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">¿Cuándo usar esta herramienta?</p>
            <p>Si en el portal del padre o en Estado de Pagos aparecen <b>varios pagos del mismo mes</b> (ej. dos "Abril 2026" pagados o uno pagado + uno pendiente), ejecuta primero el análisis para ver qué se va a consolidar y luego aplica la limpieza.</p>
            <p className="mt-1">Los duplicados se marcan como <code className="bg-amber-100 px-1 rounded">canceled</code> con razón <code className="bg-amber-100 px-1 rounded">dedup_consolidation</code>; ningún dato se elimina.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runPreview}
            disabled={loading || executing}
            data-testid="dedupe-preview-btn"
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loading ? "Analizando..." : "1. Analizar duplicados (preview)"}
          </button>
          {preview && preview.duplicates_found > 0 && (
            <button
              onClick={execute}
              disabled={executing || loading}
              data-testid="dedupe-execute-btn"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-medium flex items-center gap-2 transition-colors"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              2. Ejecutar consolidación
            </button>
          )}
        </div>

        {preview && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" data-testid="dedupe-preview-result">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Grupos analizados" value={preview.groups_checked} />
              <Stat label="Duplicados encontrados" value={preview.duplicates_found} highlight={preview.duplicates_found > 0 ? "amber" : "emerald"} />
              <Stat label="Pagos a cancelar" value={preview.would_cancel} highlight={preview.would_cancel > 0 ? "rose" : "slate"} />
              <Stat label="Estado" value={preview.dry_run ? "Preview" : "Aplicado"} />
            </div>

            {preview.duplicates_found === 0 ? (
              <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> No se encontraron duplicados. Tu BD está limpia ✓
              </p>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Detalle (primeros {Math.min(preview.details?.length || 0, 30)})</p>
                <div className="max-h-72 overflow-auto bg-white rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Alumno</th>
                        <th className="text-left px-3 py-2">Mes</th>
                        <th className="text-left px-3 py-2">Se mantiene</th>
                        <th className="text-left px-3 py-2">Se cancela</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.details || []).slice(0, 30).map((c, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-mono text-[10px]">{c.student_id?.slice(0, 8)}…</td>
                          <td className="px-3 py-2">{c.pension_month}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                              {c.kept_concept} · {c.kept_status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {c.canceled.map((x, j) => (
                              <span key={j} className="inline-block mr-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px]">
                                {x.concept} · S/{x.amount}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = "slate" }) {
  const tones = {
    slate: "text-slate-700 bg-white border-slate-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    rose: "text-rose-700 bg-rose-50 border-rose-200",
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${tones[highlight] || tones.slate}`}>
      <p className="text-2xl font-black tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-75">{label}</p>
    </div>
  );
}
