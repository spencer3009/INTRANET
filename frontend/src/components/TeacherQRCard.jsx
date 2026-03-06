import { useRef } from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function TeacherQRCard({ teacher, schoolName = "EduNet" }) {
  const qrRef = useRef(null);

  const fullName = `${teacher?.name || ""} ${teacher?.last_name || ""}`.trim();
  const initials = `${(teacher?.name || "")[0] || ""}${(teacher?.last_name || "")[0] || ""}`.toUpperCase();

  const handleDownload = () => {
    if (!teacher?.qr_token || !qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const s = 800;
    canvas.width = s;
    canvas.height = s + 260;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(0, 0, s, 80);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText(schoolName, s / 2, 52);

    // "PROFESOR" label
    ctx.fillStyle = "#7c3aed";
    ctx.font = "bold 18px Arial";
    ctx.fillText("PROFESOR", s / 2, 115);

    // Name
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 26px Arial";
    ctx.fillText(fullName, s / 2, 155);

    // QR code from SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (s - 500) / 2, 180, 500, 500);

      // Footer
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px Arial";
      ctx.fillText("Escanear para registro de asistencia", s / 2, s + 210);

      const link = document.createElement("a");
      link.download = `QR_Profesor_${fullName.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgDataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR ${fullName}</title>
      <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; font-family: Arial; }
        .card { text-align: center; border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 350px; }
        .header { background: #7c3aed; color: white; margin: -32px -32px 24px; padding: 16px; border-radius: 14px 14px 0 0; }
        .label { color: #7c3aed; font-weight: bold; font-size: 14px; letter-spacing: 2px; margin-bottom: 8px; }
        .name { font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 16px; }
        .qr img { width: 200px; height: 200px; }
        .footer { color: #94a3b8; font-size: 12px; margin-top: 16px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head>
      <body><div class="card">
        <div class="header"><strong>${schoolName}</strong></div>
        <div class="label">PROFESOR</div>
        <div class="name">${fullName}</div>
        <div class="qr"><img src="${svgDataUrl}" /></div>
        <div class="footer">Escanear para registro de asistencia</div>
      </div></body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  if (!teacher?.qr_token) {
    return (
      <div className="text-center py-8 text-slate-400" data-testid="teacher-qr-no-token">
        <QrCode className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Este profesor no tiene código QR</p>
        <p className="text-xs mt-1">Contacte al administrador para generar uno</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" data-testid="teacher-qr-card">
      {/* Card */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden w-full max-w-xs shadow-sm">
        {/* Header */}
        <div className="bg-violet-600 text-white text-center py-3 px-4">
          <p className="font-bold text-sm tracking-wide">{schoolName}</p>
        </div>

        <div className="px-6 py-5 flex flex-col items-center">
          {/* Avatar */}
          <div className="mb-3">
            {teacher.photo_url ? (
              <img src={teacher.photo_url} alt={fullName} className="w-16 h-16 rounded-full object-cover border-2 border-violet-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center border-2 border-violet-200">
                <span className="text-violet-600 font-bold text-lg">{initials}</span>
              </div>
            )}
          </div>

          {/* Label */}
          <span className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mb-1">Profesor</span>
          
          {/* Name */}
          <p className="font-bold text-slate-800 text-base text-center leading-tight">{fullName}</p>

          {/* QR */}
          <div className="mt-4 p-3 bg-slate-50 rounded-xl" ref={qrRef}>
            <QRCodeSVG value={teacher.qr_token} size={180} level="M" />
          </div>

          <p className="text-[10px] text-slate-400 mt-2">Escanear para registro de asistencia</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
          data-testid="teacher-qr-download"
        >
          <Download className="w-4 h-4" /> Descargar
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
          data-testid="teacher-qr-print"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}
