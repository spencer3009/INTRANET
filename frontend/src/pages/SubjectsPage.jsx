import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, 
  Clock, MoreVertical, GraduationCap, ArrowRight, User, Power, PowerOff,
  Image, Upload, Trash2, Crop, ZoomIn, ZoomOut, RotateCcw,
  Baby, Backpack, Settings2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Subject colors
const SUBJECT_COLORS = [
  { value: "#3B82F6", label: "Azul" },
  { value: "#10B981", label: "Verde" },
  { value: "#F59E0B", label: "Amarillo" },
  { value: "#EF4444", label: "Rojo" },
  { value: "#8B5CF6", label: "Violeta" },
  { value: "#EC4899", label: "Rosa" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#6366F1", label: "Indigo" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#F97316", label: "Naranja" },
  { value: "#84CC16", label: "Lima" },
  { value: "#A855F7", label: "Púrpura" },
];

// Level icons mapping
const LEVEL_ICONS = {
  "inicial": Baby,
  "primaria": Backpack,
  "secundaria": GraduationCap,
};

// Helper to get icon for level
function getLevelIcon(levelName) {
  const name = levelName?.toLowerCase() || "";
  if (name.includes("inicial")) return Baby;
  if (name.includes("primaria")) return Backpack;
  if (name.includes("secundaria")) return GraduationCap;
  return GraduationCap;
}

// Helper function to create centered aspect crop
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM GRADE CARD - Large, clean, Notion-style
// ══════════════════════════════════════════════════════════════════════════════
function PremiumGradeCard({ grade, subjectCount, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`grade-card-${grade.id}`}
      className="group relative bg-white border border-slate-200 rounded-2xl p-8 text-left
        shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        hover:-translate-y-1 transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-[#001f4b] focus:ring-offset-2"
    >
      {/* Icon */}
      <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
        <GraduationCap className="w-7 h-7 text-[#001f4b]" />
      </div>
      
      {/* Grade name */}
      <h3 className="text-2xl font-semibold text-[#0F172A] mb-2 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {grade.nombre}
      </h3>
      
      {/* Subject count */}
      <p className="text-base text-[#64748B] mb-6">
        {subjectCount === 0 ? "Sin asignaturas" : `${subjectCount} asignatura${subjectCount !== 1 ? "s" : ""}`}
      </p>
      
      {/* Action button */}
      <div className="flex items-center gap-2 text-[#001f4b] font-medium group-hover:gap-3 transition-all duration-300">
        <Settings2 className="w-4 h-4" />
        <span>Gestionar asignaturas</span>
        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT CARD - Premium style
// ══════════════════════════════════════════════════════════════════════════════
function SubjectCard({ subject, onEdit, onToggleStatus, onViewCourse }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <div 
      onClick={() => onViewCourse && onViewCourse(subject)}
      data-testid={`subject-card-${subject.id}`}
      className={`group relative bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer
        shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        hover:-translate-y-1 transition-all duration-300
        ${subject.status === "inactive" ? "opacity-60" : ""}`}
    >
      {/* Color accent */}
      <div className="h-1.5 w-full" style={{ backgroundColor: subject.color }} />
      
      <div className="p-6">
        {/* Menu */}
        <div className="absolute top-5 right-4 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 w-44">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(subject); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  <Edit2 className="w-4 h-4 text-slate-400" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStatus(subject); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                >
                  {subject.status === "active" ? (
                    <><PowerOff className="w-4 h-4 text-amber-500" /><span>Desactivar</span></>
                  ) : (
                    <><Power className="w-4 h-4 text-emerald-500" /><span>Activar</span></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Subject icon/image */}
        {subject.image_url ? (
          <div className="w-16 h-16 rounded-xl overflow-hidden mb-4 shadow-sm border border-slate-100">
            <img src={subject.image_url} alt={subject.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 shadow-sm" style={{ backgroundColor: subject.color + '15' }}>
            <BookOpen className="w-8 h-8" style={{ color: subject.color }} />
          </div>
        )}
        
        {/* Subject info */}
        <h3 className="font-semibold text-[#0F172A] text-lg mb-2 pr-8 line-clamp-1">{subject.name}</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: subject.color }}>
            {subject.code}
          </span>
          {subject.weekly_hours && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3" />{subject.weekly_hours}h
            </span>
          )}
        </div>
        
        {/* Teacher */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          {subject.primary_teacher ? (
            <>
              <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200">
                {subject.primary_teacher.profile_image ? (
                  <img src={subject.primary_teacher.profile_image} alt={subject.primary_teacher.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#001f4b] to-[#001636] flex items-center justify-center">
                    <span className="text-white font-medium text-sm">{subject.primary_teacher.name?.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 font-medium truncate">{subject.primary_teacher.name}</p>
                <p className="text-xs text-slate-400">Titular</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-200">
                <User className="w-4 h-4 text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-400">Sin asignar</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function AddSubjectCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid="add-subject-card"
      className="group relative bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6
        hover:border-[#001f4b] hover:bg-slate-50/50
        transition-all duration-300 flex flex-col items-center justify-center min-h-[240px]
        focus:outline-none focus:ring-2 focus:ring-[#001f4b] focus:ring-offset-2"
    >
      <div className="w-14 h-14 bg-slate-100 group-hover:bg-[#001f4b] rounded-xl flex items-center justify-center mb-4 transition-colors duration-300">
        <Plus className="w-7 h-7 text-slate-400 group-hover:text-white transition-colors duration-300" />
      </div>
      <span className="text-base font-semibold text-slate-600 group-hover:text-[#001f4b] transition-colors">Nueva asignatura</span>
      <span className="text-sm text-slate-400 mt-1">Agregar materia</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL - With Premium Image Crop
// ══════════════════════════════════════════════════════════════════════════════
function SubjectFormModal({ isOpen, onClose, subject, onSave, levels, grades, preselectedLevel, preselectedGrade, token }) {
  const [formData, setFormData] = useState({
    name: "", code: "", description: "", level_id: "", grade_id: "",
    weekly_hours: 2, color: "#3B82F6", status: "active", image_url: ""
  });
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Image upload states
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // Crop states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scale, setScale] = useState(1);
  const imgRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (subject) {
        setFormData({
          name: subject.name || "", code: subject.code || "", description: subject.description || "",
          level_id: subject.level_id || "", grade_id: subject.grade_id || "",
          weekly_hours: subject.weekly_hours || 2, color: subject.color || "#3B82F6",
          status: subject.status || "active", image_url: subject.image_url || ""
        });
        setImagePreview(subject.image_url || null);
      } else {
        setFormData({
          name: "", code: "", description: "",
          level_id: preselectedLevel || "", grade_id: preselectedGrade || "",
          weekly_hours: 2, color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value,
          status: "active", image_url: ""
        });
        setImagePreview(null);
      }
      setError("");
      setUploadProgress(0);
      setCropImageSrc(null);
      setShowCropModal(false);
      setScale(1);
    }
  }, [subject, isOpen, preselectedLevel, preselectedGrade]);

  useEffect(() => {
    if (formData.level_id) {
      setFilteredGrades(grades.filter(g => g.nivel_id === formData.level_id && g.activo));
    } else {
      setFilteredGrades([]);
    }
  }, [formData.level_id, grades]);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    const cropInit = centerAspectCrop(width, height, 1);
    setCrop(cropInit);
    setCompletedCrop(cropInit);
  }, []);

  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return null;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const outputSize = 800;
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    const scaledCropWidth = cropWidth / scale;
    const scaledCropHeight = cropHeight / scale;
    const offsetX = (cropWidth - scaledCropWidth) / 2;
    const offsetY = (cropHeight - scaledCropHeight) / 2;
    
    ctx.drawImage(image, cropX + offsetX, cropY + offsetY, scaledCropWidth, scaledCropHeight, 0, 0, outputSize, outputSize);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], 'cropped-image.webp', { type: 'image/webp' }));
        else resolve(null);
      }, 'image/webp', 0.85);
    });
  }, [completedCrop, scale]);

  const uploadToCloudinary = async (file) => {
    const headers = { Authorization: `Bearer ${token}` };
    const signatureRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/subjects&resource_type=image`, { headers });
    const { signature, timestamp, cloud_name, api_key, folder } = signatureRes.data;
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('signature', signature);
    formDataUpload.append('timestamp', timestamp);
    formDataUpload.append('api_key', api_key);
    formDataUpload.append('folder', folder);
    
    const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, formDataUpload, {
      onUploadProgress: (progressEvent) => setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
    });
    return uploadRes.data.secure_url;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Por favor selecciona una imagen válida'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('La imagen no debe superar los 10MB'); return; }
    
    setError("");
    const reader = new FileReader();
    reader.onload = () => { setCropImageSrc(reader.result); setShowCropModal(true); setScale(1); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleApplyCrop = async () => {
    setUploadingImage(true);
    setShowCropModal(false);
    try {
      const croppedFile = await getCroppedImg();
      if (!croppedFile) throw new Error('Error al recortar imagen');
      const imageUrl = await uploadToCloudinary(croppedFile);
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
      setImagePreview(imageUrl);
      setCropImageSrc(null);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Error al subir la imagen. Intenta de nuevo.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleCancelCrop = () => { setShowCropModal(false); setCropImageSrc(null); setScale(1); };
  const handleRemoveImage = () => { setFormData(prev => ({ ...prev, image_url: "" })); setImagePreview(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim()) { setError("El nombre es requerido"); return; }
    if (!formData.code.trim()) { setError("El código es requerido"); return; }
    if (!formData.level_id) { setError("Selecciona un nivel"); return; }
    if (!formData.grade_id) { setError("Selecciona un grado"); return; }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const isLocked = preselectedLevel && preselectedGrade;
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-[#001f4b] px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{subject?.id ? "Editar Asignatura" : "Nueva Asignatura"}</h2>
                  <p className="text-sm text-white/60">Complete los datos requeridos</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Image Upload */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Image className="w-4 h-4 text-slate-400" />
                Imagen de la Asignatura
              </label>
              
              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  {uploadingImage ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center gap-2">
                        <Crop className="w-4 h-4" /> Cambiar
                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                      </label>
                      <button type="button" onClick={handleRemoveImage} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Quitar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-[#001f4b] hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7 text-slate-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Subir imagen</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (máx. 10MB)</span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Matemáticas" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Código *</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Ej: MAT-01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b] uppercase" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nivel *</label>
                <select value={formData.level_id} onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "" }))}
                  disabled={isLocked} className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b] ${isLocked ? "opacity-60" : ""}`}>
                  <option value="">Seleccionar</option>
                  {levels.filter(l => l.activo).map(level => (<option key={level.id} value={level.id}>{level.nombre}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grado *</label>
                <select value={formData.grade_id} onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value }))}
                  disabled={isLocked || !formData.level_id} className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b] ${isLocked || !formData.level_id ? "opacity-60" : ""}`}>
                  <option value="">Seleccionar</option>
                  {filteredGrades.map(grade => (<option key={grade.id} value={grade.id}>{grade.nombre}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Horas Semanales</label>
                <input type="number" min="1" max="40" value={formData.weekly_hours} onChange={(e) => setFormData(prev => ({ ...prev, weekly_hours: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]" />
              </div>
              <div className="flex flex-col justify-end">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700">💡 Los profesores se asignan desde "Asignación Docente"</p>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Color</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map(color => (
                  <button key={color.value} type="button" onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={`w-9 h-9 rounded-lg transition-all duration-200 ${formData.color === color.value ? "ring-2 ring-offset-2 ring-[#001f4b] scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: color.value }} title={color.label} />
                ))}
              </div>
            </div>
          </form>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <div className="flex-1" />
            <button onClick={handleSubmit} disabled={saving || uploadingImage}
              className="px-6 py-2.5 bg-[#001f4b] hover:bg-[#001636] text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {subject?.id ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {showCropModal && cropImageSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={handleCancelCrop} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-[#001f4b] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crop className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Recortar Imagen</h3>
                    <p className="text-sm text-white/60">Ajusta el área de recorte</p>
                  </div>
                </div>
                <button onClick={handleCancelCrop} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-900">
              <div className="relative max-h-[400px] overflow-hidden rounded-xl flex items-center justify-center">
                <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={1} className="max-h-[400px]">
                  <img ref={imgRef} src={cropImageSrc} alt="Crop preview" onLoad={onImageLoad} style={{ transform: `scale(${scale})`, maxHeight: '400px' }} className="max-w-full" />
                </ReactCrop>
              </div>
              <div className="mt-4 flex items-center justify-center gap-4">
                <button type="button" onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"><ZoomOut className="w-5 h-5" /></button>
                <span className="text-white text-sm px-3">{Math.round(scale * 100)}%</span>
                <button type="button" onClick={() => setScale(Math.min(3, scale + 0.1))} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"><ZoomIn className="w-5 h-5" /></button>
                <button type="button" onClick={() => setScale(1)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"><RotateCcw className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">Arrastra las esquinas para ajustar</p>
              <div className="flex gap-3">
                <button type="button" onClick={handleCancelCrop} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={handleApplyCrop} className="px-6 py-2.5 bg-[#001f4b] text-white rounded-xl font-medium hover:bg-[#001636] flex items-center gap-2">
                  <Check className="w-4 h-4" /> Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE - Premium Tabbed Design
// ══════════════════════════════════════════════════════════════════════════════
export default function SubjectsPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, subjectsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      const activeLevels = (levelsRes.data || []).filter(l => l.activo);
      setLevels(activeLevels);
      setGrades(gradesRes.data || []);
      setSubjects(subjectsRes.data || []);
      
      // Set first level as active tab
      if (activeLevels.length > 0) {
        setActiveTab(activeLevels[0].id);
      }
    } catch (err) { 
      console.error("SubjectsPage load error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadSubjects = async () => {
    try { 
      const res = await axios.get(`${API}/academic/subjects`, { headers }); 
      setSubjects(res.data); 
    } catch (err) { console.error(err); }
  };

  const handleSelectGrade = (level, grade) => {
    setSelectedLevel(level);
    setSelectedGrade(grade);
  };

  const handleBackToLevels = () => {
    setSelectedLevel(null);
    setSelectedGrade(null);
  };

  const handleSaveSubject = async (data) => {
    const subjectData = {
      name: data.name, code: data.code, description: data.description,
      level_id: data.level_id, grade_id: data.grade_id,
      weekly_hours: data.weekly_hours, color: data.color,
      status: data.status, image_url: data.image_url || null
    };
    if (editingSubject?.id) {
      await axios.put(`${API}/academic/subjects/${editingSubject.id}`, subjectData, { headers });
    } else {
      await axios.post(`${API}/academic/subjects`, subjectData, { headers });
    }
    loadSubjects();
  };

  const handleToggleStatus = async (subject) => {
    await axios.put(`${API}/academic/subjects/${subject.id}`, { 
      status: subject.status === "active" ? "inactive" : "active" 
    }, { headers });
    loadSubjects();
  };

  const handleViewCourse = (subject) => {
    if (subdomain) {
      navigate(`/school/${subdomain}/curso/${subject.id}`);
    } else {
      navigate(`/curso/${subject.id}`);
    }
  };

  // Compute subject counts
  const subjectCountByGrade = {};
  subjects.forEach(subject => {
    if (subject.grade_id) {
      subjectCountByGrade[subject.grade_id] = (subjectCountByGrade[subject.grade_id] || 0) + 1;
    }
  });

  const gradeSubjects = selectedGrade ? subjects.filter(s => s.grade_id === selectedGrade.id) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#001f4b] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-slate-500 font-medium">Cargando asignaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar user={user} settings={settings} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} subdomain={subdomain} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        <main className="flex-1 p-8 md:p-12">
          <div className="max-w-7xl mx-auto">
            
            {/* Page Header */}
            <div className="mb-12">
              <div className="flex items-center gap-5 mb-2">
                {selectedGrade && (
                  <button 
                    onClick={handleBackToLevels}
                    data-testid="back-to-levels"
                    className="p-3 bg-white hover:bg-slate-50 rounded-xl shadow-sm border border-slate-200 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5 text-slate-500 rotate-180" />
                  </button>
                )}
                <div className="w-14 h-14 bg-[#001f4b] rounded-2xl flex items-center justify-center shadow-lg">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-[#0F172A] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Asignaturas
                  </h1>
                  <p className="text-lg text-[#64748B]">
                    {selectedGrade 
                      ? `${selectedLevel?.nombre} — ${selectedGrade?.nombre}`
                      : "Gestiona las materias por nivel y grado"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            {!selectedGrade ? (
              // ════════════════════════════════════════════════════════════════
              // LEVELS VIEW WITH TABS
              // ════════════════════════════════════════════════════════════════
              levels.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                  <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin niveles configurados</h3>
                  <p className="text-slate-500">Configura los niveles en Ajustes Académicos</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  {/* Tab List - Premium Style */}
                  <TabsList className="w-full max-w-2xl mx-auto mb-12 p-1.5 bg-slate-100/70 rounded-2xl h-auto flex gap-1" data-testid="level-tabs">
                    {levels.map((level) => {
                      const LevelIcon = getLevelIcon(level.nombre);
                      const levelGrades = grades.filter(g => g.nivel_id === level.id && g.activo);
                      const totalSubjects = levelGrades.reduce((sum, g) => sum + (subjectCountByGrade[g.id] || 0), 0);
                      
                      return (
                        <TabsTrigger
                          key={level.id}
                          value={level.id}
                          data-testid={`tab-${level.nombre.toLowerCase().replace(/\s+/g, '-')}`}
                          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-200
                            data-[state=active]:bg-white data-[state=active]:text-[#001f4b] data-[state=active]:shadow-sm
                            data-[state=inactive]:text-[#64748B] data-[state=inactive]:hover:text-[#0F172A] data-[state=inactive]:hover:bg-white/50"
                        >
                          <LevelIcon className="w-5 h-5" />
                          <span>{level.nombre}</span>
                          <span className="px-2 py-0.5 text-xs font-bold bg-slate-200/80 data-[state=active]:bg-[#001f4b]/10 rounded-full">
                            {totalSubjects}
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {/* Tab Contents */}
                  {levels.map((level) => {
                    const levelGrades = grades.filter(g => g.nivel_id === level.id && g.activo);
                    
                    return (
                      <TabsContent key={level.id} value={level.id} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        {levelGrades.length === 0 ? (
                          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                            <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin grados en {level.nombre}</h3>
                            <p className="text-slate-500">Configura los grados en Ajustes Académicos</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {levelGrades.map(grade => (
                              <PremiumGradeCard
                                key={grade.id}
                                grade={grade}
                                subjectCount={subjectCountByGrade[grade.id] || 0}
                                onClick={() => handleSelectGrade(level, grade)}
                              />
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )
            ) : (
              // ════════════════════════════════════════════════════════════════
              // GRADE SUBJECTS VIEW
              // ════════════════════════════════════════════════════════════════
              <div>
                {/* Grade Header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-8 shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-[#001f4b]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base text-[#64748B] font-medium mb-1">{selectedLevel.nombre}</p>
                      <h2 className="text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Manrope, sans-serif' }}>{selectedGrade.nombre}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold text-[#001f4b]">{gradeSubjects.length}</p>
                      <p className="text-base text-[#64748B]">asignatura{gradeSubjects.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </div>

                {/* Subjects Grid */}
                {gradeSubjects.length === 0 ? (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <BookOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin asignaturas</h3>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">Este grado aún no tiene materias configuradas</p>
                    <button
                      onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
                      data-testid="add-first-subject"
                      className="px-8 py-4 bg-[#001f4b] hover:bg-[#001636] text-white rounded-xl font-semibold transition-colors inline-flex items-center gap-3"
                    >
                      <Plus className="w-5 h-5" />
                      Agregar Primera Asignatura
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {gradeSubjects.map(subject => (
                      <SubjectCard
                        key={subject.id}
                        subject={subject}
                        onEdit={() => { setEditingSubject(subject); setShowSubjectModal(true); }}
                        onToggleStatus={() => handleToggleStatus(subject)}
                        onViewCourse={() => handleViewCourse(subject)}
                      />
                    ))}
                    <AddSubjectCard onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <SubjectFormModal
        isOpen={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        subject={editingSubject}
        onSave={handleSaveSubject}
        levels={levels}
        grades={grades}
        preselectedLevel={selectedLevel?.id}
        preselectedGrade={selectedGrade?.id}
        token={token}
      />
    </div>
  );
}
