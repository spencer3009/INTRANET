import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { X, Download, Loader2, Palette, Check, QrCode, FolderArchive, List, Upload, Image } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;

const FORMATS = [
  { id: "pdf_grid", label: "PDF para imprimir", desc: "Carnets en grilla", icon: QrCode },
  { id: "zip", label: "ZIP con imágenes QR", desc: "1 PNG por estudiante", icon: FolderArchive },
  { id: "pdf_lista", label: "PDF tipo lista", desc: "Tabla con nombre y QR", icon: List },
];

const PALETAS = [
  { nombre: "Azul Marino + Dorado", principal: "#1e3a5f", acento: "#f5b800" },
  { nombre: "Verde Bosque + Crema", principal: "#1f4d3a", acento: "#f0e6d2" },
  { nombre: "Rojo Vino + Dorado", principal: "#7a1f2b", acento: "#d4a017" },
  { nombre: "Púrpura + Lavanda", principal: "#3d2a5c", acento: "#c9b6e4" },
  { nombre: "Negro + Naranja", principal: "#1a1a1a", acento: "#ff7a00" },
  { nombre: "Turquesa + Coral", principal: "#0d5e6e", acento: "#ff9678" },
];

function CarnetClassicPreview({ data, incluirCodigo }) {
  if (!data) return null;
  return (
    <div className="flex justify-center" data-testid="carnet-preview-classic">
      <div className="w-[240px] bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
        <div className="h-3 bg-slate-400" />
        <div className="flex flex-col items-center pt-3 pb-1 px-3">
          {data.school_logo ? (
            <img src={data.school_logo} alt="" className="w-10 h-10 object-contain mb-1" />
          ) : (
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-slate-400">LOGO</span>
            </div>
          )}
          <p className="text-[11px] font-bold text-[#001f4b] text-center leading-tight">{data.school_name}</p>
        </div>
        <div className="mx-4 border-t border-slate-200 my-1" />
        <div className="flex justify-center py-2">
          {data.student_photo ? (
            <img src={data.student_photo} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-2 border-slate-200" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
              <span className="text-2xl font-bold text-[#001f4b]">{data.student_initial}</span>
            </div>
          )}
        </div>
        <p className="text-[13px] font-bold text-[#001f4b] text-center px-3 leading-tight">{data.student_name}</p>
        {incluirCodigo && data.codigo_alumno && <p className="text-[9px] text-slate-400 text-center mt-0.5">Cod: {data.codigo_alumno}</p>}
        <p className="text-[10px] text-slate-500 text-center mt-0.5">{data.nivel} - {data.grado} - {data.seccion}</p>
        <div className="flex justify-center py-3">
          {data.qr_token ? <QRCodeSVG value={data.qr_token} size={120} /> : <div className="w-[120px] h-[120px] bg-slate-50 border border-dashed border-slate-300 rounded" />}
        </div>
        <p className="text-[8px] text-slate-400 text-center pb-2">Personal e intransferible</p>
      </div>
    </div>
  );
}

function CarnetModernaPreview({ data, incluirCodigo, logoCarnet, colorPrincipal, colorAcento, watermarkUrl }) {
  if (!data) return null;
  const logoSrc = logoCarnet || data.school_logo;
  const cp = colorPrincipal || "#1e3a5f";
  const ca = colorAcento || "#F5B800";
  return (
    <div className="flex justify-center" data-testid="carnet-preview-moderna">
      <div className="w-[240px] bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden relative">
        <div style={{ backgroundColor: cp }} className="pt-3 pb-12 px-4 text-center">
          {logoSrc ? (
            <img src={logoSrc} alt="" className="w-10 h-10 object-contain mx-auto mb-1.5" />
          ) : (
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1.5">
              <span className="text-[9px] font-bold text-white/60">LOGO</span>
            </div>
          )}
          <p className="text-[10px] font-bold text-white leading-tight">{data.school_name}</p>
        </div>
        <div style={{ backgroundColor: ca, height: "14px" }} />
        <div className="flex justify-center -mt-[44px] relative z-20">
          {data.student_photo ? (
            <img src={data.student_photo} alt="" className="w-[80px] h-[80px] rounded-full object-cover bg-white" style={{ border: `3px solid ${ca}` }} />
          ) : (
            <div className="w-[80px] h-[80px] rounded-full bg-slate-100 flex items-center justify-center" style={{ border: `3px solid ${ca}` }}>
              <span className="text-3xl font-bold" style={{ color: cp }}>{data.student_initial}</span>
            </div>
          )}
        </div>
        <p className="text-[13px] font-bold text-[#1a1a2e] text-center px-3 mt-2 leading-tight">{data.student_name}</p>
        {incluirCodigo && data.codigo_alumno && <p className="text-[9px] text-slate-400 text-center mt-0.5">Cod: {data.codigo_alumno}</p>}
        <div className="flex justify-center mt-1.5">
          <span className="text-[9px] font-bold px-3 py-0.5 rounded-full" style={{ backgroundColor: ca, color: cp }}>{data.nivel} - {data.grado} - {data.seccion}</span>
        </div>
        {/* Watermark overlay */}
        {watermarkUrl && (
          <div className="absolute left-0 right-0 bottom-0 pointer-events-none overflow-hidden" style={{ top: "36%", zIndex: 1 }}>
            <img src={watermarkUrl} alt="" className="w-full h-full object-cover" style={{ opacity: 0.22 }} />
          </div>
        )}
        <div className="flex justify-center py-2.5 relative" style={{ zIndex: 2 }}>
          <div className="bg-white p-0.5">
            {data.qr_token ? <QRCodeSVG value={data.qr_token} size={100} /> : <div className="w-[100px] h-[100px] bg-slate-50 border border-dashed border-slate-300 rounded" />}
          </div>
        </div>
        <p className="text-[7px] text-slate-400 text-center pb-2">Personal e intransferible</p>
      </div>
    </div>
  );
}

export default function QRTemplateDrawer({ open, onClose, token }) {
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selLevel, setSelLevel] = useState("");
  const [selGrade, setSelGrade] = useState("");
  const [selSection, setSelSection] = useState("");
  const [selShift, setSelShift] = useState("");
  const [studentCount, setStudentCount] = useState(0);

  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState("classic");
  const [formato, setFormato] = useState("pdf_grid");
  const [incluirCodigo, setIncluirCodigo] = useState(false);
  const [ordenar, setOrdenar] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [logoCarnet, setLogoCarnet] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [colorPrincipal, setColorPrincipal] = useState("#1e3a5f");
  const [colorAcento, setColorAcento] = useState("#F5B800");
  const [savedColors, setSavedColors] = useState({});
  const [showCustomColors, setShowCustomColors] = useState(false);
  const [savingColors, setSavingColors] = useState(false);
  const [watermarkUrl, setWatermarkUrl] = useState(null);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!open) return;
    Promise.all([
      axios.get(`${API}/api/academic/levels`, { headers }),
      axios.get(`${API}/api/academic/grades`, { headers }),
      axios.get(`${API}/api/academic/sections`, { headers }),
      axios.get(`${API}/api/academic/shifts`, { headers }).catch(() => ({ data: [] })),
      axios.get(`${API}/api/qr-templates/list`, { headers }),
      axios.get(`${API}/api/qr-templates/logo-carnet`, { headers }).catch(() => ({ data: {} })),
      axios.get(`${API}/api/qr-templates/saved-colors`, { headers }).catch(() => ({ data: {} })),
      axios.get(`${API}/api/qr-templates/watermark`, { headers }).catch(() => ({ data: {} })),
    ]).then(([l, g, s, sh, tpl, logo, colorsRes, wmRes]) => {
      setLevels((l.data || []).filter(x => x.activo));
      setGrades((g.data || []).filter(x => x.activo));
      setSections((s.data || []).filter(x => x.activo));
      setShifts(sh.data || []);
      setTemplates(tpl.data.templates || [{ id: "classic", name: "Clásica", description: "Carnet estándar" }, { id: "moderna", name: "Moderna", description: "Header azul con curva amarilla" }]);
      if (tpl.data.templates?.length) setSelected(tpl.data.templates[0].id);
      setLogoCarnet(logo.data?.logo_carnet_url || null);
      const sc = colorsRes.data?.colors || {};
      setSavedColors(sc);
      if (sc.moderna) {
        setColorPrincipal(sc.moderna.color_principal || "#1e3a5f");
        setColorAcento(sc.moderna.color_acento || "#F5B800");
      }
      setWatermarkUrl(wmRes.data?.watermark_url || null);
    }).catch(() => {});
  }, [open]);

  const filteredGrades = useMemo(() => grades.filter(g => !selLevel || g.nivel_id === selLevel), [grades, selLevel]);
  const filteredSections = useMemo(() => sections.filter(s => !selGrade || s.grado_id === selGrade), [sections, selGrade]);

  useEffect(() => { setSelGrade(""); setSelSection(""); }, [selLevel]);
  useEffect(() => { setSelSection(""); }, [selGrade]);

  useEffect(() => {
    if (!selLevel || !selGrade || !selSection) { setStudentCount(0); setPreviewData(null); return; }
    setLoadingPreview(true);
    const params = { nivel_id: selLevel, grado_id: selGrade, seccion_id: selSection };
    Promise.all([
      axios.get(`${API}/api/qr-templates/preview`, { headers, params }),
      axios.get(`${API}/api/qr-templates/count`, { headers, params }),
    ]).then(([prevRes, countRes]) => {
      setPreviewData(prevRes.data);
      setStudentCount(countRes.data?.count || 0);
    }).catch(() => {
      setPreviewData(null);
      setStudentCount(0);
    }).finally(() => setLoadingPreview(false));
  }, [selLevel, selGrade, selSection, selShift]);

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CLIENT_SIZE) {
      alert(`El archivo excede el límite de 5MB (actual: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      e.target.value = "";
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/api/qr-templates/upload-logo-carnet`, fd, { headers: { ...headers, "Content-Type": "multipart/form-data" } });
      setLogoCarnet(res.data.logo_carnet_url);
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al subir el logo.";
      alert(msg);
    } finally { setUploadingLogo(false); e.target.value = ""; }
  };

  const handleSelectTemplate = (id) => {
    setSelected(id);
    const tpl = templates.find(t => t.id === id);
    const sc = savedColors[id];
    if (sc) {
      setColorPrincipal(sc.color_principal);
      setColorAcento(sc.color_acento);
    } else if (tpl) {
      setColorPrincipal(tpl.default_color_principal || "#1e3a5f");
      setColorAcento(tpl.default_color_acento || "#F5B800");
    }
  };

  const handleSaveColors = async () => {
    setSavingColors(true);
    try {
      await axios.post(`${API}/api/qr-templates/save-colors`, { template_id: selected, color_principal: colorPrincipal, color_acento: colorAcento }, { headers });
      setSavedColors(prev => ({ ...prev, [selected]: { color_principal: colorPrincipal, color_acento: colorAcento } }));
      alert("Colores guardados. Se usarán por defecto la próxima vez.");
    } catch { alert("Error al guardar colores."); }
    finally { setSavingColors(false); }
  };

  const MAX_CLIENT_SIZE = 5 * 1024 * 1024;

  const handleUploadWatermark = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CLIENT_SIZE) {
      alert(`El archivo excede el límite de 5MB (actual: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      e.target.value = "";
      return;
    }
    setUploadingWatermark(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/api/qr-templates/upload-watermark`, fd, { headers: { ...headers, "Content-Type": "multipart/form-data" } });
      setWatermarkUrl(res.data.watermark_url);
      alert("Marca de agua guardada.");
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al subir la imagen.";
      alert(msg);
    } finally { setUploadingWatermark(false); e.target.value = ""; }
  };

  const handleDeleteWatermark = async () => {
    if (!confirm("¿Eliminar la marca de agua?")) return;
    try {
      await axios.delete(`${API}/api/qr-templates/watermark`, { headers });
      setWatermarkUrl(null);
    } catch { alert("Error al eliminar."); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.post(`${API}/api/qr-templates/download`, {
        formato, template: selected,
        nivel_id: selLevel, grado_id: selGrade, seccion_id: selSection,
        turno_id: selShift || null,
        incluir_codigo_alumno: incluirCodigo, ordenar_alfabetico: ordenar, incluir_foto: true,
        color_principal: selectedTpl?.supports_custom_colors ? colorPrincipal : null,
        color_acento: selectedTpl?.supports_custom_colors ? colorAcento : null,
      }, { headers, responseType: "blob" });
      const isZip = formato === "zip";
      const url = window.URL.createObjectURL(new Blob([res.data], { type: isZip ? "application/zip" : "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `qr_export.${isZip ? "zip" : "pdf"}`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert("Error al descargar."); } finally { setDownloading(false); }
  };

  if (!open) return null;

  const filtersComplete = selLevel && selGrade && selSection;
  const selectedTpl = templates.find(t => t.id === selected);
  const downloadLabel = formato === "zip" ? "Descargar ZIP" : formato === "pdf_lista" ? "Descargar PDF (lista)" : "Descargar PDF";
  const showTemplate = formato !== "zip";
  const showCarnetPreview = formato === "pdf_grid";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[190]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[200] flex flex-col" data-testid="qr-template-drawer">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center"><Palette className="w-4 h-4 text-teal-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Exportar Carnets QR</h2>
              <p className="text-[11px] text-slate-500">Configura filtros, formato y descarga</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="qr-drawer-close"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 1. Filters */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Filtros</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">Nivel</label>
                <select value={selLevel} onChange={e => setSelLevel(e.target.value)} data-testid="drawer-level" className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none">
                  <option value="">Seleccionar...</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">Grado</label>
                <select value={selGrade} onChange={e => setSelGrade(e.target.value)} disabled={!selLevel} data-testid="drawer-grade" className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:opacity-50">
                  <option value="">Seleccionar...</option>
                  {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">Sección</label>
                <select value={selSection} onChange={e => setSelSection(e.target.value)} disabled={!selGrade} data-testid="drawer-section" className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:opacity-50">
                  <option value="">Seleccionar...</option>
                  {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-0.5 block">Turno</label>
                <select value={selShift} onChange={e => setSelShift(e.target.value)} data-testid="drawer-shift" className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none">
                  <option value="">Todos</option>
                  {shifts.filter(s => s.activo !== false).map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                </select>
              </div>
            </div>
            {filtersComplete && studentCount > 0 && <p className="text-[11px] text-teal-600 mt-1.5 font-medium">{studentCount} estudiante{studentCount !== 1 ? "s" : ""} con QR</p>}
            {filtersComplete && studentCount === 0 && !loadingPreview && <p className="text-[11px] text-amber-600 mt-1.5">No se encontraron estudiantes con QR</p>}
          </div>

          {/* 2. Format */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Formato de descarga</p>
            <div className="space-y-1.5">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormato(f.id)} data-testid={`format-${f.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${formato === f.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <f.icon className={`w-4 h-4 flex-shrink-0 ${formato === f.id ? "text-teal-600" : "text-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{f.label}</p>
                    <p className="text-[10px] text-slate-500">{f.desc}</p>
                  </div>
                  {formato === f.id && <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Options */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Opciones</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={incluirCodigo} onChange={e => setIncluirCodigo(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" /><span className="text-xs text-slate-700">Incluir código del alumno</span></label>
              <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={ordenar} onChange={e => setOrdenar(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" /><span className="text-xs text-slate-700">Ordenar alfabéticamente</span></label>
            </div>
          </div>

          {/* 4. Template */}
          {showTemplate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Plantilla</p>
              {formato === "pdf_lista" && <p className="text-[10px] text-slate-400 mb-2">Se aplicarán colores de la plantilla al encabezado</p>}
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => handleSelectTemplate(t.id)} data-testid={`template-card-${t.id}`}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${selected === t.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    {selected === t.id && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                    <p className="font-semibold text-xs text-slate-800">{t.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4b. Colors (only if template supports) */}
          {selectedTpl?.supports_custom_colors && showTemplate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Colores</p>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {PALETAS.map((p, i) => {
                  const isActive = colorPrincipal === p.principal && colorAcento === p.acento;
                  return (
                    <button key={i} onClick={() => { setColorPrincipal(p.principal); setColorAcento(p.acento); }}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border-2 transition-all ${isActive ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                      title={p.nombre} data-testid={`paleta-${i}`}>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: p.principal }} />
                      <div className="w-5 h-5 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: p.acento }} />
                      {isActive && <Check className="w-3 h-3 text-teal-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowCustomColors(!showCustomColors)} className="text-[11px] text-teal-600 hover:underline mb-2">
                {showCustomColors ? "Ocultar personalización" : "Personalizar colores"}
              </button>
              {showCustomColors && (
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-2 mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-600 w-16">Principal</label>
                    <input type="color" value={colorPrincipal} onChange={e => setColorPrincipal(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input type="text" value={colorPrincipal} onChange={e => setColorPrincipal(e.target.value)} className="text-[10px] w-20 px-1.5 py-1 border border-slate-200 rounded font-mono" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-600 w-16">Acento</label>
                    <input type="color" value={colorAcento} onChange={e => setColorAcento(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input type="text" value={colorAcento} onChange={e => setColorAcento(e.target.value)} className="text-[10px] w-20 px-1.5 py-1 border border-slate-200 rounded font-mono" />
                  </div>
                </div>
              )}
              <button onClick={handleSaveColors} disabled={savingColors}
                className="text-[11px] text-teal-600 font-medium hover:underline flex items-center gap-1 disabled:opacity-50">
                {savingColors ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {savingColors ? "Guardando..." : "Guardar como predeterminados"}
              </button>
            </div>
          )}

          {/* 4c. Logo carnet (only for Moderna) */}
          {selected === "moderna" && showTemplate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Logo del carnet</p>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                {logoCarnet ? (
                  <div className="flex items-center gap-3">
                    <img src={logoCarnet} alt="Logo carnet" className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 font-medium">Logo alternativo configurado</p>
                      <label className="text-[10px] text-teal-600 cursor-pointer hover:underline inline-flex items-center gap-1 mt-0.5">
                        <Upload className="w-3 h-3" /> Cambiar logo
                        <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <Image className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500 mb-1.5">No has configurado un logo alternativo</p>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-teal-600 font-medium cursor-pointer hover:underline">
                      {uploadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingLogo ? "Subiendo..." : "Subir logo para carnet"}
                      <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" disabled={uploadingLogo} />
                    </label>
                  </div>
                )}
                <p className="text-[9px] text-slate-400 mt-2 leading-tight">Opcional. Usa un logo con colores claros que contraste con el fondo azul. Se optimiza a WebP (max 5MB, 800px).</p>
              </div>
            </div>
          )}

          {/* 4d. Watermark (only for Moderna) */}
          {selected === "moderna" && showTemplate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Marca de agua</p>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                {watermarkUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={watermarkUrl} alt="Marca de agua" className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1 opacity-40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 font-medium">Marca de agua configurada</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <label className="text-[10px] text-teal-600 cursor-pointer hover:underline inline-flex items-center gap-1">
                          {uploadingWatermark ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Cambiar
                          <input type="file" accept="image/*" onChange={handleUploadWatermark} className="hidden" disabled={uploadingWatermark} />
                        </label>
                        <button onClick={handleDeleteWatermark} className="text-[10px] text-red-500 hover:underline">Quitar</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <Image className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500 mb-1.5">Sin marca de agua. El carnet se generará limpio.</p>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-teal-600 font-medium cursor-pointer hover:underline">
                      {uploadingWatermark ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingWatermark ? "Subiendo..." : "Subir imagen"}
                      <input type="file" accept="image/*" onChange={handleUploadWatermark} className="hidden" disabled={uploadingWatermark} />
                    </label>
                  </div>
                )}
                <p className="text-[9px] text-slate-400 mt-2 leading-tight">Se optimiza a WebP (max 5MB, 800px). Se renderiza al 22% de opacidad detrás del contenido.</p>
              </div>
            </div>
          )}

          {/* 5. Preview */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">Vista previa</p>
            {formato === "zip" ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-6 text-center">
                <FolderArchive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">El ZIP contiene solo las imágenes QR</p>
                <p className="text-[10px] text-slate-400">individuales, sin diseño de carnet</p>
              </div>
            ) : formato === "pdf_lista" ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4 px-4">
                <p className="text-[10px] text-slate-400 mb-2">Vista de lista</p>
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 border-b border-slate-200">
                    <span className="text-[9px] font-bold text-slate-600 w-4">#</span>
                    <span className="text-[9px] font-bold text-slate-600 flex-1">Nombre</span>
                    {incluirCodigo && <span className="text-[9px] font-bold text-slate-600 w-12">Código</span>}
                    <span className="text-[9px] font-bold text-slate-600 w-12 text-center">QR</span>
                  </div>
                  {previewData && (
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-[9px] text-slate-500 w-4">1</span>
                      <span className="text-[9px] text-slate-800 flex-1 font-medium">{previewData.student_name}</span>
                      {incluirCodigo && <span className="text-[9px] text-slate-500 w-12">{previewData.codigo_alumno || "-"}</span>}
                      <div className="w-12 flex justify-center">{previewData.qr_token && <QRCodeSVG value={previewData.qr_token} size={28} />}</div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400">2</span><span className="text-[9px] text-slate-300 flex-1">...</span>
                  </div>
                </div>
              </div>
            ) : showCarnetPreview ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4">
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
                ) : previewData ? (
                  <>
                    <p className="text-[10px] text-slate-400 text-center mb-2">{previewData.student_name}</p>
                    {selected === "moderna" ? (
                      <CarnetModernaPreview data={previewData} incluirCodigo={incluirCodigo} logoCarnet={logoCarnet} colorPrincipal={colorPrincipal} colorAcento={colorAcento} watermarkUrl={watermarkUrl} />
                    ) : (
                      <CarnetClassicPreview data={previewData} incluirCodigo={incluirCodigo} />
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12 text-xs text-slate-400">
                    {filtersComplete ? "No se encontraron estudiantes" : "Selecciona nivel, grado y sección"}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors" data-testid="qr-drawer-cancel">Cancelar</button>
          <button onClick={handleDownload} disabled={downloading || !filtersComplete || !studentCount}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50" data-testid="qr-drawer-download">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generando..." : downloadLabel}
          </button>
        </div>
      </div>
    </>
  );
}
