import { useRef, useState, useEffect } from "react";
import InstitutionalStamp from "./InstitutionalStamp";

// Lienzo de coordenadas fijo (debe coincidir con el backend y la libreta).
const CW = 250;   // ancho
const CH = 230;   // alto
const LINE_Y = 150;       // y de la línea de firma
const LINE_X = 25;        // inicio x de la línea
const LINE_W = 200;       // ancho de la línea
const SCALE = 1.5;        // escala visual del editor

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Editor visual (arrastrar y soltar) de la zona de firmas del DIRECTOR.
 * Permite reubicar la firma y el sello. Guarda al soltar (onChange).
 */
export default function SignatureLayoutEditor({
  layout, onChange, directorName, directorSignature, stampMode, stampImage, stampConfig,
}) {
  const canvasRef = useRef(null);
  const [local, setLocal] = useState(layout);
  const dragRef = useRef(null); // { key, startX, startY, origX, origY }

  useEffect(() => { setLocal(layout); }, [layout]);

  const hasStamp = (stampMode === "image" && stampImage) ||
    (stampMode === "generated" && (stampConfig?.texto_superior || stampConfig?.texto_inferior || stampConfig?.ruc || stampConfig?.direccion));

  const onPointerDown = (key) => (e) => {
    e.preventDefault();
    const item = local[key];
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / SCALE;
    const dy = (e.clientY - d.startY) / SCALE;
    setLocal((prev) => {
      const w = prev[d.key].w;
      return {
        ...prev,
        [d.key]: {
          ...prev[d.key],
          x: clamp(Math.round(d.origX + dx), -40, CW - 20),
          y: clamp(Math.round(d.origY + dy), -40, CH - 20),
        },
      };
    });
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const d = dragRef.current;
    dragRef.current = null;
    if (d && onChange) onChange(local);
  };

  const resize = (key, delta) => {
    const next = { ...local, [key]: { ...local[key], w: clamp(local[key].w + delta, 30, 230) } };
    setLocal(next);
    if (onChange) onChange(next);
  };

  return (
    <div className="space-y-2">
      <div
        ref={canvasRef}
        className="relative mx-auto bg-white border border-slate-300 rounded-lg overflow-hidden"
        style={{ width: CW * SCALE, height: CH * SCALE }}
        data-testid="signature-layout-canvas"
      >
        {/* Inner coordinate space scaled */}
        <div style={{ position: "absolute", top: 0, left: 0, width: CW, height: CH, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          {/* Línea de firma (fija) */}
          <div style={{ position: "absolute", left: LINE_X, top: LINE_Y, width: LINE_W, borderTop: "1px solid #000" }} />
          {/* Nombre (fijo) */}
          <div style={{ position: "absolute", left: LINE_X, top: LINE_Y + 4, width: LINE_W, textAlign: "center", fontSize: 9, fontFamily: "Arial, sans-serif" }}>
            {directorName || "Nombre del director"}
          </div>
          {/* Cargo (fijo) */}
          <div style={{ position: "absolute", left: LINE_X, top: LINE_Y + 18, width: LINE_W, textAlign: "center", fontSize: 10, fontWeight: "bold", fontFamily: "Arial, sans-serif" }}>
            DIRECTOR (A)
          </div>

          {/* Firma (arrastrable) */}
          {directorSignature && (
            <div
              onPointerDown={onPointerDown("signature")}
              style={{ position: "absolute", left: local.signature.x, top: local.signature.y, width: local.signature.w, cursor: "grab", touchAction: "none", outline: "1px dashed #8b5cf6" }}
              data-testid="drag-signature"
            >
              <img src={directorSignature} alt="Firma" style={{ width: "100%", display: "block", pointerEvents: "none" }} />
            </div>
          )}

          {/* Sello (arrastrable) */}
          {hasStamp && (
            <div
              onPointerDown={onPointerDown("stamp")}
              style={{ position: "absolute", left: local.stamp.x, top: local.stamp.y, width: local.stamp.w, cursor: "grab", touchAction: "none", outline: "1px dashed #8b5cf6" }}
              data-testid="drag-stamp"
            >
              {stampMode === "image" ? (
                <img src={stampImage} alt="Sello" style={{ width: "100%", display: "block", pointerEvents: "none" }} />
              ) : (
                <div style={{ pointerEvents: "none" }}><InstitutionalStamp config={stampConfig} size={local.stamp.w} /></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controles de tamaño */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        {directorSignature && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Firma:</span>
            <button type="button" onClick={() => resize("signature", -10)} className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold" data-testid="signature-size-minus">−</button>
            <button type="button" onClick={() => resize("signature", 10)} className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold" data-testid="signature-size-plus">+</button>
          </div>
        )}
        {hasStamp && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Sello:</span>
            <button type="button" onClick={() => resize("stamp", -8)} className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold" data-testid="stamp-size-minus">−</button>
            <button type="button" onClick={() => resize("stamp", 8)} className="w-7 h-7 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold" data-testid="stamp-size-plus">+</button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 text-center">Arrastra la firma y el sello para ubicarlos. Usa − / + para cambiar su tamaño. Se guarda automáticamente.</p>
    </div>
  );
}
