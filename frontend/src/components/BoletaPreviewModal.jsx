import { useEffect, useState } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BoletaPreviewModal({ isOpen, ingresoId, numeroBoleta, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !ingresoId) return;

    let currentUrl = null;

    const fetchPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API}/api/contabilidad/boletas/${ingresoId}/pdf`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) throw new Error("No se pudo generar la boleta");
        const rawBlob = await response.blob();
        const pdfBlob = new Blob([rawBlob], { type: "application/pdf" });
        currentUrl = window.URL.createObjectURL(pdfBlob);
        setPdfUrl(currentUrl);
      } catch (err) {
        setError(err.message || "Error al cargar la boleta");
      } finally {
        setLoading(false);
      }
    };

    fetchPdf();

    return () => {
      if (currentUrl) window.URL.revokeObjectURL(currentUrl);
      setPdfUrl(null);
    };
  }, [isOpen, ingresoId]);

  const handleImprimir = () => {
    const iframe = document.getElementById("boleta-preview-iframe");
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  const handleDescargar = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `Boleta_${numeroBoleta}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" data-testid="boleta-preview-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-xl">
          <h2 className="text-base font-semibold text-white tracking-wide" data-testid="boleta-preview-title">
            Boleta {numeroBoleta}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimir}
              disabled={loading || !!error}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/90 hover:bg-white text-slate-700 text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="boleta-print-btn"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={handleDescargar}
              disabled={loading || !!error}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="boleta-download-btn"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition"
              data-testid="boleta-preview-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-gray-100 rounded-b-xl">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <p className="text-sm text-gray-500">Generando boleta...</p>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          {pdfUrl && !loading && !error && (
            <iframe
              id="boleta-preview-iframe"
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`Boleta ${numeroBoleta}`}
              data-testid="boleta-preview-iframe"
            />
          )}
        </div>
      </div>
    </div>
  );
}
