/**
 * libretaPdf.js — utility para convertir un elemento de libreta ya renderizado
 * en un PDF (jsPDF) o en un Blob/Uint8Array para empaquetar en ZIP.
 *
 * Reusa exactamente el mismo render de LibretaCard que ve el padre/tutor en
 * pantalla, capturando el contenedor con html2canvas a alta resolución y
 * compaginándolo en hojas A4.
 *
 * Uso:
 *   import { libretaElementToPdfBytes, libretaElementToPdfBlob, downloadPdf } from "@/utils/libretaPdf";
 *   const blob = await libretaElementToPdfBlob(htmlEl);
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 8;

/**
 * Captura el elemento como canvas a 2× para mantener nitidez.
 * Es responsabilidad del llamador asegurar que el elemento esté en el DOM y
 * sea visible (puede ser off-screen vía position:absolute / left:-9999px).
 */
async function captureElement(el) {
  if (!el) throw new Error("Elemento de libreta no provisto");
  // Wait for fonts / images
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) { /* ignore */ }
  }
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
  return canvas;
}

/**
 * Convierte el elemento en un PDF (jsPDF) compaginando en A4 vertical.
 * Si la libreta supera 1 página, se divide automáticamente.
 */
async function buildPdf(el) {
  const canvas = await captureElement(el);
  const imgWidthMm = A4_W_MM - MARGIN_MM * 2;
  const pxPerMm = canvas.width / imgWidthMm;
  const pageHeightPx = (A4_H_MM - MARGIN_MM * 2) * pxPerMm;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Slice the canvas into A4-height chunks
  let rendered = 0;
  while (rendered < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - rendered);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    const sliceMm = sliceHeight / pxPerMm;
    if (rendered > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", MARGIN_MM, MARGIN_MM, imgWidthMm, sliceMm);
    rendered += sliceHeight;
  }
  return pdf;
}

export async function libretaElementToPdfBlob(el) {
  const pdf = await buildPdf(el);
  return pdf.output("blob");
}

export async function libretaElementToPdfBytes(el) {
  const pdf = await buildPdf(el);
  return pdf.output("arraybuffer");
}

export async function downloadLibretaPdf(el, filename) {
  const pdf = await buildPdf(el);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Slugify a nombre de archivo seguro (sin acentos ni caracteres raros).
 */
export function safeFilename(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")        // strip accents
    .replace(/[^a-zA-Z0-9._-]+/g, "_")        // safe chars only
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
