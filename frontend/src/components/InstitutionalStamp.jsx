import { useId } from "react";

/**
 * Sello institucional circular generado por texto (SVG).
 * Reutilizable en Ajustes (vista previa en vivo) y en la libreta.
 *
 * Props:
 *  - config: { texto_superior, texto_inferior, ruc, direccion, cargo }
 *  - size: px (default 180)
 *  - color: color del trazo y texto (default gris)
 */
export default function InstitutionalStamp({ config = {}, size = 180, color = "#374151" }) {
  const uid = useId().replace(/:/g, "");
  const {
    texto_superior = "",
    texto_inferior = "",
    ruc = "",
    direccion = "",
    cargo = "DIRECTOR",
  } = config || {};

  const cx = 100, cy = 100;
  const rOuterText = 84;   // anillo externo (nombre colegio)
  const rInnerText = 58;   // anillo interno (ruc / dirección)

  // Arco superior: izquierda → derecha por arriba (texto al derecho).
  const topPath = (r) => `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`;
  // Arco inferior: izquierda → derecha por abajo (texto al derecho).
  const bottomPath = (r) => `M ${cx - r},${cy} A ${r},${r} 0 0,0 ${cx + r},${cy}`;

  const rucText = ruc ? `RUC: ${ruc}` : "";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ display: "block" }}
      data-testid="institutional-stamp"
    >
      <defs>
        <path id={`top-out-${uid}`} d={topPath(rOuterText)} fill="none" />
        <path id={`bot-out-${uid}`} d={bottomPath(rOuterText)} fill="none" />
        <path id={`top-in-${uid}`} d={topPath(rInnerText)} fill="none" />
        <path id={`bot-in-${uid}`} d={bottomPath(rInnerText)} fill="none" />
      </defs>

      {/* Círculos */}
      <circle cx={cx} cy={cy} r={97} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={72} fill="none" stroke={color} strokeWidth={1.4} />

      {/* Texto curvo externo */}
      <text fill={color} fontSize="12" fontWeight="700" letterSpacing="1.2"
        style={{ fontFamily: "Arial, sans-serif", textTransform: "uppercase" }}>
        <textPath href={`#top-out-${uid}`} startOffset="50%" textAnchor="middle">{texto_superior}</textPath>
      </text>
      <text fill={color} fontSize="12" fontWeight="700" letterSpacing="1.2"
        style={{ fontFamily: "Arial, sans-serif", textTransform: "uppercase" }}>
        <textPath href={`#bot-out-${uid}`} startOffset="50%" textAnchor="middle">{texto_inferior}</textPath>
      </text>

      {/* Texto curvo interno */}
      <text fill={color} fontSize="9.5" fontWeight="600" letterSpacing="0.6"
        style={{ fontFamily: "Arial, sans-serif", textTransform: "uppercase" }}>
        <textPath href={`#top-in-${uid}`} startOffset="50%" textAnchor="middle">{rucText}</textPath>
      </text>
      <text fill={color} fontSize="9" fontWeight="600" letterSpacing="0.4"
        style={{ fontFamily: "Arial, sans-serif", textTransform: "uppercase" }}>
        <textPath href={`#bot-in-${uid}`} startOffset="50%" textAnchor="middle">{direccion}</textPath>
      </text>

      {/* Centro: dos líneas + cargo */}
      <line x1={cx - 40} y1={cy - 13} x2={cx + 40} y2={cy - 13} stroke={color} strokeWidth={1.6} />
      <text x={cx} y={cy + 5} fill={color} fontSize="17" fontWeight="800" textAnchor="middle"
        style={{ fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {cargo}
      </text>
      <line x1={cx - 40} y1={cy + 13} x2={cx + 40} y2={cy + 13} stroke={color} strokeWidth={1.6} />
    </svg>
  );
}
