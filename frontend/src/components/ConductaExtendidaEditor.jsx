import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, RotateCcw, ClipboardList, ShieldCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Editor de plantilla de Evaluación Conductual extendida.
 * - Radio: Predeterminado | Extendido
 * - Si Extendido → editor de secciones + criterios (CRUD + reorden)
 * - "Restaurar default" devuelve la plantilla de fábrica
 */
export default function ConductaExtendidaEditor({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("default");
  const [template, setTemplate] = useState({ secciones: [] });
  const [defaultTemplate, setDefaultTemplate] = useState({ secciones: [] });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/conducta-extendida/template`, { headers });
        setMode(r.data.mode || "default");
        setTemplate(r.data.template || { secciones: [] });
        setDefaultTemplate(r.data.default_template || { secciones: [] });
      } catch (e) {
        setError(e?.response?.data?.detail || "Error al cargar la plantilla");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleModeChange = async (newMode) => {
    if (newMode === mode) return;
    setSaving(true);
    setError("");
    try {
      const body = { mode: newMode };
      // When activating extended for the first time and current template is empty, seed with default.
      if (newMode === "extended" && (!template.secciones || template.secciones.length === 0)) {
        body.secciones = defaultTemplate.secciones || [];
      }
      const r = await axios.put(`${API}/conducta-extendida/template`, body, { headers });
      setMode(r.data.mode);
      setTemplate(r.data.template);
      flash(newMode === "extended"
        ? "Modo extendido activado. Configura los criterios abajo."
        : "Modo predeterminado activado. La libreta usará la conducta MINEDU tradicional.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al cambiar el modo");
    } finally {
      setSaving(false);
    }
  };

  const updateSeccion = (sidx, patch) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      sec[sidx] = { ...sec[sidx], ...patch };
      return { ...prev, secciones: sec };
    });
    setDirty(true);
  };

  const moveSeccion = (sidx, dir) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      const tgt = sidx + dir;
      if (tgt < 0 || tgt >= sec.length) return prev;
      [sec[sidx], sec[tgt]] = [sec[tgt], sec[sidx]];
      return { ...prev, secciones: sec.map((s, i) => ({ ...s, orden: i })) };
    });
    setDirty(true);
  };

  const removeSeccion = (sidx) => {
    if (!window.confirm("¿Eliminar esta sección y todos sus criterios?")) return;
    setTemplate(prev => ({
      ...prev,
      secciones: prev.secciones.filter((_, i) => i !== sidx).map((s, i) => ({ ...s, orden: i })),
    }));
    setDirty(true);
  };

  const addSeccion = () => {
    setTemplate(prev => ({
      ...prev,
      secciones: [
        ...prev.secciones,
        { id: `sec_${Date.now()}`, nombre: "NUEVA SECCIÓN", orden: prev.secciones.length, criterios: [] },
      ],
    }));
    setDirty(true);
  };

  const addCriterio = (sidx) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      const crits = sec[sidx].criterios || [];
      sec[sidx] = {
        ...sec[sidx],
        criterios: [...crits, { id: `crit_${Date.now()}`, nombre: "Nuevo criterio", orden: crits.length }],
      };
      return { ...prev, secciones: sec };
    });
    setDirty(true);
  };

  const updateCriterio = (sidx, cidx, patch) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      const crits = [...(sec[sidx].criterios || [])];
      crits[cidx] = { ...crits[cidx], ...patch };
      sec[sidx] = { ...sec[sidx], criterios: crits };
      return { ...prev, secciones: sec };
    });
    setDirty(true);
  };

  const moveCriterio = (sidx, cidx, dir) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      const crits = [...(sec[sidx].criterios || [])];
      const tgt = cidx + dir;
      if (tgt < 0 || tgt >= crits.length) return prev;
      [crits[cidx], crits[tgt]] = [crits[tgt], crits[cidx]];
      sec[sidx] = { ...sec[sidx], criterios: crits.map((c, i) => ({ ...c, orden: i })) };
      return { ...prev, secciones: sec };
    });
    setDirty(true);
  };

  const removeCriterio = (sidx, cidx) => {
    setTemplate(prev => {
      const sec = [...prev.secciones];
      const crits = (sec[sidx].criterios || []).filter((_, i) => i !== cidx).map((c, i) => ({ ...c, orden: i }));
      sec[sidx] = { ...sec[sidx], criterios: crits };
      return { ...prev, secciones: sec };
    });
    setDirty(true);
  };

  const restoreDefault = () => {
    if (!window.confirm("¿Restaurar la plantilla a los 7 criterios por defecto? Se perderán las modificaciones no guardadas.")) return;
    setTemplate({ secciones: JSON.parse(JSON.stringify(defaultTemplate.secciones || [])) });
    setDirty(true);
  };

  const saveTemplate = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await axios.put(`${API}/conducta-extendida/template`, {
        secciones: template.secciones,
      }, { headers });
      setTemplate(r.data.template);
      setDirty(false);
      flash("Plantilla guardada correctamente.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar la plantilla");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-6" data-testid="conducta-ext-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando plantilla...
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="conducta-ext-editor">
      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-600" />
          Formato de Evaluación Conductual
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Elige cómo se evalúa la conducta en la libreta. El modo <b>extendido</b> reemplaza la fila CONDUCTA por una tabla configurable de criterios agrupados en secciones. La conducta tradicional (AD/A/B/C) NO se borra; queda almacenada y vuelve a mostrarse si regresas al modo predeterminado.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm flex items-center gap-2" data-testid="conducta-ext-error">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 text-sm flex items-center gap-2" data-testid="conducta-ext-success">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleModeChange("default")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${mode === "default" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="conducta-mode-default"
        >
          <div className="flex items-start justify-between mb-2">
            <ShieldCheck className={`w-5 h-5 ${mode === "default" ? "text-violet-700" : "text-slate-400"}`} />
            {mode === "default" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-900">Predeterminado</h4>
          <p className="text-xs text-slate-600 mt-1">Fila <b>CONDUCTA</b> con escala MINEDU (AD/A/B/C) + nota opcional a PADRES. Comportamiento original.</p>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("extended")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${mode === "extended" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="conducta-mode-extended"
        >
          <div className="flex items-start justify-between mb-2">
            <ClipboardList className={`w-5 h-5 ${mode === "extended" ? "text-violet-700" : "text-slate-400"}`} />
            {mode === "extended" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-900">Extendido (configurable)</h4>
          <p className="text-xs text-slate-600 mt-1">Tabla amplia con secciones <i>Evaluación Conductual</i> + <i>Participación de PP.FF.</i> + columnas por bimestre y promedio.</p>
        </button>
      </div>

      {mode === "extended" && (
        <div className="space-y-3 pt-2" data-testid="conducta-ext-template-editor">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-bold text-slate-900">Editor de criterios</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restoreDefault}
                disabled={saving}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
                data-testid="conducta-ext-restore-default"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar default
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                disabled={saving || !dirty}
                className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-40"
                data-testid="conducta-ext-save"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Guardar cambios
              </button>
            </div>
          </div>

          {template.secciones.map((sec, sidx) => (
            <div key={sec.id || sidx} className="rounded-xl border border-slate-200 bg-white" data-testid={`conducta-ext-sec-${sidx}`}>
              <div className="flex items-center gap-2 p-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                <GripVertical className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={sec.nombre || ""}
                  onChange={(e) => updateSeccion(sidx, { nombre: e.target.value })}
                  placeholder="NOMBRE DE LA SECCIÓN"
                  className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none border-b border-transparent focus:border-violet-500 uppercase"
                  data-testid={`conducta-ext-sec-name-${sidx}`}
                />
                <button onClick={() => moveSeccion(sidx, -1)} disabled={sidx === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveSeccion(sidx, 1)} disabled={sidx === template.secciones.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Bajar">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => removeSeccion(sidx)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar sección" data-testid={`conducta-ext-sec-remove-${sidx}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {(sec.criterios || []).map((crit, cidx) => (
                  <div key={crit.id || cidx} className="flex items-center gap-2" data-testid={`conducta-ext-crit-${sidx}-${cidx}`}>
                    <span className="text-xs text-slate-400 w-5 text-center">{cidx + 1}.</span>
                    <input
                      type="text"
                      value={crit.nombre || ""}
                      onChange={(e) => updateCriterio(sidx, cidx, { nombre: e.target.value })}
                      placeholder="Nombre del criterio"
                      className="flex-1 text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                      data-testid={`conducta-ext-crit-name-${sidx}-${cidx}`}
                    />
                    <button onClick={() => moveCriterio(sidx, cidx, -1)} disabled={cidx === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveCriterio(sidx, cidx, 1)} disabled={cidx === sec.criterios.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Bajar">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeCriterio(sidx, cidx)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar" data-testid={`conducta-ext-crit-remove-${sidx}-${cidx}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addCriterio(sidx)}
                  className="text-xs font-semibold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1"
                  data-testid={`conducta-ext-add-crit-${sidx}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar criterio
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSeccion}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-600 hover:text-violet-700 inline-flex items-center justify-center gap-2 transition-colors"
            data-testid="conducta-ext-add-sec"
          >
            <Plus className="w-4 h-4" /> Agregar sección
          </button>

          {dirty && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Tienes cambios sin guardar. Haz clic en <b>Guardar cambios</b> para aplicar.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
