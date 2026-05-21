import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, CheckCircle2, AlertCircle, FileText, CloudOff, Cloud } from "lucide-react";
import { Link } from "react-router-dom";

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
  const [driveConnected, setDriveConnected] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/report-cards/settings`, { headers });
        setSource(r.data?.report_card_source || "generated");
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

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">¿Cómo funciona "Cargar PDF"?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Activa el modo "Cargar PDF a Drive" arriba.</li>
          <li>Ve al Consolidado de Notas y haz clic en <strong>Cargar libretas</strong>.</li>
          <li>Filtra por nivel, grado, sección y bimestre, y sube un PDF por alumno (máx. 10 MB).</li>
          <li>Los padres y alumnos verán la libreta disponible en su portal.</li>
        </ol>
      </div>
    </div>
  );
}
