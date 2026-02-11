import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, 
  Users, Search, ChevronRight, Clock, MoreVertical,
  GraduationCap, Home, ArrowLeft, User, Power, PowerOff,
  Sparkles, Star, Zap
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

// Vibrant level themes
const LEVEL_THEMES = {
  0: { 
    name: "Inicial",
    gradient: "from-violet-400 via-purple-400 to-fuchsia-400",
    cardGradient: "from-violet-400 to-purple-500",
    bg: "bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50",
    sectionBg: "bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-400/10",
    border: "border-violet-200",
    text: "text-violet-600",
    badge: "bg-violet-500",
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
    cardBorder: "border-violet-300/50",
    hoverGlow: "hover:shadow-violet-300/50",
    lightCard: "from-violet-100/80 to-purple-100/60"
  },
  1: { 
    name: "Primaria",
    gradient: "from-blue-500 via-indigo-500 to-purple-500",
    cardGradient: "from-blue-400 to-indigo-500",
    bg: "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
    sectionBg: "bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-400/10",
    border: "border-blue-200",
    text: "text-blue-600",
    badge: "bg-blue-500",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    cardBorder: "border-blue-300/50",
    hoverGlow: "hover:shadow-blue-300/50",
    lightCard: "from-blue-100/80 to-indigo-100/60"
  },
  2: { 
    name: "Secundaria",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    cardGradient: "from-emerald-400 to-teal-500",
    bg: "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50",
    sectionBg: "bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-400/10",
    border: "border-emerald-200",
    text: "text-emerald-600",
    badge: "bg-emerald-500",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    cardBorder: "border-emerald-300/50",
    hoverGlow: "hover:shadow-emerald-300/50",
    lightCard: "from-emerald-100/80 to-teal-100/60"
  },
  3: { 
    name: "Extra",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    cardGradient: "from-amber-400 to-orange-500",
    bg: "bg-gradient-to-br from-amber-50 via-orange-50 to-red-50",
    sectionBg: "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-400/10",
    border: "border-amber-200",
    text: "text-amber-600",
    badge: "bg-amber-500",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    cardBorder: "border-amber-300/50",
    hoverGlow: "hover:shadow-amber-300/50",
    lightCard: "from-amber-100/80 to-orange-100/60"
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════════════════════════════════════════════════
function LevelsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse bg-white/50 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-2xl" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded-lg w-40 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-28" />
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="h-32 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BREADCRUMB
// ══════════════════════════════════════════════════════════════════════════════
function Breadcrumb({ items, onNavigate, theme }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-8">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
          <button
            onClick={() => onNavigate(index)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-300 ${
              index === items.length - 1
                ? `bg-gradient-to-r ${theme?.gradient || 'from-blue-500 to-indigo-500'} text-white font-bold shadow-lg`
                : "text-gray-500 hover:text-gray-700 hover:bg-white/80"
            }`}
          >
            {index === 0 && <Home className="w-4 h-4" />}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COLORFUL GRADE CARD
// ══════════════════════════════════════════════════════════════════════════════
function GradeCard({ grade, theme, subjectCount, onClick }) {
  const hasSubjects = subjectCount > 0;
  
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ease-out text-left
        bg-gradient-to-br ${theme.lightCard}
        border-2 ${theme.cardBorder}
        shadow-lg ${theme.hoverGlow}
        hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]
        active:scale-[0.98]
      `}
      data-testid={`grade-card-${grade.id}`}
    >
      {/* Decorative circles */}
      <div className={`absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br ${theme.cardGradient} rounded-full opacity-20 group-hover:opacity-40 transition-opacity`} />
      <div className={`absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br ${theme.cardGradient} rounded-full opacity-10 group-hover:opacity-30 transition-opacity`} />
      
      {/* Subject count badge */}
      {hasSubjects && (
        <div className={`absolute -top-2 -right-2 min-w-[32px] h-8 px-2.5 ${theme.badge} text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg ring-4 ring-white z-10`}>
          {subjectCount}
        </div>
      )}
      
      {/* Icon */}
      <div className={`relative w-16 h-16 ${theme.iconBg} rounded-2xl flex items-center justify-center mb-3 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        <GraduationCap className="w-8 h-8 text-white" />
        <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {/* Grade name */}
      <h3 className="font-bold text-gray-800 text-xl mb-1">{grade.nombre}</h3>
      <p className={`text-sm font-medium ${hasSubjects ? theme.text : 'text-gray-400'}`}>
        {subjectCount === 0 ? "Sin asignaturas" : `${subjectCount} materia${subjectCount !== 1 ? "s" : ""}`}
      </p>
      
      {/* Hover indicator */}
      <div className={`absolute bottom-3 right-3 w-8 h-8 rounded-full bg-gradient-to-r ${theme.cardGradient} flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300`}>
        <ChevronRight className="w-5 h-5 text-white" />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COLORFUL SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function SubjectCard({ subject, onEdit, onToggleStatus, onViewCourse }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Generate a lighter background color from the subject color
  const bgColor = subject.color + "15";
  const borderColor = subject.color + "40";
  
  return (
    <div 
      onClick={() => onViewCourse && onViewCourse(subject)}
      className={`group relative rounded-2xl overflow-hidden transition-all duration-300 ease-out cursor-pointer
        shadow-lg hover:shadow-2xl
        hover:-translate-y-2 hover:scale-[1.02]
        ${subject.status === "inactive" ? "opacity-50 grayscale" : ""}
      `}
      style={{ 
        background: `linear-gradient(135deg, ${bgColor}, white)`,
        borderWidth: '2px',
        borderColor: borderColor
      }}
      data-testid={`subject-card-${subject.id}`}
    >
      {/* Color accent bar */}
      <div 
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${subject.color}, ${subject.color}99)` }}
      />
      
      <div className="p-5">
        {/* Menu */}
        <div className="absolute top-4 right-3 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-sm"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-52">
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
        
        {/* Subject icon */}
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          style={{ 
            background: `linear-gradient(135deg, ${subject.color}, ${subject.color}CC)`,
          }}
        >
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        
        {/* Subject info */}
        <h3 className="font-bold text-gray-800 text-lg mb-1 pr-8 line-clamp-1">{subject.name}</h3>
        <div className="flex items-center gap-2 mb-4">
          <span 
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: subject.color }}
          >
            {subject.code}
          </span>
          {subject.weekly_hours && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" />
              {subject.weekly_hours}h
            </span>
          )}
        </div>
        
        {/* Teacher - Always show "Sin asignar" as per architecture */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200/50">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
            <User className="w-5 h-5 text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-400 font-medium">Sin asignar</p>
            <p className="text-xs text-gray-300">Ir a Asignación Docente</p>
          </div>
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
      className={`group relative rounded-2xl p-5 
        bg-gradient-to-br from-white via-gray-50 to-white
        border-2 border-dashed ${theme.border}
        hover:border-solid hover:bg-gradient-to-br ${theme.lightCard}
        hover:shadow-xl ${theme.hoverGlow}
        hover:-translate-y-2 hover:scale-[1.02]
        transition-all duration-300 ease-out
        flex flex-col items-center justify-center min-h-[220px]
      `}
      data-testid="add-subject-card"
    >
      {/* Animated icon */}
      <div className="relative mb-4">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.cardGradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300`} />
        <div className={`relative w-16 h-16 bg-gradient-to-br ${theme.iconBg} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
          <Plus className="w-8 h-8 text-white transition-transform duration-300 group-hover:rotate-90" />
        </div>
      </div>
      
      <span className={`text-base font-bold ${theme.text} transition-colors duration-300`}>Nueva asignatura</span>
      <span className="text-sm text-gray-400 mt-1">Agregar materia</span>
      
      {/* Sparkle */}
      <Star className={`absolute top-4 right-4 w-5 h-5 text-gray-200 group-hover:text-yellow-400 transition-all duration-300 group-hover:rotate-12`} />
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SubjectFormModal({ isOpen, onClose, subject, onSave, levels, grades, preselectedLevel, preselectedGrade }) {
  const [formData, setFormData] = useState({
    name: "", code: "", description: "", level_id: "", grade_id: "",
    weekly_hours: 2, color: "#3B82F6", status: "active"
  });
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name || "", code: subject.code || "", description: subject.description || "",
        level_id: subject.level_id || "", grade_id: subject.grade_id || "",
        weekly_hours: subject.weekly_hours || 2, color: subject.color || "#3B82F6",
        status: subject.status || "active"
      });
    } else {
      setFormData({
        name: "", code: "", description: "",
        level_id: preselectedLevel || "", grade_id: preselectedGrade || "",
        weekly_hours: 2, color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value,
        status: "active"
      });
    }
    setError("");
  }, [subject, isOpen, preselectedLevel, preselectedGrade]);

  useEffect(() => {
    if (formData.level_id) {
      setFilteredGrades(grades.filter(g => g.nivel_id === formData.level_id && g.activo));
    } else {
      setFilteredGrades([]);
    }
  }, [formData.level_id, grades]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{subject?.id ? "Editar Asignatura" : "Nueva Asignatura"}</h2>
                <p className="text-sm text-white/70">Complete los datos</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nombre *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Matemáticas" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Código *</label>
              <input type="text" value={formData.code} onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="Ej: MAT-01" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nivel *</label>
              <select value={formData.level_id} onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "" }))}
                disabled={isLocked} className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${isLocked ? "opacity-70" : ""}`}>
                <option value="">Seleccionar</option>
                {levels.filter(l => l.activo).map(level => (<option key={level.id} value={level.id}>{level.nombre}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Grado *</label>
              <select value={formData.grade_id} onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value }))}
                disabled={isLocked || !formData.level_id} className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${isLocked || !formData.level_id ? "opacity-70" : ""}`}>
                <option value="">Seleccionar</option>
                {filteredGrades.map(grade => (<option key={grade.id} value={grade.id}>{grade.nombre}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Horas Semanales</label>
              <input type="number" min="1" max="40" value={formData.weekly_hours} onChange={(e) => setFormData(prev => ({ ...prev, weekly_hours: parseInt(e.target.value) || 1 }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col justify-end">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">
                  💡 Los profesores se asignan desde el módulo "Asignación Docente"
                </p>
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
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancelar</button>
          <div className="flex-1" />
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {subject?.id ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEVELS VIEW - COLORFUL
// ══════════════════════════════════════════════════════════════════════════════
function LevelsView({ levels, grades, subjects, onSelectGrade }) {
  const gradesByLevel = {};
  levels.forEach(level => { gradesByLevel[level.id] = grades.filter(g => g.nivel_id === level.id && g.activo); });
  
  const subjectCountByGrade = {};
  subjects.forEach(subject => { if (subject.grade_id) { subjectCountByGrade[subject.grade_id] = (subjectCountByGrade[subject.grade_id] || 0) + 1; } });

  return (
    <div className="space-y-8">
      {levels.filter(l => l.activo).map((level, levelIndex) => {
        const levelGrades = gradesByLevel[level.id] || [];
        const theme = LEVEL_THEMES[levelIndex % Object.keys(LEVEL_THEMES).length];
        const totalSubjects = levelGrades.reduce((sum, g) => sum + (subjectCountByGrade[g.id] || 0), 0);
        
        return (
          <div key={level.id} className={`relative ${theme.bg} rounded-3xl p-6 lg:p-8 border-2 ${theme.border} shadow-xl overflow-hidden`}>
            {/* Decorative elements */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${theme.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`} />
            <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br ${theme.gradient} opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl`} />
            
            {/* Header */}
            <div className="relative flex items-center gap-5 mb-6">
              <div className={`w-20 h-20 ${theme.iconBg} rounded-3xl flex items-center justify-center shadow-2xl`}>
                <GraduationCap className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-black text-gray-800">{level.nombre}</h2>
                <p className={`text-base ${theme.text} font-semibold`}>
                  {levelGrades.length} grado{levelGrades.length !== 1 ? "s" : ""} • {totalSubjects} materia{totalSubjects !== 1 ? "s" : ""}
                </p>
              </div>
              <div className={`hidden sm:flex items-center gap-3 px-5 py-3 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border ${theme.border}`}>
                <BookOpen className={`w-6 h-6 ${theme.text}`} />
                <span className={`text-2xl font-black ${theme.text}`}>{totalSubjects}</span>
              </div>
            </div>
            
            {/* Grades grid */}
            {levelGrades.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-500 mb-2">Sin grados configurados</h3>
                <p className="text-sm text-gray-400">Configura los grados en Ajustes Académicos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {levelGrades.map(grade => (
                  <GradeCard key={grade.id} grade={grade} theme={theme} subjectCount={subjectCountByGrade[grade.id] || 0} onClick={() => onSelectGrade(level, grade)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRADE SUBJECTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function GradeSubjectsView({ level, grade, subjects, onAddSubject, onEditSubject, onToggleStatus, onViewCourse, levelColorIndex }) {
  const theme = LEVEL_THEMES[levelColorIndex % Object.keys(LEVEL_THEMES).length];

  return (
    <div>
      {/* Header */}
      <div className={`relative ${theme.bg} rounded-3xl p-8 mb-8 border-2 ${theme.border} shadow-xl overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${theme.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`} />
        <div className="relative flex items-center gap-6">
          <div className={`w-24 h-24 ${theme.iconBg} rounded-3xl flex items-center justify-center shadow-2xl`}>
            <GraduationCap className="w-12 h-12 text-white" />
          </div>
          <div className="flex-1">
            <p className={`text-lg font-bold ${theme.text} mb-1`}>{level.nombre}</p>
            <h2 className="text-4xl font-black text-gray-800">{grade.nombre}</h2>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-black ${theme.text}`}>{subjects.length}</p>
            <p className="text-base text-gray-500 font-semibold">materia{subjects.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Subjects grid */}
      {subjects.length === 0 ? (
        <div className={`${theme.bg} rounded-3xl p-16 text-center border-2 border-dashed ${theme.border}`}>
          <div className={`w-24 h-24 ${theme.iconBg} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl opacity-50`}>
            <BookOpen className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-black text-gray-700 mb-3">Sin asignaturas</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Este grado aún no tiene materias configuradas. ¡Agrega la primera!</p>
          <button onClick={onAddSubject}
            className={`px-8 py-4 bg-gradient-to-r ${theme.gradient} text-white rounded-2xl font-bold hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 inline-flex items-center gap-3`}>
            <Plus className="w-6 h-6" />
            Agregar Asignatura
            <Zap className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {subjects.map(subject => (
            <SubjectCard key={subject.id} subject={subject}
              onEdit={() => onEditSubject(subject)} onToggleStatus={() => onToggleStatus(subject)} onViewCourse={() => onViewCourse(subject)} />
          ))}
          <AddSubjectCard onClick={onAddSubject} theme={theme} />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
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
  const [levelColorIndex, setLevelColorIndex] = useState(0);
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, subjectsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }), axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }), axios.get(`${API}/academic/subjects`, { headers })
      ]);
      
      setSettings(settingsRes.data); setLevels(levelsRes.data || []); setGrades(gradesRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (err) { 
      console.error("SubjectsPage load error:", err); 
    } finally { setLoading(false); }
  };

  const loadSubjects = async () => {
    try { const res = await axios.get(`${API}/academic/subjects`, { headers }); setSubjects(res.data); } catch (err) { console.error(err); }
  };

  const handleSelectGrade = (level, grade) => {
    setLevelColorIndex(levels.findIndex(l => l.id === level.id));
    setSelectedLevel(level); setSelectedGrade(grade);
  };

  const handleNavigate = (index) => { if (index === 0) { setSelectedLevel(null); setSelectedGrade(null); } };

  const handleSaveSubject = async (data) => {
    const subjectData = { name: data.name, code: data.code, description: data.description, level_id: data.level_id, grade_id: data.grade_id, weekly_hours: data.weekly_hours, color: data.color, status: data.status };
    if (editingSubject?.id) { await axios.put(`${API}/academic/subjects/${editingSubject.id}`, subjectData, { headers }); }
    else { await axios.post(`${API}/academic/subjects`, subjectData, { headers }); }
    loadSubjects();
  };

  const handleToggleStatus = async (subject) => {
    await axios.put(`${API}/academic/subjects/${subject.id}`, { status: subject.status === "active" ? "inactive" : "active" }, { headers });
    loadSubjects();
  };

  const handleViewCourse = (subject) => {
    if (subdomain) {
      navigate(`/school/${subdomain}/curso/${subject.id}`);
    } else {
      navigate(`/curso/${subject.id}`);
    }
  };

  const breadcrumbItems = [{ label: "Asignaturas" }];
  if (selectedLevel) breadcrumbItems.push({ label: selectedLevel.nombre });
  if (selectedGrade) breadcrumbItems.push({ label: selectedGrade.nombre });

  const gradeSubjects = selectedGrade ? subjects.filter(s => s.grade_id === selectedGrade.id) : [];
  const currentTheme = LEVEL_THEMES[levelColorIndex % Object.keys(LEVEL_THEMES).length];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl animate-pulse">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <p className="text-gray-500 font-medium">Cargando asignaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex">
      <Sidebar user={user} settings={settings} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} subdomain={subdomain} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl"><BookOpen className="w-5 h-5 text-gray-600" /></button>
            {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-9 w-auto" />}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{settings?.system_name || "Instituto"}</h1>
              <p className="text-xs text-gray-400">Gestión Académica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg">
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {selectedGrade && (
                <button onClick={() => handleNavigate(0)} className="p-3 bg-white hover:bg-gray-50 rounded-xl shadow-lg border border-gray-100 hover:scale-105 transition-all">
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
              )}
              <div className={`w-16 h-16 bg-gradient-to-br ${selectedGrade ? currentTheme?.gradient || 'from-blue-500 to-indigo-500' : 'from-blue-600 to-indigo-700'} rounded-2xl flex items-center justify-center shadow-xl`}>
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-gray-800">Asignaturas</h1>
                <p className="text-gray-500 font-medium">{selectedGrade ? `${selectedLevel?.nombre} - ${selectedGrade?.nombre}` : "Gestiona las materias por nivel y grado"}</p>
              </div>
            </div>
            {selectedGrade && <Breadcrumb items={breadcrumbItems} onNavigate={handleNavigate} theme={currentTheme} />}
          </div>

          {!selectedGrade ? (
            <LevelsView levels={levels} grades={grades} subjects={subjects} onSelectGrade={handleSelectGrade} />
          ) : (
            <GradeSubjectsView level={selectedLevel} grade={selectedGrade} subjects={gradeSubjects}
              levelColorIndex={levelColorIndex}
              onAddSubject={() => { setEditingSubject(null); setShowSubjectModal(true); }}
              onEditSubject={(s) => { setEditingSubject(s); setShowSubjectModal(true); }}
              onToggleStatus={handleToggleStatus}
              onViewCourse={handleViewCourse} />
          )}
        </main>
      </div>

      <SubjectFormModal isOpen={showSubjectModal} onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        subject={editingSubject} onSave={handleSaveSubject} levels={levels} grades={grades}
        preselectedLevel={selectedLevel?.id} preselectedGrade={selectedGrade?.id} />
    </div>
  );
}
