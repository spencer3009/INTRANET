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
            { v: "large",  label: "Grande",       sub: "1.15×", example: "ABc", recommended: true },
            { v: "xlarge", label: "Extra grande", sub: "1.3×",  example: "ABc" },
          ]}
          saving={saving}
        />

        {/* Orientation */}
        <PrintFormatGroup
          icon={<RotateCw className="w-4 h-4" />}
          label="Orientación del papel"
          hint="Horizontal ofrece MUCHO más ancho — recomendado si tienes muchas asignaturas o usas formato 'mixto'."
          field="orientation"
          value={printFormat.orientation}
          onChange={setPrintField}
          options={[
            { v: "portrait",  label: "Vertical",   sub: "Tradicional" },
            { v: "landscape", label: "Horizontal", sub: "Más ancho", recommended: true },
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
          <b>💡 Tip:</b> si te reportan que "las letras salen muy pequeñas", prueba primero <b>Orientación: Horizontal</b> + <b>Tamaño: Grande</b>. Es la combinación que más gana.
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
