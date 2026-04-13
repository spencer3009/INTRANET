import { useState, useEffect } from "react";
import axios from "axios";
import { X, Download, Loader2, Palette, Check } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function QRTemplateDrawer({ open, onClose, token, filters, studentCount }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState("classic");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/api/qr-templates/list`, { headers })
      .then(res => {
        setTemplates(res.data.templates || []);
        if (res.data.templates?.length) setSelected(res.data.templates[0].id);
      })
      .catch(() => setTemplates([{ id: "classic", name: "Clásica", description: "Carnet estándar" }]));
  }, [open]);

  useEffect(() => {
    if (!open || !filters?.nivel_id || !filters?.grado_id || !filters?.seccion_id) {
      setPreviewUrl(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      template: selected,
      nivel_id: filters.nivel_id,
      grado_id: filters.grado_id,
      seccion_id: filters.seccion_id,
    });
    setPreviewUrl(`${API}/api/qr-templates/preview?${params.toString()}&token=${token}`);
    setLoading(false);
  }, [open, selected, filters]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.post(`${API}/api/qr-templates/download`, {
        template: selected,
        nivel_id: filters.nivel_id,
        grado_id: filters.grado_id,
        seccion_id: filters.seccion_id,
        incluir_foto: true,
        ordenar_alfabetico: true,
      }, { headers, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `carnets_qr_${selected}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Error al descargar. Verifica los filtros e intenta de nuevo.");
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  const filterSummary = filters
    ? [filters.nivelName, filters.gradoName, filters.seccionName ? `Sección ${filters.seccionName}` : null].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[190]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[200] flex flex-col animate-in slide-in-from-right" data-testid="qr-template-drawer">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <Palette className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Exportar Carnets QR</h2>
              <p className="text-xs text-slate-500">Selecciona plantilla y descarga</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="qr-drawer-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Filter summary */}
          {filterSummary && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-0.5">Filtros aplicados</p>
              <p className="text-sm font-medium text-slate-800">{filterSummary}</p>
              {studentCount > 0 && <p className="text-xs text-teal-600 mt-1">{studentCount} estudiante{studentCount !== 1 ? "s" : ""}</p>}
            </div>
          )}

          {/* Template selector */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Plantilla</p>
            <div className="grid grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  data-testid={`template-card-${t.id}`}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    selected === t.id
                      ? "border-teal-500 bg-teal-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {selected === t.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <p className="font-semibold text-sm text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Vista previa</p>
            <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden" style={{ height: "360px" }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="Preview"
                  data-testid="qr-preview-iframe"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">
                  Aplica filtros para ver la vista previa
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            data-testid="qr-drawer-cancel"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || !filters?.nivel_id}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="qr-drawer-download"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </>
  );
}
