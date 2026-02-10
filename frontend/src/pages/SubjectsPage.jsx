import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { 
  BookOpen, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  Users, Search, Filter, ChevronDown, Clock, Palette, Code,
  GraduationCap, Layers, UserPlus, CheckCircle2, XCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Subject colors
const SUBJECT_COLORS = [
  { value: "#3B82F6", label: "Azul", class: "bg-blue-500" },
  { value: "#10B981", label: "Verde", class: "bg-emerald-500" },
  { value: "#F59E0B", label: "Amarillo", class: "bg-amber-500" },
  { value: "#EF4444", label: "Rojo", class: "bg-red-500" },
  { value: "#8B5CF6", label: "Violeta", class: "bg-violet-500" },
  { value: "#EC4899", label: "Rosa", class: "bg-pink-500" },
  { value: "#06B6D4", label: "Cyan", class: "bg-cyan-500" },
  { value: "#6366F1", label: "Indigo", class: "bg-indigo-500" },
  { value: "#14B8A6", label: "Teal", class: "bg-teal-500" },
  { value: "#F97316", label: "Naranja", class: "bg-orange-500" },
  { value: "#84CC16", label: "Lima", class: "bg-lime-500" },
  { value: "#A855F7", label: "Púrpura", class: "bg-purple-500" },
];

// Status options
const STATUS_OPTIONS = {
  active: { label: "Activo", bgClass: "bg-emerald-50", textClass: "text-emerald-700", dotClass: "bg-emerald-500" },
  inactive: { label: "Inactivo", bgClass: "bg-gray-100", textClass: "text-gray-600", dotClass: "bg-gray-400" }
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ══════════════════════════════════════════════════════════════════════════════
function SubjectsSkeleton() {
  return (
    <div className="space-y-4" data-testid="subjects-skeleton">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl p-5 animate-pulse border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECT FORM MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SubjectFormModal({ isOpen, onClose, subject, onSave, levels, grades }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    level_id: "",
    grade_id: "",
    weekly_hours: 2,
    color: "#3B82F6",
    status: "active"
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
        status: subject.status || "active"
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        level_id: "",
        grade_id: "",
        weekly_hours: 2,
        color: "#3B82F6",
        status: "active"
      });
    }
    setError("");
  }, [subject, isOpen]);

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

          {/* Description */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción de la asignatura..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Level and Grade */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nivel *</label>
              <select
                value={formData.level_id}
                onChange={(e) => setFormData(prev => ({ ...prev, level_id: e.target.value, grade_id: "" }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar nivel</option>
                {levels.filter(l => l.activo).map(level => (
                  <option key={level.id} value={level.id}>{level.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Grado (opcional)</label>
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value }))}
                disabled={!formData.level_id}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Todos los grados</option>
                {filteredGrades.map(grade => (
                  <option key={grade.id} value={grade.id}>{grade.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hours and Status */}
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Estado</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
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
function TeacherAssignModal({ isOpen, onClose, subject, teachers, assignedTeachers, onSave }) {
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen && assignedTeachers) {
      setSelectedTeachers(assignedTeachers.map(t => t.id));
    }
    setSearchTerm("");
  }, [isOpen, assignedTeachers]);

  const handleToggleTeacher = (teacherId) => {
    setSelectedTeachers(prev => 
      prev.includes(teacherId) 
        ? prev.filter(id => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedTeachers);
      onClose();
    } catch (err) {
      console.error("Error saving teachers:", err);
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
              <h2 className="text-lg font-bold text-white">Asignar Profesores</h2>
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

          {/* Teachers list */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredTeachers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hay profesores disponibles</p>
              </div>
            ) : (
              filteredTeachers.map(teacher => {
                const isSelected = selectedTeachers.includes(teacher.id);
                return (
                  <div
                    key={teacher.id}
                    onClick={() => handleToggleTeacher(teacher.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {teacher.name} {teacher.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected count */}
          <div className="mt-4 text-sm text-gray-500 text-center">
            {selectedTeachers.length} profesor(es) seleccionado(s)
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
            data-testid="save-teachers-btn"
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
// CONFIRM DELETE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmDeleteModal({ isOpen, onClose, subject, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !subject) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-rose-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Eliminar Asignatura</h3>
          <p className="text-sm text-gray-500 mb-6">
            ¿Estás seguro de eliminar <strong>{subject.name}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </div>
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
  
  const [subjects, setSubjects] = useState([]);
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  const [filterLevel, setFilterLevel] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [assignedTeachers, setAssignedTeachers] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) loadSubjects();
  }, [filterLevel, filterGrade, filterStatus]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, levelsRes, gradesRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      setLevels(levelsRes.data);
      setGrades(gradesRes.data);
      setTeachers(usersRes.data.filter(u => u.role === "teacher"));
      
      await loadSubjects();
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const params = {};
      if (filterLevel) params.level_id = filterLevel;
      if (filterGrade) params.grade_id = filterGrade;
      if (filterStatus) params.status = filterStatus;
      
      const res = await axios.get(`${API}/academic/subjects`, { headers, params });
      setSubjects(res.data);
    } catch (err) {
      console.error("Error loading subjects:", err);
    }
  };

  const handleSaveSubject = async (data) => {
    if (editingSubject?.id) {
      await axios.put(`${API}/academic/subjects/${editingSubject.id}`, data, { headers });
    } else {
      await axios.post(`${API}/academic/subjects`, data, { headers });
    }
    loadSubjects();
  };

  const handleOpenTeacherModal = async (subject) => {
    setSelectedSubject(subject);
    try {
      const res = await axios.get(`${API}/academic/subjects/${subject.id}/teachers`, { headers });
      setAssignedTeachers(res.data.teachers || []);
      setShowTeacherModal(true);
    } catch (err) {
      console.error("Error loading teachers:", err);
    }
  };

  const handleSaveTeachers = async (teacherIds) => {
    await axios.post(`${API}/academic/subjects/${selectedSubject.id}/teachers`, { teacher_ids: teacherIds }, { headers });
    loadSubjects();
  };

  const handleDeleteSubject = async () => {
    try {
      await axios.delete(`${API}/academic/subjects/${deletingSubject.id}`, { headers });
      loadSubjects();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
      throw err;
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGradesForFilter = filterLevel 
    ? grades.filter(g => g.nivel_id === filterLevel && g.activo)
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
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Asignaturas</h1>
                <p className="text-sm text-gray-500">Gestiona las materias académicas del colegio</p>
              </div>
            </div>
          </div>

          {/* Filters bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar asignatura..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Level filter */}
              <select
                value={filterLevel}
                onChange={(e) => { setFilterLevel(e.target.value); setFilterGrade(""); }}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los niveles</option>
                {levels.filter(l => l.activo).map(level => (
                  <option key={level.id} value={level.id}>{level.nombre}</option>
                ))}
              </select>

              {/* Grade filter */}
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                disabled={!filterLevel}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Todos los grados</option>
                {filteredGradesForFilter.map(grade => (
                  <option key={grade.id} value={grade.id}>{grade.nombre}</option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>

              {/* Add button */}
              <button
                onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
                data-testid="create-subject-btn"
              >
                <Plus className="w-4 h-4" />
                Nueva Asignatura
              </button>
            </div>
          </div>

          {/* Subjects list */}
          {filteredSubjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay asignaturas</h3>
              <p className="text-sm text-gray-500 mb-6">Comienza creando tu primera asignatura</p>
              <button
                onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Asignatura
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSubjects.map(subject => {
                const statusInfo = STATUS_OPTIONS[subject.status] || STATUS_OPTIONS.active;
                return (
                  <div
                    key={subject.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all"
                    data-testid={`subject-card-${subject.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Color indicator */}
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: subject.color + "20" }}
                      >
                        <BookOpen className="w-7 h-7" style={{ color: subject.color }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-bold text-gray-800">{subject.name}</h3>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold">
                            {subject.code}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-4 h-4" />
                            {subject.level_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-4 h-4" />
                            {subject.grade_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {subject.weekly_hours}h/semana
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {subject.teacher_count || 0} profesor(es)
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenTeacherModal(subject)}
                          className="p-2.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Asignar profesores"
                          data-testid={`assign-teachers-${subject.id}`}
                        >
                          <UserPlus className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setEditingSubject(subject); setShowSubjectModal(true); }}
                          className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                          data-testid={`edit-subject-${subject.id}`}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setDeletingSubject(subject); setShowDeleteModal(true); }}
                          className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar"
                          data-testid={`delete-subject-${subject.id}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats footer */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>{filteredSubjects.length} asignatura(s) encontrada(s)</span>
            <span>{subjects.filter(s => s.status === "active").length} activas</span>
          </div>
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
      />
      <TeacherAssignModal
        isOpen={showTeacherModal}
        onClose={() => { setShowTeacherModal(false); setSelectedSubject(null); }}
        subject={selectedSubject}
        teachers={teachers}
        assignedTeachers={assignedTeachers}
        onSave={handleSaveTeachers}
      />
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingSubject(null); }}
        subject={deletingSubject}
        onConfirm={handleDeleteSubject}
      />
    </div>
  );
}
