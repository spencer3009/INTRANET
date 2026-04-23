import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import FloatingHelpAvatar from "@/components/FloatingHelpAvatar";
import CourseLoadingScreen from "@/components/CourseLoadingScreen";
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
function FilterBar({ filters, setFilters, levels, grades, sections, subjects, teachers, academicYears, onClear }) {
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
          
          {/* Academic Year Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año Académico</label>
            <select
              value={filters.academic_year_id || ""}
              onChange={(e) => setFilters({...filters, academic_year_id: e.target.value || ""})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year} {y.status === "activo" ? "✓" : ""}</option>
              ))}
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
          <span>{assignment.academic_year || assignment.school_year}</span>
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
function AssignmentModal({ isOpen, onClose, token, assignment, onSuccess, academicData, existingAssignments = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const teacherRef = useRef(null);
  const subjectRef = useRef(null);
  const [form, setForm] = useState({
    level_id: "",
    grade_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    academic_year_id: "",
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
  
  // Subjects filtered by Level + Grade + Section AND excluding already assigned subjects in this section
  const filteredSubjects = (form.level_id && form.grade_id)
    ? academicData.subjects.filter(s => {
        // Must match level and grade
        if (s.level_id !== form.level_id || s.grade_id !== form.grade_id) return false;
        
        // If section is selected, must match section
        if (form.section_id && s.section_id && s.section_id !== form.section_id) return false;
        
        // If section is selected, check if this subject is already assigned in this section
        if (form.section_id) {
          const alreadyAssigned = existingAssignments.some(a => 
            a.level_id === form.level_id &&
            a.grade_id === form.grade_id &&
            a.section_id === form.section_id &&
            a.subject_id === s.id &&
            // If editing, don't exclude the current assignment's subject
            (!isEdit || a.id !== assignment?.id)
          );
          if (alreadyAssigned) return false;
        }
        
        return true;
      })
    : [];
  
  // Sort academic years (active first, then by year descending)
  const sortedYears = [...(academicData.academicYears || [])].sort((a, b) => {
    if (a.status === "activo" && b.status !== "activo") return -1;
    if (b.status === "activo" && a.status !== "activo") return 1;
    return b.year - a.year;
  });
  
  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setForm({
          level_id: assignment.level_id || "",
          grade_id: assignment.grade_id || "",
          section_id: assignment.section_id || "",
          subject_id: assignment.subject_id || "",
          teacher_id: assignment.teacher_id || "",
          academic_year_id: assignment.academic_year_id || "",
          role: assignment.role || "titular",
          status: assignment.status || "activo"
        });
      } else {
        // Find the active year as default
        const activeYear = academicData.academicYears?.find(y => y.status === "activo");
        const defaultYearId = activeYear?.id || sortedYears[0]?.id || "";
        
        setForm({
          level_id: "",
          grade_id: "",
          section_id: "",
          subject_id: "",
          teacher_id: "",
          academic_year_id: defaultYearId,
          role: "titular",
          status: "activo"
        });
      }
      setError("");
      setTeacherSearch("");
      setSubjectSearch("");
      setTeacherOpen(false);
      setSubjectOpen(false);
    }
  }, [isOpen, assignment, academicData.academicYears]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (teacherRef.current && !teacherRef.current.contains(e.target)) setTeacherOpen(false);
      if (subjectRef.current && !subjectRef.current.contains(e.target)) setSubjectOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
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
    
    if (!form.academic_year_id) {
      setError("Selecciona un año académico");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Get the year to extract school_year for backward compatibility
      const selectedYear = academicData.academicYears?.find(y => y.id === form.academic_year_id);
      const schoolYear = selectedYear?.year || new Date().getFullYear();
      
      const submitData = {
        ...form,
        school_year: schoolYear // Keep school_year for backward compatibility
      };
      
      if (isEdit) {
        await axios.put(`${API}/academic/assignments/${assignment.id}`, submitData, { headers });
      } else {
        await axios.post(`${API}/academic/assignments`, submitData, { headers });
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
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
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
            
            {/* Subject - AUTOCOMPLETE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <BookOpen className="w-4 h-4 inline mr-1 text-amber-500" />
                Asignatura *
              </label>
              {!form.grade_id ? (
                <div className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm">
                  Primero selecciona un grado
                </div>
              ) : (
                <div className="relative" ref={subjectRef}>
                  {form.subject_id && !subjectOpen ? (
                    (() => {
                      const sel = filteredSubjects.find(s => s.id === form.subject_id);
                      return (
                        <div
                          className="w-full flex items-center gap-3 px-4 py-2 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                          onClick={() => { setSubjectOpen(true); setSubjectSearch(""); }}
                          data-testid="subject-selected-preview"
                        >
                          {sel?.image_url ? (
                            <img src={sel.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (sel?.color || '#F59E0B') + '20' }}>
                              <BookOpen className="w-4 h-4" style={{ color: sel?.color || '#F59E0B' }} />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-800 truncate">{sel?.name} ({sel?.code})</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setForm({...form, subject_id: ""}); setSubjectSearch(""); }} className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <input
                      type="text"
                      placeholder="Buscar asignatura..."
                      value={subjectSearch}
                      onChange={(e) => { setSubjectSearch(e.target.value); setSubjectOpen(true); }}
                      onFocus={() => { setSubjectOpen(true); setSubjectSearch(""); }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      data-testid="subject-autocomplete-input"
                    />
                  )}
                  {subjectOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredSubjects
                        .filter(s => {
                          const q = subjectSearch.toLowerCase();
                          return !q || s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q);
                        })
                        .map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setForm({...form, subject_id: s.id}); setSubjectOpen(false); setSubjectSearch(""); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left ${form.subject_id === s.id ? "bg-blue-50" : ""}`}
                            data-testid={`subject-option-${s.id}`}
                          >
                            {s.image_url ? (
                              <img src={s.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (s.color || '#F59E0B') + '20' }}>
                                <BookOpen className="w-4 h-4" style={{ color: s.color || '#F59E0B' }} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                              <p className="text-xs text-gray-500">{s.code}</p>
                            </div>
                            {form.subject_id === s.id && <Check className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" />}
                          </button>
                        ))
                      }
                      {filteredSubjects.filter(s => {
                        const q = subjectSearch.toLowerCase();
                        return !q || s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q);
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {form.grade_id && form.section_id && filteredSubjects.length === 0 && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Todas las asignaturas de esta sección ya tienen docente asignado
                </p>
              )}
            </div>
            
            {/* Teacher - AUTOCOMPLETE WITH PHOTOS */}
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
                <div className="relative" ref={teacherRef}>
                  {/* Selected teacher preview or search input */}
                  {form.teacher_id && !teacherOpen ? (
                    <div
                      className="w-full flex items-center gap-3 px-4 py-2 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                      onClick={() => { setTeacherOpen(true); setTeacherSearch(""); }}
                      data-testid="teacher-selected-preview"
                    >
                      {(() => {
                        const t = academicData.teachers.find(t => t.id === form.teacher_id);
                        if (!t) return <span className="text-gray-400 text-sm">Seleccionar profesor...</span>;
                        return (
                          <>
                            {t.photo_url ? (
                              <img src={t.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-indigo-600" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 truncate">{t.name} {t.last_name}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setForm({...form, teacher_id: ""}); setTeacherSearch(""); }} className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Buscar profesor por nombre..."
                      value={teacherSearch}
                      onChange={(e) => { setTeacherSearch(e.target.value); setTeacherOpen(true); }}
                      onFocus={() => setTeacherOpen(true)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      data-testid="teacher-autocomplete-input"
                      autoComplete="off"
                    />
                  )}
                  {teacherOpen && (
                    <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                      {academicData.teachers
                        .filter(t => {
                          const q = teacherSearch.toLowerCase();
                          const fullName = `${t.name} ${t.last_name}`.toLowerCase();
                          return !q || fullName.includes(q);
                        })
                        .map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { setForm({...form, teacher_id: t.id}); setTeacherOpen(false); setTeacherSearch(""); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left ${form.teacher_id === t.id ? "bg-blue-50" : ""}`}
                            data-testid={`teacher-option-${t.id}`}
                          >
                            {t.photo_url ? (
                              <img src={t.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-indigo-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{t.name} {t.last_name}</p>
                              <p className="text-xs text-gray-500">{t.email}</p>
                            </div>
                            {form.teacher_id === t.id && <Check className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" />}
                          </button>
                        ))
                      }
                      {academicData.teachers.filter(t => {
                        const q = teacherSearch.toLowerCase();
                        return !q || `${t.name} ${t.last_name}`.toLowerCase().includes(q);
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados para "{teacherSearch}"</div>
                      )}
                    </div>
                  )}
                </div>
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
                  Año Académico
                </label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({...form, academic_year_id: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Seleccionar año...</option>
                  {sortedYears.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.year} {y.status === "activo" ? "(Activo)" : y.status === "futuro" ? "(Futuro)" : "(Cerrado)"}
                    </option>
                  ))}
                </select>
                {sortedYears.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No hay años académicos configurados. Créalos en Años Académicos.
                  </p>
                )}
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
// BULK ASSIGNMENT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function BulkAssignmentModal({ isOpen, onClose, token, onSuccess, academicData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1 = form, 2 = preview
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const teacherRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const [form, setForm] = useState({
    teacher_id: "",
    level_id: "",
    grade_ids: [],
    section_ids: [],
    subject_ids: [],
    academic_year_id: "",
    role: "titular",
    all_sections: false,
  });

  // Derived data
  const filteredGrades = form.level_id
    ? academicData.grades.filter((g) => g.nivel_id === form.level_id)
    : [];

  const filteredSections = form.grade_ids.length > 0
    ? academicData.sections.filter((s) => form.grade_ids.includes(s.grado_id))
    : [];

  const filteredSubjects = form.level_id
    ? academicData.subjects.filter((s) => {
        if (s.level_id !== form.level_id) return false;
        if (form.grade_ids.length > 0 && s.grade_id && !form.grade_ids.includes(s.grade_id)) return false;
        return true;
      })
    : [];

  // Deduplicate subjects by name (same subject across grades/sections)
  const uniqueSubjects = filteredSubjects.reduce((acc, s) => {
    if (!acc.find((x) => x.id === s.id)) acc.push(s);
    return acc;
  }, []);

  const sortedYears = [...(academicData.academicYears || [])].sort((a, b) => {
    if (a.status === "activo" && b.status !== "activo") return -1;
    if (b.status === "activo" && a.status !== "activo") return 1;
    return b.year - a.year;
  });

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      const activeYear = academicData.academicYears?.find((y) => y.status === "activo");
      setForm({
        teacher_id: "",
        level_id: "",
        grade_ids: [],
        section_ids: [],
        subject_ids: [],
        academic_year_id: activeYear?.id || sortedYears[0]?.id || "",
        role: "titular",
        all_sections: false,
      });
      setStep(1);
      setError("");
      setTeacherSearch("");
      setTeacherOpen(false);
    }
  }, [isOpen]);

  // Auto-select all sections when toggled
  useEffect(() => {
    if (form.all_sections) {
      setForm((prev) => ({ ...prev, section_ids: filteredSections.map((s) => s.id) }));
    }
  }, [form.all_sections, form.grade_ids.join(",")]);

  // Close teacher dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (teacherRef.current && !teacherRef.current.contains(e.target)) setTeacherOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Handlers
  const toggleGrade = (gid) => {
    setForm((prev) => {
      const ids = prev.grade_ids.includes(gid)
        ? prev.grade_ids.filter((x) => x !== gid)
        : [...prev.grade_ids, gid];
      return { ...prev, grade_ids: ids, section_ids: [], subject_ids: [], all_sections: false };
    });
  };

  const toggleSection = (sid) => {
    setForm((prev) => {
      const ids = prev.section_ids.includes(sid)
        ? prev.section_ids.filter((x) => x !== sid)
        : [...prev.section_ids, sid];
      return { ...prev, section_ids: ids, all_sections: ids.length === filteredSections.length };
    });
  };

  const toggleSubject = (sid) => {
    setForm((prev) => {
      const ids = prev.subject_ids.includes(sid)
        ? prev.subject_ids.filter((x) => x !== sid)
        : [...prev.subject_ids, sid];
      return { ...prev, subject_ids: ids };
    });
  };

  const selectAllSubjects = () => {
    const allIds = uniqueSubjects.map((s) => s.id);
    setForm((prev) => ({
      ...prev,
      subject_ids: prev.subject_ids.length === allIds.length ? [] : allIds,
    }));
  };

  // Build preview data
  const previewItems = [];
  const gradeMap = Object.fromEntries(academicData.grades.map((g) => [g.id, g.nombre]));
  const sectionMap = Object.fromEntries(academicData.sections.map((s) => [s.id, s]));
  const subjectMap = Object.fromEntries(academicData.subjects.map((s) => [s.id, s]));

  for (const gid of form.grade_ids) {
    for (const sid of form.section_ids) {
      const sec = sectionMap[sid];
      if (!sec || sec.grado_id !== gid) continue;
      for (const subId of form.subject_ids) {
        previewItems.push({
          grade: gradeMap[gid] || gid,
          section: sec.nombre || sid,
          subject: subjectMap[subId]?.name || subId,
        });
      }
    }
  }

  const selectedTeacher = academicData.teachers.find((t) => t.id === form.teacher_id);
  const teacherLabel = selectedTeacher
    ? `${selectedTeacher.name} ${selectedTeacher.last_name || ""}`.trim()
    : "";

  const canPreview =
    form.teacher_id &&
    form.level_id &&
    form.grade_ids.length > 0 &&
    form.section_ids.length > 0 &&
    form.subject_ids.length > 0 &&
    form.academic_year_id;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const selectedYear = academicData.academicYears?.find((y) => y.id === form.academic_year_id);
      const res = await axios.post(
        `${API}/academic/assignments/bulk`,
        {
          teacher_id: form.teacher_id,
          level_id: form.level_id,
          grade_ids: form.grade_ids,
          section_ids: form.section_ids,
          subject_ids: form.subject_ids,
          academic_year_id: form.academic_year_id,
          school_year: selectedYear?.year || new Date().getFullYear(),
          role: form.role,
        },
        { headers }
      );
      const { created, skipped } = res.data;
      const parts = [];
      if (created > 0) parts.push(`${created} asignacion${created !== 1 ? "es" : ""} creada${created !== 1 ? "s" : ""}`);
      if (skipped > 0) parts.push(`${skipped} ya existia${skipped !== 1 ? "n" : ""}`);
      alert(parts.join(", ") || "Operacion completada");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear asignaciones masivas");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" data-testid="bulk-assignment-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-white" />
              <div className="text-white">
                <h2 className="text-xl font-bold">Asignacion Masiva</h2>
                <p className="text-sm text-white/80">
                  {step === 1 ? "Selecciona profesor, grados, secciones y asignaturas" : `${previewItems.length} asignaciones por crear`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              data-testid="bulk-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                {/* Teacher */}
                <div ref={teacherRef} className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Profesor</label>
                  <div
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer flex items-center justify-between hover:border-violet-300 transition-colors"
                    onClick={() => setTeacherOpen(!teacherOpen)}
                    data-testid="bulk-teacher-select"
                  >
                    <span className={teacherLabel ? "text-gray-900" : "text-gray-400"}>
                      {teacherLabel || "Seleccionar profesor..."}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${teacherOpen ? "rotate-180" : ""}`} />
                  </div>
                  {teacherOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={teacherSearch}
                            onChange={(e) => setTeacherSearch(e.target.value)}
                            placeholder="Buscar profesor..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            autoFocus
                            data-testid="bulk-teacher-search"
                          />
                        </div>
                      </div>
                      {academicData.teachers
                        .filter((t) => {
                          const fullName = `${t.name} ${t.last_name || ""}`.toLowerCase();
                          return fullName.includes(teacherSearch.toLowerCase());
                        })
                        .map((t) => (
                          <button
                            key={t.id}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 flex items-center gap-2 ${
                              form.teacher_id === t.id ? "bg-violet-50 text-violet-700 font-medium" : "text-gray-700"
                            }`}
                            onClick={() => {
                              setForm((prev) => ({ ...prev, teacher_id: t.id }));
                              setTeacherOpen(false);
                            }}
                          >
                            <User className="w-4 h-4 flex-shrink-0" />
                            {t.name} {t.last_name || ""}
                            {form.teacher_id === t.id && <Check className="w-4 h-4 ml-auto text-violet-500" />}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nivel</label>
                  <select
                    value={form.level_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, level_id: e.target.value, grade_ids: [], section_ids: [], subject_ids: [], all_sections: false }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    data-testid="bulk-level-select"
                  >
                    <option value="">Seleccionar nivel...</option>
                    {academicData.levels.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Grades (multi-select checkboxes) */}
                {filteredGrades.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Grados <span className="text-gray-400 font-normal">({form.grade_ids.length} seleccionados)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3" data-testid="bulk-grades-list">
                      {filteredGrades.map((g) => (
                        <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-violet-50 rounded-lg px-2 py-1.5 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.grade_ids.includes(g.id)}
                            onChange={() => toggleGrade(g.id)}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="text-gray-700">{g.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sections (multi-select, depends on grades) */}
                {filteredSections.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-semibold text-gray-700">
                        Secciones <span className="text-gray-400 font-normal">({form.section_ids.length} seleccionadas)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          all_sections: !prev.all_sections,
                          section_ids: !prev.all_sections ? filteredSections.map((s) => s.id) : [],
                        }))}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                        data-testid="bulk-sections-toggle-all"
                      >
                        {form.all_sections ? "Deseleccionar todas" : "Seleccionar todas"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3" data-testid="bulk-sections-list">
                      {filteredSections.map((s) => {
                        const gradeName = gradeMap[s.grado_id] || "";
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-violet-50 rounded-lg px-2 py-1.5 transition-colors">
                            <input
                              type="checkbox"
                              checked={form.section_ids.includes(s.id)}
                              onChange={() => toggleSection(s.id)}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-gray-700">{gradeName} - {s.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subjects (multi-select) */}
                {uniqueSubjects.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-semibold text-gray-700">
                        Asignaturas <span className="text-gray-400 font-normal">({form.subject_ids.length} seleccionadas)</span>
                      </label>
                      <button
                        type="button"
                        onClick={selectAllSubjects}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                        data-testid="bulk-subjects-toggle-all"
                      >
                        {form.subject_ids.length === uniqueSubjects.length ? "Deseleccionar todas" : "Seleccionar todas"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3" data-testid="bulk-subjects-list">
                      {uniqueSubjects.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-violet-50 rounded-lg px-2 py-1.5 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.subject_ids.includes(s.id)}
                            onChange={() => toggleSubject(s.id)}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color || "#3B82F6" }} />
                            {s.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Role + Year row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      data-testid="bulk-role-select"
                    >
                      <option value="titular">Titular</option>
                      <option value="auxiliar">Auxiliar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ano Académico</label>
                    <select
                      value={form.academic_year_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, academic_year_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      data-testid="bulk-year-select"
                    >
                      <option value="">Seleccionar...</option>
                      {sortedYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.year} {y.status === "activo" ? "(Activo)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {step === 2 && (
              <div>
                <div className="mb-4 p-4 rounded-xl bg-violet-50 border border-violet-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-violet-600" />
                    <span className="font-semibold text-violet-900">Profesor: {teacherLabel}</span>
                  </div>
                  <p className="text-sm text-violet-700">
                    Se crearan <strong>{previewItems.length}</strong> asignacion{previewItems.length !== 1 ? "es" : ""} como <strong>{form.role}</strong>
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl" data-testid="bulk-preview-list">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-600 font-medium">#</th>
                        <th className="text-left px-4 py-2 text-gray-600 font-medium">Grado</th>
                        <th className="text-left px-4 py-2 text-gray-600 font-medium">Sección</th>
                        <th className="text-left px-4 py-2 text-gray-600 font-medium">Asignatura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="px-4 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-1.5 text-gray-800">{item.grade}</td>
                          <td className="px-4 py-1.5 text-gray-800">{item.section}</td>
                          <td className="px-4 py-1.5 text-gray-800">{item.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between rounded-b-2xl">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                data-testid="bulk-back-btn"
              >
                Volver
              </button>
            )}
            {step === 1 && <div />}

            {step === 1 ? (
              <button
                disabled={!canPreview}
                onClick={() => setStep(2)}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  canPreview
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                data-testid="bulk-preview-btn"
              >
                <ChevronRight className="w-4 h-4" />
                Ver Preview ({previewItems.length})
              </button>
            ) : (
              <button
                disabled={loading || previewItems.length === 0}
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
                data-testid="bulk-confirm-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? "Creando..." : `Confirmar ${previewItems.length} Asignaciones`}
              </button>
            )}
          </div>
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
    academicYears: []
  });
  
  // Filters
  const [filters, setFilters] = useState({
    level_id: "",
    grade_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    academic_year_id: ""
  });
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
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
        yearsRes
      ] = await Promise.all([
        axios.get(`${API}/academic/assignments?${params}`, { headers }),
        axios.get(`${API}/academic/assignments/teachers-summary`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/users/teachers/active`, { headers }),
        axios.get(`${API}/academic/years`, { headers })
      ]);
      
      setAssignments(assignmentsRes.data);
      setTeachersSummary(teachersSummaryRes.data);
      setAcademicData({
        levels: levelsRes.data,
        grades: gradesRes.data,
        sections: sectionsRes.data,
        subjects: subjectsRes.data,
        teachers: teachersRes.data,
        academicYears: yearsRes.data
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
      academic_year_id: ""
    });
  };
  
  if (loading) {
    return (
      <CourseLoadingScreen 
        title="Cargando asignaciones"
        subtitle="Preparando la gestión docente"
        icon={BookMarked}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex">
      <Sidebar 
        active="asignacion-docente"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name}
        subdomain={subdomain}
        user={user}
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
        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8 overflow-x-hidden">
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
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-xl hover:from-violet-600 hover:to-fuchsia-700 transition-all shadow-lg shadow-violet-500/25 font-medium"
                  data-testid="bulk-assignment-btn"
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline">Asignacion Masiva</span>
                </button>
                <button
                  onClick={() => { setEditingAssignment(null); setShowModal(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 font-medium"
                  data-testid="new-assignment-btn"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nueva Asignacion</span>
                </button>
              </div>
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
                academicYears={academicData.academicYears}
                onClear={clearFilters}
              />
            
            {/* Assignments Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
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
        existingAssignments={assignments}
      />
      
      <BulkAssignmentModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        token={token}
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
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
      <FloatingHelpAvatar subdomain={user?.subdomain} />
    </div>
  );
}
