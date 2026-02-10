import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, 
  Users, Search, ChevronRight, Clock, MoreVertical, UserPlus,
  GraduationCap, Layers, Home, ArrowLeft, User, Power, PowerOff,
  Sparkles, BookMarked, School
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

// Premium level themes with rich gradients
const LEVEL_THEMES = {
  0: { 
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    lightBg: "bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50",
    cardBg: "bg-gradient-to-br from-violet-100/50 to-purple-100/30",
    border: "border-violet-200/50",
    text: "text-violet-700",
    accent: "violet",
    shadow: "shadow-violet-200/50",
    glow: "hover:shadow-violet-300/60",
    icon: "from-violet-500 to-purple-600"
  },
  1: { 
    gradient: "from-blue-500 via-indigo-500 to-violet-500",
    lightBg: "bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50",
    cardBg: "bg-gradient-to-br from-blue-100/50 to-indigo-100/30",
    border: "border-blue-200/50",
    text: "text-blue-700",
    accent: "blue",
    shadow: "shadow-blue-200/50",
    glow: "hover:shadow-blue-300/60",
    icon: "from-blue-500 to-indigo-600"
  },
  2: { 
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    lightBg: "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50",
    cardBg: "bg-gradient-to-br from-emerald-100/50 to-teal-100/30",
    border: "border-emerald-200/50",
    text: "text-emerald-700",
    accent: "emerald",
    shadow: "shadow-emerald-200/50",
    glow: "hover:shadow-emerald-300/60",
    icon: "from-emerald-500 to-teal-600"
  },
  3: { 
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    lightBg: "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50",
    cardBg: "bg-gradient-to-br from-amber-100/50 to-orange-100/30",
    border: "border-amber-200/50",
    text: "text-amber-700",
    accent: "amber",
    shadow: "shadow-amber-200/50",
    glow: "hover:shadow-amber-300/60",
    icon: "from-amber-500 to-orange-600"
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM SKELETON LOADERS
// ══════════════════════════════════════════════════════════════════════════════
function LevelsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/80 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl" />
              <div>
                <div className="h-6 bg-gray-200 rounded-lg w-32 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4].map(j => (
                <div key={j} className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-48 bg-white/60 backdrop-blur-sm rounded-2xl animate-pulse shadow-lg" />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM BREADCRUMB
// ══════════════════════════════════════════════════════════════════════════════
function Breadcrumb({ items, onNavigate }) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-8">
      <div className="flex items-center bg-white/70 backdrop-blur-sm rounded-2xl px-2 py-1 shadow-sm border border-white/80">
        {items.map((item, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />}
            <button
              onClick={() => onNavigate(index)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                index === items.length - 1
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/80"
              }`}
            >
              {index === 0 && <Home className="w-4 h-4" />}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM GRADE CARD
// ══════════════════════════════════════════════════════════════════════════════
function GradeCard({ grade, theme, subjectCount, onClick }) {
  const hasSubjects = subjectCount > 0;
  
  return (
    <button
      onClick={onClick}
      className={`group relative bg-white rounded-2xl p-5 transition-all duration-300 ease-out text-left overflow-hidden
        border-2 ${hasSubjects ? theme.border : 'border-gray-100'}
        shadow-lg ${theme.shadow}
        hover:shadow-2xl ${theme.glow}
        hover:-translate-y-1 hover:scale-[1.02]
        active:scale-[0.98]
      `}
      data-testid={`grade-card-${grade.id}`}
    >
      {/* Decorative gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      
      {/* Subject count badge */}
      {hasSubjects && (
        <div className={`absolute -top-1 -right-1 min-w-[28px] h-7 px-2 bg-gradient-to-r ${theme.icon} text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white`}>
          {subjectCount}
        </div>
      )}
      
      {/* Icon container with gradient */}
      <div className={`relative w-14 h-14 bg-gradient-to-br ${theme.icon} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
        <GraduationCap className="w-7 h-7 text-white" />
        {/* Shine effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      
      {/* Grade name */}
      <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-gray-900 transition-colors">{grade.nombre}</h3>
      <p className={`text-sm ${hasSubjects ? theme.text : 'text-gray-400'} font-medium`}>
        {subjectCount === 0 ? "Sin asignaturas" : `${subjectCount} asignatura${subjectCount !== 1 ? "s" : ""}`}
      </p>
      
      {/* Hover arrow indicator */}
      <div className={`absolute bottom-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r ${theme.icon} flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300`}>
        <ChevronRight className="w-4 h-4 text-white" />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function SubjectCard({ subject, teacher, onEdit, onAssignTeacher, onToggleStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <div 
      className={`group relative bg-white rounded-2xl overflow-hidden transition-all duration-300 ease-out
        shadow-lg hover:shadow-2xl
        hover:-translate-y-1 hover:scale-[1.02]
        border border-gray-100 hover:border-gray-200
        ${subject.status === "inactive" ? "opacity-60 grayscale" : ""}
      `}
      data-testid={`subject-card-${subject.id}`}
    >
      {/* Color header with gradient effect */}
      <div 
        className="h-2 w-full relative"
        style={{ backgroundColor: subject.color }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0" />
      </div>
      
      <div className="p-5">
        {/* Menu button */}
        <div className="absolute top-4 right-3 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {/* Dropdown menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-52 backdrop-blur-xl">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(subject); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Editar asignatura</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onAssignTeacher(subject); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-violet-600" />
                  </div>
                  <span className="font-medium">{teacher ? "Cambiar profesor" : "Asignar profesor"}</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onToggleStatus(subject); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <div className={`w-8 h-8 ${subject.status === "active" ? "bg-amber-100" : "bg-emerald-100"} rounded-lg flex items-center justify-center`}>
                    {subject.status === "active" ? (
                      <PowerOff className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Power className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <span className="font-medium">{subject.status === "active" ? "Desactivar" : "Activar"}</span>
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Subject icon with glow */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110"
          style={{ 
            backgroundColor: subject.color + "20",
            boxShadow: `0 8px 24px ${subject.color}30`
          }}
        >
          <BookOpen className="w-6 h-6" style={{ color: subject.color }} />
        </div>
        
        {/* Subject info */}
        <h3 className="font-bold text-gray-800 text-base mb-1 pr-8 line-clamp-1 group-hover:text-gray-900 transition-colors">{subject.name}</h3>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">{subject.code}</span>
          {subject.weekly_hours && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {subject.weekly_hours}h
            </span>
          )}
        </div>
        
        {/* Teacher section */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          {teacher ? (
            <>
              {teacher.photo_url ? (
                <img src={teacher.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white shadow-md" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                  {teacher.name?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 font-semibold truncate">{teacher.name} {teacher.last_name?.charAt(0)}.</p>
                <p className="text-xs text-gray-400">Profesor asignado</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200">
                <User className="w-4 h-4 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-400 font-medium">Sin profesor</p>
                <p className="text-xs text-gray-300">Click para asignar</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM ADD SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function AddSubjectCard({ onClick, theme }) {
  return (
    <button
      onClick={onClick}
      className={`group relative bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl p-5 
        border-2 border-dashed border-gray-200 
        hover:border-blue-300 hover:from-blue-50 hover:via-white hover:to-indigo-50
        hover:shadow-xl hover:shadow-blue-100/50
        hover:-translate-y-1 hover:scale-[1.02]
        transition-all duration-300 ease-out
        flex flex-col items-center justify-center min-h-[200px]
      `}
      data-testid="add-subject-card"
    >
      {/* Animated plus icon */}
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
        <div className="relative w-full h-full bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl border border-gray-100 group-hover:border-blue-200 transition-all duration-300">
          <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors duration-300 group-hover:rotate-90" style={{ transition: 'transform 0.3s, color 0.3s' }} />
        </div>
      </div>
      
      <span className="text-base font-bold text-gray-500 group-hover:text-blue-600 transition-colors duration-300">Nueva asignatura</span>
      <span className="text-sm text-gray-400 group-hover:text-blue-500/70 mt-1 transition-colors duration-300">Agregar a este grado</span>
      
      {/* Sparkle decoration */}
      <Sparkles className="absolute top-4 right-4 w-5 h-5 text-gray-200 group-hover:text-amber-400 transition-colors duration-300" />
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL (Same logic, improved visuals)
// ══════════════════════════════════════════════════════════════════════════════
function SubjectFormModal({ isOpen, onClose, subject, onSave, levels, grades, teachers, preselectedLevel, preselectedGrade }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    level_id: "",
    grade_id: "",
    weekly_hours: 2,
    color: "#3B82F6",
    status: "active",
    teacher_id: ""
  });
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name || "",
        code: subject.code || "",
        description: subject.description || "",
        level_id: subject.level_id || "",
        grade_id: subject.grade_id || "",
        weekly_hours: subject.weekly_hours || 2,
        color: subject.color || "#3B82F6",
        status: subject.status || "active",
        teacher_id: subject.teacher_id || ""
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        level_id: preselectedLevel || "",
        grade_id: preselectedGrade || "",
        weekly_hours: 2,
        color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value,
        status: "active",
        teacher_id: ""
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

    if (!formData.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!formData.code.trim()) {
      setError("El código es requerido");
      return;
    }
    if (!formData.level_id) {
      setError("Selecciona un nivel");
      return;
    }
    if (!formData.grade_id) {
      setError("Selecciona un grado");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar asignatura");
    } finally {
      setSaving(false);
    }
  };

  const isLocked = preselectedLevel && preselectedGrade;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="subject-form-modal">
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-6 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdi0yMGgtNjB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {subject?.id ? "Editar Asignatura" : "Nueva Asignatura"}
                </h2>
                <p className="text-sm text-white/70">Complete los datos de la materia</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Name and Code */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Matemáticas"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Código *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="Ej: MAT-01"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase"
              />
            </div>
          </div>

          {/* Level and Grade */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nivel *</label>
              <select
                value={formData.level_id}
                onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "" }))}
                disabled={isLocked}
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLocked ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <option value="">Seleccionar nivel</option>
                {levels.filter(l => l.activo).map(level => (
                  <option key={level.id} value={level.id}>{level.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Grado *</label>
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value }))}
                disabled={isLocked || !formData.level_id}
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLocked || !formData.level_id ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <option value="">Seleccionar grado</option>
                {filteredGrades.map(grade => (
                  <option key={grade.id} value={grade.id}>{grade.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hours and Teacher */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Horas Semanales</label>
              <input
                type="number"
                min="1"
                max="40"
                value={formData.weekly_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, weekly_hours: parseInt(e.target.value) || 1 }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Profesor</label>
              <select
                value={formData.teacher_id}
                onChange={(e) => setFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Sin asignar</option>
                {teachers.filter(t => t.activo).map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name} {teacher.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Picker */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-3">Color Identificador</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`w-10 h-10 rounded-xl transition-all duration-200 ${
                    formData.color === color.value 
                      ? "ring-2 ring-offset-2 ring-gray-400 scale-110 shadow-lg" 
                      : "hover:scale-110 hover:shadow-md"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción de la asignatura..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-subject-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {subject?.id ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEACHER ASSIGNMENT MODAL (Same logic, improved visuals)
// ══════════════════════════════════════════════════════════════════════════════
function TeacherAssignModal({ isOpen, onClose, subject, teachers, currentTeacherId, onSave }) {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedTeacher(currentTeacherId || "");
      setSearchTerm("");
    }
  }, [isOpen, currentTeacherId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedTeacher ? [selectedTeacher] : []);
      onClose();
    } catch (err) {
      console.error("Error saving teacher:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.activo && (
      `${t.name} ${t.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (!isOpen || !subject) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="teacher-assign-modal">
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-6 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdi0yMGgtNjB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Asignar Profesor</h2>
                <p className="text-sm text-white/70">{subject.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar profesor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>

          {/* Remove teacher option */}
          <button
            onClick={() => setSelectedTeacher("")}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3 transition-all duration-200 ${
              selectedTeacher === "" 
                ? "bg-rose-50 border-2 border-rose-300 shadow-lg" 
                : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
            }`}
          >
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              selectedTeacher === "" ? "bg-rose-500 border-rose-500" : "border-gray-300"
            }`}>
              {selectedTeacher === "" && <Check className="w-4 h-4 text-white" />}
            </div>
            <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-sm font-semibold text-gray-600">Sin profesor asignado</span>
          </button>

          {/* Teachers list */}
          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {filteredTeachers.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No hay profesores disponibles</p>
              </div>
            ) : (
              filteredTeachers.map(teacher => {
                const isSelected = selectedTeacher === teacher.id;
                return (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                      isSelected 
                        ? "bg-violet-50 border-2 border-violet-300 shadow-lg" 
                        : "bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-md"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300"
                    }`}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    {teacher.photo_url ? (
                      <img src={teacher.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover shadow-md" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
                        {teacher.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {teacher.name} {teacher.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-teacher-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREMIUM LEVELS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function LevelsView({ levels, grades, subjects, onSelectGrade }) {
  const gradesByLevel = {};
  levels.forEach(level => {
    gradesByLevel[level.id] = grades.filter(g => g.nivel_id === level.id && g.activo);
  });

  const subjectCountByGrade = {};
  subjects.forEach(subject => {
    if (subject.grade_id) {
      subjectCountByGrade[subject.grade_id] = (subjectCountByGrade[subject.grade_id] || 0) + 1;
    }
  });

  return (
    <div className="space-y-8">
      {levels.filter(l => l.activo).map((level, levelIndex) => {
        const levelGrades = gradesByLevel[level.id] || [];
        const theme = LEVEL_THEMES[levelIndex % Object.keys(LEVEL_THEMES).length];
        const totalSubjects = levelGrades.reduce((sum, g) => sum + (subjectCountByGrade[g.id] || 0), 0);
        
        return (
          <div 
            key={level.id} 
            className={`relative ${theme.lightBg} rounded-3xl p-6 lg:p-8 border ${theme.border} shadow-xl overflow-hidden`}
            data-testid={`level-section-${level.id}`}
          >
            {/* Background decoration */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${theme.gradient} opacity-5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2`} />
            
            {/* Level header */}
            <div className="relative flex items-center gap-5 mb-6">
              <div className={`w-16 h-16 bg-gradient-to-br ${theme.icon} rounded-2xl flex items-center justify-center shadow-xl`}>
                <School className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800">{level.nombre}</h2>
                <p className={`text-sm ${theme.text} font-medium`}>
                  {levelGrades.length} grado{levelGrades.length !== 1 ? "s" : ""} • {totalSubjects} asignatura{totalSubjects !== 1 ? "s" : ""}
                </p>
              </div>
              <div className={`hidden sm:flex items-center gap-2 px-4 py-2 ${theme.cardBg} rounded-xl border ${theme.border}`}>
                <BookMarked className={`w-5 h-5 ${theme.text}`} />
                <span className={`text-sm font-bold ${theme.text}`}>{totalSubjects}</span>
              </div>
            </div>
            
            {/* Grades grid */}
            {levelGrades.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-10 text-center border border-white/80 shadow-lg">
                <div className={`w-20 h-20 bg-gradient-to-br ${theme.icon} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl opacity-50`}>
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-600 mb-2">Sin grados configurados</h3>
                <p className="text-sm text-gray-400 mb-4">Este nivel no tiene grados académicos</p>
                <span className="text-xs text-gray-400">Configura los grados en Ajustes Académicos</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {levelGrades.map(grade => (
                  <GradeCard
                    key={grade.id}
                    grade={grade}
                    theme={theme}
                    subjectCount={subjectCountByGrade[grade.id] || 0}
                    onClick={() => onSelectGrade(level, grade)}
                  />
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
// PREMIUM GRADE SUBJECTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function GradeSubjectsView({ level, grade, subjects, teachers, subjectTeachers, onAddSubject, onEditSubject, onAssignTeacher, onToggleStatus, levelColorIndex }) {
  const theme = LEVEL_THEMES[levelColorIndex % Object.keys(LEVEL_THEMES).length];
  
  const getTeacherForSubject = (subjectId) => {
    const assignment = subjectTeachers[subjectId];
    if (assignment && assignment.length > 0) {
      return teachers.find(t => t.id === assignment[0]);
    }
    return null;
  };

  return (
    <div>
      {/* Premium grade header */}
      <div className={`relative ${theme.lightBg} rounded-3xl p-8 mb-8 border ${theme.border} shadow-xl overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-br ${theme.gradient} opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2`} />
        
        <div className="relative flex items-center gap-6">
          <div className={`w-20 h-20 bg-gradient-to-br ${theme.icon} rounded-2xl flex items-center justify-center shadow-2xl`}>
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${theme.text} mb-1`}>{level.nombre}</p>
            <h2 className="text-3xl font-bold text-gray-800">{grade.nombre}</h2>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-gray-800">{subjects.length}</p>
            <p className="text-sm text-gray-500 font-medium">asignatura{subjects.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Subjects grid */}
      {subjects.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-16 text-center border-2 border-dashed border-gray-200 shadow-xl">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-3xl opacity-20 blur-xl" />
            <div className="relative w-full h-full bg-white rounded-3xl flex items-center justify-center shadow-xl border border-gray-100">
              <BookOpen className="w-12 h-12 text-gray-300" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Este grado aún no tiene asignaturas</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">Comienza agregando las materias que se impartirán en este grado</p>
          <button
            onClick={onAddSubject}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 inline-flex items-center gap-3"
          >
            <Plus className="w-5 h-5" />
            Agregar Primera Asignatura
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {subjects.map(subject => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              teacher={getTeacherForSubject(subject.id)}
              onEdit={() => onEditSubject(subject)}
              onAssignTeacher={() => onAssignTeacher(subject)}
              onToggleStatus={() => onToggleStatus(subject)}
            />
          ))}
          <AddSubjectCard onClick={onAddSubject} theme={theme} />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SubjectsPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjectTeachers, setSubjectTeachers] = useState({});
  
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [levelColorIndex, setLevelColorIndex] = useState(0);
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, subjectsRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      setLevels(levelsRes.data);
      setGrades(gradesRes.data);
      setSubjects(subjectsRes.data);
      setTeachers(usersRes.data.filter(u => u.role === "teacher"));
      
      const teacherAssignments = {};
      for (const subject of subjectsRes.data) {
        try {
          const res = await axios.get(`${API}/academic/subjects/${subject.id}/teachers`, { headers });
          teacherAssignments[subject.id] = res.data.teachers?.map(t => t.id) || [];
        } catch (err) {
          teacherAssignments[subject.id] = [];
        }
      }
      setSubjectTeachers(teacherAssignments);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await axios.get(`${API}/academic/subjects`, { headers });
      setSubjects(res.data);
    } catch (err) {
      console.error("Error loading subjects:", err);
    }
  };

  const handleSelectGrade = (level, grade) => {
    const levelIndex = levels.findIndex(l => l.id === level.id);
    setLevelColorIndex(levelIndex >= 0 ? levelIndex : 0);
    setSelectedLevel(level);
    setSelectedGrade(grade);
  };

  const handleNavigate = (index) => {
    if (index === 0) {
      setSelectedLevel(null);
      setSelectedGrade(null);
    }
  };

  const handleSaveSubject = async (data) => {
    const subjectData = {
      name: data.name,
      code: data.code,
      description: data.description,
      level_id: data.level_id,
      grade_id: data.grade_id,
      weekly_hours: data.weekly_hours,
      color: data.color,
      status: data.status
    };

    let subjectId;
    
    if (editingSubject?.id) {
      await axios.put(`${API}/academic/subjects/${editingSubject.id}`, subjectData, { headers });
      subjectId = editingSubject.id;
    } else {
      const res = await axios.post(`${API}/academic/subjects`, subjectData, { headers });
      subjectId = res.data.subject.id;
    }
    
    if (data.teacher_id) {
      await axios.post(`${API}/academic/subjects/${subjectId}/teachers`, { teacher_ids: [data.teacher_id] }, { headers });
      setSubjectTeachers(prev => ({ ...prev, [subjectId]: [data.teacher_id] }));
    } else if (editingSubject?.id) {
      await axios.post(`${API}/academic/subjects/${subjectId}/teachers`, { teacher_ids: [] }, { headers });
      setSubjectTeachers(prev => ({ ...prev, [subjectId]: [] }));
    }
    
    loadSubjects();
  };

  const handleAssignTeacher = async (teacherIds) => {
    if (!selectedSubjectForTeacher) return;
    await axios.post(`${API}/academic/subjects/${selectedSubjectForTeacher.id}/teachers`, { teacher_ids: teacherIds }, { headers });
    setSubjectTeachers(prev => ({ ...prev, [selectedSubjectForTeacher.id]: teacherIds }));
    loadSubjects();
  };

  const handleToggleStatus = async (subject) => {
    const newStatus = subject.status === "active" ? "inactive" : "active";
    await axios.put(`${API}/academic/subjects/${subject.id}`, { status: newStatus }, { headers });
    loadSubjects();
  };

  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setShowSubjectModal(true);
  };

  const openEditSubjectModal = (subject) => {
    const currentTeachers = subjectTeachers[subject.id] || [];
    setEditingSubject({ ...subject, teacher_id: currentTeachers[0] || "" });
    setShowSubjectModal(true);
  };

  const openTeacherModal = (subject) => {
    setSelectedSubjectForTeacher(subject);
    setShowTeacherModal(true);
  };

  const breadcrumbItems = [{ label: "Asignaturas", path: null }];
  if (selectedLevel) {
    breadcrumbItems.push({ label: selectedLevel.nombre, path: null });
  }
  if (selectedGrade) {
    breadcrumbItems.push({ label: selectedGrade.nombre, path: null });
  }

  const gradeSubjects = selectedGrade 
    ? subjects.filter(s => s.grade_id === selectedGrade.id)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-full h-full bg-white rounded-2xl flex items-center justify-center shadow-xl">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Cargando asignaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 flex" data-testid="subjects-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Premium Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <BookOpen className="w-5 h-5 text-gray-600" />
            </button>
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="h-9 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{settings?.system_name || "Instituto"}</h1>
              <p className="text-xs text-gray-400 font-medium">Gestión Académica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-gray-400 capitalize font-medium">{user?.role}</p>
            </div>
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white shadow-lg" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {selectedGrade && (
                <button
                  onClick={() => handleNavigate(0)}
                  className="p-3 bg-white hover:bg-gray-50 rounded-xl transition-all shadow-md hover:shadow-lg border border-gray-100"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
              )}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-xl opacity-30" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Asignaturas</h1>
                <p className="text-sm text-gray-500">
                  {selectedGrade 
                    ? `${selectedLevel?.nombre} - ${selectedGrade?.nombre}`
                    : "Gestiona las materias por nivel y grado"
                  }
                </p>
              </div>
            </div>

            {selectedGrade && (
              <Breadcrumb items={breadcrumbItems} onNavigate={handleNavigate} />
            )}
          </div>

          {/* Content */}
          {!selectedGrade ? (
            <LevelsView
              levels={levels}
              grades={grades}
              subjects={subjects}
              onSelectGrade={handleSelectGrade}
            />
          ) : (
            <GradeSubjectsView
              level={selectedLevel}
              grade={selectedGrade}
              subjects={gradeSubjects}
              teachers={teachers}
              subjectTeachers={subjectTeachers}
              levelColorIndex={levelColorIndex}
              onAddSubject={openAddSubjectModal}
              onEditSubject={openEditSubjectModal}
              onAssignTeacher={openTeacherModal}
              onToggleStatus={handleToggleStatus}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <SubjectFormModal
        isOpen={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        subject={editingSubject}
        onSave={handleSaveSubject}
        levels={levels}
        grades={grades}
        teachers={teachers}
        preselectedLevel={selectedLevel?.id}
        preselectedGrade={selectedGrade?.id}
      />
      <TeacherAssignModal
        isOpen={showTeacherModal}
        onClose={() => { setShowTeacherModal(false); setSelectedSubjectForTeacher(null); }}
        subject={selectedSubjectForTeacher}
        teachers={teachers}
        currentTeacherId={selectedSubjectForTeacher ? (subjectTeachers[selectedSubjectForTeacher.id]?.[0] || "") : ""}
        onSave={handleAssignTeacher}
      />
    </div>
  );
}
