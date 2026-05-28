import { useState, useEffect } from "react";
import axios from "axios";
import {
  Loader2, CheckCircle2, AlertCircle, FileText, CloudOff, Cloud, Hash, Type, Layers, EyeOff,
  Printer, Maximize2, RotateCw, Rows, Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import ConductaExtendidaEditor from "./ConductaExtendidaEditor";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRINT_DEFAULTS = {
  font_scale: "normal",
  orientation: "portrait",
  paper_size: "a4",
  row_density: "comfortable",
  table_style: "thin",
};

const HEADER_DEFAULTS = {
  line1: "INSTITUCIÓN EDUCATIVA PRIVADA",
  school_name_override: "",
  line3: "Informe de Progreso del Estudiante - {year}",
  bimestre_label: "{roman} BIMESTRE",
  show_initials_box: true,
  line1_bold: false,
  school_name_bold: true,
  line3_bold: true,
  nivel_bold: true,
  bimestre_bold: true,
};

/**
 * Settings tab — choose between auto-generated report cards (from the
 * Consolidado) or PDF uploads (one per student/bimester, stored in Drive).
 * Owner / director only (the parent SettingsPage already filters tab access).
 */
export default function LibretasSettingsTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("generated");
  const [gradeFormat, setGradeFormat] = useState("numeric");
  const [hideConducta, setHideConducta] = useState(false);
  const [hideTutorComments, setHideTutorComments] = useState(false);
  const [hideAsistencia, setHideAsistencia] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [printFormat, setPrintFormat] = useState(PRINT_DEFAULTS);
  const [headerTpl, setHeaderTpl] = useState(HEADER_DEFAULTS);
  const [headerDefaults, setHeaderDefaults] = useState(HEADER_DEFAULTS);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/report-cards/settings`, { headers });
        setSource(r.data?.report_card_source || "generated");
        setGradeFormat(r.data?.libreta_grade_format || "numeric");
        setHideConducta(Boolean(r.data?.hide_conducta_in_libreta));
        setHideTutorComments(Boolean(r.data?.hide_tutor_comments_in_libreta));
        setHideAsistencia(Boolean(r.data?.hide_asistencia_in_libreta));
        setPrintFormat({ ...PRINT_DEFAULTS, ...(r.data?.print_format || {}) });
        setHeaderTpl({ ...HEADER_DEFAULTS, ...(r.data?.header_template || {}) });
        if (r.data?.header_template_defaults) {
          setHeaderDefaults({ ...HEADER_DEFAULTS, ...r.data.header_template_defaults });
        }
        setDriveConnected(Boolean(r.data?.google_drive_connected));
      } catch (e) {
        setError(e?.response?.data?.detail || "Error al cargar la configuración");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = async (newSource) => {
    if (newSource === source) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { report_card_source: newSource }, { headers });
      setSource(newSource);
      setSuccess(newSource === "pdf_upload"
        ? "Modo cambiado a Cargar PDF. Ya puedes subir libretas desde el Consolidado."
        : "Modo cambiado a Generar desde Consolidado.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleFormatChange = async (newFormat) => {
    if (newFormat === gradeFormat) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { libreta_grade_format: newFormat }, { headers });
      setGradeFormat(newFormat);
      setSuccess("Formato de notas actualizado.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar el formato");
    } finally {
      setSaving(false);
    }
  };

  // Generic toggle saver — used for hide_conducta / hide_tutor_comments.
  const handleVisibilityToggle = async (field, newValue, setter, label) => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { [field]: newValue }, { headers });
      setter(newValue);
      setSuccess(`${label} ${newValue ? "ocultado" : "visible"} en la libreta.`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la visibilidad");
    } finally {
      setSaving(false);
    }
  };

  // Print-format option saver — debounced via optimistic UI.
  const setPrintField = async (field, value) => {
    if (printFormat[field] === value) return;
    const prev = printFormat;
    const next = { ...printFormat, [field]: value };
    setPrintFormat(next);
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { print_format: { [field]: value } }, { headers });
      setSuccess("Formato de impresión actualizado.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setPrintFormat(prev);
      setError(e?.response?.data?.detail || "Error al actualizar el formato");
    } finally {
      setSaving(false);
    }
  };

  // Save the editable header template (all fields go in a single PUT).
  const saveHeaderTemplate = async (next) => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { header_template: next }, { headers });
      setHeaderTpl({ ...HEADER_DEFAULTS, ...next });
      setSuccess("Plantilla del encabezado actualizada.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la plantilla");
    } finally {
      setSaving(false);
    }
  };

  const restoreHeaderField = async (field) => {
    const next = { ...headerTpl, [field]: headerDefaults[field] };
    await saveHeaderTemplate({ [field]: headerDefaults[field] });
    setHeaderTpl(next);
  };

  const restoreHeaderAll = async () => {
    await saveHeaderTemplate(headerDefaults);
  };

  // Opens a preview tab — picks the first student in the school's directory
  // so the owner can see exactly how the format renders with real data.
  const openPreview = async () => {
    try {
      const r = await axios.get(`${API}/users?role=student&limit=1`, { headers });
      const items = Array.isArray(r.data) ? r.data : (r.data?.users || r.data?.items || []);
      const first = items.find((u) => (u.role || u.user_type) === "student") || items[0];
      if (!first?.id) {
        setError("No hay alumnos para vista previa. Crea uno primero.");
        setTimeout(() => setError(""), 4000);
        return;
      }
      window.open(`/libreta/${first.id}`, "_blank", "noopener,noreferrer");
    } catch {
      setError("No se pudo abrir la vista previa.");
      setTimeout(() => setError(""), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500" data-testid="libretas-settings-loading">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="libretas-settings-tab">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Libretas de Notas</h2>
        <p className="text-sm text-slate-600 mt-1">Decide cómo se entregan las libretas a los padres y alumnos.</p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm flex items-center gap-2" data-testid="libretas-settings-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex items-center gap-2" data-testid="libretas-settings-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

      {/* Drive connection status */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${driveConnected ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`} data-testid="libretas-drive-status">
        <div className="flex items-center gap-3">
          {driveConnected ? (
            <Cloud className="w-5 h-5 text-emerald-700" />
          ) : (
            <CloudOff className="w-5 h-5 text-amber-700" />
          )}
          <div>
            <p className={`text-sm font-semibold ${driveConnected ? "text-emerald-900" : "text-amber-900"}`}>
              Google Drive: {driveConnected ? "Conectado" : "Desconectado"}
            </p>
            <p className={`text-xs ${driveConnected ? "text-emerald-700" : "text-amber-700"}`}>
              {driveConnected
                ? "Las libretas PDF se almacenarán en Drive."
                : "Conecta Drive para poder subir libretas en PDF."}
            </p>
          </div>
        </div>
        {!driveConnected && (
          <Link to="/settings?tab=general" className="text-xs font-semibold text-amber-900 underline whitespace-nowrap">
            Ir a Conexión Drive
          </Link>
        )}
      </div>

      {/* Switch — radio cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleChange("generated")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${source === "generated" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="libretas-source-generated-card"
        >
          <div className="flex items-start justify-between mb-2">
            <FileText className={`w-6 h-6 ${source === "generated" ? "text-violet-700" : "text-slate-400"}`} />
            {source === "generated" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Generar desde Consolidado</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            El sistema arma la libreta automáticamente con las notas del Consolidado. Comportamiento actual.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleChange("pdf_upload")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${source === "pdf_upload" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="libretas-source-pdf-card"
        >
          <div className="flex items-start justify-between mb-2">
            <Cloud className={`w-6 h-6 ${source === "pdf_upload" ? "text-violet-700" : "text-slate-400"}`} />
            {source === "pdf_upload" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Cargar PDF a Drive</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            El admin sube un PDF por alumno y bimestre. Se almacena en Google Drive del colegio y el padre lo descarga desde el portal.
          </p>
        </button>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-slate-500" data-testid="libretas-saving">
          <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
        </div>
      )}

      {/* Formato de notas — aplica SOLO a la libreta generada (no al
          Consolidado ni al Registro Auxiliar). */}
      <section className="pt-2" data-testid="libreta-format-section">
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Formato de notas en la libreta</h3>
            <p className="text-xs text-slate-500">Decide cómo se muestran las notas en la libreta generada. Escala MINEDU: AD (18–20), A (14–17), B (11–13), C (0–10).</p>
          </div>
          {source !== "generated" && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              Aplica solo en modo "Generar desde Consolidado"
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleFormatChange("numeric")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "numeric" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-numeric"
          >
            <div className="flex items-start justify-between mb-2">
              <Hash className={`w-5 h-5 ${gradeFormat === "numeric" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "numeric" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Numérico</h4>
            <p className="text-xs text-slate-600 mt-1">Solo números (18, 16, 11, …).</p>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange("letters")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "letters" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-letters"
          >
            <div className="flex items-start justify-between mb-2">
              <Type className={`w-5 h-5 ${gradeFormat === "letters" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "letters" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Letras</h4>
            <p className="text-xs text-slate-600 mt-1">Solo nivel de logro (AD, A, B, C).</p>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange("mixed")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "mixed" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-mixed"
          >
            <div className="flex items-start justify-between mb-2">
              <Layers className={`w-5 h-5 ${gradeFormat === "mixed" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "mixed" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Mixto</h4>
            <p className="text-xs text-slate-600 mt-1">Número y nivel de logro juntos por bimestre.</p>
          </button>
        </div>
      </section>

      {/* ── Visibilidad de secciones en la libreta ────────────────────── */}
      <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="libreta-visibility-section">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-violet-600" />
            Secciones visibles en la libreta
          </h3>
          <p className="text-xs text-slate-500 mt-1">Si tu colegio no usa alguna de estas secciones, ocúltala. Los datos quedan guardados — al volver a activar el toggle reaparecen.</p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideConducta}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_conducta_in_libreta", e.target.checked, setHideConducta, "Nota de conducta")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-conducta-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar nota de conducta</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la fila <b>CONDUCTA</b> (ni la tabla extendida si la tienes activa). Útil para colegios que no califican conducta en la libreta.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideTutorComments}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_tutor_comments_in_libreta", e.target.checked, setHideTutorComments, "Comentarios del tutor")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-comments-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar comentarios del tutor</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la tabla <b>COMENTARIOS DEL TUTOR (A)</b> al final de la libreta. El tutor seguirá pudiendo escribirlos desde su portal — solo no se imprimen.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideAsistencia}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_asistencia_in_libreta", e.target.checked, setHideAsistencia, "Asistencia")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-asistencia-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar asistencia</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la tabla de <b>ASISTENCIA</b> (Presente / Tardanza / Falta / Justificada) en la libreta. El registro de asistencia diario se sigue tomando — solo no se imprime en la libreta.</p>
          </div>
        </label>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          Plantilla del encabezado — textos editables del header
          (INSTITUCIÓN EDUCATIVA PRIVADA, Informe de Progreso, etc.)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-header-template-section">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Plantilla del encabezado</h3>
              <p className="text-xs text-slate-500">Personaliza los textos del encabezado de la libreta. Puedes usar variables como <code className="bg-slate-100 px-1 rounded">{"{year}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{roman}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{grado}"}</code> y <code className="bg-slate-100 px-1 rounded">{"{seccion}"}</code>.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={restoreHeaderAll}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
            data-testid="header-restore-all"
          >
            Restaurar todo al default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Plantilla por defecto */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="header-template-default">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Plantilla por defecto</div>
            <div className="space-y-2 text-xs text-slate-600">
              <HeaderRow label="Línea superior" value={headerDefaults.line1} muted />
              <HeaderRow label="Nombre del colegio" value="(nombre real del colegio)" muted />
              <HeaderRow label="Subtítulo" value={headerDefaults.line3} muted />
              <HeaderRow label="Etiqueta de bimestre" value={headerDefaults.bimestre_label} muted />
              <HeaderRow label="Cuadro lateral (foto/iniciales)" value={headerDefaults.show_initials_box ? "Visible" : "Oculto"} muted />
              <HeaderRow label="Negritas por defecto" value="Nombre · Subtítulo · Grado · Bimestre" muted />
            </div>
          </div>

          {/* Plantilla en uso */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-3" data-testid="header-template-current">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Plantilla en uso</div>
            <div className="space-y-2">
              <HeaderEditableField
                label="Línea superior"
                field="line1"
                value={headerTpl.line1}
                defaultValue={headerDefaults.line1}
                onSave={(v) => saveHeaderTemplate({ line1: v })}
                onRestore={() => restoreHeaderField("line1")}
                hint="Aparece en la parte más alta del encabezado."
                saving={saving}
                boldField="line1_bold"
                boldValue={!!headerTpl.line1_bold}
                onToggleBold={(b) => saveHeaderTemplate({ line1_bold: b })}
              />
              <HeaderEditableField
                label="Nombre del colegio"
                field="school_name_override"
                value={headerTpl.school_name_override}
                defaultValue={headerDefaults.school_name_override}
                onSave={(v) => saveHeaderTemplate({ school_name_override: v })}
                onRestore={() => restoreHeaderField("school_name_override")}
                hint="Déjalo vacío para usar el nombre legal del colegio. Escribe aquí para sobreescribirlo (ej: 'COLEGIO EL ROBLE — 2026')."
                saving={saving}
                boldField="school_name_bold"
                boldValue={headerTpl.school_name_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ school_name_bold: b })}
              />
              <HeaderEditableField
                label="Subtítulo"
                field="line3"
                value={headerTpl.line3}
                defaultValue={headerDefaults.line3}
                onSave={(v) => saveHeaderTemplate({ line3: v })}
                onRestore={() => restoreHeaderField("line3")}
                hint="Variables: {year} = año actual."
                saving={saving}
                boldField="line3_bold"
                boldValue={headerTpl.line3_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ line3_bold: b })}
              />
              <HeaderEditableField
                label="Etiqueta de bimestre"
                field="bimestre_label"
                value={headerTpl.bimestre_label}
                defaultValue={headerDefaults.bimestre_label}
                onSave={(v) => saveHeaderTemplate({ bimestre_label: v })}
                onRestore={() => restoreHeaderField("bimestre_label")}
                hint="Variables: {roman} = número romano (I, II, III, IV)."
                saving={saving}
                boldField="bimestre_bold"
                boldValue={headerTpl.bimestre_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ bimestre_bold: b })}
              />
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-amber-300 transition-colors">
                <input
                  type="checkbox"
                  checked={headerTpl.nivel_bold !== false}
                  disabled={saving}
                  onChange={(e) => saveHeaderTemplate({ nivel_bold: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                  data-testid="header-nivel-bold-toggle"
                />
                <span className="text-sm text-slate-700">Grado / sección en <b>negrita</b></span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-amber-300 transition-colors">
                <input
                  type="checkbox"
                  checked={headerTpl.show_initials_box !== false}
                  disabled={saving}
                  onChange={(e) => saveHeaderTemplate({ show_initials_box: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                  data-testid="header-show-initials-toggle"
                />
                <span className="text-sm text-slate-700">Mostrar cuadro lateral (foto o iniciales del alumno)</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Vista previa en vivo (estilo Canva) ── */}
        <HeaderLivePreview tpl={headerTpl} />
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          Formato de impresión premium — controles para que la libreta
          se vea bien al imprimir / exportar (resuelve el caso de letras
          muy pequeñas o tablas que se cortan en el papel).
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-print-format-section">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Formato de impresión</h3>
              <p className="text-xs text-slate-500">Ajusta cómo se ve la libreta al imprimirla o exportarla a PDF. Ideal si los padres reportan que las letras son muy pequeñas o que la tabla se corta.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
            data-testid="libreta-print-format-preview"
          >
            <Eye className="w-4 h-4" /> Vista previa
          </button>
        </div>

        {/* Font size */}
        <PrintFormatGroup
          icon={<Type className="w-4 h-4" />}
          label="Tamaño de letra"
          hint="Más grande = más fácil de leer, pero ocupa más espacio."
          field="font_scale"
          value={printFormat.font_scale}
          onChange={setPrintField}
          options={[
            { v: "small",  label: "Pequeña",      sub: "0.85×", example: "ABc" },
            { v: "normal", label: "Normal",       sub: "1.0×",  example: "ABc" },
            { v: "large",  label: "Grande",       sub: "1.15×", example: "ABc" },
            { v: "xlarge", label: "Extra grande", sub: "1.3×",  example: "ABc" },
          ]}
          saving={saving}
        />

        {/* Orientation */}
        <PrintFormatGroup
          icon={<RotateCw className="w-4 h-4" />}
          label="Orientación del papel"
          hint="Mantén Vertical si imprimes en hojas A4 normales. Solo usa Horizontal si tu colegio imprime en hojas apaisadas o tiene muchísimas asignaturas."
          field="orientation"
          value={printFormat.orientation}
          onChange={setPrintField}
          options={[
            { v: "portrait",  label: "Vertical",   sub: "Default" },
            { v: "landscape", label: "Horizontal", sub: "Apaisado" },
          ]}
          saving={saving}
        />

        {/* Paper size */}
        <PrintFormatGroup
          icon={<Maximize2 className="w-4 h-4" />}
          label="Tamaño de papel"
          hint="El tamaño físico de la hoja en que se va a imprimir."
          field="paper_size"
          value={printFormat.paper_size}
          onChange={setPrintField}
          options={[
            { v: "a4",     label: "A4",     sub: "21 × 29.7 cm" },
            { v: "letter", label: "Carta",  sub: "21.6 × 27.9 cm" },
            { v: "legal",  label: "Oficio", sub: "21.6 × 35.6 cm" },
          ]}
          saving={saving}
        />

        {/* Row density */}
        <PrintFormatGroup
          icon={<Rows className="w-4 h-4" />}
          label="Densidad de filas"
          hint="Filas más altas son más fáciles de leer; las compactas ahorran páginas."
          field="row_density"
          value={printFormat.row_density}
          onChange={setPrintField}
          options={[
            { v: "compact",      label: "Compacto",  sub: "Mínimo espacio" },
            { v: "comfortable",  label: "Cómodo",    sub: "Balance" },
            { v: "spacious",     label: "Espacioso", sub: "Filas altas" },
          ]}
          saving={saving}
        />

        {/* Table style */}
        <PrintFormatGroup
          icon={<Layers className="w-4 h-4" />}
          label="Estilo de tabla"
          hint="Cómo se ven las líneas y los fondos de la tabla principal."
          field="table_style"
          value={printFormat.table_style}
          onChange={setPrintField}
          options={[
            { v: "thin",  label: "Líneas finas",    sub: "Clásico" },
            { v: "bold",  label: "Líneas marcadas", sub: "Mejor contraste" },
            { v: "zebra", label: "Cebra",           sub: "Filas alternadas" },
          ]}
          saving={saving}
        />

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
          <b>💡 Tip:</b> el default (Vertical · A4 · Normal · Cómodo) está optimizado para impresión estándar. Si los padres reportan letras muy pequeñas, sube el <b>Tamaño de letra</b> a "Grande". Solo cambia a Horizontal si tu colegio imprime en hojas apaisadas.
        </div>
      </section>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">¿Cómo funciona "Cargar PDF"?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Activa el modo "Cargar PDF a Drive" arriba.</li>
          <li>Ve al Consolidado de Notas y haz clic en <strong>Cargar libretas</strong>.</li>
          <li>Filtra por nivel, grado, sección y bimestre, y sube un PDF por alumno (máx. 10 MB).</li>
          <li>Los padres y alumnos verán la libreta disponible en su portal.</li>
        </ol>
      </div>

      {/* Conducta Extendida — editor de plantilla */}
      <div className="pt-4 border-t border-slate-200">
        <ConductaExtendidaEditor token={token} />
      </div>
    </div>
  );
}

/**
 * Live preview of the libreta header — renders exactly like the real
 * encabezado in LibretaCard.jsx, but with mock data, inside a "paper-style"
 * card (drop shadow, soft borders, rotated subtle background). Updates
 * instantly as the user types in the template fields above. Canva-inspired:
 * the goal is that the owner SEES what the parents will see, not just text
 * fields.
 */
function HeaderLivePreview({ tpl }) {
  const NOW = new Date();
  const mockYear = NOW.getFullYear();
  const interpolate = (str) =>
    String(str || "").replace(/\{(\w+)\}/g, (_, k) => {
      const vars = { year: mockYear, roman: "I", bimestre: "I", grado: "2DO GRADO A PRIMARIA", seccion: "A" };
      return vars[k] != null ? vars[k] : "";
    });

  const line1 = interpolate(tpl.line1 || "INSTITUCIÓN EDUCATIVA PRIVADA");
  const schoolName = (tpl.school_name_override && String(tpl.school_name_override).trim())
    ? String(tpl.school_name_override).trim().toUpperCase()
    : "COLEGIO DE EJEMPLO";
  const line3 = interpolate(tpl.line3 || "Informe de Progreso del Estudiante - {year}");
  const bimestre = interpolate(tpl.bimestre_label || "{roman} BIMESTRE");
  const showInitials = tpl.show_initials_box !== false;
  const fw = (on) => (on ? 700 : 400);

  return (
    <div data-testid="header-live-preview">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Vista previa en vivo
        </div>
        <div className="text-[10px] text-slate-400 italic">Se actualiza mientras editas →</div>
      </div>
      {/* Canva-like paper card */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #fef3c7 100%)",
          padding: "20px",
          boxShadow: "0 20px 50px -20px rgba(124, 58, 237, 0.25), 0 8px 20px -10px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Subtle grid background, very faint */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Mock paper sheet */}
        <div
          className="relative bg-white rounded-md mx-auto"
          style={{
            width: "100%",
            maxWidth: "640px",
            boxShadow: "0 6px 16px -6px rgba(0, 0, 0, 0.18), 0 2px 4px -2px rgba(0,0,0,0.06)",
            padding: "20px 28px",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#000",
          }}
        >
          {/* HEADER — same structure as LibretaCard's real header */}
          <div className="flex items-center gap-3" style={{ minHeight: "90px" }}>
            {/* Logo placeholder */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm"
              style={{ width: "60px", height: "60px", border: "2px solid #1a3a52", color: "#1a3a52" }}
            >
              C
            </div>
            {/* Center text block */}
            <div className="flex-1 text-center">
              <div style={{ fontSize: "10px", letterSpacing: "0.5px", color: "#111", fontWeight: fw(tpl.line1_bold) }}>{line1}</div>
              <div style={{ fontSize: "18px", fontWeight: fw(tpl.school_name_bold !== false), fontFamily: "Times, serif", color: "#0f172a", margin: "2px 0" }}>
                {schoolName}
              </div>
              <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: fw(tpl.line3_bold !== false) }}>{line3}</div>
              <div style={{ fontSize: "10px", fontWeight: fw(tpl.nivel_bold !== false), marginTop: "4px" }}>2DO GRADO A PRIMARIA</div>
              <div style={{ fontSize: "11px", fontWeight: fw(tpl.bimestre_bold !== false), marginTop: "2px" }}>{bimestre}</div>
            </div>
            {/* Initials box (toggle) */}
            {showInitials && (
              <div
                className="flex-shrink-0 flex items-center justify-center text-white font-bold rounded"
                style={{ width: "52px", height: "70px", background: "#94a3b8", fontSize: "16px" }}
                data-testid="preview-initials-box"
              >
                AB
              </div>
            )}
          </div>

          {/* Mock student row to give context (greyed out — out of editing scope) */}
          <div className="mt-3 pt-2 border-t border-slate-200" style={{ opacity: 0.5 }}>
            <div className="grid grid-cols-4 gap-2 text-[9px] uppercase text-slate-500">
              <span>Código</span><span>Apellidos y Nombres</span><span>Salón</span><span className="text-right">N° Ord</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-700 mt-1">
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">STU-000774</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">ALVA BLAS, Barbara</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">2DO GRADO A PRIMARIA</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only display of a single template field (used in the "default" column).
 */
function HeaderRow({ label, value, muted }) {
  return (
    <div>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${muted ? "text-slate-400" : "text-slate-600"}`}>{label}</div>
      <div className={`text-xs ${muted ? "text-slate-500 italic" : "text-slate-800"} bg-white border border-slate-200 rounded px-2 py-1 mt-0.5`}>
        {value || <span className="opacity-50">(vacío)</span>}
      </div>
    </div>
  );
}

/**
 * Editable single-line input for a header field, with restore-to-default button.
 * Saves onBlur (or on Enter) to avoid spamming the API on each keystroke.
 */
function HeaderEditableField({ label, field, value, defaultValue, onSave, onRestore, hint, saving, boldField, boldValue, onToggleBold }) {
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);
  const dirty = local !== (value || "");
  const isDefault = (value || "") === (defaultValue || "");

  const commit = () => {
    if (!dirty) return;
    onSave(local);
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">{label}</div>
        {!isDefault && (
          <button
            type="button"
            onClick={onRestore}
            disabled={saving}
            className="text-[10px] text-slate-500 hover:text-slate-700 underline disabled:opacity-50"
            data-testid={`header-restore-${field}`}
          >
            restaurar default
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={local}
          disabled={saving}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); e.target.blur(); } }}
          className="flex-1 text-sm px-2 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 disabled:opacity-50"
          style={boldValue ? { fontWeight: 700 } : undefined}
          data-testid={`header-input-${field}`}
        />
        {boldField && (
          <button
            type="button"
            onClick={() => onToggleBold(!boldValue)}
            disabled={saving}
            title={boldValue ? "Quitar negrita" : "Poner en negrita"}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border-2 font-bold text-sm transition-all ${
              boldValue
                ? "border-amber-600 bg-amber-100 text-amber-900"
                : "border-slate-300 bg-white text-slate-500 hover:border-amber-400 hover:bg-amber-50"
            } disabled:opacity-50`}
            data-testid={`header-bold-${field}`}
          >
            B
          </button>
        )}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

/**
 * Visual card-style selector for a single print-format field. Each option is
 * a "chip card" that highlights when selected. Big enough to feel premium,
 * with a description and an optional "Recomendado" badge.
 */
function PrintFormatGroup({ icon, label, hint, field, value, onChange, options, saving }) {
  return (
    <div className="space-y-2" data-testid={`print-format-${field}`}>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>
      {hint && <p className="text-xs text-slate-500 -mt-1 ml-6">{hint}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-6">
        {options.map((opt) => {
          const selected = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              disabled={saving}
              onClick={() => onChange(field, opt.v)}
              className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                selected
                  ? "border-violet-600 bg-violet-50 ring-2 ring-violet-100"
                  : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"
              } ${saving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
              data-testid={`print-format-${field}-${opt.v}`}
            >
              {opt.recommended && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                  ★
                </span>
              )}
              <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
              {opt.sub && <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>}
              {opt.example && (
                <div className="text-slate-700 mt-1.5" style={{
                  fontSize: opt.v === "small" ? "0.7em" : opt.v === "large" ? "1.15em" : opt.v === "xlarge" ? "1.4em" : "0.9em",
                  fontWeight: 600,
                }}>{opt.example}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
