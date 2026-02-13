import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  BarChart3, Users, BookOpen, Layers, Filter, Search,
  Pencil, Check, X, Loader2, ArrowLeft, TrendingUp,
  AlertCircle, Download, ChevronDown
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Summary Card Component
function SummaryCard({ icon: Icon, label, value, color, subtext }) {
  const colorClasses = {
    purple: "bg-purple-100 text-purple-600",
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600"
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
          {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

// Edit Grade Modal
function EditGradeModal({ isOpen, onClose, grade, onSave, loading }) {
  const [newGrade, setNewGrade] = useState(grade?.grade || 0);
  const [motivo, setMotivo] = useState("");
  
  useEffect(() => {
    if (grade) {
      setNewGrade(grade.grade || 0);
      setMotivo("");
    }
  }, [grade]);
  
  if (!isOpen || !grade) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Editar Nota</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">Estudiante</p>
            <p className="font-medium text-slate-800">{grade.student_name}</p>
            <p className="text-sm text-slate-500 mt-2">Asignatura</p>
            <p className="font-medium text-slate-800">{grade.subject_name}</p>
            <p className="text-sm text-slate-500 mt-2">Nota actual</p>
            <p className="font-medium text-slate-800">{grade.grade ?? "Sin nota"}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Nota *</label>
            <input
              type="number"
              value={newGrade}
              onChange={(e) => setNewGrade(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              min={0}
              max={20}
              step={0.5}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo de la corrección * <span className="text-slate-400">(mín. 5 caracteres)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
              rows={3}
              placeholder="Ej: Corrección por error de digitación del profesor..."
            />
          </div>
          
          {grade.last_admin_edit && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700">
                Última edición administrativa: {grade.last_admin_edit.admin_name} - {new Date(grade.last_admin_edit.timestamp).toLocaleDateString()}
              </p>
              <p className="text-xs text-amber-600 mt-1">Motivo: {grade.last_admin_edit.motivo}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(grade.id, newGrade, motivo)}
            disabled={loading || motivo.length < 5}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-xl flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminGradesManagementPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [grades, setGrades] = useState([]);
  const [summary, setSummary] = useState([]);
  const [levels, setLevels] = useState([]);
  const [academicGrades, setAcademicGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  // Filters
  const [filterLevel, setFilterLevel] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal
  const [editingGrade, setEditingGrade] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState("summary"); // "summary" or "detail"
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    if (viewMode === "detail" && filterSection) {
      loadGrades();
    }
  }, [filterSection, filterSubject, viewMode]);

  const loadInitialData = async () => {
    try {
      const [settingsRes, levelsRes, gradesRes, sectionsRes, subjectsRes, summaryRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/admin/grades/summary`, { headers })
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      setLevels(levelsRes.data || []);
      setAcademicGrades(gradesRes.data || []);
      setSections(sectionsRes.data || []);
      setSubjects(subjectsRes.data || []);
      setSummary(summaryRes.data?.summary || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadGrades = async () => {
    if (!filterSection) return;
    
    try {
      const params = new URLSearchParams();
      if (filterSection) params.append("section_id", filterSection);
      if (filterSubject) params.append("subject_id", filterSubject);
      
      const res = await axios.get(`${API}/admin/grades?${params}`, { headers });
      setGrades(res.data?.grades || []);
    } catch (err) {
      console.error("Error loading grades:", err);
    }
  };
  
  const handleSaveGrade = async (gradeId, newGrade, motivo) => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/grades/${gradeId}`, { grade: newGrade, motivo }, { headers });
      loadGrades();
      setShowEditModal(false);
      setEditingGrade(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };
  
  // Filter sections by selected grade
  const filteredSections = filterGrade 
    ? sections.filter(s => s.grado_id === filterGrade)
    : sections;
  
  // Filter academic grades by selected level
  const filteredAcademicGrades = filterLevel
    ? academicGrades.filter(g => g.nivel_id === filterLevel)
    : academicGrades;
  
  // Filter grades by search term
  const filteredGrades = grades.filter(g => 
    g.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.subject_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Calculate summary stats
  const totalSections = summary.length;
  const avgGrade = summary.length > 0 
    ? summary.reduce((acc, s) => acc + (s.average_grade || 0), 0) / summary.filter(s => s.average_grade).length
    : 0;
  const totalStudents = summary.reduce((acc, s) => acc + s.students_count, 0);
  const totalGrades = summary.reduce((acc, s) => acc + s.grades_count, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-grades-management-page">
      <AdminSidebar
        active="notas"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Gestión de Notas</h1>
                <p className="text-sm text-slate-500">Vista y edición administrativa de calificaciones</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("summary")}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  viewMode === "summary" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Resumen
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  viewMode === "detail" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Detalle
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard icon={Layers} label="Secciones" value={totalSections} color="purple" />
            <SummaryCard icon={Users} label="Estudiantes" value={totalStudents} color="blue" />
            <SummaryCard icon={BarChart3} label="Notas registradas" value={totalGrades} color="emerald" />
            <SummaryCard 
              icon={TrendingUp} 
              label="Promedio general" 
              value={avgGrade ? avgGrade.toFixed(1) : "N/A"} 
              color="amber" 
            />
          </div>

          {viewMode === "summary" ? (
            /* Summary View */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800">Resumen por Sección</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Nivel</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Grado</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sección</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estudiantes</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Notas</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Promedio</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500">No hay datos disponibles</td>
                      </tr>
                    ) : (
                      summary.map((item) => (
                        <tr key={item.section_id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-600">{item.level_name || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.grade_name || "-"}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.section_name}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600">{item.students_count}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600">{item.grades_count}</td>
                          <td className="px-6 py-4 text-center">
                            {item.average_grade ? (
                              <span className={`px-2 py-1 rounded-lg text-sm font-medium ${
                                item.average_grade >= 15 ? "bg-emerald-100 text-emerald-700" :
                                item.average_grade >= 11 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {item.average_grade.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setFilterSection(item.section_id);
                                setViewMode("detail");
                              }}
                              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Detail View */
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-700">Filtros</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Nivel</label>
                    <select
                      value={filterLevel}
                      onChange={(e) => { setFilterLevel(e.target.value); setFilterGrade(""); setFilterSection(""); }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">Todos los niveles</option>
                      {levels.filter(l => l.activo).map(l => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Grado</label>
                    <select
                      value={filterGrade}
                      onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(""); }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">Todos los grados</option>
                      {filteredAcademicGrades.filter(g => g.activo).map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Sección *</label>
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">Seleccionar sección</option>
                      {filteredSections.filter(s => s.activo).map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Asignatura</label>
                    <select
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">Todas las asignaturas</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Search */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por estudiante o asignatura..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              
              {/* Grades Table */}
              {!filterSection ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Selecciona una sección para ver las notas</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">
                      Notas ({filteredGrades.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estudiante</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Asignatura</th>
                          <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Nota</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Profesor</th>
                          <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredGrades.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-500">
                              No hay notas registradas
                            </td>
                          </tr>
                        ) : (
                          filteredGrades.map((g) => (
                            <tr key={g.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {g.student_photo ? (
                                    <img src={g.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                      <Users className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}
                                  <span className="font-medium text-slate-800">{g.student_name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">{g.subject_name}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                                  g.grade >= 15 ? "bg-emerald-100 text-emerald-700" :
                                  g.grade >= 11 ? "bg-amber-100 text-amber-700" :
                                  g.grade !== null ? "bg-red-100 text-red-700" :
                                  "bg-slate-100 text-slate-500"
                                }`}>
                                  {g.grade ?? "-"}
                                </span>
                                {g.last_admin_edit && (
                                  <span className="ml-2 text-xs text-amber-600" title="Editado por administración">⚠️</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">{g.teacher_name || "-"}</td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => { setEditingGrade(g); setShowEditModal(true); }}
                                  className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Editar nota"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      <EditGradeModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingGrade(null); }}
        grade={editingGrade}
        onSave={handleSaveGrade}
        loading={saving}
      />
    </div>
  );
}
