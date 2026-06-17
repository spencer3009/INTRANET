import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import FloatingHelpAvatar from "@/components/FloatingHelpAvatar";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  BookMarked, GraduationCap, Calendar, Clock,
  Plus, Pencil, Trash2, MoreVertical, Loader2, Check, X,
  BookOpen, Users, ChevronRight, ArrowLeft, Camera,
  AlertCircle, Layers, Play, CalendarDays, Settings, GripVertical,
  ChevronUp, ChevronDown, Stethoscope
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Shift color options
const SHIFT_COLORS = [
  { value: "#3B82F6", label: "Azul", class: "bg-blue-500" },
  { value: "#10B981", label: "Verde", class: "bg-emerald-500" },
  { value: "#F59E0B", label: "Amarillo", class: "bg-amber-500" },
  { value: "#EF4444", label: "Rojo", class: "bg-red-500" },
  { value: "#8B5CF6", label: "Violeta", class: "bg-violet-500" },
  { value: "#EC4899", label: "Rosa", class: "bg-pink-500" },
  { value: "#06B6D4", label: "Cyan", class: "bg-cyan-500" },
  { value: "#6366F1", label: "Indigo", class: "bg-indigo-500" },
];

// Academic settings categories
const ACADEMIC_CATEGORIES = [
  {
    id: "niveles",
    label: "Niveles Educativos",
    description: "Inicial, Primaria, Secundaria",
    icon: GraduationCap,
    color: "from-blue-500 to-indigo-600",
    lightColor: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  {
    id: "grados",
    label: "Grados",
    description: "1°, 2°, 3°, 4°, 5°, 6°",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-600",
    lightColor: "from-emerald-50 to-teal-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-100"
  },
  {
    id: "secciones",
    label: "Secciones",
    description: "A, B, C, D",
    icon: Users,
    color: "from-purple-500 to-pink-600",
    lightColor: "from-purple-50 to-pink-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  {
    id: "turnos",
    label: "Turnos",
    description: "Mañana, Tarde, Noche",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
    lightColor: "from-amber-50 to-orange-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    bgColor: "bg-amber-100"
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// LEVEL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function LevelModal({ isOpen, onClose, token, level, onSuccess }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", descripcion: "", imagen_url: "", activo: true });
  const [autoGrades, setAutoGrades] = useState(false);
  const isEdit = !!level;
  const headers = { Authorization: `Bearer ${token}` };

  // Detect if name matches standard levels for auto-checkbox
  const nameNorm = form.nombre.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const isStandardLevel = ["PRIMARIA", "SECUNDARIA", "INICIAL"].includes(nameNorm);

  useEffect(() => {
    if (isOpen) {
      setForm(level ? { nombre: level.nombre || "", descripcion: level.descripcion || "", imagen_url: level.imagen_url || "", activo: level.activo !== false } : { nombre: "", descripcion: "", imagen_url: "", activo: true });
      setAutoGrades(false);
      setError("");
    }
  }, [isOpen, level]);

  // Auto-toggle checkbox when name matches standard level
  useEffect(() => {
    if (!isEdit) setAutoGrades(isStandardLevel);
  }, [isStandardLevel, isEdit]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/academic`, { headers });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", folder);
      const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, formData);
      setForm(prev => ({ ...prev, imagen_url: uploadRes.data.secure_url }));
    } catch { setError("Error al subir imagen"); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true);
    try {
      const payload = isEdit ? form : { ...form, crear_grados_estandar: autoGrades };
      const res = isEdit ? await axios.put(`${API}/academic/levels/${level.id}`, payload, { headers }) : await axios.post(`${API}/academic/levels`, payload, { headers });
      onSuccess(res.data.level, isEdit ? "update" : "create", res.data.created_grades || []);
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-white" />
              <div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Nivel</h2></div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 flex flex-col items-center justify-center text-blue-600 hover:border-blue-500 overflow-hidden">
                  {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : form.imagen_url ? <img src={form.imagen_url} alt="" className="w-full h-full object-cover" /> : <><Camera className="w-8 h-8 mb-1" /><span className="text-xs">Subir imagen</span></>}
                </button>
                {form.imagen_url && <button type="button" onClick={() => setForm(p => ({ ...p, imagen_url: "" }))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button>}
              </div>
            </div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: Primaria" required /></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl resize-none" rows={3} /></div>
            {!isEdit && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer" data-testid="auto-grades-checkbox">
                  <input type="checkbox" checked={autoGrades} onChange={(e) => setAutoGrades(e.target.checked)} className="mt-1 w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">Crear grados estándar automáticamente</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {nameNorm === "PRIMARIA" ? "Se crearán: 1°, 2°, 3°, 4°, 5°, 6°" : nameNorm === "SECUNDARIA" ? "Se crearán: 1°, 2°, 3°, 4°, 5°" : nameNorm === "INICIAL" ? "Se crearán: 3 AÑOS, 4 AÑOS, 5 AÑOS" : "Disponible para Inicial, Primaria y Secundaria"}
                    </p>
                  </div>
                </label>
              </div>
            )}
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-blue-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRADE MODAL
// ══════════════════════════════════════════════════════════════════════════════
// Preset grades per standard level (dropdown instead of free text)
const PRESET_GRADES_BY_LEVEL = {
  INICIAL: ["3 AÑOS", "4 AÑOS", "5 AÑOS"],
  PRIMARIA: ["1°", "2°", "3°", "4°", "5°", "6°"],
  SECUNDARIA: ["1°", "2°", "3°", "4°", "5°"],
};

// Section-like patterns to block in grade names
const SECTION_PATTERNS = [
  /\s+[A-Za-z]$/,                    // ends with single letter: "4 AÑOS A"
  /(AÑOS|°|GRADO)\s+[A-Za-z]$/i,    // grade + letter: "4 AÑOS B"  
  /°\s*[A-Za-z]$/,                   // "1°A", "2° B"
];
const SECTION_WORDS = ["SECCIÓN", "SECCIÓN", "AULA", "ALAMO", "ÁLAMO", "ROBLE", "CEDRO", "PINO", "SAUCE", "OLIVO"];

function looksLikeSection(name) {
  const upper = name.trim().toUpperCase();
  for (const pat of SECTION_PATTERNS) {
    if (pat.test(upper)) return true;
  }
  for (const word of SECTION_WORDS) {
    if (upper.includes(word) && upper !== word) return true;
  }
  // "X AÑOS <extra>" pattern
  const m = upper.match(/^(\d+)\s*(AÑOS?)\s+(.+)$/);
  if (m && m[3].trim().length > 0) return true;
  return false;
}

function GradeModal({ isOpen, onClose, token, grade, levels, onSuccess, preselectedLevelId, existingGrades = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", nivel_id: "", orden: 0, activo: true });
  const [sectionWarning, setSectionWarning] = useState("");
  const isEdit = !!grade;
  const headers = { Authorization: `Bearer ${token}` };

  // Determine if selected level has preset grades
  const selectedLevel = levels.find(l => l.id === form.nivel_id);
  const levelNameNorm = selectedLevel?.nombre?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "")?.toUpperCase()?.trim() || "";
  const presetGrades = PRESET_GRADES_BY_LEVEL[levelNameNorm] || null;
  const hasPresets = !!presetGrades;

  // Filter out grades that already exist for this level
  const availablePresets = presetGrades
    ? presetGrades.filter(pg => {
        if (isEdit && grade?.nombre?.toUpperCase() === pg.toUpperCase()) return true;
        return !existingGrades.some(eg => eg.nivel_id === form.nivel_id && eg.nombre.toUpperCase() === pg.toUpperCase());
      })
    : [];

  useEffect(() => {
    if (isOpen) {
      setForm(grade ? { nombre: grade.nombre || "", nivel_id: grade.nivel_id || "", orden: grade.orden || 0, activo: grade.activo !== false } : { nombre: "", nivel_id: preselectedLevelId || "", orden: 0, activo: true });
      setError("");
      setSectionWarning("");
    }
  }, [isOpen, grade, preselectedLevelId]);

  // Filter levels: hide standard levels that already have all preset grades created
  const levelsWithAvailableGrades = levels.filter(l => {
    if (!l.activo) return false;
    const norm = l.nombre?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "")?.toUpperCase()?.trim() || "";
    const presets = PRESET_GRADES_BY_LEVEL[norm];
    if (!presets) return true; // Non-standard levels always shown
    const existingForLevel = existingGrades.filter(eg => eg.nivel_id === l.id);
    const allCreated = presets.every(pg => existingForLevel.some(eg => eg.nombre.toUpperCase() === pg.toUpperCase()));
    return !allCreated;
  });

  // Validate name on change (for non-standard levels)
  const handleNameChange = (value) => {
    setForm(p => ({ ...p, nombre: value }));
    if (value.trim() && looksLikeSection(value)) {
      setSectionWarning("Parece que estás incluyendo una sección. Crea el grado sin letras (A, B) ni nombres de aula. Las secciones se crean por separado.");
    } else {
      setSectionWarning("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.nivel_id) { setError("Selecciona un nivel"); return; }
    if (looksLikeSection(form.nombre)) {
      setError("El nombre parece incluir una sección (ej: A, B, Álamo). Crea el grado como '4 AÑOS' y luego agrega la sección desde 'Agregar sección'.");
      return;
    }
    setLoading(true);
    try {
      const res = isEdit ? await axios.put(`${API}/academic/grades/${grade.id}`, form, { headers }) : await axios.post(`${API}/academic/grades`, form, { headers });
      onSuccess(res.data.grade, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" data-testid="grade-modal">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><BookOpen className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Grado</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></div>}
            
            {/* Level selector */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nivel <span className="text-red-500">*</span></label>
              <select value={form.nivel_id} onChange={(e) => { setForm(p => ({ ...p, nivel_id: e.target.value, nombre: "" })); setSectionWarning(""); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required data-testid="grade-level-select">
                <option value="">Seleccionar...</option>
                {levelsWithAvailableGrades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              {levelsWithAvailableGrades.length === 0 && (
                <p className="mt-2 text-sm text-amber-600">Todos los niveles ya tienen sus grados completos.</p>
              )}
            </div>
            
            {/* Grade name - dropdown for INICIAL, text for others */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre del Grado <span className="text-red-500">*</span></label>
              {hasPresets ? (
                <>
                  <select
                    value={form.nombre}
                    onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                    required={availablePresets.length > 0}
                    data-testid="grade-name-select"
                  >
                    <option value="">Seleccionar grado...</option>
                    {availablePresets.map(pg => <option key={pg} value={pg}>{pg}</option>)}
                  </select>
                  {availablePresets.length === 0 && (
                    <p className="mt-2 text-sm text-amber-600">Todos los grados de este nivel ya fueron creados.</p>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl ${sectionWarning ? "border-amber-400" : "border-slate-200"}`}
                  placeholder="Ej: 1°, 2°, 3°"
                  required
                  data-testid="grade-name-input"
                />
              )}
              {sectionWarning && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2" data-testid="section-warning">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{sectionWarning}</span>
                </div>
              )}
            </div>

            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Orden</label><input type="number" value={form.orden} onChange={(e) => setForm(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" min={0} /><p className="text-xs text-slate-500 mt-1">0 = automático</p></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SectionModal({ isOpen, onClose, token, section, grades, levels, onSuccess, preselectedGradeId }) {
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [error, setError] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [sectionTypes, setSectionTypes] = useState([]);
  const [form, setForm] = useState({ section_type_id: "", grado_id: "", capacidad_maxima: "", activo: true });
  const isEdit = !!section;
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch section types catalog when modal opens
  useEffect(() => {
    if (isOpen && token) {
      setLoadingTypes(true);
      axios.get(`${API}/academic/section-types`, { headers })
        .then(res => setSectionTypes(res.data || []))
        .catch(() => setSectionTypes([]))
        .finally(() => setLoadingTypes(false));
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (isOpen) {
      if (section) {
        setForm({ 
          section_type_id: section.section_type_id || "", 
          grado_id: section.grado_id || "", 
          capacidad_maxima: section.capacidad_maxima || "", 
          activo: section.activo !== false 
        });
        setSelectedLevelId(section.nivel_id || "");
      } else {
        const preGrade = grades.find(g => g.id === preselectedGradeId);
        setForm({ section_type_id: "", grado_id: preselectedGradeId || "", capacidad_maxima: "", activo: true });
        setSelectedLevelId(preGrade?.nivel_id || "");
      }
      setError("");
    }
  }, [isOpen, section, preselectedGradeId, grades]);

  const filteredGrades = selectedLevelId ? grades.filter(g => g.nivel_id === selectedLevelId && g.activo) : grades.filter(g => g.activo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.section_type_id) { setError("Selecciona un tipo de sección"); return; }
    if (!form.grado_id) { setError("Selecciona un grado"); return; }
    setLoading(true);
    try {
      const submitData = { 
        section_type_id: form.section_type_id,
        grado_id: form.grado_id,
        capacidad_maxima: form.capacidad_maxima ? parseInt(form.capacidad_maxima) : null,
        activo: form.activo
      };
      const res = isEdit 
        ? await axios.put(`${API}/academic/sections/${section.id}`, submitData, { headers }) 
        : await axios.post(`${API}/academic/sections`, submitData, { headers });
      onSuccess(res.data.section, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><Users className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nueva"} Sección</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></div>}
            
            {/* Filter by Level */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filtrar por Nivel</label>
              <select 
                value={selectedLevelId} 
                onChange={(e) => { setSelectedLevelId(e.target.value); setForm(p => ({ ...p, grado_id: "" })); }} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos los niveles</option>
                {levels.filter(l => l.activo).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            
            {/* Grade selector */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Grado <span className="text-red-500">*</span></label>
              <select 
                value={form.grado_id} 
                onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value }))} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" 
                required
              >
                <option value="">Seleccionar grado...</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>)}
              </select>
            </div>
            
            {/* Section Type selector (NEW - replaces text input) */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tipo de Sección <span className="text-red-500">*</span>
              </label>
              {loadingTypes ? (
                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando tipos...</span>
                </div>
              ) : (
                <select 
                  value={form.section_type_id} 
                  onChange={(e) => setForm(p => ({ ...p, section_type_id: e.target.value }))} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" 
                  required
                  data-testid="section-type-select"
                >
                  <option value="">Seleccionar tipo...</option>
                  {sectionTypes.filter(t => t.activo).map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-500 mt-1">Ej: A, B, C, ÚNICA (del catálogo centralizado)</p>
            </div>
            
            {/* Capacity */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Capacidad máxima</label>
              <input 
                type="number" 
                value={form.capacidad_maxima} 
                onChange={(e) => setForm(p => ({ ...p, capacidad_maxima: e.target.value }))} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" 
                placeholder="Ej: 30" 
                min={1} 
              />
              <p className="text-xs text-slate-500 mt-1">Opcional - Cantidad máxima de estudiantes</p>
            </div>
            
            {/* Status toggle */}
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700">Estado</p>
                <p className="text-sm text-slate-500">{form.activo ? "Activa" : "Inactiva"}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} 
                className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-purple-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} />
              </button>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors">Cancelar</button>
              <button 
                type="submit" 
                disabled={loading || loadingTypes} 
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                data-testid="section-modal-submit"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isEdit ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION TYPES ADMIN MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SectionTypesAdminModal({ isOpen, onClose, token, onTypesUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sectionTypes, setSectionTypes] = useState([]);
  const [newType, setNewType] = useState({ key: "", label: "" });
  const [editingType, setEditingType] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  // Load section types when modal opens
  useEffect(() => {
    if (isOpen && token) {
      loadSectionTypes();
    }
  }, [isOpen, token]);

  const loadSectionTypes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/academic/section-types`, { headers });
      setSectionTypes(res.data || []);
    } catch (err) {
      setError("Error al cargar tipos de sección");
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newType.key.trim() || !newType.label.trim()) {
      setError("La clave y etiqueta son obligatorias");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(`${API}/academic/section-types`, {
        key: newType.key.toUpperCase(),
        label: newType.label
      }, { headers });
      setSectionTypes(prev => [...prev, res.data.section_type]);
      setNewType({ key: "", label: "" });
      setSuccess("Tipo agregado correctamente");
      setTimeout(() => setSuccess(""), 3000);
      if (onTypesUpdated) onTypesUpdated();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear tipo");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateType = async (typeId, updates) => {
    setSaving(true);
    setError("");
    try {
      const res = await axios.put(`${API}/academic/section-types/${typeId}`, updates, { headers });
      setSectionTypes(prev => prev.map(t => t.id === typeId ? res.data.section_type : t));
      setEditingType(null);
      setSuccess("Tipo actualizado correctamente");
      setTimeout(() => setSuccess(""), 3000);
      if (onTypesUpdated) onTypesUpdated();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al actualizar tipo");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (type) => {
    await handleUpdateType(type.id, { activo: !type.activo });
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newOrder = [...sectionTypes];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await reorderTypes(newOrder);
  };

  const handleMoveDown = async (index) => {
    if (index === sectionTypes.length - 1) return;
    const newOrder = [...sectionTypes];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await reorderTypes(newOrder);
  };

  const reorderTypes = async (newOrder) => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/academic/section-types/reorder`, {
        order: newOrder.map(t => t.id)
      }, { headers });
      setSectionTypes(res.data.section_types);
      setSuccess("Orden actualizado");
      setTimeout(() => setSuccess(""), 3000);
      if (onTypesUpdated) onTypesUpdated();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al reordenar");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">Administrar Tipos de Sección</h2>
                <p className="text-sm text-white/80">Catálogo centralizado</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Add new type form */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Agregar nuevo tipo
              </h3>
              <form onSubmit={handleAddType} className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newType.key}
                    onChange={(e) => setNewType(p => ({ ...p, key: e.target.value.toUpperCase() }))}
                    placeholder="Clave (ej: G)"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    maxLength={10}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={newType.label}
                    onChange={(e) => setNewType(p => ({ ...p, label: e.target.value }))}
                    placeholder="Etiqueta visible (ej: G)"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !newType.key.trim() || !newType.label.trim()}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Agregar
                </button>
              </form>
            </div>

            {/* Types list */}
            <div className="mb-4">
              <h3 className="font-semibold text-slate-700 mb-3">Tipos existentes ({sectionTypes.length})</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : sectionTypes.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No hay tipos de sección configurados</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sectionTypes.map((type, index) => (
                    <div
                      key={type.id}
                      className={`flex items-center gap-3 p-3 bg-white border rounded-xl transition-all ${
                        type.activo ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"
                      }`}
                    >
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || saving}
                          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === sectionTypes.length - 1 || saving}
                          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>

                      {/* Order number */}
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                        {type.orden || index + 1}
                      </span>

                      {/* Type info */}
                      <div className="flex-1 min-w-0">
                        {editingType === type.id ? (
                          <input
                            type="text"
                            defaultValue={type.label}
                            className="w-full px-2 py-1 border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUpdateType(type.id, { label: e.target.value });
                              } else if (e.key === "Escape") {
                                setEditingType(null);
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value !== type.label) {
                                handleUpdateType(type.id, { label: e.target.value });
                              } else {
                                setEditingType(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{type.label}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              key: {type.key}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        type.activo 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-slate-200 text-slate-500"
                      }`}>
                        {type.activo ? "Activo" : "Inactivo"}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingType(type.id)}
                          className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-blue-500"
                          title="Editar etiqueta"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(type)}
                          disabled={saving}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            type.activo 
                              ? "hover:bg-amber-50 text-amber-500" 
                              : "hover:bg-emerald-50 text-emerald-500"
                          }`}
                          title={type.activo ? "Desactivar" : "Activar"}
                        >
                          {type.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info note */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Nota importante</p>
                  <p>Los tipos desactivados no aparecerán al crear nuevas secciones. No se pueden desactivar tipos que ya están en uso por secciones existentes.</p>
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHIFT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ShiftModal({ isOpen, onClose, token, shift, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", hora_inicio: "07:00", hora_fin: "12:00", color: "#3B82F6", activo: true });
  const isEdit = !!shift;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      setForm(shift ? { nombre: shift.nombre || "", hora_inicio: shift.hora_inicio || "07:00", hora_fin: shift.hora_fin || "12:00", color: shift.color || "#3B82F6", activo: shift.activo !== false } : { nombre: "", hora_inicio: "07:00", hora_fin: "12:00", color: "#3B82F6", activo: true });
      setError("");
    }
  }, [isOpen, shift]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (form.hora_inicio >= form.hora_fin) { setError("La hora de inicio debe ser menor que la hora de fin"); return; }
    setLoading(true);
    try {
      const res = isEdit ? await axios.put(`${API}/academic/shifts/${shift.id}`, form, { headers }) : await axios.post(`${API}/academic/shifts`, form, { headers });
      onSuccess(res.data.shift, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><Clock className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Turno</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: Mañana" required /></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Hora inicio <span className="text-red-500">*</span></label><input type="time" value={form.hora_inicio} onChange={(e) => setForm(p => ({ ...p, hora_inicio: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Hora fin <span className="text-red-500">*</span></label><input type="time" value={form.hora_fin} onChange={(e) => setForm(p => ({ ...p, hora_fin: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
            </div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Color</label><div className="flex flex-wrap gap-2">{SHIFT_COLORS.map(c => <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, color: c.value }))} className={`w-10 h-10 rounded-xl ${c.class} ${form.color === c.value ? "ring-2 ring-offset-2 ring-slate-400" : ""}`} />)}</div></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-amber-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PERIOD MODAL
// ══════════════════════════════════════════════════════════════════════════════
function PeriodModal({ isOpen, onClose, token, period, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", fecha_inicio: "", fecha_fin: "", activo: false });
  const isEdit = !!period;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (period) {
        setForm({
          nombre: period.nombre || "",
          fecha_inicio: period.fecha_inicio || "",
          fecha_fin: period.fecha_fin || "",
          activo: period.activo || false
        });
      } else {
        // Set default dates for new period (current year)
        const now = new Date();
        const year = now.getFullYear();
        setForm({
          nombre: "",
          fecha_inicio: `${year}-03-01`,
          fecha_fin: `${year}-07-31`,
          activo: false
        });
      }
      setError("");
    }
  }, [isOpen, period]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.fecha_inicio) { setError("La fecha de inicio es obligatoria"); return; }
    if (!form.fecha_fin) { setError("La fecha de fin es obligatoria"); return; }
    if (form.fecha_inicio >= form.fecha_fin) { 
      setError("La fecha de inicio debe ser anterior a la fecha de fin"); 
      return; 
    }
    setLoading(true);
    try {
      const res = isEdit 
        ? await axios.put(`${API}/academic/periods/${period.id}`, form, { headers }) 
        : await axios.post(`${API}/academic/periods`, form, { headers });
      onSuccess(res.data.period, isEdit ? "update" : "create", res.data.deactivated_period);
      onClose();
    } catch (err) { 
      setError(err.response?.data?.detail || "Error al guardar"); 
    }
    finally { setLoading(false); }
  };

  // Format date for display
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Período</h2>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={form.nombre} 
                onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" 
                placeholder="Ej: Bimestre I - 2025" 
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fecha inicio <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.fecha_inicio} 
                  onChange={(e) => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" 
                  required 
                />
                {form.fecha_inicio && (
                  <p className="text-xs text-slate-500 mt-1">{formatDateLabel(form.fecha_inicio)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fecha fin <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.fecha_fin} 
                  onChange={(e) => setForm(p => ({ ...p, fecha_fin: e.target.value }))} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" 
                  required 
                />
                {form.fecha_fin && (
                  <p className="text-xs text-slate-500 mt-1">{formatDateLabel(form.fecha_fin)}</p>
                )}
              </div>
            </div>

            {/* Warning about activation */}
            {!isEdit && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Nota sobre activación</p>
                    <p>Solo puede haber un período activo a la vez. Si activas este período al crearlo, el período actual será desactivado automáticamente.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700">Activar período</p>
                <p className="text-sm text-slate-500">
                  {form.activo ? "Este será el período activo" : "Crear como inactivo"}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} 
                className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-indigo-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} />
              </button>
            </div>
            
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isEdit ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademicSettingsPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Data states
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [sectionStudentCounts, setSectionStudentCounts] = useState({});
  // Tutor management (Fase 2 - Libreta)
  const [tutorsBySection, setTutorsBySection] = useState({});
  const [teachersList, setTeachersList] = useState([]);
  const [tutorModalOpen, setTutorModalOpen] = useState(false);
  const [tutorTarget, setTutorTarget] = useState(null);
  const [tutorSelectedId, setTutorSelectedId] = useState("");
  const [tutorSaving, setTutorSaving] = useState(false);

  // Computed: students per grade and per level (from section counts)
  const gradeStudentCounts = {};
  const gradeSectionCounts = {};
  sections.forEach(s => {
    if (!gradeSectionCounts[s.grado_id]) gradeSectionCounts[s.grado_id] = 0;
    gradeSectionCounts[s.grado_id]++;
    if (!gradeStudentCounts[s.grado_id]) gradeStudentCounts[s.grado_id] = 0;
    gradeStudentCounts[s.grado_id] += (sectionStudentCounts[s.id] || 0);
  });
  const levelSectionCounts = {};
  const levelStudentCounts = {};
  grades.forEach(g => {
    if (!levelSectionCounts[g.nivel_id]) levelSectionCounts[g.nivel_id] = 0;
    if (!levelStudentCounts[g.nivel_id]) levelStudentCounts[g.nivel_id] = 0;
    levelSectionCounts[g.nivel_id] += (gradeSectionCounts[g.id] || 0);
    levelStudentCounts[g.nivel_id] += (gradeStudentCounts[g.id] || 0);
  });
  
  // Modal states
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showSectionTypesAdmin, setShowSectionTypesAdmin] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  
  // Activation modal for periods
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activatingPeriod, setActivatingPeriod] = useState(null);
  const [activateLoading, setActivateLoading] = useState(false);
  
  // Info modal for showing messages
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState({ title: "", message: "" });
  
  // Menu states
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("");
  const [preselectedGradeForSection, setPreselectedGradeForSection] = useState(null);
  
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Diagnóstico (solo lectura)
  const isSupportSession = user?.is_support_session || user?.original_role === "system_admin_global";
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState("");
  const [diagMismatches, setDiagMismatches] = useState(null);
  const [diagDups, setDiagDups] = useState(null);

  const loadDiagnostics = async () => {
    setDiagLoading(true);
    setDiagError("");
    try {
      const [misRes, dupRes] = await Promise.all([
        axios.get(`${API}/admin/data-integrity/section-mismatches`, { headers }),
        axios.get(`${API}/admin/data-integrity/duplicates`, { headers }),
      ]);
      setDiagMismatches(misRes.data);
      setDiagDups(dupRes.data);
    } catch (err) {
      setDiagError(err.response?.data?.detail || "No se pudo cargar el diagnóstico");
    } finally {
      setDiagLoading(false);
    }
  };

  const [fixingKey, setFixingKey] = useState(null);
  const [fixingAll, setFixingAll] = useState(false);

  const fixOneMismatch = async (m) => {
    const target = m.assignment_section?.section_id;
    if (!target) return false;
    try {
      await axios.post(`${API}/admin/data-integrity/fix-section-mismatch`,
        { subject_id: m.subject_id, target_section_id: target }, { headers });
      return true;
    } catch (err) {
      setDiagError(err.response?.data?.detail || "No se pudo corregir el curso");
      return false;
    }
  };

  const handleFixOne = async (m, idx) => {
    setFixingKey(idx);
    const ok = await fixOneMismatch(m);
    setFixingKey(null);
    if (ok) await loadDiagnostics();
  };

  const handleFixAll = async () => {
    const list = diagMismatches?.mismatches || [];
    if (list.length === 0) return;
    if (!window.confirm(`¿Corregir los ${list.length} cursos cruzados? Cada curso se vinculará a la sección de la asignación del profesor (se migran sus notas).`)) return;
    setFixingAll(true);
    for (const m of list) {
      // eslint-disable-next-line no-await-in-loop
      await fixOneMismatch(m);
    }
    setFixingAll(false);
    await loadDiagnostics();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, levelsRes, gradesRes, sectionsRes, shiftsRes, periodsRes] = await Promise.all([
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/academic/levels`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/shifts`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/periods`, { headers }).catch(() => ({ data: [] }))
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        setLevels(levelsRes.data || []);
        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setShifts(shiftsRes.data || []);
        setPeriods(periodsRes.data || []);
        // Load student counts per section
        const secs = sectionsRes.data || [];
        if (secs.length > 0) {
          const counts = {};
          await Promise.all(secs.map(async (s) => {
            try {
              const r = await axios.get(`${API}/academic/sections/${s.id}/students-count`, { headers });
              counts[s.id] = r.data?.count || 0;
            } catch { counts[s.id] = 0; }
          }));
          setSectionStudentCounts(counts);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  // Reload data when category changes (to ensure fresh data)
  useEffect(() => {
    if (selectedCategory === "secciones") loadSections();
    if (selectedCategory === "turnos") loadShifts();
  }, [selectedCategory]);

  const loadSections = async () => {
    try {
      const res = await axios.get(`${API}/academic/sections`, { headers });
      setSections(res.data);
      // Cargar tutores en paralelo
      const tutorPairs = await Promise.all(
        (res.data || []).map(async (s) => {
          try {
            const r = await axios.get(`${API}/sections/${s.id}/tutor`, { headers });
            return [s.id, r.data?.tutor || null];
          } catch { return [s.id, null]; }
        })
      );
      setTutorsBySection(Object.fromEntries(tutorPairs));
      // Cargar lista de profesores
      try {
        const tRes = await axios.get(`${API}/users?role=teacher`, { headers });
        const items = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.users || tRes.data?.items || []);
        setTeachersList(items);
      } catch { setTeachersList([]); }
    } catch (err) { console.error(err); }
  };

  const openTutorModal = (section) => {
    setTutorTarget(section);
    setTutorSelectedId(tutorsBySection[section.id]?.id || "");
    setTutorModalOpen(true);
  };

  const saveTutor = async (clearTutor = false) => {
    if (!tutorTarget) return;
    setTutorSaving(true);
    try {
      await axios.put(
        `${API}/sections/${tutorTarget.id}/tutor`,
        { teacher_id: clearTutor ? null : (tutorSelectedId || null) },
        { headers }
      );
      // recargar SOLO los tutores
      const r = await axios.get(`${API}/sections/${tutorTarget.id}/tutor`, { headers });
      setTutorsBySection(prev => ({ ...prev, [tutorTarget.id]: r.data?.tutor || null }));
      setTutorModalOpen(false);
      setTutorTarget(null);
      setTutorSelectedId("");
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar tutor");
    } finally {
      setTutorSaving(false);
    }
  };
  const loadShifts = async () => {
    try { const res = await axios.get(`${API}/academic/shifts`, { headers }); setShifts(res.data); } catch (err) { console.error(err); }
  };
  const loadPeriods = async () => {
    try { const res = await axios.get(`${API}/academic/periods`, { headers }); setPeriods(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const handleClick = () => setMenuOpen(null);
    if (menuOpen) { document.addEventListener("click", handleClick); return () => document.removeEventListener("click", handleClick); }
  }, [menuOpen]);

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  // Success handlers
  const handleLevelSuccess = (level, action, createdGrades = []) => { if (action === "create") { setLevels(p => [...p, level]); if (createdGrades.length > 0) setGrades(p => [...p, ...createdGrades]); } else setLevels(p => p.map(l => l.id === level.id ? level : l)); };
  const handleGradeSuccess = (grade, action) => {
    if (action === "create") { setGrades(p => [...p, grade]); setLevels(p => p.map(l => l.id === grade.nivel_id ? { ...l, grade_count: (l.grade_count || 0) + 1 } : l)); }
    else setGrades(p => p.map(g => g.id === grade.id ? grade : g));
  };
  const handleSectionSuccess = (section, action) => {
    if (action === "create") { setSections(p => [...p, section]); setGrades(p => p.map(g => g.id === section.grado_id ? { ...g, section_count: (g.section_count || 0) + 1 } : g)); }
    else setSections(p => p.map(s => s.id === section.id ? section : s));
  };
  const handleShiftSuccess = (shift, action) => { if (action === "create") setShifts(p => [...p, shift]); else setShifts(p => p.map(s => s.id === shift.id ? shift : s)); };
  
  const handlePeriodSuccess = (period, action, deactivatedPeriodName) => {
    if (action === "create") {
      setPeriods(p => [period, ...p]); // Add at beginning (sorted by fecha_inicio desc)
      // If another period was deactivated, update it
      if (deactivatedPeriodName) {
        setPeriods(p => p.map(per => per.nombre === deactivatedPeriodName ? { ...per, activo: false } : per));
        setInfoModalMessage({
          title: "Período creado",
          message: `El período "${period.nombre}" ha sido creado y activado. El período "${deactivatedPeriodName}" ha sido desactivado automáticamente.`
        });
        setShowInfoModal(true);
      }
    } else {
      setPeriods(p => p.map(per => per.id === period.id ? period : per));
      if (deactivatedPeriodName) {
        setPeriods(p => p.map(per => per.nombre === deactivatedPeriodName ? { ...per, activo: false } : per));
        setInfoModalMessage({
          title: "Período actualizado",
          message: `El período "${period.nombre}" ha sido activado. El período "${deactivatedPeriodName}" ha sido desactivado automáticamente.`
        });
        setShowInfoModal(true);
      }
    }
  };

  // Activate period handler
  const handleActivatePeriod = async () => {
    if (!activatingPeriod) return;
    setActivateLoading(true);
    try {
      const res = await axios.post(`${API}/academic/periods/${activatingPeriod.id}/activate`, {}, { headers });
      // Update local state
      setPeriods(p => p.map(per => ({
        ...per,
        activo: per.id === activatingPeriod.id
      })));
      setShowActivateModal(false);
      setActivatingPeriod(null);
      // Show info message if another period was deactivated
      if (res.data.deactivated_period) {
        setInfoModalMessage({
          title: "Período activado",
          message: res.data.message
        });
        setShowInfoModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error al activar período");
    } finally {
      setActivateLoading(false);
    }
  };

  // Delete handlers
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/academic/${deleteTarget.type}s/${deleteTarget.item.id}`, { headers });
      if (deleteTarget.type === "level") setLevels(p => p.filter(l => l.id !== deleteTarget.item.id));
      else if (deleteTarget.type === "grade") { setGrades(p => p.filter(g => g.id !== deleteTarget.item.id)); setLevels(p => p.map(l => l.id === deleteTarget.item.nivel_id ? { ...l, grade_count: Math.max(0, (l.grade_count || 1) - 1) } : l)); }
      else if (deleteTarget.type === "section") { setSections(p => p.filter(s => s.id !== deleteTarget.item.id)); setGrades(p => p.map(g => g.id === deleteTarget.item.grado_id ? { ...g, section_count: Math.max(0, (g.section_count || 1) - 1) } : g)); }
      else if (deleteTarget.type === "shift") setShifts(p => p.filter(s => s.id !== deleteTarget.item.id));
      else if (deleteTarget.type === "period") setPeriods(p => p.filter(per => per.id !== deleteTarget.item.id));
      setShowDeleteModal(false); setDeleteTarget(null);
    } catch (err) { alert(err.response?.data?.detail || "Error al eliminar"); }
    finally { setDeleteLoading(false); }
  };

  const openDelete = (type, item) => { setDeleteTarget({ type, item }); setShowDeleteModal(true); setMenuOpen(null); };

  // Categories grid
  const renderCategoriesGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {ACADEMIC_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = cat.id === "niveles" ? levels.length : cat.id === "grados" ? grades.length : cat.id === "secciones" ? sections.length : cat.id === "turnos" ? shifts.length : 0;
        return (
          <button key={cat.id} onClick={() => !cat.disabled && setSelectedCategory(cat.id)} disabled={cat.disabled} className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${cat.borderColor} bg-gradient-to-br ${cat.lightColor} ${cat.disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${cat.color} opacity-10`} />
            {cat.disabled && <div className="absolute top-3 right-3 px-2 py-1 bg-slate-200 text-slate-500 text-xs font-medium rounded-full">Próximamente</div>}
            <div className="relative z-10">
              <div className="flex justify-center mb-4"><div className={`w-20 h-20 rounded-2xl bg-white shadow-lg p-4 border-2 ${cat.borderColor}`}><Icon className={`w-full h-full ${cat.textColor}`} /></div></div>
              <h3 className={`text-xl font-bold text-center mb-2 ${cat.textColor}`}>{cat.label}</h3>
              <div className="flex justify-center"><span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border ${cat.borderColor} ${cat.textColor} font-medium text-sm`}><span className={`w-2 h-2 rounded-full bg-gradient-to-r ${cat.color}`}></span>{cat.disabled ? cat.description : `${count} registros`}</span></div>
              {!cat.disabled && <div className="flex justify-center mt-4"><div className={`w-10 h-10 rounded-full bg-gradient-to-r ${cat.color} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0`}><ChevronRight className="w-5 h-5 text-white" /></div></div>}
            </div>
          </button>
        );
      })}
      
      {/* Special card for Academic Years - redirects to dedicated page */}
      <button 
        onClick={() => {
          const basePath = subdomain ? `/${subdomain}` : "";
          navigate(`${basePath}/anos-academicos`);
        }}
        className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 opacity-0 group-hover:opacity-10 transition-opacity" />
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 opacity-10" />
        <div className="absolute top-3 right-3 px-2 py-1 bg-indigo-100 text-indigo-600 text-xs font-bold rounded-full flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          Ir al módulo
        </div>
        <div className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-lg p-4 border-2 border-indigo-200">
              <Calendar className="w-full h-full text-indigo-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-center mb-2 text-indigo-600">Años y Períodos</h3>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-indigo-200 text-indigo-600 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600"></span>
              Gestión centralizada
            </span>
          </div>
          <div className="flex justify-center mt-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </button>

      {/* Diagnóstico (solo lectura): SOLO visible en sesión de soporte técnico */}
      {isSupportSession && (
      <button
        onClick={() => { setSelectedCategory("diagnostico"); loadDiagnostics(); }}
        className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50"
        data-testid="diagnostico-card"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-orange-600 opacity-0 group-hover:opacity-10 transition-opacity" />
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-rose-500 to-orange-600 opacity-10" />
        <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Solo soporte</div>
        <div className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-lg p-4 border-2 border-rose-200">
              <Stethoscope className="w-full h-full text-rose-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-center mb-2 text-rose-600">Diagnóstico</h3>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-rose-200 text-rose-600 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-600"></span>
              Secciones cruzadas / duplicadas
            </span>
          </div>
          <div className="flex justify-center mt-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-orange-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </button>
      )}
    </div>
  );

  // Diagnóstico render (solo lectura)
  const renderDiagnostico = () => {
    const mismatchList = diagMismatches?.mismatches || [];
    const dupSections = diagDups?.duplicate_sections || [];
    const allClean = !diagLoading && mismatchList.length === 0 && dupSections.length === 0;
    return (
      <div data-testid="diagnostico-view">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 group">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200"><ArrowLeft className="w-4 h-4" /></div>
          <span className="font-medium">Volver</span>
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Diagnóstico de integridad</h2>
            <p className="text-sm text-slate-500">Solo lectura — no modifica nada. Detecta cursos con sección cruzada y secciones duplicadas.</p>
          </div>
          <button onClick={loadDiagnostics} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 font-medium" data-testid="diagnostico-refresh">Actualizar</button>
        </div>

        {diagLoading && (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        )}
        {diagError && !diagLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{diagError}</div>
        )}

        {!diagLoading && !diagError && (
          <div className="space-y-6">
            {allClean && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3" data-testid="diagnostico-clean">
                <Check className="w-5 h-5 text-emerald-600" />
                <span className="text-sm text-emerald-800 font-medium">No se detectaron secciones cruzadas ni duplicadas. Tu data está limpia.</span>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-800">Cursos con sección cruzada</h3>
                <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700" data-testid="diagnostico-mismatch-count">{mismatchList.length}</span>
                {mismatchList.length > 0 && (
                  <button
                    onClick={handleFixAll}
                    disabled={fixingAll || fixingKey !== null}
                    className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1.5"
                    data-testid="diagnostico-fix-all"
                  >
                    {fixingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Corregir todos
                  </button>
                )}
              </div>
              {mismatchList.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-400">No hay cursos con la sección cruzada. ✅</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  <p className="px-5 pt-3 text-xs text-slate-500">El profesor ya ve la lista correcta (se corrige solo). "Corregir" vincula el curso a la sección de la asignación del profesor (verde) y migra sus notas. Recomendado.</p>
                  {mismatchList.map((m, i) => (
                    <div key={i} className="px-5 py-3" data-testid={`diagnostico-mismatch-${i}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{m.subject_name}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-sm text-slate-600">{m.teacher_name || "Sin docente"}</span>
                        <button
                          onClick={() => handleFixOne(m, i)}
                          disabled={fixingAll || fixingKey !== null}
                          className="ml-auto px-3 py-1 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-1.5"
                          data-testid={`diagnostico-fix-${i}`}
                        >
                          {fixingKey === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Corregir
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-emerald-50 rounded-lg px-3 py-2">
                          <span className="text-emerald-700 font-semibold">Asignación (profesor): </span>
                          {m.assignment_section?.grade_name || "?"} – {m.assignment_section?.nombre || "?"}
                          <span className="text-slate-500"> ({m.assignment_section?.student_count} alumnos)</span>
                        </div>
                        <div className="bg-rose-50 rounded-lg px-3 py-2">
                          <span className="text-rose-700 font-semibold">Curso apunta a: </span>
                          {m.subject_section?.exists
                            ? <>{m.subject_section?.grade_name || "?"} – {m.subject_section?.nombre || "?"} <span className="text-slate-500">({m.subject_section?.student_count} alumnos)</span></>
                            : <span className="text-slate-500">sección inexistente</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-slate-800">Secciones duplicadas</h3>
                <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700" data-testid="diagnostico-dup-count">{dupSections.length}</span>
              </div>
              {dupSections.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-400">No hay secciones duplicadas. ✅</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dupSections.map((g, i) => (
                    <div key={i} className="px-5 py-3" data-testid={`diagnostico-dup-${i}`}>
                      <p className="font-semibold text-slate-800 mb-1">
                        {g.level_name} · {g.grade_name} · Sección {g.nombre}
                        <span className="text-xs text-slate-400 font-normal"> — {g.count} documentos duplicados</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {g.sections.map((s, j) => (
                          <span key={j} className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 text-slate-600">
                            {s.student_count} alumnos · {s.subject_count} cursos · {s.assignment_count} asignaciones
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Section header component
  const SectionHeader = ({ category, count, countLabel, onAdd, addLabel }) => (
    <div className={`relative overflow-hidden bg-gradient-to-r ${category.color} text-white rounded-3xl p-8 mb-8 shadow-xl`}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="relative z-10">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-white/80 hover:text-white mb-6 group"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30"><ArrowLeft className="w-4 h-4" /></div><span className="font-medium">Volver</span></button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center"><category.icon className={`w-14 h-14 ${category.textColor}`} /></div>
            <div><h1 className="text-4xl font-bold mb-2">{category.label}</h1><span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium">{count} {countLabel}</span></div>
          </div>
          {onAdd && <button onClick={onAdd} className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:shadow-xl"><div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center`}><Plus className="w-5 h-5 text-white" /></div><span>{addLabel}</span></button>}
        </div>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = ({ category, message, onAdd, addLabel }) => (
    <div className={`relative overflow-hidden bg-gradient-to-br ${category.lightColor} rounded-3xl p-16 text-center border-2 ${category.borderColor}`}>
      <div className="relative z-10">
        <div className={`w-32 h-32 mx-auto mb-6 bg-white rounded-3xl shadow-lg p-6 border-2 ${category.borderColor}`}><category.icon className={`w-full h-full ${category.textColor} opacity-50`} /></div>
        <h3 className={`text-2xl font-bold ${category.textColor} mb-2`}>Sin {category.label.toLowerCase()}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{message}</p>
        {onAdd && <button onClick={onAdd} className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${category.color} text-white rounded-xl font-semibold hover:shadow-xl`}><Plus className="w-5 h-5" />{addLabel}</button>}
      </div>
    </div>
  );

  // Item card component with menu
  const ItemCard = ({ item, category, onEdit, onDelete, children, badge, canDelete = true }) => (
    <div className={`group relative overflow-hidden bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border-2 ${category.borderColor} hover:-translate-y-1`}>
      <div className={`h-2 bg-gradient-to-r ${category.color}`}></div>
      <div className="p-6 relative">
        <div className="absolute top-3 right-3">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === item.id ? null : item.id); }} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><MoreVertical className="w-5 h-5" /></button>
          {menuOpen === item.id && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border py-2 min-w-[170px] z-10">
              <button onClick={() => { onEdit(item); setMenuOpen(null); }} className="w-full px-4 py-3 text-left text-base text-slate-700 hover:bg-slate-50 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center"><Pencil className="w-5 h-5 text-blue-600" /></div>Editar</button>
              {canDelete && <button onClick={() => onDelete(item)} className="w-full px-4 py-3 text-left text-base text-red-600 hover:bg-red-50 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>Eliminar</button>}
            </div>
          )}
        </div>
        {children}
        <div className={`mt-4 pt-4 border-t ${category.borderColor} flex items-center justify-between`}>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${item.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`w-2 h-2 rounded-full ${item.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>{item.activo ? "Activo" : "Inactivo"}</span>
          {badge}
        </div>
      </div>
    </div>
  );

  // Niveles section
  const renderNiveles = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "niveles");
    return (
      <div>
        <SectionHeader category={cat} count={levels.length} countLabel={levels.length === 1 ? "nivel" : "niveles"} onAdd={() => { setEditingLevel(null); setShowLevelModal(true); }} addLabel="Nuevo Nivel" />
        {levels.length === 0 ? <EmptyState category={cat} message="Crea el primer nivel para comenzar." onAdd={() => { setEditingLevel(null); setShowLevelModal(true); }} addLabel="Crear nivel" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map(level => (
              <ItemCard key={level.id} item={level} category={cat} onEdit={(l) => { setEditingLevel(l); setShowLevelModal(true); }} onDelete={(l) => openDelete("level", l)} canDelete={(level.grade_count || 0) === 0}>
                <div className="flex flex-col items-center text-center mb-2">
                  <div className={`w-24 h-24 rounded-2xl overflow-hidden border-2 ${cat.borderColor} shadow-lg mb-4 bg-gradient-to-br ${cat.lightColor}`}>
                    {level.imagen_url ? <img src={level.imagen_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className={`w-12 h-12 ${cat.textColor}`} /></div>}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">{level.nombre}</h3>
                  {level.descripcion && <p className="text-base text-slate-500 line-clamp-2 mt-1">{level.descripcion}</p>}
                </div>
                <div className="flex flex-wrap gap-2.5 justify-center mt-4 pt-4 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold"><Layers className="w-4 h-4" />{level.grade_count || 0} grados</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-sm font-semibold"><BookOpen className="w-4 h-4" />{levelSectionCounts[level.id] || 0} secciones</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold"><Users className="w-4 h-4" />{levelStudentCounts[level.id] || 0} estudiantes</span>
                </div>
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Grados section
  const renderGrados = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "grados");
    const filteredGrades = selectedLevelFilter ? grades.filter(g => g.nivel_id === selectedLevelFilter) : grades;
    const gradesByLevel = {};
    filteredGrades.forEach(g => { if (!gradesByLevel[g.nivel_id]) gradesByLevel[g.nivel_id] = { nivel_nombre: g.nivel_nombre, grades: [] }; gradesByLevel[g.nivel_id].grades.push(g); });
    
    // Sort levels by orden field from levels array
    const sortedLevelEntries = Object.entries(gradesByLevel).sort((a, b) => {
      const levelA = levels.find(l => l.id === a[0]);
      const levelB = levels.find(l => l.id === b[0]);
      return (levelA?.orden || 99) - (levelB?.orden || 99);
    });

    // Check if there are any available grades to create across all levels
    const hasAvailableGrades = levels.some(l => {
      if (!l.activo) return false;
      const norm = l.nombre?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "")?.toUpperCase()?.trim() || "";
      const presets = PRESET_GRADES_BY_LEVEL[norm];
      if (!presets) return true; // Non-standard levels can always add
      const existingForLevel = grades.filter(g => g.nivel_id === l.id);
      return !presets.every(pg => existingForLevel.some(g => g.nombre.toUpperCase() === pg.toUpperCase()));
    });

    return (
      <div>
        <SectionHeader category={cat} count={grades.length} countLabel={grades.length === 1 ? "grado" : "grados"} onAdd={hasAvailableGrades ? () => { setEditingGrade(null); setShowGradeModal(true); } : null} addLabel="Nuevo Grado" />
        {levels.length > 0 && <div className="mb-6 flex flex-wrap gap-2"><button onClick={() => setSelectedLevelFilter("")} className={`px-4 py-2 rounded-xl font-medium transition-all ${!selectedLevelFilter ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>Todos</button>{levels.filter(l => l.activo).map(l => <button key={l.id} onClick={() => setSelectedLevelFilter(l.id)} className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedLevelFilter === l.id ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>{l.nombre}</button>)}</div>}
        {sortedLevelEntries.length === 0 ? <EmptyState category={cat} message={levels.length === 0 ? "Primero crea un nivel educativo." : "Crea el primer grado."} onAdd={levels.length > 0 ? () => { setEditingGrade(null); setShowGradeModal(true); } : null} addLabel="Crear grado" /> : (
          <div className="space-y-8">
            {sortedLevelEntries.map(([nivelId, data]) => (
              <div key={nivelId}>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-blue-500" />{data.nivel_nombre}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {data.grades.map(g => (
                    <div key={g.id} className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border-2 ${cat.borderColor} hover:-translate-y-1 overflow-hidden`}>
                      <div className={`h-2 bg-gradient-to-r ${cat.color}`}></div>
                      <div className="p-6 relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === g.id ? null : g.id); }} className="absolute top-3 right-3 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 z-10"><MoreVertical className="w-5 h-5" /></button>
                        {menuOpen === g.id && <div className="absolute right-0 top-14 bg-white rounded-xl shadow-2xl border py-2 min-w-[160px] z-20"><button onClick={() => { setEditingGrade(g); setShowGradeModal(true); setMenuOpen(null); }} className="w-full px-4 py-3 text-left text-base hover:bg-slate-50 flex items-center gap-3"><Pencil className="w-5 h-5 text-blue-500" />Editar</button>{sections.filter(s => s.grado_id === g.id).length === 0 && <button onClick={() => openDelete("grade", g)} className="w-full px-4 py-3 text-left text-base text-red-600 hover:bg-red-50 flex items-center gap-3"><Trash2 className="w-5 h-5" />Eliminar</button>}</div>}
                        <div className="text-center pt-2">
                          <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${cat.lightColor} border-2 ${cat.borderColor} flex items-center justify-center`}>
                            <GraduationCap className={`w-10 h-10 ${cat.textColor}`} />
                          </div>
                          <h4 className="text-xl font-bold text-slate-800 truncate px-1 mb-2" title={g.nombre}>{g.nombre}</h4>
                          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 truncate max-w-full" title={data.nivel_nombre}>
                            {data.nivel_nombre}
                          </span>
                          <div className="mt-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${g.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              <span className={`w-2 h-2 rounded-full ${g.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                              {g.activo ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center mt-3 pt-3 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-sm font-semibold">{gradeSectionCounts[g.id] || 0} secciones</span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold"><Users className="w-4 h-4" />{gradeStudentCounts[g.id] || 0} estudiantes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const lvl = levels.find(l => l.id === nivelId);
                    const norm = lvl?.nombre?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "")?.toUpperCase()?.trim() || "";
                    const presets = PRESET_GRADES_BY_LEVEL[norm];
                    if (presets) {
                      const allCreated = presets.every(pg => data.grades.some(g => g.nombre.toUpperCase() === pg.toUpperCase()));
                      if (allCreated) return null;
                    }
                    return <button onClick={() => { setEditingGrade(null); setShowGradeModal(true); }} className={`rounded-2xl border-2 border-dashed ${cat.borderColor} hover:border-emerald-400 hover:bg-emerald-50 p-6 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600 min-h-[200px]`}><Plus className="w-8 h-8 mb-2" /><span className="text-base font-medium">Agregar</span></button>;
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Secciones section
  const renderSecciones = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "secciones");
    const filteredSections = selectedLevelFilter ? sections.filter(s => s.nivel_id === selectedLevelFilter) : sections;
    const sectionsByGrade = {};
    filteredSections.forEach(s => { const key = `${s.nivel_id}-${s.grado_id}`; if (!sectionsByGrade[key]) sectionsByGrade[key] = { nivel_nombre: s.nivel_nombre, grado_nombre: s.grado_nombre, grado_id: s.grado_id, sections: [] }; sectionsByGrade[key].sections.push(s); });

    return (
      <div>
        <SectionHeader category={cat} count={sections.length} countLabel={sections.length === 1 ? "sección" : "secciones"} onAdd={() => { setEditingSection(null); setPreselectedGradeForSection(null); setShowSectionModal(true); }} addLabel="Nueva Sección" />
        
        {/* Filters and Admin button */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {levels.length > 0 && (
              <>
                <button onClick={() => setSelectedLevelFilter("")} className={`px-4 py-2 rounded-xl font-medium transition-all ${!selectedLevelFilter ? "bg-purple-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>Todos</button>
                {levels.filter(l => l.activo).map(l => (
                  <button key={l.id} onClick={() => setSelectedLevelFilter(l.id)} className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedLevelFilter === l.id ? "bg-purple-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>{l.nombre}</button>
                ))}
              </>
            )}
          </div>
          <button 
            onClick={() => setShowSectionTypesAdmin(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-all"
            data-testid="admin-section-types-btn"
          >
            <Settings className="w-4 h-4" />
            Administrar Tipos
          </button>
        </div>

        {Object.keys(sectionsByGrade).length === 0 ? <EmptyState category={cat} message={grades.length === 0 ? "Primero crea grados." : "Crea la primera sección."} onAdd={grades.length > 0 ? () => { setEditingSection(null); setPreselectedGradeForSection(null); setShowSectionModal(true); } : null} addLabel="Crear sección" /> : (
          <div className="space-y-8">
            {Object.entries(sectionsByGrade).map(([key, data]) => (
              <div key={key}>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-500" />{data.nivel_nombre} - {data.grado_nombre}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {data.sections.map(s => (
                    <div key={s.id} className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border-2 ${cat.borderColor} hover:-translate-y-1 overflow-hidden`}>
                      <div className={`h-2 bg-gradient-to-r ${cat.color}`}></div>
                      <div className="p-6 relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === s.id ? null : s.id); }} className="absolute top-3 right-3 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100"><MoreVertical className="w-5 h-5" /></button>
                        {menuOpen === s.id && <div className="absolute right-0 top-14 bg-white rounded-xl shadow-2xl border py-2 min-w-[160px] z-10"><button onClick={() => { setEditingSection(s); setShowSectionModal(true); setMenuOpen(null); }} className="w-full px-4 py-3 text-left text-base hover:bg-slate-50 flex items-center gap-3"><Pencil className="w-5 h-5 text-blue-500" />Editar</button>{(sectionStudentCounts[s.id] || 0) === 0 && <button onClick={() => openDelete("section", s)} className="w-full px-4 py-3 text-left text-base text-red-600 hover:bg-red-50 flex items-center gap-3"><Trash2 className="w-5 h-5" />Eliminar</button>}</div>}
                        <div className="text-center pt-2">
                          <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${cat.lightColor} border-2 ${cat.borderColor} flex items-center justify-center`}><span className={`text-3xl font-bold ${cat.textColor}`}>{s.nombre}</span></div>
                          {s.capacidad_maxima && <p className="text-base text-slate-500 mb-2">Capacidad: {s.capacidad_maxima}</p>}
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`w-2 h-2 rounded-full ${s.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>{s.activo ? "Activa" : "Inactiva"}</span>
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold"><Users className="w-4 h-4" />{sectionStudentCounts[s.id] || 0} estudiantes</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100" data-testid={`section-tutor-block-${s.id}`}>
                            <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Tutor</p>
                            {tutorsBySection[s.id] ? (
                              <p className="text-sm font-medium text-slate-700 truncate" data-testid={`section-tutor-name-${s.id}`}>{tutorsBySection[s.id].nombres_completos}</p>
                            ) : (
                              <p className="text-sm italic text-slate-400" data-testid={`section-tutor-empty-${s.id}`}>Sin asignar</p>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openTutorModal(s); }}
                              className="mt-2 text-xs px-3 py-1 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50"
                              data-testid={`section-tutor-btn-${s.id}`}
                            >
                              {tutorsBySection[s.id] ? "Cambiar tutor" : "Asignar tutor"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingSection(null); setPreselectedGradeForSection(data.grado_id); setShowSectionModal(true); }} className={`rounded-2xl border-2 border-dashed ${cat.borderColor} hover:border-purple-400 hover:bg-purple-50 p-6 flex flex-col items-center justify-center text-slate-400 hover:text-purple-600 min-h-[200px]`}><Plus className="w-8 h-8 mb-2" /><span className="text-base font-medium">Agregar</span></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Turnos section
  const renderTurnos = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "turnos");
    return (
      <div>
        <SectionHeader category={cat} count={shifts.length} countLabel={shifts.length === 1 ? "turno" : "turnos"} onAdd={() => { setEditingShift(null); setShowShiftModal(true); }} addLabel="Nuevo Turno" />
        {shifts.length === 0 ? <EmptyState category={cat} message="Crea el primer turno para organizar horarios." onAdd={() => { setEditingShift(null); setShowShiftModal(true); }} addLabel="Crear turno" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts.map(shift => (
              <ItemCard key={shift.id} item={shift} category={cat} onEdit={(s) => { setEditingShift(s); setShowShiftModal(true); }} onDelete={(s) => openDelete("shift", s)} badge={<span className="text-sm text-slate-600 font-medium">{shift.hora_inicio} - {shift.hora_fin}</span>}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: shift.color + "20" }}><Clock className="w-8 h-8" style={{ color: shift.color }} /></div>
                  <div><h3 className="text-lg font-bold text-slate-800">{shift.nombre}</h3><p className="text-slate-500">{shift.hora_inicio} - {shift.hora_fin}</p></div>
                </div>
                <div className="mt-4 flex gap-2">{SHIFT_COLORS.map(c => <div key={c.value} className={`w-6 h-6 rounded-full ${c.class} ${shift.color === c.value ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-30"}`} />)}</div>
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" /></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar active="ajustes-académicos" onNavigate={() => {}} expanded={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {!selectedCategory && (
            <div className="relative overflow-hidden rounded-3xl mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600"><div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div></div>
              <div className="relative px-8 py-10 flex items-center gap-6"><div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl"><BookMarked className="w-10 h-10 text-indigo-600" /></div><div className="text-white"><h1 className="text-4xl font-bold tracking-tight mb-2">Ajustes Académicos</h1><p className="text-indigo-200 text-lg">Configura la estructura académica de tu institución</p></div></div>
            </div>
          )}
          {!selectedCategory && renderCategoriesGrid()}
          {selectedCategory === "niveles" && renderNiveles()}
          {selectedCategory === "grados" && renderGrados()}
          {selectedCategory === "secciones" && renderSecciones()}
          {selectedCategory === "turnos" && renderTurnos()}
          {selectedCategory === "diagnostico" && isSupportSession && renderDiagnostico()}
        </main>
      </div>
      <LevelModal isOpen={showLevelModal} onClose={() => { setShowLevelModal(false); setEditingLevel(null); }} token={token} level={editingLevel} onSuccess={handleLevelSuccess} />
      <GradeModal isOpen={showGradeModal} onClose={() => { setShowGradeModal(false); setEditingGrade(null); }} token={token} grade={editingGrade} levels={levels} onSuccess={handleGradeSuccess} preselectedLevelId={selectedLevelFilter} existingGrades={grades} />
      <SectionModal isOpen={showSectionModal} onClose={() => { setShowSectionModal(false); setEditingSection(null); setPreselectedGradeForSection(null); }} token={token} section={editingSection} grades={grades} levels={levels} onSuccess={handleSectionSuccess} preselectedGradeId={preselectedGradeForSection || ""} />
      <SectionTypesAdminModal isOpen={showSectionTypesAdmin} onClose={() => setShowSectionTypesAdmin(false)} token={token} onTypesUpdated={loadSections} />
      <ShiftModal isOpen={showShiftModal} onClose={() => { setShowShiftModal(false); setEditingShift(null); }} token={token} shift={editingShift} onSuccess={handleShiftSuccess} />

      {/* Tutor assignment modal (Fase 2 - Libreta) */}
      {tutorModalOpen && tutorTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !tutorSaving && setTutorModalOpen(false)} data-testid="tutor-modal-backdrop">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="tutor-modal">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Asignar Tutor</h3>
            <p className="text-sm text-slate-500 mb-4">Sección <strong>{tutorTarget.nombre}</strong> · {tutorTarget.grado_nombre}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profesor</label>
                <select
                  value={tutorSelectedId}
                  onChange={(e) => setTutorSelectedId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  data-testid="tutor-modal-select"
                >
                  <option value="">— Seleccionar profesor —</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>
                      {`${t.last_name || ""} ${t.name || ""}`.trim() || t.email}
                    </option>
                  ))}
                </select>
              </div>
              {tutorsBySection[tutorTarget.id] && (
                <button
                  type="button"
                  onClick={() => saveTutor(true)}
                  disabled={tutorSaving}
                  className="w-full px-4 py-2 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  data-testid="tutor-modal-remove-btn"
                >
                  Quitar tutor actual ({tutorsBySection[tutorTarget.id].nombres_completos})
                </button>
              )}
              <p className="text-xs text-slate-500">El tutor podrá calificar conducta, escribir comentarios por bimestre y editar la situación final del año en la libreta de cada alumno de esta sección.</p>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setTutorModalOpen(false)}
                disabled={tutorSaving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                data-testid="tutor-modal-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveTutor(false)}
                disabled={tutorSaving || !tutorSelectedId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium"
                data-testid="tutor-modal-save-btn"
              >
                {tutorSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation modal */}
      <ConfirmModal 
        isOpen={showDeleteModal} 
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }} 
        onConfirm={confirmDelete} 
        title={`Eliminar ${deleteTarget?.type === "level" ? "Nivel" : deleteTarget?.type === "grade" ? "Grado" : deleteTarget?.type === "section" ? "Sección" : "Turno"}`} 
        message={`¿Eliminar "${deleteTarget?.item?.nombre}"? Esta acción no se puede deshacer.`} 
        confirmText="Sí, eliminar" 
        type="danger" 
        loading={deleteLoading} 
      />
      
      {/* Info modal for success messages */}
      <ConfirmModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
        onConfirm={() => setShowInfoModal(false)} 
        title={infoModalMessage.title} 
        message={infoModalMessage.message} 
        confirmText="Entendido" 
        type="success" 
        showCancel={false} 
      />
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
      <FloatingHelpAvatar subdomain={subdomain} />
    </div>
  );
}
