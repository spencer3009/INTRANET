import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  GripVertical, CheckCircle2, AlertTriangle, X, ClipboardList
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PlantillaEditorPage({ user, token, subdomain }) {
  const { plantillaId } = useParams();
  const navigate = useNavigate();
  const isNew = !plantillaId;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const schoolId = user?.school_id;
  const headers = { Authorization: `Bearer ${token}` };

  const [nombre, setNombre] = useState("Nueva Plantilla");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("borrador");
  const [criterios, setCriterios] = useState([]);
  const [columnasFinales, setColumnasFinales] = useState([]);
  const [labelPromedioFinal, setLabelPromedioFinal] = useState("PROM. BIMESTRAL");
  const [escalaMin, setEscalaMin] = useState(0);
  const [escalaMax, setEscalaMax] = useState(20);
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef(null);
  const autoSaveRef = useRef(null);

  const effectiveId = plantillaId || createdId;

  // Load template
  useEffect(() => {
    if (!plantillaId || !schoolId) return;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${plantillaId}`, { headers });
        setNombre(data.nombre);
        setDescripcion(data.descripcion || "");
        setEstado(data.estado);
        setCriterios(data.criterios || []);
        setColumnasFinales(data.columnas_finales || []);
        setLabelPromedioFinal(data.label_promedio_final || "PROM. BIMESTRAL");
        setEscalaMin(data.escala_minima ?? 0);
        setEscalaMax(data.escala_maxima ?? 20);
      } catch { toast.error("Error al cargar plantilla"); }
      finally { setLoading(false); }
    })();
  }, [plantillaId, schoolId]);

  const ts = () => Date.now().toString(36);

  // Percentage sum
  const pctSum = criterios.reduce((s, c) => s + (parseFloat(c.porcentaje) || 0), 0)
    + columnasFinales.reduce((s, c) => s + (parseFloat(c.porcentaje) || 0), 0);
  const pctOk = Math.round(pctSum * 100) / 100 === 100;

  const markChanged = () => setHasChanges(true);

  // ── Criterio operations ──
  const updateCriterio = (idx, field, value) => {
    setCriterios(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
    markChanged();
  };
  const moveCriterio = (idx, dir) => {
    setCriterios(prev => {
      const n = [...prev]; const t = idx + dir;
      if (t < 0 || t >= n.length) return n;
      [n[idx], n[t]] = [n[t], n[idx]];
      return n.map((c, i) => ({ ...c, orden: i }));
    });
    markChanged();
  };
  const removeCriterio = (idx) => {
    if (!window.confirm(`¿Eliminar '${criterios[idx]?.nombre}'?`)) return;
    setCriterios(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, orden: i })));
    markChanged();
  };
  const addCriterio = () => {
    const id = `criterio_${ts()}`;
    setCriterios(prev => [...prev, {
      id, nombre: "NUEVO CRITERIO", porcentaje: 0, color: "#F1C40F", orden: prev.length,
      subcolumnas: [
        { id: `${id}_c1`, label: "C1", tipo: "input", orden: 0 },
        { id: `${id}_prom`, label: "PROMEDIO", tipo: "promedio_auto", orden: 1 },
      ]
    }]);
    markChanged();
  };

  // ── Subcolumna operations ──
  const updateSub = (cIdx, sIdx, field, value) => {
    setCriterios(prev => {
      const n = [...prev];
      const subs = [...n[cIdx].subcolumnas];
      subs[sIdx] = { ...subs[sIdx], [field]: value };
      n[cIdx] = { ...n[cIdx], subcolumnas: subs };
      return n;
    });
    markChanged();
  };
  const moveSub = (cIdx, sIdx, dir) => {
    setCriterios(prev => {
      const n = [...prev];
      const subs = [...n[cIdx].subcolumnas];
      const t = sIdx + dir;
      if (t < 0 || t >= subs.length) return n;
      [subs[sIdx], subs[t]] = [subs[t], subs[sIdx]];
      n[cIdx] = { ...n[cIdx], subcolumnas: subs.map((s, i) => ({ ...s, orden: i })) };
      return n;
    });
    markChanged();
  };
  const removeSub = (cIdx, sIdx) => {
    if (criterios[cIdx].subcolumnas.length <= 1) return;
    setCriterios(prev => {
      const n = [...prev];
      n[cIdx] = { ...n[cIdx], subcolumnas: n[cIdx].subcolumnas.filter((_, i) => i !== sIdx).map((s, i) => ({ ...s, orden: i })) };
      return n;
    });
    markChanged();
  };
  const addSub = (cIdx) => {
    setCriterios(prev => {
      const n = [...prev];
      const c = n[cIdx];
      const newId = `${c.id}_sub_${ts()}`;
      n[cIdx] = { ...c, subcolumnas: [...c.subcolumnas, { id: newId, label: "Nueva", tipo: "input", orden: c.subcolumnas.length }] };
      return n;
    });
    markChanged();
  };

  // ── Columnas finales operations ──
  const updateColFinal = (idx, field, value) => {
    setColumnasFinales(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
    markChanged();
  };
  const moveColFinal = (idx, dir) => {
    setColumnasFinales(prev => {
      const n = [...prev]; const t = idx + dir;
      if (t < 0 || t >= n.length) return n;
      [n[idx], n[t]] = [n[t], n[idx]];
      return n.map((c, i) => ({ ...c, orden: i }));
    });
    markChanged();
  };
  const removeColFinal = (idx) => {
    setColumnasFinales(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, orden: i })));
    markChanged();
  };
  const addColFinal = () => {
    setColumnasFinales(prev => [...prev, { id: `col_final_${ts()}`, label: "NUEVA COLUMNA", label_corto: "NC", porcentaje: 0, orden: prev.length }]);
    markChanged();
  };

  // ── Save ──
  const buildPayload = (targetEstado) => ({
    nombre, descripcion, estado: targetEstado,
    criterios: criterios.map((c, i) => ({ ...c, orden: i, subcolumnas: c.subcolumnas.map((s, j) => ({ ...s, orden: j })) })),
    columnas_finales: columnasFinales.map((c, i) => ({ ...c, orden: i })),
    label_promedio_final: labelPromedioFinal,
    escala_minima: escalaMin, escala_maxima: escalaMax,
  });

  const save = async (targetEstado = "borrador", silent = false) => {
    if (!silent) setSaving(true);
    try {
      if (effectiveId) {
        await axios.put(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${effectiveId}`, buildPayload(targetEstado), { headers });
      } else {
        const { data } = await axios.post(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas`, buildPayload(targetEstado), { headers });
        setCreatedId(data.id);
      }
      setEstado(targetEstado);
      setHasChanges(false);
      setLastSaved(new Date());
      if (!silent) toast.success(targetEstado === "activa" ? "Plantilla activada" : "Borrador guardado");
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.detail || "Error al guardar");
    } finally { if (!silent) setSaving(false); }
  };

  // Autosave every 30s for borradores
  useEffect(() => {
    if (estado !== "borrador" || !effectiveId) return;
    autoSaveRef.current = setInterval(() => {
      if (hasChanges) save("borrador", true);
    }, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [estado, effectiveId, hasChanges, criterios, columnasFinales, nombre]);

  const handleBack = () => {
    if (hasChanges && !window.confirm("Tienes cambios sin guardar. ¿Salir de todas formas?")) return;
    navigate(`/${subdomain}/settings`);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" data-testid="editor-back"><ArrowLeft className="w-5 h-5" /></button>
            {editingName ? (
              <input ref={nameRef} autoFocus value={nombre} onChange={e => { setNombre(e.target.value); markChanged(); }}
                onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                className="text-lg font-bold text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent px-1" data-testid="editor-name-input" />
            ) : (
              <h1 className="text-lg font-bold text-slate-800 cursor-pointer hover:text-indigo-600" onClick={() => setEditingName(true)} data-testid="editor-name">{nombre}</h1>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${pctOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`} data-testid="editor-pct-sum">
              {pctOk ? "✓" : "⚠"} {Math.round(pctSum)}% / 100%
            </span>
            <button onClick={() => save("borrador")} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-50" data-testid="editor-save-draft">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar borrador
            </button>
            <button onClick={() => save("activa")} disabled={saving || !pctOk}
              title={pctOk ? "" : "La suma de porcentajes debe ser exactamente 100%"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed" data-testid="editor-activate">
              <CheckCircle2 className="w-4 h-4" /> Activar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column — Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section A: Criterios */}
            <section>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Criterios de Evaluación</h2>
              <p className="text-xs text-slate-400 mb-4">Define las categorías y su peso en la nota final.</p>
              <div className="space-y-4">
                {criterios.map((c, cIdx) => (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`criterio-card-${cIdx}`}>
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="w-6 h-6 rounded border border-slate-300" style={{ backgroundColor: c.color }}>
                        <input type="color" value={c.color} onChange={e => updateCriterio(cIdx, "color", e.target.value)}
                          className="w-full h-full opacity-0 cursor-pointer" />
                      </div>
                      <input value={c.nombre} onChange={e => updateCriterio(cIdx, "nombre", e.target.value.toUpperCase())}
                        className="flex-1 text-sm font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-400 outline-none px-1" data-testid={`criterio-nombre-${cIdx}`} />
                      <div className="flex items-center gap-1">
                        <input type="number" value={c.porcentaje} onChange={e => updateCriterio(cIdx, "porcentaje", parseFloat(e.target.value) || 0)}
                          className="w-16 text-sm text-center font-bold border border-slate-200 rounded-lg py-1" data-testid={`criterio-pct-${cIdx}`} />
                        <span className="text-xs text-slate-400 font-bold">%</span>
                      </div>
                      <button onClick={() => moveCriterio(cIdx, -1)} disabled={cIdx === 0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => moveCriterio(cIdx, 1)} disabled={cIdx === criterios.length - 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                      <button onClick={() => removeCriterio(cIdx)} className="p-1 rounded hover:bg-rose-100 text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="p-3">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400">
                          <th className="text-left py-1 w-8"></th>
                          <th className="text-left py-1">Label</th>
                          <th className="text-left py-1 w-40">Tipo</th>
                          <th className="w-8"></th>
                        </tr></thead>
                        <tbody>
                          {c.subcolumnas.map((s, sIdx) => (
                            <tr key={s.id} className="border-t border-slate-50">
                              <td className="py-1.5">
                                <div className="flex flex-col">
                                  <button onClick={() => moveSub(cIdx, sIdx, -1)} disabled={sIdx === 0} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                  <button onClick={() => moveSub(cIdx, sIdx, 1)} disabled={sIdx === c.subcolumnas.length - 1} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                              </td>
                              <td><input value={s.label} onChange={e => updateSub(cIdx, sIdx, "label", e.target.value)}
                                className="w-full text-sm border border-transparent focus:border-indigo-300 rounded px-1 py-0.5 outline-none" /></td>
                              <td>
                                <select value={s.tipo} onChange={e => updateSub(cIdx, sIdx, "tipo", e.target.value)}
                                  className="text-xs border border-slate-200 rounded px-1 py-1 w-full">
                                  <option value="input">Input manual</option>
                                  <option value="promedio_auto">Promedio automático</option>
                                </select>
                              </td>
                              <td>
                                <button onClick={() => removeSub(cIdx, sIdx)} disabled={c.subcolumnas.length <= 1}
                                  title={c.subcolumnas.length <= 1 ? "Debe haber al menos una subcolumna" : "Eliminar"}
                                  className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed">
                                  <X className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={() => addSub(cIdx)} className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Agregar subcolumna
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={addCriterio} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center gap-2" data-testid="add-criterio">
                  <Plus className="w-4 h-4" /> Agregar criterio
                </button>
              </div>
            </section>

            {/* Section B: Columnas Finales */}
            <section>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Columnas Finales</h2>
              <p className="text-xs text-slate-400 mb-4">Exámenes u otras evaluaciones ponderadas a la nota final.</p>
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                {columnasFinales.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                    <input value={col.label} onChange={e => updateColFinal(idx, "label", e.target.value)}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-300" placeholder="Nombre" />
                    <div className="relative">
                      <input value={col.label_corto} maxLength={4} onChange={e => updateColFinal(idx, "label_corto", e.target.value.toUpperCase())}
                        className="w-16 text-sm text-center border border-slate-200 rounded-lg px-1 py-1.5 outline-none focus:border-indigo-300" placeholder="Corto" />
                      <span className="absolute -bottom-3 right-0 text-[9px] text-slate-300">{(col.label_corto || "").length}/4</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={col.porcentaje} onChange={e => updateColFinal(idx, "porcentaje", parseFloat(e.target.value) || 0)}
                        className="w-16 text-sm text-center font-bold border border-slate-200 rounded-lg py-1.5" />
                      <span className="text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <button onClick={() => moveColFinal(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveColFinal(idx, 1)} disabled={idx === columnasFinales.length - 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeColFinal(idx)} className="p-1 rounded hover:bg-rose-100 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={addColFinal} className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar columna final
                </button>
              </div>
            </section>

            {/* Section C: Config */}
            <section className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Configuración General</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold">Etiqueta promedio final</label>
                  <input value={labelPromedioFinal} maxLength={20} onChange={e => { setLabelPromedioFinal(e.target.value); markChanged(); }}
                    className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold">Nota mínima</label>
                  <input type="number" value={escalaMin} onChange={e => { setEscalaMin(parseFloat(e.target.value) || 0); markChanged(); }}
                    className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold">Nota máxima</label>
                  <input type="number" value={escalaMax} onChange={e => { setEscalaMax(parseFloat(e.target.value) || 0); markChanged(); }}
                    className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-300" />
                  {escalaMin >= escalaMax && <p className="text-xs text-rose-500 mt-1">Debe ser mayor que la nota mínima</p>}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column — Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Vista previa en tiempo real</h3>
              <div className="bg-white rounded-xl border border-slate-200 p-3 overflow-x-auto">
                <PreviewTable criterios={criterios} columnasFinales={columnasFinales} labelPromedio={labelPromedioFinal} />
              </div>
              {/* Percentage Breakdown */}
              <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Desglose de ponderación</h4>
                {criterios.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 text-slate-600 font-medium">{c.nombre}</span>
                    <span className="font-bold text-slate-800">{c.porcentaje}%</span>
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(c.porcentaje, 100)}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
                {columnasFinales.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-amber-400" />
                    <span className="flex-1 text-slate-600 font-medium">{c.label}</span>
                    <span className="font-bold text-slate-800">{c.porcentaje}%</span>
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(c.porcentaje, 100)}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs pt-2 border-t border-slate-100">
                  <span className="flex-1 font-bold text-slate-700">Total</span>
                  <span className={`font-bold ${pctOk ? "text-emerald-600" : "text-rose-600"}`}>{Math.round(pctSum)}%</span>
                  {!pctOk && <span className="text-rose-500 text-[10px]">Faltan {Math.round(100 - pctSum)}%</span>}
                </div>
              </div>
              {/* Autosave indicator */}
              {estado === "borrador" && effectiveId && (
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  {hasChanges ? "Cambios sin guardar" : lastSaved ? `Autoguardado ${Math.round((Date.now() - lastSaved.getTime()) / 1000)}s` : "Sin cambios"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTable({ criterios, columnasFinales, labelPromedio }) {
  const students = ["García López, Ana", "Mendoza Torres, Carlos", "Quispe Huamani, Lucía"];
  if (!criterios.length && !columnasFinales.length) return <p className="text-xs text-slate-400 text-center py-8">Agrega criterios para ver la vista previa</p>;

  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr>
          <th rowSpan={2} className="bg-slate-100 text-slate-600 font-bold px-2 py-1.5 border border-slate-200 text-left min-w-[120px]">ALUMNO</th>
          {criterios.map(c => (
            <th key={c.id} colSpan={(c.subcolumnas || []).length} className="text-white font-bold px-1 py-1.5 border border-white/20 text-center" style={{ backgroundColor: c.color || "#94a3b8" }}>
              {c.nombre} {c.porcentaje}%
            </th>
          ))}
          {columnasFinales.map(col => (
            <th key={col.id} rowSpan={2} className="bg-amber-400 text-white font-bold px-1 py-1.5 border border-amber-300 text-center">
              {col.label_corto || col.label}
            </th>
          ))}
          <th rowSpan={2} className="bg-emerald-600 text-white font-bold px-2 py-1.5 border border-emerald-500 text-center">{labelPromedio || "PROM."}</th>
        </tr>
        <tr>
          {criterios.flatMap(c => (c.subcolumnas || []).map(s => (
            <th key={s.id} className="bg-slate-50 text-slate-500 font-semibold px-1 py-1 border border-slate-200 text-center min-w-[28px]">{s.label}</th>
          )))}
        </tr>
      </thead>
      <tbody>
        {students.map((name, i) => (
          <tr key={i}>
            <td className="px-2 py-1 border border-slate-200 text-slate-600 font-medium">{name}</td>
            {criterios.flatMap(c => (c.subcolumnas || []).map(s => (
              <td key={s.id} className={`border border-slate-200 text-center ${s.tipo === "promedio_auto" ? "bg-emerald-50 text-emerald-600 font-bold" : "text-slate-300"}`}>
                {s.tipo === "promedio_auto" ? "—" : ""}
              </td>
            )))}
            {columnasFinales.map(col => <td key={col.id} className="border border-slate-200"></td>)}
            <td className="border border-slate-200 text-center bg-emerald-50 text-emerald-600 font-bold">—</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
