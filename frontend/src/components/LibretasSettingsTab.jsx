import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, CheckCircle2, AlertCircle, FileText, CloudOff, Cloud, Hash, Type, Layers, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import ConductaExtendidaEditor from "./ConductaExtendidaEditor";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const [driveConnected, setDriveConnected] = useState(false);
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
