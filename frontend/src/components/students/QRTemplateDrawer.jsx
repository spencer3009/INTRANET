import { useState, useEffect } from "react";
import axios from "axios";
import { X, Download, Loader2, Palette, Check, QrCode, FolderArchive, List } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;

const FORMATS = [
  { id: "pdf_grid", label: "PDF para imprimir", desc: "Carnets en grilla", icon: QrCode },
  { id: "zip", label: "ZIP con imágenes QR", desc: "1 PNG por estudiante", icon: FolderArchive },
  { id: "pdf_lista", label: "PDF tipo lista", desc: "Tabla con nombre y QR", icon: List },
];

function CarnetPreview({ data, incluirCodigo }) {
  if (!data) return null;
  return (
    <div className="flex justify-center" data-testid="carnet-preview">
      <div className="w-[240px] bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
        <div className="h-3 bg-slate-400" />
        <div className="flex flex-col items-center pt-3 pb-1 px-3">
          {data.school_logo ? (
            <img src={data.school_logo} alt="" className="w-10 h-10 object-contain mb-1" />
          ) : (
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-slate-400">LOGO</span>
            </div>
          )}
          <p className="text-[11px] font-bold text-[#001f4b] text-center leading-tight">{data.school_name}</p>
        </div>
        <div className="mx-4 border-t border-slate-200 my-1" />
        <div className="flex justify-center py-2">
          {data.student_photo ? (
            <img src={data.student_photo} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-2 border-slate-200" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
              <span className="text-2xl font-bold text-[#001f4b]">{data.student_initial}</span>
            </div>
          )}
        </div>
        <p className="text-[13px] font-bold text-[#001f4b] text-center px-3 leading-tight">{data.student_name}</p>
        {incluirCodigo && data.codigo_alumno && (
          <p className="text-[9px] text-slate-400 text-center mt-0.5">Cod: {data.codigo_alumno}</p>
        )}
        <p className="text-[10px] text-slate-500 text-center mt-0.5">{data.nivel} - {data.grado} - {data.seccion}</p>
        <div className="flex justify-center py-3">
          {data.qr_token ? (
            <QRCodeSVG value={data.qr_token} size={120} />
          ) : (
            <div className="w-[120px] h-[120px] bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-center">
              <span className="text-xs text-slate-400">QR</span>
            </div>
          )}
        </div>
        <p className="text-[8px] text-slate-400 text-center pb-2">Personal e intransferible</p>
      </div>
    </div>
  );
}

export default function QRTemplateDrawer({ open, onClose, token, filters, studentCount }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState("classic");
  const [formato, setFormato] = useState("pdf_grid");
  const [incluirCodigo, setIncluirCodigo] = useState(false);
  const [ordenar, setOrdenar] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/api/qr-templates/list`, { headers })
      .then(res => {
        setTemplates(res.data.templates || []);
        if (res.data.templates?.length) setSelected(res.data.templates[0].id);
      })
      .catch(() => setTemplates([{ id: "classic", name: "Clásica", description: "Carnet estándar con logo, foto, nombre, grado/sección y QR." }]));
  }, [open]);

  useEffect(() => {
    if (!open || !filters?.nivel_id || !filters?.grado_id || !filters?.seccion_id) {
      setPreviewData(null);
      return;
    }
    setLoadingPreview(true);
    axios.get(`${API}/api/qr-templates/preview`, {
      headers,
      params: { nivel_id: filters.nivel_id, grado_id: filters.grado_id, seccion_id: filters.seccion_id }
    })
      .then(res => setPreviewData(res.data))
      .catch(() => setPreviewData(null))
      .finally(() => setLoadingPreview(false));
  }, [open, filters?.nivel_id, filters?.grado_id, filters?.seccion_id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.post(`${API}/api/qr-templates/download`, {
        formato,
        template: selected,
        nivel_id: filters.nivel_id,
        grado_id: filters.grado_id,
        seccion_id: filters.seccion_id,
        incluir_codigo_alumno: incluirCodigo,
        ordenar_alfabetico: ordenar,
        incluir_foto: true,
      }, { headers, responseType: "blob" });

      const isZip = formato === "zip";
      const mime = isZip ? "application/zip" : "application/pdf";
      const ext = isZip ? "zip" : "pdf";
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr_export.${ext}`;
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

  const downloadLabel = formato === "zip" ? "Descargar ZIP" : formato === "pdf_lista" ? "Descargar PDF (lista)" : "Descargar PDF";
  const showTemplate = formato !== "zip";
  const showCarnetPreview = formato === "pdf_grid";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[190]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[200] flex flex-col" data-testid="qr-template-drawer">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <Palette className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Exportar Carnets QR</h2>
              <p className="text-[11px] text-slate-500">Configura formato y descarga</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="qr-drawer-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 1. Filter summary */}
          {filterSummary && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[11px] text-slate-500">Filtros aplicados</p>
              <p className="text-sm font-medium text-slate-800">{filterSummary}</p>
              {studentCount > 0 && <p className="text-[11px] text-teal-600 mt-0.5">{studentCount} estudiante{studentCount !== 1 ? "s" : ""}</p>}
            </div>
          )}

          {/* 2. Format selector */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Formato de descarga</p>
            <div className="space-y-1.5">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormato(f.id)}
                  data-testid={`format-${f.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                    formato === f.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <f.icon className={`w-4 h-4 flex-shrink-0 ${formato === f.id ? "text-teal-600" : "text-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{f.label}</p>
                    <p className="text-[10px] text-slate-500">{f.desc}</p>
                  </div>
                  {formato === f.id && (
                    <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Options */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Opciones</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="opt-codigo">
                <input
                  type="checkbox"
                  checked={incluirCodigo}
                  onChange={e => setIncluirCodigo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700">Incluir código del alumno</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="opt-ordenar">
                <input
                  type="checkbox"
                  checked={ordenar}
                  onChange={e => setOrdenar(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700">Ordenar alfabéticamente</span>
              </label>
            </div>
          </div>

          {/* 4. Template selector (hidden for ZIP) */}
          {showTemplate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Plantilla</p>
              {formato === "pdf_lista" && (
                <p className="text-[10px] text-slate-400 mb-2">Se aplicarán colores de la plantilla al encabezado</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    data-testid={`template-card-${t.id}`}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      selected === t.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {selected === t.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <p className="font-semibold text-xs text-slate-800">{t.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Preview */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">Vista previa</p>
            {formato === "zip" ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-6 text-center">
                <FolderArchive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">El ZIP contiene solo las imágenes QR</p>
                <p className="text-[10px] text-slate-400">individuales, sin diseño de carnet</p>
              </div>
            ) : formato === "pdf_lista" ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4 px-4">
                <p className="text-[10px] text-slate-400 mb-2">Vista de lista</p>
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 border-b border-slate-200">
                    <span className="text-[9px] font-bold text-slate-600 w-4">#</span>
                    <span className="text-[9px] font-bold text-slate-600 flex-1">Nombre</span>
                    {incluirCodigo && <span className="text-[9px] font-bold text-slate-600 w-12">Código</span>}
                    <span className="text-[9px] font-bold text-slate-600 w-12 text-center">QR</span>
                  </div>
                  {previewData && (
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-[9px] text-slate-500 w-4">1</span>
                      <span className="text-[9px] text-slate-800 flex-1 font-medium">{previewData.student_name}</span>
                      {incluirCodigo && <span className="text-[9px] text-slate-500 w-12">{previewData.codigo_alumno || "-"}</span>}
                      <div className="w-12 flex justify-center">
                        {previewData.qr_token && <QRCodeSVG value={previewData.qr_token} size={28} />}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400">2</span>
                    <span className="text-[9px] text-slate-300 flex-1">...</span>
                  </div>
                </div>
              </div>
            ) : showCarnetPreview ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4">
                {previewData && <p className="text-[10px] text-slate-400 text-center mb-2">{previewData.student_name}</p>}
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  </div>
                ) : previewData ? (
                  <CarnetPreview data={previewData} incluirCodigo={incluirCodigo} />
                ) : (
                  <div className="flex items-center justify-center py-12 text-xs text-slate-400">
                    Aplica filtros para ver la vista previa
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            data-testid="qr-drawer-cancel"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || !filters?.nivel_id || !studentCount}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="qr-drawer-download"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generando..." : downloadLabel}
          </button>
        </div>
      </div>
    </>
  );
}
