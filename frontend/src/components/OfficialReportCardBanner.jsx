import { useState, useEffect } from "react";
import axios from "axios";
import { Download, FileText, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Banner that surfaces the official PDF report card (uploaded to Drive
 * by the admin) when the school has switched report cards to PDF mode.
 * Used inside ParentGradesPage and LibretaPage.
 *
 * Behavior:
 *   - reportCardSource !== "pdf_upload" → renders nothing (legacy generated mode)
 *   - reportCardSource === "pdf_upload" + items === 0 → informational banner
 *   - reportCardSource === "pdf_upload" + items > 0 → list with "Ver libreta" / Descargar
 */
export default function OfficialReportCardBanner({ studentId, periodId, token, reportCardSource = "pdf_upload" }) {
  const [items, setItems] = useState([]);
  const [downloading, setDownloading] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/report-cards/student/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: periodId ? { period_id: periodId } : {},
        });
        setItems(r.data?.items || []);
      } catch { setItems([]); }
    };
    load();
  }, [studentId, periodId, token]);

  if (!items || items.length === 0) return null;

  const handleView = async (rc) => {
    setViewing(rc.id);
    try {
      const r = await axios.get(`${API}/report-cards/download/${rc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      if (!win) toast.error("El navegador bloqueó la pestaña. Permite popups y vuelve a intentarlo.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo abrir la libreta");
    } finally {
      setViewing(null);
    }
  };

  const handleDownload = async (rc) => {
    setDownloading(rc.id);
    try {
      const r = await axios.get(`${API}/report-cards/download/${rc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = rc.file_name || `libreta_${rc.period_name || "bimestre"}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Libreta descargada");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo descargar la libreta");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mb-4 print:hidden" data-testid="official-report-card-banner">
      <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-violet-100 px-5 py-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-violet-800" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-violet-900">Libreta oficial disponible</h3>
            <p className="text-xs text-violet-800 mt-0.5">
              {items.length === 1
                ? "El colegio publicó la libreta oficial en PDF para este bimestre."
                : `El colegio publicó ${items.length} libretas oficiales en PDF.`}
            </p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {items.map((rc) => (
            <li key={rc.id} className="flex items-center justify-between gap-3 bg-white/70 backdrop-blur rounded-lg px-3 py-2" data-testid={`official-pdf-row-${rc.id}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate" title={rc.file_name}>{rc.period_name || "Bimestre"}</p>
                <p className="text-[11px] text-slate-500 truncate">{rc.file_name}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleView(rc)}
                  disabled={viewing === rc.id}
                  className="px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                  data-testid={`official-pdf-view-btn-${rc.id}`}
                >
                  {viewing === rc.id ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Abriendo</>
                  ) : (
                    <><Eye className="w-3.5 h-3.5" /> Ver libreta</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(rc)}
                  disabled={downloading === rc.id}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-violet-50 border border-violet-300 text-violet-800 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                  data-testid={`official-pdf-download-btn-${rc.id}`}
                  title="Descargar"
                >
                  {downloading === rc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
