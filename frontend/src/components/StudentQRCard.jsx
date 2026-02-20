import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, QrCode, User, GraduationCap } from "lucide-react";

export default function StudentQRCard({ student, schoolName, onClose }) {
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!student?.qr_token) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600">Este estudiante no tiene código QR generado.</p>
      </div>
    );
  }

  const downloadQR = async () => {
    setDownloading(true);
    try {
      const svg = qrRef.current?.querySelector("svg");
      if (!svg) return;
      
      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 300, 300);
        
        // Download
        const link = document.createElement("a");
        link.download = `QR_${student.name}_${student.last_name || ""}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        URL.revokeObjectURL(url);
        setDownloading(false);
      };
      
      img.src = url;
    } catch (error) {
      console.error("Error downloading QR:", error);
      setDownloading(false);
    }
  };

  const printCredential = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const svg = qrRef.current?.querySelector("svg");
    const svgData = svg ? new XMLSerializer().serializeToString(svg) : "";
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Credencial - ${student.name} ${student.last_name || ""}</title>
          <style>
            @page { size: 85.6mm 54mm; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f1f5f9;
            }
            .card {
              width: 320px;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              border: 1px solid #e2e8f0;
            }
            .header {
              background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
              color: white;
              padding: 12px 16px;
              text-align: center;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .header p {
              font-size: 10px;
              opacity: 0.9;
            }
            .content {
              display: flex;
              padding: 16px;
              gap: 16px;
            }
            .photo-section {
              text-align: center;
            }
            .photo {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              object-fit: cover;
              border: 3px solid #7c3aed;
            }
            .photo-placeholder {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: linear-gradient(135deg, #7c3aed, #a855f7);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 28px;
              font-weight: bold;
            }
            .info {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .name {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 4px;
            }
            .grade {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 8px;
            }
            .qr-section {
              display: flex;
              justify-content: center;
              padding: 0 16px 16px;
            }
            .qr-section svg {
              width: 100px !important;
              height: 100px !important;
            }
            .footer {
              background: #f8fafc;
              padding: 8px 16px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              font-size: 9px;
              color: #94a3b8;
            }
            @media print {
              body { background: white; }
              .card { box-shadow: none; border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>${schoolName || "EduNet"}</h1>
              <p>Credencial de Estudiante</p>
            </div>
            <div class="content">
              <div class="photo-section">
                ${student.photo_url 
                  ? `<img src="${student.photo_url}" alt="" class="photo" />`
                  : `<div class="photo-placeholder">${(student.name || "E").charAt(0)}</div>`
                }
              </div>
              <div class="info">
                <p class="name">${student.name} ${student.last_name || ""}</p>
                <p class="grade">${student.grade_name || ""} - ${student.section_name || ""}</p>
              </div>
            </div>
            <div class="qr-section">
              ${svgData}
            </div>
            <div class="footer">
              <p>Este código es personal e intransferible</p>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-6" data-testid="student-qr-card">
      {/* QR Code Display */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-center">
          <h3 className="text-lg font-bold text-white">Código QR del Estudiante</h3>
          <p className="text-white/70 text-sm">Escanea para registrar asistencia</p>
        </div>
        
        <div className="p-8 flex flex-col items-center">
          {/* Student Info */}
          <div className="flex items-center gap-4 mb-6">
            {student.photo_url ? (
              <img 
                src={student.photo_url} 
                alt="" 
                className="w-16 h-16 rounded-full object-cover border-2 border-violet-500"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                {(student.name || "E").charAt(0)}
              </div>
            )}
            <div>
              <p className="text-xl font-bold text-slate-800">
                {student.name} {student.last_name || ""}
              </p>
              <p className="text-slate-500 flex items-center gap-1">
                <GraduationCap className="w-4 h-4" />
                {student.grade_name || "Sin grado"} - {student.section_name || "Sin sección"}
              </p>
            </div>
          </div>
          
          {/* QR Code */}
          <div 
            ref={qrRef}
            className="bg-white p-6 rounded-2xl border-4 border-violet-200 shadow-lg"
          >
            <QRCodeSVG 
              value={student.qr_token}
              size={200}
              level="H"
              includeMargin={true}
              bgColor="#FFFFFF"
              fgColor="#1e293b"
            />
          </div>
          
          <p className="text-sm text-slate-400 mt-4 text-center">
            Este código es único y personal.<br/>
            No lo compartas con otras personas.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={downloadQR}
          disabled={downloading}
          className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          data-testid="download-qr-btn"
        >
          <Download className="w-5 h-5" />
          {downloading ? "Descargando..." : "Descargar QR"}
        </button>
        <button
          onClick={printCredential}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-violet-600 hover:to-purple-700 transition-colors"
          data-testid="print-credential-btn"
        >
          <Printer className="w-5 h-5" />
          Imprimir Credencial
        </button>
      </div>
    </div>
  );
}
