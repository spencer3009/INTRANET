/**
 * BulkLibretaZipButton — botón embebible que genera un ZIP con las libretas
 * individuales de una sección + bimestre dados. Reutilizable en:
 *   • ConsolidatedGradesPage (owner / admin)
 *   • MisTutoriasPage → LibretasTab (tutor)
 *
 * Props:
 *   sectionId, periodId  → contexto pre-seleccionado (obligatorios)
 *   headers, token       → autenticación
 *   user                 → role/subdomain (para naming)
 *   labels               → { level, grade, section, period } opcional para naming del ZIP
 *   size                 → "sm" | "md" (default md)
 *   className            → extra clases
 *
 * El botón:
 *   1. Carga los alumnos de la sección.
 *   2. Por cada alumno, GETs /api/libreta/<id>?period_id=Y, renderiza off-screen
 *      el componente LibretaCard, captura con html2canvas → jsPDF → blob.
 *   3. Empaqueta todo con JSZip y dispara la descarga.
 */
import { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import JSZip from "jszip";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

import LibretaCard from "@/components/libreta/LibretaCard";
import { safeFilename } from "@/utils/libretaPdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkLibretaZipButton({
  sectionId,
  periodId,
  headers,
  token,
  user,
  labels = {},
  size = "md",
  className = "",
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, name: "" });

  const handleClick = useCallback(async () => {
    if (!sectionId || !periodId) {
      toast.error("Falta seleccionar sección o bimestre.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 0, name: "" });
    let errors = [];
    try {
      // 1. List students of the section
      const usersRes = await axios.get(`${API}/users`, { headers });
      const studs = (usersRes.data || [])
        .filter(u => u.role === "student" && u.seccion_id === sectionId
          && u.student_status !== "deleted" && u.student_status !== "pending" && !u.is_deleted)
        .sort((a, b) => {
          const an = `${a.last_name || ""} ${a.name || ""}`.trim().toLowerCase();
          const bn = `${b.last_name || ""} ${b.name || ""}`.trim().toLowerCase();
          return an.localeCompare(bn, "es");
        });
      if (!studs.length) {
        toast.error("La sección no tiene alumnos activos.");
        setBusy(false);
        return;
      }
      setProgress({ done: 0, total: studs.length, name: "" });

      const zip = new JSZip();
      let idx = 0;
      for (const stu of studs) {
        idx += 1;
        const fullName = `${stu.last_name || ""} ${stu.name || ""}`.trim();
        setProgress({ done: idx - 1, total: studs.length, name: fullName });
        try {
          const r = await axios.get(`${API}/libreta/${stu.id}?period_id=${periodId}`, { headers });
          const data = r.data;
          const host = document.createElement("div");
          host.style.cssText = "position:absolute;left:-99999px;top:0;width:794px;background:#fff;";
          document.body.appendChild(host);
          const root = createRoot(host);
          await new Promise((resolve) => {
            root.render(
              <LibretaCard data={data} token={token} canEdit={false} userRole={user?.role} onReload={() => {}} />
            );
            setTimeout(resolve, 350);
          });
          // Reusa el MISMO HTML renderizado + el mismo CSS @media print: lo
          // mandamos al backend, que lo imprime a PDF con Chromium (idéntico al
          // botón "Imprimir" individual). Reemplaza a html2canvas (que deformaba).
          const cardEl = host.querySelector(".libreta-card");
          const cardHtml = cardEl ? cardEl.outerHTML : host.innerHTML;
          const pf = data?.metadata?.print_format || {};
          root.unmount();
          host.remove();

          const pdfRes = await axios.post(
            `${API}/report-cards/render-pdf`,
            {
              html: cardHtml,
              paper_size: pf.paper_size || "a4",
              orientation: pf.orientation || "portrait",
              fit_one_page: !!pf.fit_one_page,
            },
            { headers, responseType: "blob", timeout: 60000 }
          );
          const blob = pdfRes.data;
          const numStr = String(idx).padStart(2, "0");
          const fname = `${numStr}_${safeFilename(stu.last_name || "")}_${safeFilename(stu.name || "")}.pdf`;
          zip.file(fname, blob);
        } catch (e) {
          errors.push(`${fullName}: ${e?.response?.data?.detail || e?.message || "error"}`);
        }
        setProgress({ done: idx, total: studs.length, name: fullName });
      }

      if (Object.keys(zip.files).length === 0) {
        toast.error("No se pudo generar ninguna libreta.");
        return;
      }

      const ctxName = safeFilename(
        `Libretas_${labels.level || ""}_${labels.grade || ""}_${labels.section || ""}_${labels.period || ""}`
      ) || "Libretas";
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${ctxName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      if (errors.length) {
        toast.warning(`ZIP descargado con ${Object.keys(zip.files).length} libreta(s). ${errors.length} fallaron.`);
      } else {
        toast.success(`ZIP descargado con ${Object.keys(zip.files).length} libreta(s)`);
      }
    } catch (e) {
      toast.error("Falló la generación del ZIP. Reintentá.");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0, name: "" });
    }
  }, [sectionId, periodId, headers, token, user, labels]);

  const sizeCls = size === "sm"
    ? "px-3 py-1.5 text-xs"
    : "px-4 py-2 text-sm";

  return (
    <div className={`inline-flex flex-col items-stretch gap-1 ${className}`}>
      <button
        onClick={handleClick}
        disabled={busy || !sectionId || !periodId}
        className={`rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium flex items-center gap-1.5 transition-colors ${sizeCls}`}
        data-testid="bulk-libreta-zip-btn"
        title="Descargar todas las libretas de la sección en un ZIP"
      >
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Download className="w-4 h-4" />}
        {busy
          ? `Generando ${progress.done}/${progress.total}…`
          : "Descargar libretas (ZIP)"}
      </button>
      {busy && progress.total > 0 && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
        </div>
      )}
      {busy && progress.name && (
        <p className="text-[10px] text-slate-500 truncate">{progress.name}</p>
      )}
    </div>
  );
}
