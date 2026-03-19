import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, QrCode, GraduationCap, X } from "lucide-react";

export default function StudentQRCard({ student, schoolName, logoUrl, onClose }) {
  const qrRef = useRef(null);
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!student?.qr_token) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600">Este estudiante no tiene codigo QR generado.</p>
      </div>
    );
  }

  const fullName = `${student.name || ""} ${student.last_name || ""}`.trim();
  const gradeInfo = `${student.level_name ? student.level_name + " - " : ""}${student.grade_name || ""} - ${student.section_name || ""}`;
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

      const W = 400, H = 620;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Gray bar
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(0, 0, W, 8);

      let yPos = 24;

      // Logo
      const logoImg = await loadImage(logoUrl);
      if (logoImg) {
        const lh = 50, lw = (logoImg.width / logoImg.height) * lh;
        ctx.drawImage(logoImg, (W - lw) / 2, yPos, lw, lh);
        yPos += lh + 8;
      } else {
        yPos += 10;
      }

      // School name
      ctx.fillStyle = "#001f4b";
      ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(displaySchoolName, W / 2, yPos);
      yPos += 14;

      // Divider
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, yPos);
      ctx.lineTo(W - 60, yPos);
      ctx.stroke();
      yPos += 14;

      // Photo
      const photoImg = await loadImage(student.photo_url);
      const photoSize = 100;
      const photoCx = W / 2, photoCy = yPos + photoSize / 2;
      if (photoImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(photoImg, photoCx - photoSize / 2, photoCy - photoSize / 2, photoSize, photoSize);
        ctx.restore();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#001f4b";
        ctx.font = "bold 36px sans-serif";
        ctx.fillText((student.name || "E").charAt(0), photoCx, photoCy + 12);
      }
      yPos += photoSize + 16;

      // Name
      ctx.fillStyle = "#001f4b";
      ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(fullName, W / 2, yPos);
      yPos += 20;

      // Grade
      ctx.fillStyle = "#64748b";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(gradeInfo, W / 2, yPos);
      yPos += 20;

      // QR
      const svgData = new XMLSerializer().serializeToString(svg);
      const qrImg = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const qrUrl = URL.createObjectURL(svgBlob);

      qrImg.onload = () => {
        const qrSize = 180;
        ctx.drawImage(qrImg, (W - qrSize) / 2, yPos, qrSize, qrSize);
        yPos += qrSize + 12;

        // Footer
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText("Personal e intransferible", W / 2, yPos);

        const link = document.createElement("a");
        link.download = `Carnet_${student.name}_${student.last_name || ""}.png`;
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
        .grade { font-size: 10px; color: #64748b; padding-bottom: 8px; }
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
        ${student.photo_url
          ? `<img src="${student.photo_url}" alt="" class="photo" />`
          : `<div class="initial">${(student.name || "E").charAt(0)}</div>`}
        <div class="name">${fullName}</div>
        <div class="grade">${gradeInfo}</div>
        <div class="qr">${svgData}</div>
        <div class="footer">Personal e intransferible</div>
      </div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-4" data-testid="student-qr-card">
      {/* Carnet-style card */}
      <div ref={cardRef} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Gray bar */}
        <div className="h-1.5 bg-slate-400" />

        {/* Logo + School name */}
        <div className="pt-5 pb-2 text-center">
          {logoUrl && (
            <img src={logoUrl} alt="" className="h-12 mx-auto mb-2 object-contain" />
          )}
          <p className="text-xs font-bold text-[#001f4b]">{displaySchoolName}</p>
        </div>

        {/* Divider */}
        <div className="mx-8 h-px bg-slate-200" />

        {/* Photo */}
        <div className="flex justify-center pt-4">
          {student.photo_url ? (
            <img src={student.photo_url} alt="" className="w-24 h-24 rounded-full object-cover border-3 border-slate-200" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-3xl font-bold text-[#001f4b]">{(student.name || "E").charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Name + Grade */}
        <div className="text-center pt-3 pb-1">
          <p className="text-base font-bold text-[#001f4b] px-4">{fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
            <GraduationCap className="w-3.5 h-3.5" />
            {gradeInfo}
          </p>
        </div>

        {/* QR */}
        <div ref={qrRef} className="flex justify-center py-3">
          <QRCodeSVG
            value={student.qr_token}
            size={170}
            level="H"
            includeMargin={true}
            bgColor="#FFFFFF"
            fgColor="#1e293b"
          />
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-400 text-center pb-3">Personal e intransferible</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={downloadQR}
          disabled={downloading}
          className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
          data-testid="download-qr-btn"
        >
          <Download className="w-4 h-4" />
          {downloading ? "Descargando..." : "Descargar QR"}
        </button>
        <button
          onClick={printCredential}
          className="flex-1 px-4 py-2.5 bg-[#001f4b] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#002d6b] transition-colors text-sm"
          data-testid="print-credential-btn"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>
    </div>
  );
}
