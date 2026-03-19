import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, QrCode, Briefcase } from "lucide-react";

export default function TeacherQRCard({ teacher, schoolName, logoUrl }) {
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!teacher?.qr_token) {
    return (
      <div className="p-8 text-center" data-testid="teacher-qr-no-token">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600">Este profesor no tiene codigo QR generado.</p>
      </div>
    );
  }

  const fullName = `${teacher.name || ""} ${teacher.last_name || ""}`.trim();
  const displaySchoolName = schoolName?.toLowerCase().startsWith("colegio") ? schoolName : `Colegio ${schoolName || ""}`;

  const loadImage = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  const downloadQR = async () => {
    setDownloading(true);
    try {
      const svg = qrRef.current?.querySelector("svg");
      if (!svg) return;

      const W = 500;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const logoImg = await loadImage(logoUrl);
      const photoImg = await loadImage(teacher.photo_url);

      const barH = 10;
      const logoH = logoImg ? 60 : 0;
      const photoR = 70;
      const qrSize = 220;
      let totalH = 20 + barH + logoH + 12 + 22 + 20 + (photoImg ? photoR * 2 + 24 : 10) + 28 + 22 + qrSize + 20 + 24 + 16;

      canvas.width = W;
      canvas.height = totalH;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, totalH);

      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(0, 0, W, barH);

      let y = barH + 20;

      if (logoImg) {
        const lw = (logoImg.width / logoImg.height) * logoH;
        ctx.drawImage(logoImg, (W - lw) / 2, y, lw, logoH);
        y += logoH + 12;
      }

      ctx.fillStyle = "#001f4b";
      ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(displaySchoolName, W / 2, y + 14);
      y += 28;

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(W - 80, y);
      ctx.stroke();
      y += 20;

      if (photoImg) {
        const cx = W / 2, cy = y + photoR;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const srcSize = Math.min(photoImg.width, photoImg.height);
        const sx = (photoImg.width - srcSize) / 2;
        const sy = (photoImg.height - srcSize) / 2;
        ctx.drawImage(photoImg, sx, sy, srcSize, srcSize, cx - photoR, cy - photoR, photoR * 2, photoR * 2);
        ctx.restore();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx.stroke();
        y += photoR * 2 + 24;
      }

      ctx.fillStyle = "#001f4b";
      ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fullName, W / 2, y);
      y += 28;

      ctx.fillStyle = "#64748b";
      ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Docente", W / 2, y);
      y += 24;

      const svgData = new XMLSerializer().serializeToString(svg);
      const qrImg = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const qrUrl = URL.createObjectURL(svgBlob);

      qrImg.onload = () => {
        ctx.drawImage(qrImg, (W - qrSize) / 2, y, qrSize, qrSize);
        y += qrSize + 16;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Personal e intransferible", W / 2, y);
        const link = document.createElement("a");
        link.download = `Carnet_Prof_${fullName.replace(/\s+/g, "_")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        URL.revokeObjectURL(qrUrl);
        setDownloading(false);
      };
      qrImg.src = qrUrl;
    } catch {
      setDownloading(false);
    }
  };

  const printCredential = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const svg = qrRef.current?.querySelector("svg");
    const svgData = svg ? new XMLSerializer().serializeToString(svg) : "";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Credencial - ${fullName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; }
        .card { width: 300px; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #d1d5db; text-align: center; }
        .bar { height: 6px; background: #94a3b8; }
        .logo { padding: 16px 0 4px; }
        .logo img { height: 40px; margin: 0 auto; }
        .school-name { font-size: 11px; font-weight: 700; color: #001f4b; padding: 4px 0 8px; }
        .divider { height: 1px; background: #e2e8f0; margin: 0 20px; }
        .photo { margin: 14px auto 0; width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #cbd5e1; display: block; }
        .initial { margin: 14px auto 0; width: 90px; height: 90px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #001f4b; font-size: 32px; font-weight: bold; }
        .name { font-size: 13px; font-weight: 700; color: #001f4b; padding: 10px 12px 2px; }
        .role { font-size: 10px; color: #64748b; padding-bottom: 8px; }
        .qr { padding: 4px 0 8px; }
        .qr svg { width: 140px !important; height: 140px !important; margin: 0 auto; display: block; }
        .footer { font-size: 8px; color: #94a3b8; padding: 6px 0 10px; }
        @media print { body { background: white; } .card { border: 1px solid #ccc; } }
      </style></head><body>
      <div class="card">
        <div class="bar"></div>
        ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="" /></div>` : ""}
        <div class="school-name">${displaySchoolName}</div>
        <div class="divider"></div>
        ${teacher.photo_url
          ? `<img src="${teacher.photo_url}" alt="" class="photo" />`
          : `<div class="initial">${(teacher.name || "P").charAt(0)}</div>`}
        <div class="name">${fullName}</div>
        <div class="role">Docente</div>
        <div class="qr">${svgData}</div>
        <div class="footer">Personal e intransferible</div>
      </div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-4" data-testid="teacher-qr-card">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="h-1.5 bg-slate-400" />
        <div className="pt-5 pb-2 text-center">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 mx-auto mb-2 object-contain" />}
          <p className="text-xs font-bold text-[#001f4b]">{displaySchoolName}</p>
        </div>
        <div className="mx-8 h-px bg-slate-200" />
        <div className="flex justify-center pt-4">
          {teacher.photo_url ? (
            <img src={teacher.photo_url} alt="" className="w-24 h-24 rounded-full object-cover border-3 border-slate-200" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-3xl font-bold text-[#001f4b]">{(teacher.name || "P").charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="text-center pt-3 pb-1">
          <p className="text-base font-bold text-[#001f4b] px-4">{fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
            <Briefcase className="w-3.5 h-3.5" /> Docente
          </p>
        </div>
        <div ref={qrRef} className="flex justify-center py-3">
          <QRCodeSVG value={teacher.qr_token} size={170} level="H" includeMargin={true} bgColor="#FFFFFF" fgColor="#1e293b" />
        </div>
        <p className="text-[10px] text-slate-400 text-center pb-3">Personal e intransferible</p>
      </div>
      <div className="flex gap-3">
        <button onClick={downloadQR} disabled={downloading} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-sm" data-testid="download-qr-btn">
          <Download className="w-4 h-4" />
          {downloading ? "Descargando..." : "Descargar QR"}
        </button>
        <button onClick={printCredential} className="flex-1 px-4 py-2.5 bg-[#001f4b] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#002d6b] transition-colors text-sm" data-testid="print-credential-btn">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}
