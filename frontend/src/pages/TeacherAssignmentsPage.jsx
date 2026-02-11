import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, 
  Users, Search, ChevronRight, MoreVertical, User, Filter,
  GraduationCap, Layers, Calendar, Briefcase, Trash2,
  ChevronDown, UserCheck, BookMarked
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ══════════════════════════════════════════════════════════════════════════════
// FILTER BAR COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function FilterBar({ filters, setFilters, levels, grades, sections, subjects, teachers, onClear }) {
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter grades by selected level
  const filteredGrades = filters.level_id 
    ? grades.filter(g => g.nivel_id === filters.level_id)
    : grades;
  
  const activeFiltersCount = Object.values(filters).filter(v => v).length;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
        >
          <Filter className="w-5 h-5" />
          <span className="font-medium">Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        
        {activeFiltersCount > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-gray-100">
          {/* Level Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nivel</label>
            <select
              value={filters.level_id || ""}
              onChange={(e) => setFilters({...filters, level_id: e.target.value, grade_id: ""})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          
          {/* Grade Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Grado</label>
            <select
              value={filters.grade_id || ""}
              onChange={(e) => setFilters({...filters, grade_id: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!filters.level_id}
            >
              <option value="">Todos</option>
              {filteredGrades.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>
          
          {/* Section Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sección</label>
            <select
              value={filters.section_id || ""}
              onChange={(e) => setFilters({...filters, section_id: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          
          {/* Subject Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Asignatura</label>
            <select
              value={filters.subject_id || ""}
              onChange={(e) => setFilters({...filters, subject_id: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          {/* Teacher Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Profesor</label>
            <select
              value={filters.teacher_id || ""}
              onChange={(e) => setFilters({...filters, teacher_id: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
              ))}
            </select>
          </div>
          
          {/* Year Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año Escolar</label>
            <select
              value={filters.school_year || ""}
              onChange={(e) => setFilters({...filters, school_year: e.target.value ? parseInt(e.target.value) : ""})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function AssignmentCard({ assignment, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group"
      data-testid={`assignment-card-${assignment.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Subject Color Indicator */}
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
            style={{ backgroundColor: assignment.subject_color || '#3B82F6' }}
          >
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{assignment.subject_name}</h3>
            <p className="text-xs text-gray-500">{assignment.subject_code}</p>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            data-testid={`assignment-menu-${assignment.id}`}
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 min-w-[140px]">
                <button
                  onClick={() => { onEdit(assignment); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => { onDelete(assignment); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Teacher Info */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
        {assignment.teacher_photo ? (
          <img src={assignment.teacher_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
            {assignment.teacher_name?.charAt(0) || "P"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{assignment.teacher_name}</p>
          <p className="text-xs text-gray-500 capitalize">{assignment.role}</p>
        </div>
      </div>
      
      {/* Context Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
          <span className="truncate">{assignment.level_name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Layers className="w-3.5 h-3.5 text-purple-500" />
          <span className="truncate">{assignment.grade_name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sección {assignment.section_name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          <span>{assignment.school_year}</span>
        </div>
      </div>
      
      {/* Status Badge */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          assignment.status === 'activo' 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${assignment.status === 'activo' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {assignment.status === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEACHERS SUMMARY SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════
function TeachersSummary({ teachers, onSelect, selectedTeacherId }) {
  if (!teachers.length) return null;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-blue-500" />
        Carga Docente
      </h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {teachers.map(teacher => (
          <button
            key={teacher.id}
            onClick={() => onSelect(teacher.id === selectedTeacherId ? null : teacher.id)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
              teacher.id === selectedTeacherId 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            {teacher.photo_url ? (
              <img src={teacher.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {teacher.name?.charAt(0) || "P"}
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{teacher.name}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
              teacher.assignments_count > 0 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              {teacher.assignments_count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT ASSIGNMENT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AssignmentModal({ isOpen, onClose, token, assignment, onSuccess, academicData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    level_id: "",
    grade_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    period_id: "",
    role: "titular",
    status: "activo"
  });
  
  const isEdit = !!assignment;
  const headers = { Authorization: `Bearer ${token}` };
  
  // Cascade filters - STRICT HIERARCHY
  // Grades filtered by Level
  const filteredGrades = form.level_id 
    ? academicData.grades.filter(g => g.nivel_id === form.level_id)
    : [];
  
  // Sections filtered by Grade (FIXED)
  const filteredSections = form.grade_id 
    ? academicData.sections.filter(s => s.grado_id === form.grade_id)
    : [];
  
  // Subjects filtered by Level + Grade
  const filteredSubjects = (form.level_id && form.grade_id)
    ? academicData.subjects.filter(s => 
        s.level_id === form.level_id && s.grade_id === form.grade_id
      )
    : [];
  
  // Sort periods by date (most recent first)
  const sortedPeriods = [...(academicData.periods || [])].sort((a, b) => 
    new Date(b.fecha_inicio) - new Date(a.fecha_inicio)
  );
  
  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setForm({
          level_id: assignment.level_id || "",
          grade_id: assignment.grade_id || "",
          section_id: assignment.section_id || "",
          subject_id: assignment.subject_id || "",
          teacher_id: assignment.teacher_id || "",
          period_id: assignment.period_id || "",
          role: assignment.role || "titular",
          status: assignment.status || "activo"
        });
      } else {
        // Find the active period or most recent one as default
        const activePeriod = academicData.periods?.find(p => p.activo);
        const defaultPeriodId = activePeriod?.id || sortedPeriods[0]?.id || "";
        
        setForm({
          level_id: "",
          grade_id: "",
          section_id: "",
          subject_id: "",
          teacher_id: "",
          period_id: defaultPeriodId,
          role: "titular",
          status: "activo"
        });
      }
      setError("");
    }
  }, [isOpen, assignment, academicData.periods]);
  
  // Handler for Level change - reset dependent fields
  const handleLevelChange = (e) => {
    setForm({
      ...form,
      level_id: e.target.value,
      grade_id: "",
      section_id: "",
      subject_id: ""
    });
  };
  
  // Handler for Grade change - reset dependent fields
  const handleGradeChange = (e) => {
    setForm({
      ...form,
      grade_id: e.target.value,
      section_id: "",
      subject_id: ""
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!form.level_id || !form.grade_id || !form.section_id || !form.subject_id || !form.teacher_id) {
      setError("Todos los campos son obligatorios");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      if (isEdit) {
        await axios.put(`${API}/academic/assignments/${assignment.id}`, form, { headers });
      } else {
        await axios.post(`${API}/academic/assignments`, form, { headers });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar la asignación");
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" data-testid="assignment-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nueva"} Asignación</h2>
                <p className="text-sm text-white/80">Asignar profesor a asignatura</p>
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
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <GraduationCap className="w-4 h-4 inline mr-1 text-blue-500" />
                Nivel Educativo *
              </label>
              <select
                value={form.level_id}
                onChange={handleLevelChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              >
                <option value="">Seleccionar nivel...</option>
                {academicData.levels.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            
            {/* Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Layers className="w-4 h-4 inline mr-1 text-purple-500" />
                Grado *
              </label>
              <select
                value={form.grade_id}
                onChange={handleGradeChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
                required
                disabled={!form.level_id}
              >
                <option value="">Seleccionar grado...</option>
                {filteredGrades.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              {!form.level_id && (
                <p className="text-xs text-gray-400 mt-1">Primero selecciona un nivel</p>
              )}
            </div>
            
            {/* Section - FILTERED BY GRADE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users className="w-4 h-4 inline mr-1 text-emerald-500" />
                Sección *
              </label>
              <select
                value={form.section_id}
                onChange={(e) => setForm({...form, section_id: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
                required
                disabled={!form.grade_id}
              >
                <option value="">Seleccionar sección...</option>
                {filteredSections.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {!form.grade_id && (
                <p className="text-xs text-gray-400 mt-1">Primero selecciona un grado</p>
              )}
              {form.grade_id && filteredSections.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay secciones registradas para este grado</p>
              )}
            </div>
            
            {/* Subject - FILTERED BY LEVEL + GRADE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <BookOpen className="w-4 h-4 inline mr-1 text-amber-500" />
                Asignatura *
              </label>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({...form, subject_id: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
                required
                disabled={!form.grade_id}
              >
                <option value="">Seleccionar asignatura...</option>
                {filteredSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
              {!form.grade_id && (
                <p className="text-xs text-gray-400 mt-1">Primero selecciona un grado</p>
              )}
              {form.grade_id && filteredSubjects.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay asignaturas registradas para este nivel/grado</p>
              )}
            </div>
            
            {/* Teacher */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1 text-indigo-500" />
                Profesor *
              </label>
              {academicData.teachers.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  No hay profesores registrados con rol activo.
                </div>
              ) : (
                <select
                  value={form.teacher_id}
                  onChange={(e) => setForm({...form, teacher_id: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Seleccionar profesor...</option>
                  {academicData.teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>
                  ))}
                </select>
              )}
            </div>
            
            {/* Role & Year Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Briefcase className="w-4 h-4 inline mr-1 text-rose-500" />
                  Rol
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({...form, role: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="titular">Titular</option>
                  <option value="auxiliar">Auxiliar</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1 text-cyan-500" />
                  Año Escolar
                </label>
                <select
                  value={form.school_year}
                  onChange={(e) => setForm({...form, school_year: parseInt(e.target.value)})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>
            </div>
            
            {/* Status (only for edit) */}
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({...form, status: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || academicData.teachers.length === 0}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="assignment-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isEdit ? "Guardar Cambios" : "Asignar Profesor"}
                  </>
                )}
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
export default function TeacherAssignmentsPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [teachersSummary, setTeachersSummary] = useState([]);
  
  // Academic data for form
  const [academicData, setAcademicData] = useState({
    levels: [],
    grades: [],
    sections: [],
    subjects: [],
    teachers: [],
    periods: []
  });
  
  // Filters
  const [filters, setFilters] = useState({
    level_id: "",
    grade_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    school_year: ""
  });
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;
  
  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        setSettings(res.data);
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };
    loadSettings();
  }, []);
  
  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query params for assignments
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      // Fetch all data in parallel
      const [
        assignmentsRes,
        teachersSummaryRes,
        levelsRes,
        gradesRes,
        sectionsRes,
        subjectsRes,
        teachersRes,
        periodsRes
      ] = await Promise.all([
        axios.get(`${API}/academic/assignments?${params}`, { headers }),
        axios.get(`${API}/academic/assignments/teachers-summary`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/users/teachers/active`, { headers }),
        axios.get(`${API}/academic/periods`, { headers })
      ]);
      
      setAssignments(assignmentsRes.data);
      setTeachersSummary(teachersSummaryRes.data);
      setAcademicData({
        levels: levelsRes.data,
        grades: gradesRes.data,
        sections: sectionsRes.data,
        subjects: subjectsRes.data,
        teachers: teachersRes.data,
        periods: periodsRes.data
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [filters]);
  
  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setShowModal(true);
  };
  
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await axios.delete(`${API}/academic/assignments/${deleteConfirm.id}`, { headers });
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting assignment:", error);
    }
  };
  
  const handleTeacherSelect = (teacherId) => {
    setFilters(prev => ({
      ...prev,
      teacher_id: teacherId || ""
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      level_id: "",
      grade_id: "",
      section_id: "",
      subject_id: "",
      teacher_id: "",
      school_year: ""
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex">
      <Sidebar 
        user={user}
        settings={settings}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />
        
        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <BookMarked className="w-6 h-6 text-white" />
                  </div>
                  Asignación Docente
                </h1>
                <p className="text-gray-500 mt-1 ml-15">
                  Gestiona la asignación de profesores a asignaturas
                </p>
              </div>
              
              <button
                onClick={() => { setEditingAssignment(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 font-medium"
                data-testid="new-assignment-btn"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nueva Asignación</span>
              </button>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Left: Assignments List */}
            <div className="lg:col-span-3">
              {/* Filters */}
              <FilterBar 
                filters={filters}
                setFilters={setFilters}
                levels={academicData.levels}
                grades={academicData.grades}
                sections={academicData.sections}
                subjects={academicData.subjects}
                teachers={academicData.teachers}
                onClear={clearFilters}
              />
            
            {/* Assignments Grid */}
            {loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-10 bg-gray-100 rounded-lg mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-4 bg-gray-100 rounded" />
                      <div className="h-4 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {Object.values(filters).some(v => v) 
                    ? "No se encontraron asignaciones con los filtros seleccionados"
                    : "No hay asignaciones docentes"
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {Object.values(filters).some(v => v)
                    ? "Prueba modificando los filtros o limpiándolos"
                    : "Comienza asignando profesores a las asignaturas"
                  }
                </p>
                {!Object.values(filters).some(v => v) && (
                  <button
                    onClick={() => { setEditingAssignment(null); setShowModal(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Asignación
                  </button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {assignments.map(assignment => (
                  <AssignmentCard 
                    key={assignment.id}
                    assignment={assignment}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirm}
                  />
                ))}
              </div>
            )}
            
            {/* Results Count */}
            {!loading && assignments.length > 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Mostrando {assignments.length} asignación{assignments.length !== 1 ? "es" : ""}
              </div>
            )}
          </div>
          
          {/* Right: Teachers Summary */}
          <div className="lg:col-span-1">
            <TeachersSummary 
              teachers={teachersSummary}
              onSelect={handleTeacherSelect}
              selectedTeacherId={filters.teacher_id}
            />
          </div>
        </div>
        </main>
      </div>
      
      {/* Modals */}
      <AssignmentModal 
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAssignment(null); }}
        token={token}
        assignment={editingAssignment}
        onSuccess={fetchData}
        academicData={academicData}
      />
      
      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Eliminar Asignación"
        message={`¿Estás seguro de eliminar esta asignación? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmColor="red"
      />
    </div>
  );
}
