import { useState, useEffect } from "react";
import { X, Download, Loader2, QrCode, FileText, FolderArchive, List } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { safeDownloadBlob } from "../lib/downloadHelper";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkQRModal({ open, onClose, token }) {
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [nivelId, setNivelId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [formato, setFormato] = useState("pdf_grid");
  const [incluirCodigo, setIncluirCodigo] = useState(false);
  const [incluirFoto, setIncluirFoto] = useState(true);
  const [ordenar, setOrdenar] = useState(true);
  const [generating, setGenerating] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open || !token) return;
    axios.get(`${API}/academic/levels`, { headers }).then(r => setLevels(r.data || [])).catch(() => {});
    axios.get(`${API}/academic/shifts`, { headers }).then(r => setShifts(r.data || [])).catch(() => {});
  }, [open, token]);

  useEffect(() => {
    if (!nivelId) { setGrades([]); setGradoId(""); return; }
    axios.get(`${API}/academic/grades?nivel_id=${nivelId}`, { headers }).then(r => setGrades(r.data || [])).catch(() => {});
    setGradoId("");
    setSeccionId("");
  }, [nivelId]);

  useEffect(() => {
    if (!gradoId) { setSections([]); setSeccionId(""); return; }
    axios.get(`${API}/academic/sections?grado_id=${gradoId}`, { headers }).then(r => setSections(r.data || [])).catch(() => {});
    setSeccionId("");
  }, [gradoId]);

  const handleDownload = async () => {
    if (!nivelId || !gradoId || !seccionId) {
      toast.error("Selecciona nivel, grado y sección");
      return;
    }
    setGenerating(true);
    const success = await safeDownloadBlob({
      url: `${API}/students/qr/bulk-download`,
      method: "POST",
      data: {
        nivel_id: nivelId,
        grado_id: gradoId,
        seccion_id: seccionId,
        turno_id: turnoId || undefined,
        formato,
        incluir_codigo_alumno: incluirCodigo,
        incluir_foto: incluirFoto,
        ordenar_alfabetico: ordenar,
      },
      headers,
      fallbackFilename: `qr_download.${formato === "zip" ? "zip" : "pdf"}`,
      timeout: 120000,
      errorPrefix: "Error al generar QR",
    });
    if (success) {
      toast.success("Descarga completada");
      onClose();
    }
    setGenerating(false);
  };

  if (!open) return null;

  const formatOptions = [
    { id: "pdf_grid", label: "PDF para imprimir (grid)", icon: QrCode },
    { id: "zip", label: "ZIP con imagenes QR", icon: FolderArchive },
    { id: "pdf_list", label: "PDF tipo lista", icon: List },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" data-testid="bulk-qr-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-white font-bold text-base">Descargar QR en bloque</h3>
              <p className="text-white/70 text-xs">Genera QR para un aula completa</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Photo toggle - top */}
          <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-slate-700">Incluir foto del alumno</p>
              <p className="text-xs text-slate-400">Muestra la foto en cada carnet</p>
            </div>
            <button
              type="button"
              onClick={() => setIncluirFoto(!incluirFoto)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${incluirFoto ? 'bg-violet-500' : 'bg-slate-300'}`}
              data-testid="toggle-include-photo"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${incluirFoto ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel *</label>
              <select value={nivelId} onChange={e => setNivelId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" data-testid="bulk-qr-level">
                <option value="">Seleccionar...</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre || l.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Grado *</label>
                <select value={gradoId} onChange={e => setGradoId(e.target.value)} disabled={!nivelId} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50 focus:ring-2 focus:ring-violet-500/30" data-testid="bulk-qr-grade">
                  <option value="">Seleccionar...</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sección *</label>
                <select value={seccionId} onChange={e => setSeccionId(e.target.value)} disabled={!gradoId} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50 focus:ring-2 focus:ring-violet-500/30" data-testid="bulk-qr-section">
                  <option value="">Seleccionar...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                </select>
              </div>
            </div>
            {shifts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Turno (opcional)</label>
                <select value={turnoId} onChange={e => setTurnoId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/30" data-testid="bulk-qr-shift">
                  <option value="">Todos los turnos</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Formato de descarga</label>
            <div className="space-y-2">
              {formatOptions.map(opt => (
                <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formato === opt.id ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="formato" value={opt.id} checked={formato === opt.id} onChange={() => setFormato(opt.id)} className="accent-violet-500" />
                  <opt.icon className={`w-4 h-4 ${formato === opt.id ? "text-violet-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-medium ${formato === opt.id ? "text-violet-700" : "text-slate-600"}`}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={incluirCodigo} onChange={e => setIncluirCodigo(e.target.checked)} className="accent-violet-500 w-4 h-4" />
              <span className="text-sm text-slate-600">Incluir código del alumno</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={ordenar} onChange={e => setOrdenar(e.target.checked)} className="accent-violet-500 w-4 h-4" />
              <span className="text-sm text-slate-600">Ordenar alfabeticamente</span>
            </label>
          </div>

          {/* Button */}
          <button
            onClick={handleDownload}
            disabled={generating || !nivelId || !gradoId || !seccionId}
            className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
            data-testid="bulk-qr-generate"
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generando QR...</>
            ) : (
              <><Download className="w-5 h-5" /> Generar descarga</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
