import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Sidebar from "../components/Sidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import DashboardHeader from "../components/DashboardHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, 
  Clock, MoreVertical, GraduationCap, ArrowRight, User, Users, Power, PowerOff,
  Image, Upload, Trash2, Crop, ZoomIn, ZoomOut, RotateCcw,
  Baby, Backpack, Settings2, Sparkles, Star
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

// Vibrant level themes - Premium but warm and inviting
const LEVEL_THEMES = {
  inicial: {
    name: "Inicial",
    icon: Baby,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    softGradient: "from-violet-50 via-purple-50 to-fuchsia-50",
    tabActive: "bg-gradient-to-r from-violet-500 to-purple-600 text-white [&>*]:text-white shadow-lg shadow-violet-500/30",
    tabInactive: "text-violet-600 hover:bg-violet-50",
    cardBg: "bg-gradient-to-br from-violet-50 to-purple-50",
    cardBorder: "border-violet-200/60",
    cardHover: "hover:shadow-violet-200/50 hover:border-violet-300",
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
    accent: "text-violet-600",
    badge: "bg-violet-500",
    buttonBg: "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
  },
  primaria: {
    name: "Primaria",
    icon: Backpack,
    gradient: "from-blue-500 via-indigo-500 to-violet-500",
    softGradient: "from-blue-50 via-indigo-50 to-violet-50",
    tabActive: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white [&>*]:text-white shadow-lg shadow-blue-500/30",
    tabInactive: "text-blue-600 hover:bg-blue-50",
    cardBg: "bg-gradient-to-br from-blue-50 to-indigo-50",
    cardBorder: "border-blue-200/60",
    cardHover: "hover:shadow-blue-200/50 hover:border-blue-300",
    iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
    accent: "text-blue-600",
    badge: "bg-blue-500",
    buttonBg: "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700",
  },
  secundaria: {
    name: "Secundaria",
    icon: GraduationCap,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    softGradient: "from-emerald-50 via-teal-50 to-cyan-50",
    tabActive: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white [&>*]:text-white shadow-lg shadow-emerald-500/30",
    tabInactive: "text-emerald-600 hover:bg-emerald-50",
    cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    cardBorder: "border-emerald-200/60",
    cardHover: "hover:shadow-emerald-200/50 hover:border-emerald-300",
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    accent: "text-emerald-600",
    badge: "bg-emerald-500",
    buttonBg: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700",
  },
  default: {
    name: "Nivel",
    icon: GraduationCap,
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    softGradient: "from-amber-50 via-orange-50 to-rose-50",
    tabActive: "bg-gradient-to-r from-amber-500 to-orange-600 text-white [&>*]:text-white shadow-lg shadow-amber-500/30",
    tabInactive: "text-amber-600 hover:bg-amber-50",
    cardBg: "bg-gradient-to-br from-amber-50 to-orange-50",
    cardBorder: "border-amber-200/60",
    cardHover: "hover:shadow-amber-200/50 hover:border-amber-300",
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    accent: "text-amber-600",
    badge: "bg-amber-500",
    buttonBg: "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700",
  }
};

// Helper to get theme for level
function getLevelTheme(levelName) {
  const name = levelName?.toLowerCase() || "";
  if (name.includes("inicial")) return LEVEL_THEMES.inicial;
  if (name.includes("primaria")) return LEVEL_THEMES.primaria;
  if (name.includes("secundaria")) return LEVEL_THEMES.secundaria;
  return LEVEL_THEMES.default;
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
// PREMIUM GRADE CARD - Vibrant, warm and inviting
// ══════════════════════════════════════════════════════════════════════════════
function PremiumGradeCard({ grade, subjectCount, theme, onClick }) {
  const hasSubjects = subjectCount > 0;
  const Icon = theme.icon;
  
  return (
    <button
      onClick={onClick}
      data-testid={`grade-card-${grade.id}`}
      className={`group relative overflow-hidden rounded-3xl p-8 text-left w-full
        ${theme.cardBg} border-2 ${theme.cardBorder}
        shadow-lg ${theme.cardHover} hover:shadow-2xl
        hover:-translate-y-2 transition-all duration-300 ease-out
        focus:outline-none focus:ring-4 focus:ring-offset-2`}
      style={{ focusRingColor: theme.accent }}
    >
      {/* Decorative circles */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${theme.gradient} rounded-full opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500`} />
      <div className={`absolute -bottom-8 -left-8 w-24 h-24 bg-gradient-to-br ${theme.gradient} rounded-full opacity-5 group-hover:opacity-15 transition-all duration-500`} />
      
      {/* Subject count badge */}
      {hasSubjects && (
        <div className={`absolute -top-2 -right-2 min-w-[36px] h-9 px-3 ${theme.badge} text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg ring-4 ring-white z-10`}>
          {subjectCount}
        </div>
      )}
      
      {/* Icon */}
      <div className={`relative w-16 h-16 ${theme.iconBg} rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        <Icon className="w-8 h-8 text-white" />
        <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* Grade name */}
      <h3 className="text-2xl font-bold text-gray-800 mb-2 tracking-tight">
        {grade.nombre}
      </h3>
      
      {/* Subject count text */}
      <p className={`text-base mb-6 font-medium ${hasSubjects ? theme.accent : 'text-gray-400'}`}>
        {subjectCount === 0 ? "Sin asignaturas" : `${subjectCount} asignatura${subjectCount !== 1 ? "s" : ""}`}
      </p>
      
      {/* Action */}
      <div className={`flex items-center gap-2 ${theme.accent} font-semibold group-hover:gap-3 transition-all duration-300`}>
        <Settings2 className="w-5 h-5" />
        <span>Ver secciones</span>
        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT CARD - Premium colorful style
// ══════════════════════════════════════════════════════════════════════════════
function SubjectCard({ subject, onEdit, onToggleStatus, onViewCourse }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <div 
      onClick={() => onViewCourse && onViewCourse(subject)}
      data-testid={`subject-card-${subject.id}`}
      className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer
        shadow-lg hover:shadow-2xl border-2 border-gray-100
        hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300
        ${subject.status === "inactive" ? "opacity-60 grayscale" : ""}`}
    >
      {/* Color accent bar */}
      <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${subject.color}, ${subject.color}99)` }} />
      
      <div className="p-6">
        {/* Menu */}
        <div className="absolute top-6 right-4 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-48">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(subject); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Editar</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStatus(subject); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className={`w-8 h-8 ${subject.status === "active" ? "bg-amber-100" : "bg-emerald-100"} rounded-lg flex items-center justify-center`}>
                    {subject.status === "active" ? <PowerOff className="w-4 h-4 text-amber-600" /> : <Power className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <span className="font-medium">{subject.status === "active" ? "Desactivar" : "Activar"}</span>
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Subject icon/image */}
        {subject.image_url ? (
          <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg ring-4 ring-white mx-auto group-hover:scale-105 transition-transform duration-300">
            <img src={subject.image_url} alt={subject.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
            style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}CC)` }}
          >
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        )}
        
        {/* Subject info */}
        <h3 className="font-bold text-gray-800 text-lg mb-2 pr-8 line-clamp-1">{subject.name}</h3>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span 
            className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: subject.color }}
          >
            {subject.code}
          </span>
          {subject.weekly_hours && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3" />{subject.weekly_hours}h
            </span>
          )}
        </div>
        
        {/* Teacher */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          {subject.primary_teacher ? (
            <>
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-200 shadow-sm">
                {subject.primary_teacher.profile_image ? (
                  <img src={subject.primary_teacher.profile_image} alt={subject.primary_teacher.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{subject.primary_teacher.name?.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 font-medium truncate">{subject.primary_teacher.name}</p>
                <p className="text-xs text-emerald-600">Titular</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                <User className="w-5 h-5 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-400 font-medium">Sin asignar</p>
                <p className="text-xs text-gray-300">Ir a Asignación</p>
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
function AddSubjectCard({ onClick, theme }) {
  return (
    <button
      onClick={onClick}
      data-testid="add-subject-card"
      className={`group relative rounded-2xl p-6 ${theme.cardBg}
        border-2 border-dashed ${theme.cardBorder}
        hover:border-solid ${theme.cardHover} hover:shadow-xl
        hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300
        flex flex-col items-center justify-center min-h-[260px]
        focus:outline-none focus:ring-4 focus:ring-offset-2`}
    >
      {/* Animated icon */}
      <div className="relative mb-4">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300`} />
        <div className={`relative w-16 h-16 ${theme.iconBg} rounded-2xl flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
          <Plus className="w-8 h-8 text-white transition-transform duration-300 group-hover:rotate-90" />
        </div>
      </div>
      
      <span className={`text-base font-bold ${theme.accent} transition-colors duration-300`}>Nueva asignatura</span>
      <span className="text-sm text-gray-400 mt-1">Agregar materia</span>
      
      <Star className={`absolute top-4 right-4 w-5 h-5 text-gray-200 group-hover:text-yellow-400 transition-all duration-300 group-hover:rotate-12`} />
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL - Premium with colors
// ══════════════════════════════════════════════════════════════════════════════
function SubjectFormModal({ isOpen, onClose, subject, onSave, levels, grades, sections, preselectedLevel, preselectedGrade, preselectedSection, token }) {
  const [formData, setFormData] = useState({
    name: "", code: "", description: "", level_id: "", grade_id: "", section_id: "",
    weekly_hours: 2, color: "#3B82F6", status: "active", image_url: ""
  });
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
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
          level_id: subject.level_id || preselectedLevel || "", grade_id: subject.grade_id || preselectedGrade || "", section_id: subject.section_id || preselectedSection || "",
          weekly_hours: subject.weekly_hours || 2, color: subject.color || "#3B82F6",
          status: subject.status || "active", image_url: subject.image_url || ""
        });
        setImagePreview(subject.image_url || null);
      } else {
        setFormData({
          name: "", code: "", description: "",
          level_id: preselectedLevel || "", grade_id: preselectedGrade || "", section_id: preselectedSection || "",
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
  }, [subject, isOpen, preselectedLevel, preselectedGrade, preselectedSection]);

  useEffect(() => {
    if (formData.level_id) {
      setFilteredGrades(grades.filter(g => g.nivel_id === formData.level_id && g.activo));
    } else {
      setFilteredGrades([]);
    }
  }, [formData.level_id, grades]);

  useEffect(() => {
    if (formData.grade_id) {
      setFilteredSections((sections || []).filter(s => s.grado_id === formData.grade_id && s.activo !== false));
    } else {
      setFilteredSections([]);
    }
  }, [formData.grade_id, sections]);

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
    if (!formData.section_id) { setError("Selecciona una sección"); return; }

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

  const isEditing = !!subject?.id;
  const isLocked = isEditing || (preselectedLevel && preselectedGrade && preselectedSection);
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{subject?.id ? "Editar Asignatura" : "Nueva Asignatura"}</h2>
                  <p className="text-sm text-white/70">Complete los datos requeridos</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {error && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Image Upload */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <Image className="w-4 h-4 text-indigo-500" />
                Imagen de la Asignatura
              </label>
              
              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg ring-2 ring-gray-100">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  {uploadingImage ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <label className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-sm font-medium cursor-pointer transition-colors flex items-center gap-2">
                        <Crop className="w-4 h-4" /> Cambiar
                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                      </label>
                      <button type="button" onClick={handleRemoveImage} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Quitar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                    <Upload className="w-8 h-8 text-indigo-500" />
                  </div>
                  <span className="text-sm font-semibold text-gray-600">Subir imagen</span>
                  <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP (máx. 10MB)</span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Matemáticas" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Código *</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Ej: MAT-01" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nivel *</label>
                <select value={formData.level_id} onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "", section_id: "" }))}
                  disabled={isLocked} className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isLocked ? "opacity-60" : ""}`}>
                  <option value="">Seleccionar</option>
                  {levels.filter(l => l.activo).map(level => (<option key={level.id} value={level.id}>{level.nombre}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Grado *</label>
                <select value={formData.grade_id} onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value, section_id: "" }))}
                  disabled={isLocked || !formData.level_id} className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isLocked || !formData.level_id ? "opacity-60" : ""}`}>
                  <option value="">Seleccionar</option>
                  {filteredGrades.map(grade => (<option key={grade.id} value={grade.id}>{grade.nombre}</option>))}
                </select>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">Sección *</label>
              <select value={formData.section_id} onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                disabled={isLocked || !formData.grade_id} data-testid="subject-section-select"
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isLocked || !formData.grade_id ? "opacity-60" : ""}`}>
                <option value="">Seleccionar sección</option>
                {filteredSections.map(sec => (<option key={sec.id} value={sec.id}>Sección {sec.nombre}</option>))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Horas Semanales</label>
                <input type="number" min="1" max="40" value={formData.weekly_hours} onChange={(e) => setFormData(prev => ({ ...prev, weekly_hours: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex flex-col justify-end">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700 font-medium">💡 Los profesores se asignan desde "Asignación Docente"</p>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-3">Color</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map(color => (
                  <button key={color.value} type="button" onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={`w-10 h-10 rounded-xl transition-all duration-200 ${formData.color === color.value ? "ring-4 ring-gray-300 scale-110 shadow-lg" : "hover:scale-110"}`}
                    style={{ backgroundColor: color.value }} title={color.label} />
                ))}
              </div>
            </div>
          </form>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">Cancelar</button>
            <div className="flex-1" />
            <button onClick={handleSubmit} disabled={saving || uploadingImage}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/25">
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
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crop className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Recortar Imagen</h3>
                    <p className="text-sm text-white/60">Ajusta el área de recorte</p>
                  </div>
                </div>
                <button onClick={handleCancelCrop} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-gray-900">
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

            <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-500">Arrastra las esquinas para ajustar</p>
              <div className="flex gap-3">
                <button type="button" onClick={handleCancelCrop} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">Cancelar</button>
                <button type="button" onClick={handleApplyCrop} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg flex items-center gap-2">
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
// MAIN PAGE - Premium Tabbed Design with Vibrant Colors
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
  const [selectedSection, setSelectedSection] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, subjectsRes, sectionsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/academic/sections`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      const activeLevels = (levelsRes.data || []).filter(l => l.activo);
      setLevels(activeLevels);
      setGrades(gradesRes.data || []);
      setSubjects(subjectsRes.data || []);
      setSections(sectionsRes.data || []);
      
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
    setSelectedSection(null);
  };

  const handleSelectSection = (section) => {
    setSelectedSection(section);
  };

  const handleBackToLevels = () => {
    if (selectedSection) {
      // From subjects view → sections view
      setSelectedSection(null);
    } else if (selectedGrade) {
      // From sections view → levels view (keep the correct tab active)
      const levelId = selectedLevel?.id;
      setSelectedLevel(null);
      setSelectedGrade(null);
      if (levelId) setActiveTab(levelId);
    }
  };

  const handleSaveSubject = async (data) => {
    const subjectData = {
      name: data.name, code: data.code, description: data.description,
      level_id: data.level_id, grade_id: data.grade_id, section_id: data.section_id || null,
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
      navigate(`/${subdomain}/curso/${subject.id}`);
    } else {
      navigate(`/curso/${subject.id}`);
    }
  };

  // Compute subject counts per grade and per section
  const subjectCountByGrade = {};
  const subjectCountBySection = {};
  subjects.forEach(subject => {
    if (subject.grade_id) {
      subjectCountByGrade[subject.grade_id] = (subjectCountByGrade[subject.grade_id] || 0) + 1;
    }
    if (subject.section_id) {
      subjectCountBySection[subject.section_id] = (subjectCountBySection[subject.section_id] || 0) + 1;
    }
  });

  // Sections for the selected grade
  const gradeSections = selectedGrade ? sections.filter(s => s.grado_id === selectedGrade.id && s.activo !== false) : [];
  // Subjects for selected section
  const sectionSubjects = selectedSection ? subjects.filter(s => s.section_id === selectedSection.id) : [];
  const currentTheme = selectedLevel ? getLevelTheme(selectedLevel.nombre) : LEVEL_THEMES.default;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl animate-pulse">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <p className="text-gray-500 font-medium">Cargando asignaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex">
      <Sidebar active="asignaturas" onNavigate={() => {}} expanded={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} schoolName={settings?.system_name} subdomain={subdomain} user={user} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-10 pb-20 lg:pb-10">
          <div className="max-w-7xl mx-auto">
            
            {/* Page Header - Vibrant */}
            <div className="mb-10">
              <div className="flex items-center gap-5 mb-2">
                {(selectedGrade) && (
                  <button 
                    onClick={handleBackToLevels}
                    data-testid="back-to-levels"
                    className="p-3 bg-white hover:bg-gray-50 rounded-xl shadow-lg border border-gray-100 hover:scale-105 transition-all"
                  >
                    <ArrowRight className="w-5 h-5 text-gray-500 rotate-180" />
                  </button>
                )}
                <div className={`w-16 h-16 bg-gradient-to-br ${selectedGrade ? currentTheme.gradient : 'from-blue-500 via-indigo-500 to-purple-500'} rounded-2xl flex items-center justify-center shadow-xl`}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-black text-gray-800 tracking-tight">
                    Asignaturas
                  </h1>
                  <p className="text-gray-500 font-medium text-lg">
                    {selectedSection 
                      ? `${selectedLevel?.nombre} — ${selectedGrade?.nombre} — Sección ${selectedSection?.nombre}`
                      : selectedGrade
                        ? `${selectedLevel?.nombre} — ${selectedGrade?.nombre}`
                        : "Gestiona las materias por nivel, grado y sección"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            {!selectedGrade ? (
              // ════════════════════════════════════════════════════════════════
              // LEVELS VIEW WITH PREMIUM TABS
              // ════════════════════════════════════════════════════════════════
              levels.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-200 p-16 text-center shadow-xl">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <GraduationCap className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-700 mb-3">Sin niveles configurados</h3>
                  <p className="text-gray-500 text-lg">Configura los niveles en Ajustes Académicos</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  {/* Tab List - Premium Vibrant Style */}
                  <TabsList className="w-full max-w-3xl mx-auto mb-10 p-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 h-auto flex gap-2" data-testid="level-tabs">
                    {levels.map((level) => {
                      const theme = getLevelTheme(level.nombre);
                      const Icon = theme.icon;
                      const levelGrades = grades.filter(g => g.nivel_id === level.id && g.activo);
                      const totalSubjects = levelGrades.reduce((sum, g) => sum + (subjectCountByGrade[g.id] || 0), 0);
                      const isActive = activeTab === level.id;
                      
                      return (
                        <TabsTrigger
                          key={level.id}
                          value={level.id}
                          data-testid={`tab-${level.nombre.toLowerCase().replace(/\s+/g, '-')}`}
                          className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all duration-300
                            ${isActive ? theme.tabActive : theme.tabInactive}`}
                          style={isActive ? { color: '#ffffff' } : {}}
                        >
                          <Icon className="w-6 h-6" color={isActive ? '#ffffff' : undefined} />
                          <span className="text-base">{level.nombre}</span>
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${isActive ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
                            {totalSubjects}
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {/* Tab Contents */}
                  {levels.map((level) => {
                    const theme = getLevelTheme(level.nombre);
                    const levelGrades = grades.filter(g => g.nivel_id === level.id && g.activo);
                    
                    return (
                      <TabsContent key={level.id} value={level.id} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        {levelGrades.length === 0 ? (
                          <div className={`${theme.cardBg} rounded-3xl border-2 ${theme.cardBorder} p-16 text-center`}>
                            <div className={`w-20 h-20 ${theme.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl opacity-60`}>
                              <GraduationCap className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-700 mb-3">Sin grados en {level.nombre}</h3>
                            <p className="text-gray-500 text-lg">Configura los grados en Ajustes Académicos</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {levelGrades.map(grade => (
                              <PremiumGradeCard
                                key={grade.id}
                                grade={grade}
                                theme={theme}
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
            ) : !selectedSection ? (
              // ════════════════════════════════════════════════════════════════
              // SECTIONS VIEW - Intermediate step between Grade and Subjects
              // ════════════════════════════════════════════════════════════════
              <div>
                {/* Grade Header */}
                <div className={`${currentTheme.cardBg} rounded-3xl border-2 ${currentTheme.cardBorder} p-8 mb-8 shadow-xl relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${currentTheme.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`} />
                  <div className="relative flex items-center gap-6">
                    <div className={`w-20 h-20 ${currentTheme.iconBg} rounded-2xl flex items-center justify-center shadow-xl`}>
                      <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-lg ${currentTheme.accent} font-bold mb-1`}>{selectedLevel.nombre}</p>
                      <h2 className="text-4xl font-black text-gray-800">{selectedGrade.nombre}</h2>
                      <p className="text-base text-gray-500 mt-1">Selecciona una sección para gestionar sus asignaturas</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-5xl font-black ${currentTheme.accent}`}>{gradeSections.length}</p>
                      <p className="text-base text-gray-500 font-semibold">sección{gradeSections.length !== 1 ? "es" : ""}</p>
                    </div>
                  </div>
                </div>

                {gradeSections.length === 0 ? (
                  <div className={`${currentTheme.cardBg} rounded-3xl border-2 border-dashed ${currentTheme.cardBorder} p-16 text-center`}>
                    <div className={`w-20 h-20 ${currentTheme.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl opacity-50`}>
                      <Users className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-700 mb-3">Sin secciones</h3>
                    <p className="text-gray-500 mb-4 max-w-md mx-auto text-lg">Este grado no tiene secciones configuradas. Crea secciones en Ajustes Académicos.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {gradeSections.map(section => {
                      const sCount = subjectCountBySection[section.id] || 0;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSelectSection(section)}
                          data-testid={`section-card-${section.id}`}
                          className={`group relative overflow-hidden rounded-3xl p-8 text-left w-full
                            ${currentTheme.cardBg} border-2 ${currentTheme.cardBorder}
                            shadow-lg ${currentTheme.cardHover} hover:shadow-2xl
                            hover:-translate-y-2 transition-all duration-300 ease-out`}
                        >
                          <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${currentTheme.gradient} rounded-full opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500`} />
                          {sCount > 0 && (
                            <div className={`absolute -top-2 -right-2 min-w-[36px] h-9 px-3 ${currentTheme.badge} text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg ring-4 ring-white z-10`}>
                              {sCount}
                            </div>
                          )}
                          <div className={`relative w-16 h-16 ${currentTheme.iconBg} rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                            <Users className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">Sección {section.nombre}</h3>
                          <p className={`text-base mb-6 font-medium ${sCount > 0 ? currentTheme.accent : 'text-gray-400'}`}>
                            {sCount === 0 ? "Sin asignaturas" : `${sCount} asignatura${sCount !== 1 ? "s" : ""}`}
                          </p>
                          <div className={`flex items-center gap-2 ${currentTheme.accent} font-semibold group-hover:gap-3 transition-all duration-300`}>
                            <Settings2 className="w-5 h-5" />
                            <span>Gestionar asignaturas</span>
                            <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // ════════════════════════════════════════════════════════════════
              // SECTION SUBJECTS VIEW - Premium Colorful
              // ════════════════════════════════════════════════════════════════
              <div>
                {/* Section Header */}
                <div className={`${currentTheme.cardBg} rounded-3xl border-2 ${currentTheme.cardBorder} p-8 mb-8 shadow-xl relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${currentTheme.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`} />
                  <div className="relative flex items-center gap-6">
                    <div className={`w-20 h-20 ${currentTheme.iconBg} rounded-2xl flex items-center justify-center shadow-xl`}>
                      <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-lg ${currentTheme.accent} font-bold mb-1`}>{selectedLevel.nombre} — {selectedGrade.nombre}</p>
                      <h2 className="text-4xl font-black text-gray-800">Sección {selectedSection.nombre}</h2>
                    </div>
                    <div className="text-right">
                      <p className={`text-5xl font-black ${currentTheme.accent}`}>{sectionSubjects.length}</p>
                      <p className="text-base text-gray-500 font-semibold">asignatura{sectionSubjects.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </div>

                {/* Subjects Grid */}
                {sectionSubjects.length === 0 ? (
                  <div className={`${currentTheme.cardBg} rounded-3xl border-2 border-dashed ${currentTheme.cardBorder} p-16 text-center`}>
                    <div className={`w-20 h-20 ${currentTheme.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl opacity-50`}>
                      <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-700 mb-3">Sin asignaturas</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto text-lg">Esta sección aún no tiene materias configuradas</p>
                    <button
                      onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
                      data-testid="add-first-subject"
                      className={`px-8 py-4 ${currentTheme.buttonBg} text-white rounded-2xl font-bold transition-all inline-flex items-center gap-3 shadow-xl hover:shadow-2xl hover:scale-105`}
                    >
                      <Plus className="w-6 h-6" />
                      Agregar Primera Asignatura
                      <Sparkles className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {sectionSubjects.map(subject => (
                      <SubjectCard
                        key={subject.id}
                        subject={subject}
                        onEdit={() => { setEditingSubject(subject); setShowSubjectModal(true); }}
                        onToggleStatus={() => handleToggleStatus(subject)}
                        onViewCourse={() => handleViewCourse(subject)}
                      />
                    ))}
                    <AddSubjectCard 
                      onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }} 
                      theme={currentTheme}
                    />
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
        sections={sections}
        preselectedLevel={selectedLevel?.id}
        preselectedGrade={selectedGrade?.id}
        preselectedSection={selectedSection?.id}
        token={token}
      />
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
    </div>
  );
}
