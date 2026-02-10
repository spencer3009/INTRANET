import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  BookMarked, GraduationCap, Calendar, Clock, Building2,
  Plus, Pencil, Trash2, MoreVertical, Loader2, Check, X,
  BookOpen, Users, ChevronRight, ArrowLeft, Upload, Camera,
  ToggleLeft, ToggleRight, AlertCircle, Layers
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
    bgColor: "bg-purple-100",
    disabled: true
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
    bgColor: "bg-amber-100",
    disabled: true
  },
  {
    id: "periodos",
    label: "Períodos Académicos",
    description: "Bimestres, Trimestres, Semestres",
    icon: Calendar,
    color: "from-rose-500 to-red-600",
    lightColor: "from-rose-50 to-red-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-600",
    bgColor: "bg-rose-100",
    disabled: true
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// LEVEL MODAL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function LevelModal({ isOpen, onClose, token, level, onSuccess }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    imagen_url: "",
    activo: true
  });

  const isEdit = !!level;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (level) {
        setForm({
          nombre: level.nombre || "",
          descripcion: level.descripcion || "",
          imagen_url: level.imagen_url || "",
          activo: level.activo !== false
        });
      } else {
        setForm({ nombre: "", descripcion: "", imagen_url: "", activo: true });
      }
      setError("");
    }
  }, [isOpen, level]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      // Get Cloudinary signature
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/academic`, { headers });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", folder);

      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );

      setForm(prev => ({ ...prev, imagen_url: uploadRes.data.secure_url }));
    } catch (err) {
      setError("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isEdit) {
        const res = await axios.put(`${API}/academic/levels/${level.id}`, form, { headers });
        onSuccess(res.data.level, "update");
      } else {
        const res = await axios.post(`${API}/academic/levels`, form, { headers });
        onSuccess(res.data.level, "create");
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar nivel");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" data-testid="level-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar Nivel" : "Nuevo Nivel"}</h2>
                <p className="text-white/70 text-sm">Nivel educativo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Image upload */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 flex flex-col items-center justify-center text-blue-600 hover:border-blue-500 hover:bg-blue-100 transition-all overflow-hidden"
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : form.imagen_url ? (
                    <img src={form.imagen_url} alt="Nivel" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-xs">Subir imagen</span>
                    </>
                  )}
                </button>
                {form.imagen_url && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, imagen_url: "" }))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Ej: Primaria"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                placeholder="Descripción del nivel educativo..."
                rows={3}
              />
            </div>

            {/* Active toggle */}
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700">Estado</p>
                <p className="text-sm text-slate-500">{form.activo ? "Nivel activo" : "Nivel inactivo"}</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, activo: !prev.activo }))}
                className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-blue-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} />
              </button>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
// GRADE MODAL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function GradeModal({ isOpen, onClose, token, grade, levels, onSuccess, preselectedLevelId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    nivel_id: "",
    orden: 0,
    activo: true
  });

  const isEdit = !!grade;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (grade) {
        setForm({
          nombre: grade.nombre || "",
          nivel_id: grade.nivel_id || "",
          orden: grade.orden || 0,
          activo: grade.activo !== false
        });
      } else {
        setForm({ 
          nombre: "", 
          nivel_id: preselectedLevelId || "", 
          orden: 0, 
          activo: true 
        });
      }
      setError("");
    }
  }, [isOpen, grade, preselectedLevelId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!form.nivel_id) {
      setError("Debes seleccionar un nivel educativo");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isEdit) {
        const res = await axios.put(`${API}/academic/grades/${grade.id}`, form, { headers });
        onSuccess(res.data.grade, "update");
      } else {
        const res = await axios.post(`${API}/academic/grades`, form, { headers });
        onSuccess(res.data.grade, "create");
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar grado");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedLevel = levels.find(l => l.id === form.nivel_id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" data-testid="grade-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar Grado" : "Nuevo Grado"}</h2>
                <p className="text-white/70 text-sm">Grado académico</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Level select */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nivel Educativo <span className="text-red-500">*</span>
              </label>
              <select
                value={form.nivel_id}
                onChange={(e) => setForm(prev => ({ ...prev, nivel_id: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">Seleccionar nivel...</option>
                {levels.filter(l => l.activo).map(level => (
                  <option key={level.id} value={level.id}>{level.nombre}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre del Grado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Ej: 1°, 2°, Primero"
                required
              />
            </div>

            {/* Order */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="0 = automático"
                min={0}
              />
              <p className="text-xs text-slate-500 mt-1">Deja en 0 para ordenar automáticamente</p>
            </div>

            {/* Active toggle */}
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700">Estado</p>
                <p className="text-sm text-slate-500">{form.activo ? "Grado activo" : "Grado inactivo"}</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, activo: !prev.activo }))}
                className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} />
              </button>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademicSettingsPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Levels state
  const [levels, setLevels] = useState([]);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [levelMenuOpen, setLevelMenuOpen] = useState(null);
  
  // Grades state
  const [grades, setGrades] = useState([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(null);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("");
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, levelsRes] = await Promise.all([
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/academic/levels`, { headers })
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        setLevels(levelsRes.data);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Load grades when entering grades section
  useEffect(() => {
    if (selectedCategory === "grados") {
      loadGrades();
    }
  }, [selectedCategory]);

  const loadGrades = async () => {
    try {
      const res = await axios.get(`${API}/academic/grades`, { headers });
      setGrades(res.data);
    } catch (err) {
      console.error("Error loading grades:", err);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setLevelMenuOpen(null);
      setGradeMenuOpen(null);
    };
    if (levelMenuOpen || gradeMenuOpen) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [levelMenuOpen, gradeMenuOpen]);

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  // Handlers for levels
  const handleLevelSuccess = (level, action) => {
    if (action === "create") {
      setLevels(prev => [...prev, level]);
    } else {
      setLevels(prev => prev.map(l => l.id === level.id ? level : l));
    }
  };

  const handleDeleteLevel = async () => {
    if (!deleteTarget || deleteTarget.type !== "level") return;
    
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/academic/levels/${deleteTarget.item.id}`, { headers });
      setLevels(prev => prev.filter(l => l.id !== deleteTarget.item.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar nivel");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handlers for grades
  const handleGradeSuccess = (grade, action) => {
    if (action === "create") {
      setGrades(prev => [...prev, grade]);
      // Update level grade count
      setLevels(prev => prev.map(l => 
        l.id === grade.nivel_id ? { ...l, grade_count: (l.grade_count || 0) + 1 } : l
      ));
    } else {
      setGrades(prev => prev.map(g => g.id === grade.id ? grade : g));
    }
  };

  const handleDeleteGrade = async () => {
    if (!deleteTarget || deleteTarget.type !== "grade") return;
    
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/academic/grades/${deleteTarget.item.id}`, { headers });
      setGrades(prev => prev.filter(g => g.id !== deleteTarget.item.id));
      // Update level grade count
      setLevels(prev => prev.map(l => 
        l.id === deleteTarget.item.nivel_id ? { ...l, grade_count: Math.max(0, (l.grade_count || 1) - 1) } : l
      ));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar grado");
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget?.type === "level") {
      handleDeleteLevel();
    } else if (deleteTarget?.type === "grade") {
      handleDeleteGrade();
    }
  };

  // Render categories grid (main view)
  const renderCategoriesGrid = () => (
    <>
      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {ACADEMIC_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = category.id === "niveles" ? levels.length : 
                       category.id === "grados" ? grades.length : 0;
          return (
            <button
              key={category.id}
              onClick={() => !category.disabled && setSelectedCategory(category.id)}
              disabled={category.disabled}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${category.borderColor} bg-gradient-to-br ${category.lightColor} ${category.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid={`category-${category.id}`}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              {/* Decorative circles */}
              <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${category.color} opacity-10`} />

              {/* Disabled badge */}
              {category.disabled && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-slate-200 text-slate-500 text-xs font-medium rounded-full">
                  Próximamente
                </div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div className="flex justify-center mb-4">
                  <div className={`w-20 h-20 rounded-2xl bg-white shadow-lg p-4 group-hover:shadow-xl transition-all duration-300 border-2 ${category.borderColor}`}>
                    <Icon className={`w-full h-full ${category.textColor}`} />
                  </div>
                </div>

                <h3 className={`text-xl font-bold text-center mb-2 ${category.textColor}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {category.label}
                </h3>

                <div className="flex justify-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border ${category.borderColor} ${category.textColor} font-medium text-sm`}>
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${category.color}`}></span>
                    {category.disabled ? category.description : `${count} registros`}
                  </span>
                </div>

                {!category.disabled && (
                  <div className="flex justify-center mt-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0`}>
                      <ChevronRight className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  // Render Niveles section
  const renderNivelesSection = () => {
    const category = ACADEMIC_CATEGORIES.find(c => c.id === "niveles");
    
    return (
      <div data-testid="niveles-section">
        {/* Header */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${category.color} text-white rounded-3xl p-8 mb-8 shadow-xl`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">Volver a categorías</span>
            </button>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center">
                  <GraduationCap className="w-14 h-14 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Niveles Educativos</h1>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                      {levels.length} {levels.length === 1 ? "nivel" : "niveles"}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => { setEditingLevel(null); setShowLevelModal(true); }}
                className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5"
                data-testid="add-level-btn"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center`}>
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span>Nuevo Nivel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Levels Grid */}
        {levels.length === 0 ? (
          <div className={`relative overflow-hidden bg-gradient-to-br ${category.lightColor} rounded-3xl p-16 text-center border-2 ${category.borderColor}`}>
            <div className="relative z-10">
              <div className={`w-32 h-32 mx-auto mb-6 bg-white rounded-3xl shadow-lg p-6 border-2 ${category.borderColor}`}>
                <GraduationCap className="w-full h-full text-blue-400 opacity-50" />
              </div>
              <h3 className={`text-2xl font-bold ${category.textColor} mb-2`}>Sin niveles educativos</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Aún no tienes niveles configurados. Crea el primero para comenzar a estructurar tu institución.
              </p>
              <button
                onClick={() => { setEditingLevel(null); setShowLevelModal(true); }}
                className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${category.color} text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5`}
              >
                <Plus className="w-5 h-5" />
                Crear primer nivel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level) => (
              <div 
                key={level.id}
                className={`group relative overflow-hidden bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-2 ${category.borderColor} hover:-translate-y-1`}
                data-testid={`level-card-${level.id}`}
              >
                {/* Top gradient bar */}
                <div className={`h-2 bg-gradient-to-r ${category.color}`}></div>
                
                <div className="p-6 relative">
                  {/* Menu button */}
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setLevelMenuOpen(levelMenuOpen === level.id ? null : level.id); }}
                      className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {levelMenuOpen === level.id && (
                      <div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 min-w-[160px] z-10">
                        <button
                          onClick={() => { setEditingLevel(level); setShowLevelModal(true); setLevelMenuOpen(null); }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Pencil className="w-4 h-4 text-blue-600" />
                          </div>
                          Editar
                        </button>
                        <button
                          onClick={() => { setDeleteTarget({ type: "level", item: level }); setShowDeleteModal(true); setLevelMenuOpen(null); }}
                          className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </div>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Level info */}
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="relative mb-4">
                      <div className={`w-20 h-20 rounded-2xl overflow-hidden border-3 ${category.borderColor} shadow-lg bg-gradient-to-br ${category.lightColor}`}>
                        {level.imagen_url ? (
                          <img src={level.imagen_url} alt={level.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <GraduationCap className={`w-10 h-10 ${category.textColor}`} />
                          </div>
                        )}
                      </div>
                      {/* Status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-white flex items-center justify-center ${level.activo ? "bg-emerald-500" : "bg-slate-400"}`}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{level.nombre}</h3>
                    {level.descripcion && (
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{level.descripcion}</p>
                    )}
                    
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold ${level.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${level.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {level.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  
                  {/* Stats */}
                  <div className={`pt-4 border-t ${category.borderColor}`}>
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                      <div className={`w-6 h-6 rounded-full ${category.bgColor} flex items-center justify-center`}>
                        <Layers className={`w-3 h-3 ${category.textColor}`} />
                      </div>
                      <span>{level.grade_count || 0} grado(s)</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Grados section
  const renderGradosSection = () => {
    const category = ACADEMIC_CATEGORIES.find(c => c.id === "grados");
    const filteredGrades = selectedLevelFilter 
      ? grades.filter(g => g.nivel_id === selectedLevelFilter)
      : grades;
    
    // Group grades by level
    const gradesByLevel = {};
    filteredGrades.forEach(grade => {
      if (!gradesByLevel[grade.nivel_id]) {
        gradesByLevel[grade.nivel_id] = {
          nivel_nombre: grade.nivel_nombre,
          grades: []
        };
      }
      gradesByLevel[grade.nivel_id].grades.push(grade);
    });
    
    return (
      <div data-testid="grados-section">
        {/* Header */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${category.color} text-white rounded-3xl p-8 mb-8 shadow-xl`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">Volver a categorías</span>
            </button>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center">
                  <BookOpen className="w-14 h-14 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Grados</h1>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                      {grades.length} {grades.length === 1 ? "grado" : "grados"}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => { setEditingGrade(null); setShowGradeModal(true); }}
                className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5"
                data-testid="add-grade-btn"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center`}>
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span>Nuevo Grado</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter by level */}
        {levels.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedLevelFilter("")}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${!selectedLevelFilter ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"}`}
            >
              Todos los niveles
            </button>
            {levels.filter(l => l.activo).map(level => (
              <button
                key={level.id}
                onClick={() => setSelectedLevelFilter(level.id)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedLevelFilter === level.id ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"}`}
              >
                {level.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Grades by level */}
        {Object.keys(gradesByLevel).length === 0 ? (
          <div className={`relative overflow-hidden bg-gradient-to-br ${category.lightColor} rounded-3xl p-16 text-center border-2 ${category.borderColor}`}>
            <div className="relative z-10">
              <div className={`w-32 h-32 mx-auto mb-6 bg-white rounded-3xl shadow-lg p-6 border-2 ${category.borderColor}`}>
                <BookOpen className="w-full h-full text-emerald-400 opacity-50" />
              </div>
              <h3 className={`text-2xl font-bold ${category.textColor} mb-2`}>Sin grados</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                {levels.length === 0 
                  ? "Primero debes crear un nivel educativo antes de agregar grados."
                  : "Aún no tienes grados configurados. Crea el primero para comenzar."}
              </p>
              {levels.length > 0 && (
                <button
                  onClick={() => { setEditingGrade(null); setShowGradeModal(true); }}
                  className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${category.color} text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5`}
                >
                  <Plus className="w-5 h-5" />
                  Crear primer grado
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(gradesByLevel).map(([nivelId, data]) => (
              <div key={nivelId}>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                  {data.nivel_nombre}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {data.grades.map((grade) => (
                    <div 
                      key={grade.id}
                      className={`group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-2 ${category.borderColor} hover:-translate-y-1 overflow-hidden`}
                      data-testid={`grade-card-${grade.id}`}
                    >
                      <div className={`h-1.5 bg-gradient-to-r ${category.color}`}></div>
                      
                      <div className="p-4 relative">
                        {/* Menu button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setGradeMenuOpen(gradeMenuOpen === grade.id ? null : grade.id); }}
                          className="absolute top-1 right-1 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {gradeMenuOpen === grade.id && (
                          <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 min-w-[140px] z-10">
                            <button
                              onClick={() => { setEditingGrade(grade); setShowGradeModal(true); setGradeMenuOpen(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                            >
                              <Pencil className="w-4 h-4 text-blue-500" />
                              Editar
                            </button>
                            <button
                              onClick={() => { setDeleteTarget({ type: "grade", item: grade }); setShowDeleteModal(true); setGradeMenuOpen(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          </div>
                        )}

                        <div className="text-center pt-2">
                          <div className={`w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br ${category.lightColor} border-2 ${category.borderColor} flex items-center justify-center`}>
                            <span className={`text-lg font-bold ${category.textColor}`}>{grade.nombre}</span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${grade.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            <span className={`w-1 h-1 rounded-full ${grade.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                            {grade.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add grade button for this level */}
                  <button
                    onClick={() => { setEditingGrade(null); setShowGradeModal(true); }}
                    className={`rounded-xl border-2 border-dashed ${category.borderColor} hover:border-emerald-400 hover:bg-emerald-50 transition-all p-4 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600 min-h-[100px]`}
                  >
                    <Plus className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">Agregar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="academic-settings-page">
      <Sidebar
        active="ajustes-academicos"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
        />

        <main className="flex-1 overflow-y-auto custom-scroll p-6 lg:p-8">
          {/* Page Header Banner (only show when no category selected) */}
          {!selectedCategory && (
            <div className="relative overflow-hidden rounded-3xl mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              </div>

              <div className="relative px-8 py-10">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                    <BookMarked className="w-10 h-10 text-indigo-600" />
                  </div>

                  <div className="text-white flex-1">
                    <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Ajustes Académicos
                    </h1>
                    <p className="text-indigo-200 text-lg">
                      Configura la estructura académica de tu institución
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content based on selected category */}
          {!selectedCategory && renderCategoriesGrid()}
          {selectedCategory === "niveles" && renderNivelesSection()}
          {selectedCategory === "grados" && renderGradosSection()}
        </main>
      </div>

      {/* Level Modal */}
      <LevelModal
        isOpen={showLevelModal}
        onClose={() => { setShowLevelModal(false); setEditingLevel(null); }}
        token={token}
        level={editingLevel}
        onSuccess={handleLevelSuccess}
      />

      {/* Grade Modal */}
      <GradeModal
        isOpen={showGradeModal}
        onClose={() => { setShowGradeModal(false); setEditingGrade(null); }}
        token={token}
        grade={editingGrade}
        levels={levels}
        onSuccess={handleGradeSuccess}
        preselectedLevelId={selectedLevelFilter}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title={deleteTarget?.type === "level" ? "Eliminar Nivel" : "Eliminar Grado"}
        message={
          deleteTarget?.type === "level" 
            ? `¿Estás seguro de eliminar el nivel "${deleteTarget?.item?.nombre}"? Esta acción no se puede deshacer.`
            : `¿Estás seguro de eliminar el grado "${deleteTarget?.item?.nombre}"? Esta acción no se puede deshacer.`
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
