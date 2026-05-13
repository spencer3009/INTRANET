// AreaWizardModal — Wizard de 3 pasos para crear áreas curriculares con scope por grado.
//
// Step 1 — Grados destino (atajos + checkboxes individuales agrupados por nivel)
// Step 2 — Nombre + color + orden del área
// Step 3 — Asignaturas a vincular dentro de los grados elegidos
//
// El wizard crea el área (POST /curricular-areas con `scope_grade_ids`) y
// vincula las asignaturas seleccionadas en el mismo flujo (POST /subjects/link
// con `grade_ids`). El step 3 es OPCIONAL — se puede saltar y vincular después.
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  X, ChevronRight, ChevronLeft, Check, Loader2, Layers, BookMarked,
  Search, Inbox, AlertTriangle, Link2, ChevronDown,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function errMsg(err, fallback) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(d) && d.length > 0) return d[0]?.msg || fallback;
  if (d && typeof d === "object" && d.msg) return d.msg;
  return fallback;
}

const STEPS = [
  { key: "grades", label: "Grados", icon: Layers },
  { key: "meta", label: "Nombre & color", icon: BookMarked },
  { key: "subjects", label: "Asignaturas", icon: Link2 },
];

const COLOR_PRESETS = ["#0F172A", "#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED", "#DB2777", "#0891B2"];

export default function AreaWizardModal({ token, defaultOrder = 1, onClose, onCreated }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [step, setStep] = useState(0);

  // Step 1
  const [shortcuts, setShortcuts] = useState([]);
  const [grades, setGrades] = useState([]);
  const [activeShortcut, setActiveShortcut] = useState(null);
  const [selectedGradeIds, setSelectedGradeIds] = useState(new Set());
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);

  // Step 2
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0F172A");
  const [order, setOrder] = useState(defaultOrder);

  // Step 3
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [availData, setAvailData] = useState({ subjects: [] });
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [pickedKeys, setPickedKeys] = useState(new Set());
  const debRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const reqIdRef = useRef(0);

  // Cargar atajos al montar
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/curricular-areas/grade-shortcuts`, { headers });
        setShortcuts(r.data?.shortcuts || []);
        setGrades(r.data?.grades || []);
        setShortcutsLoaded(true);
      } catch {
        toast.error("No se pudieron cargar los grados.");
        setShortcutsLoaded(true);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const applyShortcut = (sc) => {
    setSelectedGradeIds(new Set(sc.grade_ids));
    setActiveShortcut(sc.key);
    setPickedKeys(new Set());
  };
  const toggleGrade = (gid) => {
    const next = new Set(selectedGradeIds);
    if (next.has(gid)) next.delete(gid);
    else next.add(gid);
    setSelectedGradeIds(next);
    setActiveShortcut(null);
    setPickedKeys(new Set());
  };

  const gradesByLevel = useMemo(() => {
    const out = new Map();
    for (const g of grades) {
      const k = g.level_id;
      if (!out.has(k)) out.set(k, { level_name: g.level_name, level_order: g.level_order, items: [] });
      out.get(k).items.push(g);
    }
    return Array.from(out.values()).sort((a, b) => a.level_order - b.level_order);
  }, [grades]);

  // Cargar asignaturas disponibles cuando llegamos al step 3 o cambian filtros
  const loadAvailable = async () => {
    if (selectedGradeIds.size === 0) {
      setAvailData({ subjects: [] });
      return;
    }
    const myId = ++reqIdRef.current;
    setLoadingAvail(true);
    try {
      // Endpoint /available-subjects necesita area_id pero aquí estamos PRE-creación,
      // así que usamos /subjects (lista plana) y filtramos client-side. Como
      // alternativa pulida: crear área primero al pulsar "Crear área y elegir
      // asignaturas". Pero para mantener flujo lineal, agrupamos client-side.
      const r = await axios.get(`${API}/academic/subjects`, { headers });
      if (myId !== reqIdRef.current) return;
      const all = r.data?.subjects || r.data || [];
      const gradeFilter = selectedGradeIds;
      // Agrupar por nombre normalizado dentro de los grados seleccionados
      const groups = new Map();
      for (const s of all) {
        if (s.status === "deleted") continue;
        if (!gradeFilter.has(s.grade_id)) continue;
        if (unassignedOnly && s.area_id) continue;
        const key = (s.name || "").trim().toLowerCase();
        if (!key) continue;
        if (!groups.has(key)) {
          groups.set(key, {
            group_key: key,
            display_name: s.name,
            instances_count: 0,
            instance_ids: [],
            current_area_names: new Set(),
          });
        }
        const g = groups.get(key);
        g.instances_count++;
        g.instance_ids.push(s.id);
        if (s.area_name) g.current_area_names.add(s.area_name);
      }
      let arr = Array.from(groups.values()).map(g => ({
        ...g,
        current_area_name: g.current_area_names.size === 1
          ? Array.from(g.current_area_names)[0]
          : (g.current_area_names.size > 1 ? null : null),
        is_mixed: g.current_area_names.size > 1,
      }));
      if (search) {
        const q = search.toLowerCase();
        arr = arr.filter(g => g.display_name.toLowerCase().includes(q));
      }
      arr.sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
      setAvailData({ subjects: arr });
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      toast.error(errMsg(err, "No se pudieron cargar las asignaturas."));
    } finally {
      if (myId === reqIdRef.current) setLoadingAvail(false);
    }
  };

  useEffect(() => {
    if (step !== 2) return;
    loadAvailable();
    // eslint-disable-next-line
  }, [step, unassignedOnly]);

  useEffect(() => {
    if (step !== 2) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => loadAvailable(), 300);
    return () => clearTimeout(debRef.current);
    // eslint-disable-next-line
  }, [search]);

  const togglePicked = (g) => {
    const next = new Set(pickedKeys);
    if (next.has(g.group_key)) next.delete(g.group_key);
    else next.add(g.group_key);
    setPickedKeys(next);
  };

  // Navegación
  const canGoNext = () => {
    if (step === 0) return selectedGradeIds.size > 0;
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) {
      if (step === 0) toast.warning("Selecciona al menos un grado.");
      if (step === 1) toast.warning("El nombre del área es obligatorio.");
      return;
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  // Submit final
  const handleFinish = async () => {
    if (!name.trim()) {
      toast.error("El nombre del área es obligatorio.");
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const r = await axios.post(`${API}/curricular-areas`, {
        name: name.trim(),
        order: parseInt(order || 0, 10),
        color: color || "#0F172A",
        scope_grade_ids: Array.from(selectedGradeIds),
      }, { headers });
      const newArea = r.data;
      toast.success(`Área "${newArea.name}" creada.`);

      // Step 3 — vincular asignaturas elegidas (si las hay)
      if (pickedKeys.size > 0) {
        try {
          const linkRes = await axios.post(`${API}/curricular-areas/${newArea.id}/subjects/link`, {
            group_keys: Array.from(pickedKeys),
            grade_ids: Array.from(selectedGradeIds),
          }, { headers });
          const d = linkRes.data || {};
          const totalInst = d.total_instances_affected || 0;
          if (totalInst > 0) {
            toast.success(`${pickedKeys.size} asignatura${pickedKeys.size === 1 ? "" : "s"} vinculada${pickedKeys.size === 1 ? "" : "s"} (${totalInst} instancia${totalInst === 1 ? "" : "s"}).`);
          }
        } catch (err) {
          toast.warning(`Área creada, pero la vinculación falló: ${errMsg(err, "intenta desde el acordeón")}.`);
        }
      }

      onCreated && onCreated(newArea);
      onClose && onClose();
    } catch (err) {
      toast.error(errMsg(err, "No se pudo crear el área."));
    } finally {
      setSaving(false);
    }
  };

  // ────────── Render ──────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !saving && onClose && onClose()}>
      <div
        className="bg-white rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
        data-testid="area-wizard-modal"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Nueva área curricular</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-40" data-testid="wizard-close">
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Stepper visual */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step;
              const isActive = i === step;
              return (
                <React.Fragment key={s.key}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors
                    ${isActive ? "bg-slate-900 text-white" : isDone ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-white text-slate-500 border border-slate-200"}`}
                    data-testid={`wizard-step-indicator-${s.key}`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span>{i + 1}. {s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-emerald-300" : "bg-slate-200"}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ─────────── STEP 1: GRADOS ─────────── */}
          {step === 0 && (
            <div className="space-y-4" data-testid="wizard-step-grades">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">¿A qué grados aplicará esta área curricular?</h4>
                <p className="text-xs text-slate-500">Elige todos los grados para que sea un área global (Matemática, Comunicación, etc.) o un sub-rango (ej. "Reforzamiento 4° Primaria – 5° Secundaria").</p>
              </div>

              {!shortcutsLoaded ? (
                <div className="py-8 text-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando grados…</div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Atajos rápidos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {shortcuts.map(sc => (
                        <button
                          key={sc.key}
                          type="button"
                          onClick={() => applyShortcut(sc)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${activeShortcut === sc.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"}`}
                          data-testid={`wizard-shortcut-${sc.key}`}
                        >
                          {sc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Selección individual ({selectedGradeIds.size} de {grades.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                      {gradesByLevel.map(lvl => (
                        <div key={lvl.level_name}>
                          <p className="font-semibold text-[10px] uppercase tracking-wide text-slate-600 mb-1">{lvl.level_name}</p>
                          <div className="space-y-0.5">
                            {lvl.items.map(g => (
                              <label key={g.id} className="flex items-center gap-1.5 text-sm py-0.5 cursor-pointer hover:bg-white rounded px-1">
                                <input
                                  type="checkbox"
                                  checked={selectedGradeIds.has(g.id)}
                                  onChange={() => toggleGrade(g.id)}
                                  data-testid={`wizard-grade-checkbox-${g.id}`}
                                />
                                <span>{g.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─────────── STEP 2: META ─────────── */}
          {step === 1 && (
            <div className="space-y-4" data-testid="wizard-step-meta">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">Identifica el área</h4>
                <p className="text-xs text-slate-500">Asigna un nombre claro. Si el área aplica solo a algunos grados, puedes incluir el rango en el nombre (ej. "Matemática Avanzada 4°-5° Sec").</p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nombre del área *</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                  placeholder="ej. Matemática Avanzada 4°-5° Secundaria"
                  data-testid="wizard-name-input"
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Orden</span>
                  <input
                    type="number"
                    value={order}
                    onChange={e => setOrder(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    data-testid="wizard-order-input"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Color</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-12 h-9 border border-slate-300 rounded-lg cursor-pointer"
                      data-testid="wizard-color-input"
                    />
                    <div className="flex flex-wrap gap-1">
                      {COLOR_PRESETS.map(c => (
                        <button key={c} type="button"
                          onClick={() => setColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-slate-900" : "border-white"}`}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </label>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-700 mb-1">Scope seleccionado</p>
                <p className="text-xs text-slate-600">
                  {selectedGradeIds.size === grades.length
                    ? "Global (todos los grados)"
                    : `${selectedGradeIds.size} grado${selectedGradeIds.size === 1 ? "" : "s"} elegido${selectedGradeIds.size === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          )}

          {/* ─────────── STEP 3: SUBJECTS ─────────── */}
          {step === 2 && (
            <div className="space-y-3" data-testid="wizard-step-subjects">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">Asignaturas a vincular <span className="text-slate-400 font-normal">(opcional)</span></h4>
                <p className="text-xs text-slate-500">Selecciona qué asignaturas (dentro de los grados elegidos) pertenecerán a esta área. Puedes hacerlo después desde el acordeón del área.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar asignatura..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    data-testid="wizard-subjects-search"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unassignedOnly}
                    onChange={e => setUnassignedOnly(e.target.checked)}
                    data-testid="wizard-unassigned-toggle"
                  />
                  Solo asignaturas sin área
                </label>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                {loadingAvail ? (
                  <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>
                ) : availData.subjects.length === 0 ? (
                  <div className="py-10 text-center">
                    <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">{unassignedOnly ? "No hay asignaturas sin área en los grados seleccionados." : "No hay asignaturas disponibles."}</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left w-9"></th>
                        <th className="px-3 py-2 text-left">Asignatura</th>
                        <th className="px-3 py-2 text-left w-48">Área actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availData.subjects.map(g => {
                        const checked = pickedKeys.has(g.group_key);
                        return (
                          <tr
                            key={g.group_key}
                            onClick={() => togglePicked(g)}
                            className={`border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer ${checked ? "bg-slate-50" : ""}`}
                            data-testid={`wizard-subject-row-${g.group_key}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePicked(g)}
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{g.display_name}</span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {g.instances_count} inst.
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {g.is_mixed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-800 border border-orange-200">
                                  <AlertTriangle className="w-3 h-3" /> Mixto
                                </span>
                              ) : g.current_area_name ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" /> {g.current_area_name}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs">(sin área)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="text-xs text-slate-500 italic">
                {pickedKeys.size === 0
                  ? "No has elegido asignaturas — puedes vincularlas después."
                  : `${pickedKeys.size} asignatura${pickedKeys.size === 1 ? "" : "s"} seleccionada${pickedKeys.size === 1 ? "" : "s"} para vincular.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
            data-testid="wizard-back-btn"
          >
            <ChevronLeft className="w-4 h-4" /> Atrás
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
              data-testid="wizard-cancel-btn"
            >
              Cancelar
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext() || saving}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                data-testid="wizard-next-btn"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                data-testid="wizard-finish-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Crear área {pickedKeys.size > 0 ? `+ vincular ${pickedKeys.size}` : ""}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
