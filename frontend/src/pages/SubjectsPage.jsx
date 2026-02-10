import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  Users, Search, ChevronRight, Clock, MoreVertical, UserPlus,
  GraduationCap, Layers, Home, ArrowLeft, User, Power, PowerOff
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

// Level colors for visual distinction
const LEVEL_COLORS = {
  0: { bg: "from-violet-500 to-purple-600", light: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  1: { bg: "from-blue-500 to-indigo-600", light: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  2: { bg: "from-emerald-500 to-teal-600", light: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  3: { bg: "from-amber-500 to-orange-600", light: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════════════════════════════════════════════════
function LevelsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-lg w-40 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="h-32 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BREADCRUMB NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function Breadcrumb({ items, onNavigate }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          <button
            onClick={() => onNavigate(index)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              index === items.length - 1
                ? "bg-blue-100 text-blue-700 font-semibold"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            {index === 0 && <Home className="w-4 h-4" />}
            {item.label}
          </button>
        </div>
      ))}
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRADE CARD
// ══════════════════════════════════════════════════════════════════════════════
function GradeCard({ grade, levelColor, subjectCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative bg-white rounded-2xl p-5 border-2 ${levelColor.border} hover:shadow-lg hover:scale-[1.02] transition-all duration-300 text-left`}
      data-testid={`grade-card-${grade.id}`}
    >
      {/* Subject count badge */}
      {subjectCount > 0 && (
        <div className={`absolute -top-2 -right-2 w-7 h-7 ${levelColor.light} ${levelColor.text} rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm`}>
          {subjectCount}
        </div>
      )}
      
      {/* Icon */}
      <div className={`w-12 h-12 bg-gradient-to-br ${levelColor.bg} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
        <GraduationCap className="w-6 h-6 text-white" />
      </div>
      
      {/* Grade name */}
      <h3 className="font-bold text-gray-800 text-lg mb-1">{grade.nombre}</h3>
      <p className="text-xs text-gray-400">
        {subjectCount === 0 ? "Sin asignaturas" : `${subjectCount} asignatura${subjectCount !== 1 ? "s" : ""}`}
      </p>
      
      {/* Hover indicator */}
      <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
        <ChevronRight className={`w-5 h-5 ${levelColor.text}`} />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function SubjectCard({ subject, teacher, onEdit, onAssignTeacher, onToggleStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <div 
      className={`group relative bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ${subject.status === "inactive" ? "opacity-60" : ""}`}
      data-testid={`subject-card-${subject.id}`}
    >
      {/* Color header */}
      <div 
        className="h-3 w-full"
        style={{ backgroundColor: subject.color }}
      />
      
      <div className="p-4">
        {/* Menu button */}
        <div className="absolute top-5 right-3">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {/* Dropdown menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-48">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(subject); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar asignatura
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onAssignTeacher(subject); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {teacher ? "Cambiar profesor" : "Asignar profesor"}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onToggleStatus(subject); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {subject.status === "active" ? (
                    <>
                      <PowerOff className="w-4 h-4" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      Activar
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Subject icon */}
        <div 
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: subject.color + "20" }}
        >
          <BookOpen className="w-5 h-5" style={{ color: subject.color }} />
        </div>
        
        {/* Subject info */}
        <h3 className="font-bold text-gray-800 text-sm mb-0.5 pr-6 line-clamp-1">{subject.name}</h3>
        <p className="text-xs text-gray-400 mb-3">{subject.code}</p>
        
        {/* Teacher */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          {teacher ? (
            <>
              {teacher.photo_url ? (
                <img src={teacher.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 text-xs font-semibold">
                  {teacher.name?.charAt(0)}
                </div>
              )}
              <span className="text-xs text-gray-600 font-medium truncate">{teacher.name} {teacher.last_name?.charAt(0)}.</span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-300" />
              </div>
              <span className="text-xs text-gray-400 italic">Sin profesor</span>
            </>
          )}
        </div>
        
        {/* Hours badge */}
        {subject.weekly_hours && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {subject.weekly_hours}h
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD SUBJECT CARD
// ══════════════════════════════════════════════════════════════════════════════
function AddSubjectCard({ onClick, levelColor }) {
  return (
    <button
      onClick={onClick}
      className={`group relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border-2 border-dashed border-gray-200 hover:border-blue-300 hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 flex flex-col items-center justify-center min-h-[176px]`}
      data-testid="add-subject-card"
    >
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all border border-gray-100">
        <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
      <span className="text-sm font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">Nueva asignatura</span>
      <span className="text-xs text-gray-400 mt-1">Agregar a este grado</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL
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
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {subject?.id ? "Editar Asignatura" : "Nueva Asignatura"}
              </h2>
              <p className="text-xs text-blue-100">Complete los datos de la materia</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3">
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
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Código *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="Ej: MAT-01"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              />
            </div>
          </div>

          {/* Level and Grade - locked if preselected */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nivel *</label>
              <select
                value={formData.level_id}
                onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "" }))}
                disabled={isLocked}
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLocked ? "opacity-70 cursor-not-allowed" : ""}`}
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
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLocked || !formData.level_id ? "opacity-70 cursor-not-allowed" : ""}`}
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
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Profesor</label>
              <select
                value={formData.teacher_id}
                onChange={(e) => setFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className={`w-9 h-9 rounded-lg transition-all ${
                    formData.color === color.value 
                      ? "ring-2 ring-offset-2 ring-gray-400 scale-110" 
                      : "hover:scale-105"
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
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
// TEACHER ASSIGNMENT MODAL
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
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Asignar Profesor</h2>
              <p className="text-xs text-violet-100">{subject.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar profesor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Option to remove teacher */}
          <button
            onClick={() => setSelectedTeacher("")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-all ${
              selectedTeacher === "" 
                ? "bg-rose-50 border-2 border-rose-300" 
                : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedTeacher === "" ? "bg-rose-500 border-rose-500" : "border-gray-300"
            }`}>
              {selectedTeacher === "" && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-600">Sin profesor asignado</span>
          </button>

          {/* Teachers list */}
          <div className="max-h-[280px] overflow-y-auto space-y-2">
            {filteredTeachers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay profesores disponibles</p>
              </div>
            ) : (
              filteredTeachers.map(teacher => {
                const isSelected = selectedTeacher === teacher.id;
                return (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isSelected 
                        ? "bg-violet-50 border-2 border-violet-300" 
                        : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {teacher.photo_url ? (
                      <img src={teacher.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500 font-semibold">
                        {teacher.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-800 truncate">
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
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
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
// LEVELS VIEW (MAIN VIEW)
// ══════════════════════════════════════════════════════════════════════════════
function LevelsView({ levels, grades, subjects, onSelectGrade }) {
  // Group grades by level
  const gradesByLevel = {};
  levels.forEach(level => {
    gradesByLevel[level.id] = grades.filter(g => g.nivel_id === level.id && g.activo);
  });

  // Count subjects by grade
  const subjectCountByGrade = {};
  subjects.forEach(subject => {
    if (subject.grade_id) {
      subjectCountByGrade[subject.grade_id] = (subjectCountByGrade[subject.grade_id] || 0) + 1;
    }
  });

  return (
    <div className="space-y-10">
      {levels.filter(l => l.activo).map((level, levelIndex) => {
        const levelGrades = gradesByLevel[level.id] || [];
        const levelColor = LEVEL_COLORS[levelIndex % Object.keys(LEVEL_COLORS).length];
        
        return (
          <div key={level.id} data-testid={`level-section-${level.id}`}>
            {/* Level header */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 bg-gradient-to-br ${levelColor.bg} rounded-xl flex items-center justify-center shadow-lg`}>
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{level.nombre}</h2>
                <p className="text-sm text-gray-400">{levelGrades.length} grado{levelGrades.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            
            {/* Grades grid */}
            {levelGrades.length === 0 ? (
              <div className={`${levelColor.light} rounded-2xl p-8 text-center border ${levelColor.border}`}>
                <GraduationCap className={`w-12 h-12 ${levelColor.text} mx-auto mb-3 opacity-50`} />
                <p className={`${levelColor.text} font-medium`}>Este nivel no tiene grados configurados</p>
                <p className="text-sm text-gray-400 mt-1">Agrega grados en Ajustes Académicos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {levelGrades.map(grade => (
                  <GradeCard
                    key={grade.id}
                    grade={grade}
                    levelColor={levelColor}
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
// GRADE SUBJECTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function GradeSubjectsView({ level, grade, subjects, teachers, subjectTeachers, onAddSubject, onEditSubject, onAssignTeacher, onToggleStatus, levelColorIndex }) {
  const levelColor = LEVEL_COLORS[levelColorIndex % Object.keys(LEVEL_COLORS).length];
  
  // Get teacher for each subject
  const getTeacherForSubject = (subjectId) => {
    const assignment = subjectTeachers[subjectId];
    if (assignment && assignment.length > 0) {
      return teachers.find(t => t.id === assignment[0]);
    }
    return null;
  };

  return (
    <div>
      {/* Grade header */}
      <div className={`${levelColor.light} rounded-2xl p-6 mb-6 border ${levelColor.border}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${levelColor.bg} rounded-xl flex items-center justify-center shadow-lg`}>
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{grade.nombre}</h2>
            <p className={`text-sm ${levelColor.text} font-medium`}>{level.nombre}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-bold text-gray-800">{subjects.length}</p>
            <p className="text-sm text-gray-500">asignatura{subjects.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Subjects grid */}
      {subjects.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Este grado aún no tiene asignaturas</h3>
          <p className="text-sm text-gray-400 mb-6">Comienza agregando la primera asignatura</p>
          <button
            onClick={onAddSubject}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Agregar Asignatura
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
          <AddSubjectCard onClick={onAddSubject} levelColor={levelColor} />
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
  
  // Navigation state
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [levelColorIndex, setLevelColorIndex] = useState(0);
  
  // Modal state
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
      
      // Load teacher assignments for all subjects
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
    
    // Assign teacher if selected
    if (data.teacher_id) {
      await axios.post(`${API}/academic/subjects/${subjectId}/teachers`, { teacher_ids: [data.teacher_id] }, { headers });
      setSubjectTeachers(prev => ({ ...prev, [subjectId]: [data.teacher_id] }));
    } else if (editingSubject?.id) {
      // Remove teacher if none selected during edit
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
    // Find current teacher for this subject
    const currentTeachers = subjectTeachers[subject.id] || [];
    setEditingSubject({ ...subject, teacher_id: currentTeachers[0] || "" });
    setShowSubjectModal(true);
  };

  const openTeacherModal = (subject) => {
    setSelectedSubjectForTeacher(subject);
    setShowTeacherModal(true);
  };

  // Build breadcrumb items
  const breadcrumbItems = [{ label: "Asignaturas", path: null }];
  if (selectedLevel) {
    breadcrumbItems.push({ label: selectedLevel.nombre, path: null });
  }
  if (selectedGrade) {
    breadcrumbItems.push({ label: selectedGrade.nombre, path: null });
  }

  // Filter subjects for selected grade
  const gradeSubjects = selectedGrade 
    ? subjects.filter(s => s.grade_id === selectedGrade.id)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">Cargando asignaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="subjects-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl">
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
              <img src={user.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100" />
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
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              {selectedGrade && (
                <button
                  onClick={() => handleNavigate(0)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
              )}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Asignaturas</h1>
                <p className="text-sm text-gray-500">
                  {selectedGrade 
                    ? `${selectedLevel?.nombre} - ${selectedGrade?.nombre}`
                    : "Gestiona las materias por nivel y grado"
                  }
                </p>
              </div>
            </div>

            {/* Breadcrumb */}
            {selectedGrade && (
              <Breadcrumb items={breadcrumbItems} onNavigate={handleNavigate} />
            )}
          </div>

          {/* Content */}
          {!selectedGrade ? (
            // Show levels and grades overview
            <LevelsView
              levels={levels}
              grades={grades}
              subjects={subjects}
              onSelectGrade={handleSelectGrade}
            />
          ) : (
            // Show subjects for selected grade
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
