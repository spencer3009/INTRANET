/**
 * BulkLibretaDownloadPage — Descarga masiva de libretas en ZIP.
 *
 * Flujo:
 *   1. Admin/owner elige Nivel → Grado → Sección → Bimestre.
 *   2. Se carga el listado de alumnos (filtrado por sección + `role=student`).
 *   3. Click en "Generar ZIP" → por cada alumno se hace:
 *        a) GET /api/libreta/{student_id}?period_id=Y
 *        b) Render off-screen del componente LibretaCard
 *        c) html2canvas + jsPDF → PDF blob
 *        d) Se agrega al ZIP con nombre `NN_Apellidos_Nombres.pdf`
 *   4. Cuando termina, se descarga el ZIP.
 *
 * Permisos: sólo `owner` y `admin`.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import JSZip from "jszip";
import { toast } from "sonner";
import { Loader2, Download, Filter, AlertTriangle, CheckCircle2 } from "lucide-react";

import LibretaCard from "@/components/libreta/LibretaCard";
import { libretaElementToPdfBlob, safeFilename } from "@/utils/libretaPdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkLibretaDownloadPage({ user, token }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const allowed = user?.role === "owner" || user?.role === "admin";

  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [students, setStudents] = useState([]);

  const [levelId, setLevelId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [periodId, setPeriodId] = useState("");

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [errors, setErrors] = useState([]); // [{student_name, message}]

  // Hidden render target (off-screen) used to capture each libreta
  const stageRef = useRef(null);

  // ── Initial data: levels, grades, sections, periods ─────────────────
  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoadingFilters(true);
      try {
        const [lv, gr, sec, per] = await Promise.all([
          axios.get(`${API}/academic/levels`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/academic/periods`, { headers }),
        ]);
        setLevels(lv.data || []);
        setGrades(gr.data || []);
        setSections(sec.data || []);
        const pers = Array.isArray(per.data) ? per.data : (per.data?.periods || []);
        setPeriods(pers);
        // Auto-select active period if any
        const active = pers.find(p => p.activo) || pers[0];
        if (active) setPeriodId(active.id);
      } catch (e) {
        toast.error("No se pudieron cargar los filtros. Reintentá en un momento.");
      } finally {
        setLoadingFilters(false);
      }
    })();
  }, [allowed, headers]);

  // ── Cascading filter state ──────────────────────────────────────────
  const filteredGrades = useMemo(
    () => (levelId ? grades.filter(g => g.nivel_id === levelId) : []),
    [grades, levelId]
  );
  const filteredSections = useMemo(
    () => (gradeId ? sections.filter(s => s.grado_id === gradeId) : []),
    [sections, gradeId]
  );

  // Reset cascading selects when parent changes
  useEffect(() => { setGradeId(""); setSectionId(""); setStudents([]); }, [levelId]);
  useEffect(() => { setSectionId(""); setStudents([]); }, [gradeId]);

  // ── Load students of the selected section ──────────────────────────
  useEffect(() => {
    if (!sectionId) { setStudents([]); return; }
    (async () => {
      setLoadingStudents(true);
      try {
        const r = await axios.get(`${API}/users`, { headers });
        const stu = (r.data || []).filter(
          u => u.role === "student"
            && u.seccion_id === sectionId
            && u.student_status !== "deleted"
            && u.student_status !== "pending"
            && !u.is_deleted
        );
        // Sort by apellidos then nombres
        stu.sort((a, b) => {
          const an = `${a.last_name || ""} ${a.name || ""}`.trim().toLowerCase();
          const bn = `${b.last_name || ""} ${b.name || ""}`.trim().toLowerCase();
          return an.localeCompare(bn, "es");
        });
        setStudents(stu);
      } catch (e) {
        toast.error("No se pudieron cargar los alumnos de la sección");
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [sectionId, headers]);

  // ── Generation logic ───────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!students.length || !periodId) {
      toast.error("Seleccioná sección y bimestre con alumnos.");
      return;
    }
    if (!stageRef.current) {
      toast.error("No se pudo preparar el área de render. Recargá la página.");
      return;
    }
    setGenerating(true);
    setErrors([]);
    setProgress({ done: 0, total: students.length, current: "" });

    const zip = new JSZip();
    const ctxName = (() => {
      const lvl = levels.find(l => l.id === levelId)?.nombre || "";
      const grd = grades.find(g => g.id === gradeId)?.nombre || "";
      const sec = sections.find(s => s.id === sectionId)?.nombre || "";
      const per = periods.find(p => p.id === periodId)?.nombre || "";
      return safeFilename(`Libretas_${lvl}_${grd}_${sec}_${per}`);
    })();

    let idx = 0;
    for (const stu of students) {
      idx += 1;
      const fullName = `${stu.last_name || ""} ${stu.name || ""}`.trim();
      setProgress({ done: idx - 1, total: students.length, current: fullName });
      try {
        // Fetch libreta data
        const r = await axios.get(`${API}/libreta/${stu.id}?period_id=${periodId}`, { headers });
        const data = r.data;

        // Render off-screen
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;left:-99999px;top:0;width:794px;background:#fff;";
        document.body.appendChild(host);
        const root = createRoot(host);
        await new Promise((resolve) => {
          root.render(
            <LibretaCard
              data={data}
              token={token}
              canEdit={false}
              userRole={user?.role}
              onReload={() => {}}
            />
          );
          // Give React + images time to paint
          setTimeout(resolve, 350);
        });

        // Capture
        const blob = await libretaElementToPdfBlob(host);
        const numStr = String(idx).padStart(2, "0");
        const fname = `${numStr}_${safeFilename(stu.last_name || "")}_${safeFilename(stu.name || "")}.pdf`;
        zip.file(fname, blob);

        // Cleanup
        root.unmount();
        host.remove();
      } catch (e) {
        setErrors(prev => [...prev, { name: fullName, message: e?.response?.data?.detail || e?.message || "Error inesperado" }]);
      }
      setProgress({ done: idx, total: students.length, current: fullName });
    }

    if (Object.keys(zip.files).length === 0) {
      toast.error("No se pudo generar ninguna libreta. Revisá la lista de errores.");
      setGenerating(false);
      return;
    }
    try {
      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
        // optional zip progress could be wired to UI
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${ctxName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success(`ZIP generado con ${Object.keys(zip.files).length} libreta(s)`);
    } catch (e) {
      toast.error("Falló la generación del ZIP final");
    } finally {
      setGenerating(false);
    }
  }, [students, periodId, levelId, gradeId, sectionId, levels, grades, sections, periods, headers, token, user?.role]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="bulk-libreta-forbidden">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No tenés permisos</h2>
          <p className="text-sm text-slate-500">Esta página está reservada a propietario y administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" data-testid="bulk-libreta-page">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-6 h-6 text-indigo-600" />
            Descarga masiva de libretas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generá un ZIP con las libretas individuales en PDF por sección y bimestre.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
          </div>
          {loadingFilters ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="bulk-libreta-filters">
              <Select label="Nivel" value={levelId} onChange={setLevelId} options={levels} testid="bulk-filter-level" />
              <Select label="Grado" value={gradeId} onChange={setGradeId} options={filteredGrades} disabled={!levelId} testid="bulk-filter-grade" />
              <Select label="Sección" value={sectionId} onChange={setSectionId} options={filteredSections} disabled={!gradeId} testid="bulk-filter-section" />
              <Select label="Bimestre" value={periodId} onChange={setPeriodId} options={periods} testid="bulk-filter-period" />
            </div>
          )}
        </div>

        {/* Vista previa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Alumnos seleccionados</h2>
          {!sectionId ? (
            <p className="text-sm text-slate-400">Elegí una sección para ver el listado.</p>
          ) : loadingStudents ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando alumnos…
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400">La sección no tiene alumnos activos.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-3" data-testid="bulk-libreta-count">
                <strong>{students.length}</strong> alumno(s) serán incluidos en el ZIP.
              </p>
              <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100 text-xs">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-slate-700">
                      <span className="inline-block w-6 text-slate-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {s.last_name} {s.name}
                    </span>
                    <span className="text-slate-400 text-[10px]">{s.student_code || s.id?.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Acción */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
          {generating ? (
            <div data-testid="bulk-libreta-progress">
              <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Generando <strong>{progress.done}</strong> / {progress.total} —{" "}
                <span className="text-slate-500 truncate">{progress.current}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!sectionId || !periodId || students.length === 0}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              data-testid="bulk-libreta-generate-btn"
            >
              <Download className="w-4 h-4" />
              Generar ZIP {students.length ? `(${students.length} libretas)` : ""}
            </button>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            Cada libreta se renderiza igual a la versión en pantalla. Para 30 alumnos toma aprox. 1-2 minutos.
            No cierres esta pestaña durante el proceso.
          </p>
        </div>

        {/* Errores */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-5" data-testid="bulk-libreta-errors">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-red-800">Algunas libretas no se generaron ({errors.length})</h3>
            </div>
            <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto">
              {errors.map((er, i) => <li key={i}><strong>{er.name}:</strong> {er.message}</li>)}
            </ul>
          </div>
        )}

        {/* Hidden render stage — required by html2canvas */}
        <div ref={stageRef} aria-hidden="true" />

        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-3">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Los archivos PDF se generan en tu navegador. No se sube ningún dato extra al servidor.
        </p>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, disabled, testid }) {
  return (
    <label className="flex flex-col text-xs text-slate-600">
      <span className="mb-1 font-medium uppercase tracking-wide text-[10px] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid={testid}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">— Seleccionar —</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </label>
  );
}
