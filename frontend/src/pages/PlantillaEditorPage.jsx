import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  GripVertical, CheckCircle2, AlertTriangle, X, ClipboardList, Copy, Maximize2, Eye
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

  const [focusSubId, setFocusSubId] = useState(null);
  const [focusColFinalId, setFocusColFinalId] = useState(null);
  const [modalPreviewAbierto, setModalPreviewAbierto] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState(null);

  const generarLabelCorto = (labelLargo) => {
    const texto = labelLargo.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    const palabras = texto.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '';
    if (palabras.length === 1) return palabras[0].slice(0, 4);
    if (palabras.length === 2) return (palabras[0].slice(0, 2) + palabras[1].slice(0, 2));
    return palabras.map(p => p[0]).join('').slice(0, 4);
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
  const cloneSub = (cIdx, sIdx) => {
    const newId = `${criterios[cIdx].id}_sub_${Date.now()}`;
    setCriterios(prev => {
      const n = [...prev];
      const c = n[cIdx];
      const original = c.subcolumnas[sIdx];
      const cloned = { ...original, id: newId, orden: 0 };
      const newSubs = [...c.subcolumnas];
      newSubs.splice(sIdx + 1, 0, cloned);
      n[cIdx] = { ...c, subcolumnas: newSubs.map((s, i) => ({ ...s, orden: i })) };
      return n;
    });
    setFocusSubId(newId);
    markChanged();
  };

  // ── Columnas finales operations ──
  const updateColFinal = (idx, field, value) => {
    setColumnasFinales(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: value };
      if (field === "label") {
        n[idx].label_corto = generarLabelCorto(value);
      }
      return n;
    });
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
    const newId = `col_final_${ts()}`;
    setColumnasFinales(prev => [...prev, { id: newId, label: "", label_corto: "", porcentaje: 0, orden: prev.length }]);
    setFocusColFinalId(newId);
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

  const abrirModalPreview = () => {
    setPreviewSnapshot({
      criterios: JSON.parse(JSON.stringify(criterios)),
      columnasFinales: JSON.parse(JSON.stringify(columnasFinales)),
      labelPromedioFinal,
      nombre,
      pctSum: Math.round(pctSum),
      pctOk,
    });
    setModalPreviewAbierto(true);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50/30">
      {/* ── Premium Header Bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" data-testid="editor-back"><ArrowLeft className="w-5 h-5" /></button>
            <div className="w-px h-6 bg-slate-200" />
            {editingName ? (
              <input ref={nameRef} autoFocus value={nombre} onChange={e => { setNombre(e.target.value); markChanged(); }}
                onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                className="text-lg font-extrabold text-slate-900 border-b-2 border-indigo-500 outline-none bg-transparent px-1 tracking-tight" data-testid="editor-name-input" />
            ) : (
              <h1 className="text-lg font-extrabold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors tracking-tight" onClick={() => setEditingName(true)} data-testid="editor-name">{nombre}</h1>
            )}
            {estado === "borrador" && <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold border border-amber-200">Borrador</span>}
            {estado === "activa" && <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">Activa</span>}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-xs font-bold px-3.5 py-1.5 rounded-xl ${pctOk ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`} data-testid="editor-pct-sum">
              {pctOk ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
              {Math.round(pctSum)}% / 100%
            </span>
            <button onClick={() => save("borrador")} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all text-slate-700" data-testid="editor-save-draft">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar borrador
            </button>
            <button onClick={() => save("activa")} disabled={saving || !pctOk}
              title={pctOk ? "" : "La suma de porcentajes debe ser exactamente 100%"}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all" data-testid="editor-activate">
              <CheckCircle2 className="w-4 h-4" /> Activar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ══ Left Column — Form ══ */}
          <div className="lg:col-span-3 space-y-6">

            {/* ── Section A: Criterios ── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Criterios de Evaluacion</h2>
                  <p className="text-xs text-slate-400">Define las categorias y su peso en la nota final.</p>
                </div>
              </div>
              <div className="space-y-4">
                {criterios.map((c, cIdx) => (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`criterio-card-${cIdx}`}>
                    {/* Criterio header with accent bar */}
                    <div className="h-1 w-full" style={{ backgroundColor: c.color || "#94a3b8" }} />
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                      <div className="w-7 h-7 rounded-lg border-2 border-slate-200 shrink-0 cursor-pointer relative overflow-hidden" style={{ backgroundColor: c.color }}>
                        <input type="color" value={c.color} onChange={e => updateCriterio(cIdx, "color", e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <input value={c.nombre} onChange={e => updateCriterio(cIdx, "nombre", e.target.value.toUpperCase())}
                        className="flex-1 text-sm font-extrabold text-slate-800 bg-transparent border-b-2 border-transparent focus:border-indigo-400 outline-none px-1 tracking-wide" data-testid={`criterio-nombre-${cIdx}`} />
                      <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200">
                        <input type="number" value={c.porcentaje} onChange={e => updateCriterio(cIdx, "porcentaje", parseFloat(e.target.value) || 0)}
                          className="w-14 text-sm text-center font-extrabold bg-transparent outline-none text-slate-800" data-testid={`criterio-pct-${cIdx}`} />
                        <span className="text-xs text-slate-400 font-bold">%</span>
                      </div>
                      <div className="flex items-center gap-0.5 ml-1">
                        <button onClick={() => moveCriterio(cIdx, -1)} disabled={cIdx === 0} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-20 text-slate-400 transition-colors"><ChevronUp className="w-4 h-4" /></button>
                        <button onClick={() => moveCriterio(cIdx, 1)} disabled={cIdx === criterios.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-20 text-slate-400 transition-colors"><ChevronDown className="w-4 h-4" /></button>
                        <button onClick={() => removeCriterio(cIdx)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {/* Subcolumnas */}
                    <div className="px-5 py-3">
                      <div className="space-y-0">
                        {c.subcolumnas.map((s, sIdx) => (
                          <div key={s.id} className={`flex items-center gap-3 py-2.5 ${sIdx > 0 ? "border-t border-slate-100" : ""} group`}>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button onClick={() => moveSub(cIdx, sIdx, -1)} disabled={sIdx === 0} className="text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                              <button onClick={() => moveSub(cIdx, sIdx, 1)} disabled={sIdx === c.subcolumnas.length - 1} className="text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                            <input value={s.label} onChange={e => updateSub(cIdx, sIdx, "label", e.target.value)}
                              ref={el => { if (el && focusSubId === s.id) { el.focus(); el.select(); setFocusSubId(null); } }}
                              className="flex-1 text-sm font-semibold text-slate-700 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none px-1 py-0.5" data-testid={`sub-label-${cIdx}-${sIdx}`} />
                            <select value={s.tipo} onChange={e => updateSub(cIdx, sIdx, "tipo", e.target.value)}
                              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer transition-colors ${s.tipo === "promedio_auto" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              <option value="input">Input manual</option>
                              <option value="promedio_auto">Promedio auto</option>
                            </select>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => cloneSub(cIdx, sIdx)} title="Clonar"
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-colors"
                                data-testid={`clone-sub-${cIdx}-${sIdx}`}>
                                <Copy className="w-3 h-3" />
                              </button>
                              <button onClick={() => removeSub(cIdx, sIdx)} disabled={c.subcolumnas.length <= 1} title="Eliminar"
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 border border-rose-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addSub(cIdx)} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors">
                        <Plus className="w-3 h-3" /> Agregar subcolumna
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={addCriterio} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 flex items-center justify-center gap-2 transition-all" data-testid="add-criterio">
                  <Plus className="w-5 h-5" /> Agregar criterio
                </button>
              </div>
            </section>

            {/* ── Section B: Columnas Finales ── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Columnas Finales</h2>
                  <p className="text-xs text-slate-400">Examenes u otras evaluaciones ponderadas a la nota final.</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
                <div className="p-4 space-y-0">
                  {columnasFinales.map((col, idx) => (
                    <div key={col.id} className={`flex items-center gap-3 py-3 group ${idx > 0 ? "border-t border-slate-100" : ""}`}>
                      <input value={col.label} onChange={e => updateColFinal(idx, "label", e.target.value)}
                        ref={el => { if (el && focusColFinalId === col.id) { el.focus(); setFocusColFinalId(null); } }}
                        className="flex-1 text-sm font-semibold text-slate-700 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none px-1" placeholder="Nombre de columna (ej: EXAMEN MENSUAL)" />
                      <div className="flex items-center gap-1.5 bg-amber-50 rounded-xl px-2 py-1 border border-amber-200">
                        <input type="number" value={col.porcentaje} onChange={e => updateColFinal(idx, "porcentaje", parseFloat(e.target.value) || 0)}
                          className="w-14 text-sm text-center font-extrabold bg-transparent outline-none text-amber-800" />
                        <span className="text-xs text-amber-500 font-bold">%</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveColFinal(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-20 text-slate-400 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveColFinal(idx, 1)} disabled={idx === columnasFinales.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-20 text-slate-400 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removeColFinal(idx)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addColFinal} className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors">
                    <Plus className="w-3 h-3" /> Agregar columna final
                  </button>
                </div>
              </div>
            </section>

            {/* ── Section C: Config ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-slate-300 to-slate-400" />
              <div className="p-5">
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4">Configuracion General</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">Etiqueta promedio final</label>
                    <input value={labelPromedioFinal} maxLength={20} onChange={e => { setLabelPromedioFinal(e.target.value); markChanged(); }}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">Nota minima</label>
                    <input type="number" value={escalaMin} onChange={e => { setEscalaMin(parseFloat(e.target.value) || 0); markChanged(); }}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1.5 block">Nota maxima</label>
                    <input type="number" value={escalaMax} onChange={e => { setEscalaMax(parseFloat(e.target.value) || 0); markChanged(); }}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium" />
                    {escalaMin >= escalaMax && <p className="text-xs text-rose-500 mt-1.5 font-medium">Debe ser mayor que la nota minima</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ══ Right Column — Live Preview ══ */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              {/* Preview table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-indigo-500" /> Vista previa en tiempo real
                  </h3>
                </div>
                <div className="p-3 overflow-x-auto">
                  <PreviewTable criterios={criterios} columnasFinales={columnasFinales} labelPromedio={labelPromedioFinal} />
                </div>
              </div>

              {/* Percentage Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Desglose de ponderacion</h4>
                </div>
                <div className="p-4 space-y-2.5">
                  {criterios.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 text-xs">
                      <div className="w-3 h-3 rounded-md shadow-sm" style={{ backgroundColor: c.color }} />
                      <span className="flex-1 text-slate-600 font-semibold truncate">{c.nombre}</span>
                      <span className="font-extrabold text-slate-800 tabular-nums">{c.porcentaje}%</span>
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(c.porcentaje, 100)}%`, backgroundColor: c.color }} />
                      </div>
                    </div>
                  ))}
                  {columnasFinales.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 text-xs">
                      <div className="w-3 h-3 rounded-md bg-amber-400 shadow-sm" />
                      <span className="flex-1 text-slate-600 font-semibold truncate">{c.label || "Sin nombre"}</span>
                      <span className="font-extrabold text-slate-800 tabular-nums">{c.porcentaje}%</span>
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(c.porcentaje, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 text-xs pt-3 border-t border-slate-100 mt-1">
                    <span className="flex-1 font-extrabold text-slate-800">Total</span>
                    <span className={`font-extrabold text-lg tabular-nums ${pctOk ? "text-emerald-600" : "text-rose-600"}`}>{Math.round(pctSum)}%</span>
                    {!pctOk && <span className="text-rose-500 text-[10px] font-bold">Faltan {Math.round(100 - pctSum)}%</span>}
                  </div>
                </div>
              </div>

              {/* Full preview button */}
              <button onClick={abrirModalPreview}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/20 transition-all"
                data-testid="open-preview-modal">
                <Maximize2 className="w-4 h-4" /> Vista previa completa
              </button>

              {/* Autosave indicator */}
              {estado === "borrador" && effectiveId && (
                <p className="text-[10px] text-slate-400 text-center font-medium">
                  {hasChanges ? "Cambios sin guardar" : lastSaved ? `Autoguardado hace ${Math.round((Date.now() - lastSaved.getTime()) / 1000)}s` : "Sin cambios"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Preview Expandida ── */}
      {modalPreviewAbierto && previewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalPreviewAbierto(false)}>
          <div className="bg-white rounded-xl w-[90vw] max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-sm font-bold text-slate-800">Vista previa — {previewSnapshot.nombre}</h2>
              <button onClick={() => setModalPreviewAbierto(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600" data-testid="close-preview-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto">
                <PreviewTable criterios={previewSnapshot.criterios} columnasFinales={previewSnapshot.columnasFinales} labelPromedio={previewSnapshot.labelPromedioFinal} expanded />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
              <span className={`text-sm font-bold ${previewSnapshot.pctOk ? "text-emerald-600" : "text-rose-600"}`}>
                Suma total: {previewSnapshot.pctSum}% / 100% {previewSnapshot.pctOk ? " — Completo" : ` — Faltan ${100 - previewSnapshot.pctSum}%`}
              </span>
              <button onClick={() => setModalPreviewAbierto(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 hover:bg-slate-100 text-slate-600"
                data-testid="close-preview-modal-footer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ criterios, columnasFinales, labelPromedio, expanded }) {
  const students = ["García López, Ana", "Mendoza Torres, Carlos", "Quispe Huamani, Lucía"];
  if (!criterios.length && !columnasFinales.length) return <p className="text-xs text-slate-400 text-center py-8">Agrega criterios para ver la vista previa</p>;

  const sz = expanded ? "text-xs" : "text-[10px]";
  const minW = expanded ? "min-w-[180px]" : "min-w-[120px]";
  const cellMinW = expanded ? "min-w-[44px]" : "min-w-[28px]";

  return (
    <table className={`w-full ${sz} border-collapse`} style={{ minWidth: expanded ? "max-content" : undefined }}>
      <thead>
        <tr>
          <th rowSpan={2} className={`bg-slate-100 text-slate-600 font-bold px-2 py-1.5 border border-slate-200 text-left ${minW}`}>ALUMNO</th>
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
            <th key={s.id} className={`bg-slate-50 text-slate-500 font-semibold px-1 py-1 border border-slate-200 text-center ${cellMinW}`}>{s.label}</th>
          )))}
        </tr>
      </thead>
      <tbody>
        {students.map((name, i) => (
          <tr key={i}>
            <td className="px-2 py-1 border border-slate-200 text-slate-600 font-medium whitespace-nowrap">{name}</td>
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
