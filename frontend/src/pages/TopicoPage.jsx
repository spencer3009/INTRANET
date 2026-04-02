import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Cross, RefreshCw, Loader2, Search, Plus, X, Check,
  Clock, Calendar, AlertTriangle, Edit2, Trash2, Eye, ChevronDown,
  Filter, UserCheck, Activity, HeartPulse
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const INCIDENT_TYPES = [
  { value: "dolor", label: "Dolor" },
  { value: "golpe", label: "Golpe" },
  { value: "fiebre", label: "Fiebre" },
  { value: "malestar_general", label: "Malestar General" },
  { value: "emergencia", label: "Emergencia" },
  { value: "otro", label: "Otro" },
];

const STATUS_OPTIONS = [
  { value: "atendido", label: "Atendido", color: "bg-green-100 text-green-700" },
  { value: "derivado", label: "Derivado", color: "bg-amber-100 text-amber-700" },
  { value: "en_observacion", label: "En Observacion", color: "bg-blue-100 text-blue-700" },
];

const INCIDENT_COLORS = {
  dolor: "bg-orange-100 text-orange-700",
  golpe: "bg-red-100 text-red-700",
  fiebre: "bg-rose-100 text-rose-700",
  malestar_general: "bg-yellow-100 text-yellow-700",
  emergencia: "bg-red-200 text-red-800",
  otro: "bg-slate-100 text-slate-700",
};

const STORAGE_KEYS = {
  GRADE: "topico_last_grade",
  SECTION: "topico_last_section",
};

function getStatusBadge(status) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status);
  return opt || { label: status, color: "bg-slate-100 text-slate-600" };
}

function getIncidentLabel(type) {
  return INCIDENT_TYPES.find((t) => t.value === type)?.label || type;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function TopicoPage({ user, token, onLogout, renderSidebar, renderHeader, backPath, canWrite: canWriteProp }) {
  const navigate = useNavigate();
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const headers = { Authorization: `Bearer ${token}` };
  const resolvedBackPath = backPath || (subdomain ? `/${subdomain}/salud-bienestar` : "/salud-bienestar");

  // Auto-detect write permission if not explicitly passed
  const [autoCanWrite, setAutoCanWrite] = useState(canWriteProp !== undefined ? canWriteProp : true);
  useEffect(() => {
    if (canWriteProp !== undefined) { setAutoCanWrite(canWriteProp); return; }
    const isOwner = user?.is_owner || user?.role === "owner";
    if (isOwner) { setAutoCanWrite(true); return; }
    const detect = async () => {
      try {
        const res = await axios.get(`${API}/settings/health-permissions`, { headers });
        const role = user?.role;
        if (role === "teacher") setAutoCanWrite(res.data.teacher_can_manage === true);
        else if (role === "admin" || role === "director") setAutoCanWrite(res.data.admin_can_manage === true);
        else setAutoCanWrite(false);
      } catch { setAutoCanWrite(false); }
    };
    detect();
  }, [canWriteProp, user]);
  const canWrite = autoCanWrite;

  // Filters
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Data
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

  // Detail
  const [detailRecord, setDetailRecord] = useState(null);

  // Active tab
  const [activeTab, setActiveTab] = useState("alumnos"); // "alumnos" | "historial"
  const [studentSearch, setStudentSearch] = useState("");
  const [schoolSettings, setSchoolSettings] = useState(null);

  // ─── Load grades on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadGrades();
    const lastGrade = localStorage.getItem(STORAGE_KEYS.GRADE);
    const lastSection = localStorage.getItem(STORAGE_KEYS.SECTION);
    if (lastGrade) setSelectedGrade(lastGrade);
    if (lastSection) setSelectedSection(lastSection);
    // Load school settings for logo
    axios.get(`${API}/settings/public/${subdomain || user?.subdomain}`).then(r => setSchoolSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedGrade) {
      loadSections(selectedGrade);
      localStorage.setItem(STORAGE_KEYS.GRADE, selectedGrade);
    }
  }, [selectedGrade]);

  useEffect(() => {
    if (selectedSection) {
      localStorage.setItem(STORAGE_KEYS.SECTION, selectedSection);
    }
  }, [selectedSection]);

  const loadGrades = async () => {
    try {
      const res = await axios.get(`${API}/academic/grades`, { headers });
      const levelOrder = { inicial: 1, primaria: 2, secundaria: 3 };
      const sorted = res.data
        .filter((g) => g.activo)
        .sort((a, b) => {
          const la = levelOrder[a.nivel_nombre?.toLowerCase()] || 99;
          const lb = levelOrder[b.nivel_nombre?.toLowerCase()] || 99;
          if (la !== lb) return la - lb;
          return (a.orden || 0) - (b.orden || 0);
        });
      setGrades(sorted);
    } catch (err) {
      console.error("Error loading grades:", err);
    }
  };

  const loadSections = async (gradeId) => {
    try {
      const res = await axios.get(`${API}/academic/sections`, { headers });
      const filtered = res.data.filter((s) => s.activo && s.grado_id === gradeId);
      setSections(filtered);
      if (!filtered.find((s) => s.id === selectedSection)) {
        setSelectedSection("");
      }
    } catch (err) {
      console.error("Error loading sections:", err);
    }
  };

  // ─── Load students + records ──────────────────────────────────────────────
  const handleLoad = async () => {
    if (!selectedGrade || !selectedSection) {
      toast.error("Selecciona grado y seccion");
      return;
    }
    setLoading(true);
    setLoaded(false);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await axios.get(`${API}/attendance/students`, {
        headers,
        params: { grade_id: selectedGrade, section_id: selectedSection, date: today },
      });
      setStudents(res.data.students || []);
      setLoaded(true);
      loadRecords();
    } catch (err) {
      toast.error("Error al cargar alumnos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await axios.get(`${API}/health/topico`, {
        headers,
        params: { grade_id: selectedGrade, section_id: selectedSection, limit: 100 },
      });
      setRecords(res.data.records || []);
    } catch (err) {
      console.error("Error loading records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // ─── Open modal for new record ────────────────────────────────────────────
  const openNewRecord = (student) => {
    setModalStudent(student);
    setEditingRecord(null);
    setShowModal(true);
  };

  const openEditRecord = (record) => {
    setModalStudent(null);
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    loadRecords();
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await axios.delete(`${API}/health/topico/${recordId}`, { headers });
      toast.success("Registro eliminado");
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (detailRecord?.id === recordId) setDetailRecord(null);
    } catch (err) {
      toast.error("Error al eliminar");
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const gradeName = grades.find((g) => g.id === selectedGrade);
  const sectionName = sections.find((s) => s.id === selectedSection);
  const gradeLabel = gradeName ? `${gradeName.nivel_nombre} - ${gradeName.nombre}` : "";
  const sectionLabel = sectionName?.nombre || "";

  // Count records per student
  const studentRecordCounts = {};
  records.forEach((r) => {
    studentRecordCounts[r.student_id] = (studentRecordCounts[r.student_id] || 0) + 1;
  });

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="topico-page">
      {renderSidebar ? renderSidebar() : (
        <Sidebar
          active="salud-bienestar"
          onNavigate={() => {}}
          expanded={false}
          onToggle={() => {}}
          onLogout={onLogout}
          schoolName={user?.name || "EduNet"}
          subdomain={subdomain}
          token={token}
          user={user}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {renderHeader ? renderHeader() : (
          <DashboardHeader
            user={user}
            onMenuClick={() => {}}
            onLogout={onLogout}
            logoUrl={schoolSettings?.logo_url}
            schoolName={schoolSettings?.system_name || user?.name || "EduNet"}
            subdomain={subdomain}
            token={token}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(resolvedBackPath)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <Cross className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Topico</h1>
                <p className="text-sm text-slate-400">Registro de Atencion Medica</p>
              </div>
            </div>
          </div>

          {/* Read-only banner */}
          {!canWrite && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2" data-testid="read-only-banner">
              <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">Modo lectura — contacta al propietario para obtener permisos de edicion</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6" data-testid="topico-filters">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-rose-600" />
              Filtros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  data-testid="grade-select"
                >
                  <option value="">Seleccionar grado</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nivel_nombre} - {g.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Seccion</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  disabled={!selectedGrade}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                  data-testid="section-select"
                >
                  <option value="">Seleccionar seccion</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleLoad}
                  disabled={loading || !selectedGrade || !selectedSection}
                  className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  data-testid="load-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  Cargar
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          {loaded && (
            <>
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 mb-6 w-fit" data-testid="topico-tabs">
                <button
                  onClick={() => setActiveTab("alumnos")}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === "alumnos" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                  data-testid="tab-alumnos"
                >
                  <UserCheck className="w-4 h-4 inline mr-2" />
                  Alumnos ({students.length})
                </button>
                <button
                  onClick={() => setActiveTab("historial")}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === "historial" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                  data-testid="tab-historial"
                >
                  <Activity className="w-4 h-4 inline mr-2" />
                  Historial ({records.length})
                </button>
              </div>

              {/* Tab: Alumnos */}
              {activeTab === "alumnos" && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="students-list">
                  {/* Search */}
                  {students.length > 0 && (
                    <div className="px-5 pt-4 pb-2" data-testid="student-search">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder="Buscar alumno por nombre..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
                          data-testid="student-search-input"
                        />
                        {studentSearch && (
                          <button onClick={() => setStudentSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {students.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">No se encontraron alumnos</div>
                    ) : (() => {
                      const filtered = students.filter(s => {
                        if (!studentSearch.trim()) return true;
                        const fullName = `${s.name || s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
                        return fullName.includes(studentSearch.toLowerCase().trim());
                      });
                      return filtered.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">No se encontraron alumnos con "{studentSearch}"</div>
                      ) : filtered.map((s, idx) => (
                        <div key={s.student_id || idx} className="flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors">
                          {s.photo_url ? (
                            <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-sm flex-shrink-0">
                            {(s.name || s.first_name || "?")[0].toUpperCase()}
                          </div>
                          )}
                          <div className="ml-3 flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">
                              {s.name || s.first_name || ""} {s.last_name || ""}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {(() => { const g = grades.find(g => g.id === selectedGrade); return g?.nivel_nombre ? `${g.nivel_nombre} ${g.nombre || g.name || ""}` : (g?.nombre || g?.name || ""); })()} — {sections.find(sec => sec.id === selectedSection)?.nombre || sections.find(sec => sec.id === selectedSection)?.name || ""}
                            </p>
                          </div>
                          {studentRecordCounts[s.student_id] > 0 && (
                            <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full mr-3">
                              {studentRecordCounts[s.student_id]} registro{studentRecordCounts[s.student_id] > 1 ? "s" : ""}
                            </span>
                          )}
                          {canWrite && (
                          <button
                            onClick={() => openNewRecord(s)}
                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5"
                            data-testid={`register-btn-${s.student_id}`}
                          >
                            <Plus className="w-4 h-4" />
                            Registrar Atencion
                          </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Tab: Historial */}
              {activeTab === "historial" && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="records-list">
                  {loadingRecords ? (
                    <div className="p-10 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">No hay registros para esta seccion</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {records.map((r) => {
                        const statusBadge = getStatusBadge(r.status);
                        const incidentColor = INCIDENT_COLORS[r.incident_type] || INCIDENT_COLORS.otro;
                        return (
                          <div key={r.id} className="flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{r.student_name}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {r.date}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {r.time}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${incidentColor}`}>
                                  {getIncidentLabel(r.incident_type)}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              <button
                                onClick={() => setDetailRecord(r)}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canWrite && (
                              <>
                              <button
                                onClick={() => openEditRecord(r)}
                                className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-500 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Record Modal (Create / Edit) */}
      {showModal && (
        <RecordModal
          token={token}
          student={modalStudent}
          record={editingRecord}
          gradeId={selectedGrade}
          gradeLabel={gradeLabel}
          sectionId={selectedSection}
          sectionLabel={sectionLabel}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Detail Modal */}
      {detailRecord && (
        <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORD MODAL (Create / Edit)
// ═══════════════════════════════════════════════════════════════════════════════

function RecordModal({ token, student, record, gradeId, gradeLabel, sectionId, sectionLabel, onClose, onSaved }) {
  const headers = { Authorization: `Bearer ${token}` };
  const isEdit = !!record;

  const now = new Date();
  const [date, setDate] = useState(record?.date || now.toISOString().split("T")[0]);
  const [time, setTime] = useState(record?.time || now.toTimeString().slice(0, 5));
  const [incidentType, setIncidentType] = useState(record?.incident_type || "dolor");
  const [description, setDescription] = useState(record?.description || "");
  const [actionTaken, setActionTaken] = useState(record?.action_taken || "");
  const [status, setStatus] = useState(record?.status || "atendido");
  const [responsible, setResponsible] = useState(record?.responsible || "");
  const [saving, setSaving] = useState(false);

  const studentName = student
    ? student.name || `${student.first_name || ""} ${student.last_name || ""}`.trim()
    : record?.student_name || "";
  const studentId = student?.student_id || record?.student_id || "";

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error("La descripcion es obligatoria");
      return;
    }
    if (!responsible.trim()) {
      toast.error("El responsable es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await axios.put(`${API}/health/topico/${record.id}`, {
          date, time, incident_type: incidentType, description, action_taken: actionTaken, status, responsible,
        }, { headers });
        toast.success("Registro actualizado");
      } else {
        await axios.post(`${API}/health/topico`, {
          student_id: studentId,
          student_name: studentName,
          grade_id: gradeId,
          grade_name: gradeLabel,
          section_id: sectionId,
          section_name: sectionLabel,
          date, time, incident_type: incidentType, description, action_taken: actionTaken, status, responsible,
        }, { headers });
        toast.success("Registro creado");
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" data-testid="record-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{isEdit ? "Editar Registro" : "Registrar Atencion"}</h3>
            <p className="text-sm text-slate-400">{studentName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                data-testid="modal-date" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hora</label>
              <TimePicker value={time} onChange={(val) => setTime(val)} data-testid="modal-time" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Incidencia</label>
            <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="modal-incident-type">
              {INCIDENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descripcion *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Describe la situacion..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="modal-description" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Accion Tomada</label>
            <textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2}
              placeholder="Que se hizo..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="modal-action" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="modal-status">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Responsable *</label>
            <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nombre de quien atendio"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="modal-responsible" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
            data-testid="modal-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailModal({ record, onClose }) {
  const statusBadge = getStatusBadge(record.status);
  const incidentColor = INCIDENT_COLORS[record.incident_type] || INCIDENT_COLORS.otro;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" data-testid="detail-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Detalle del Registro</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Alumno</p>
            <p className="text-base font-bold text-slate-800">{record.student_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Grado / Seccion</p>
              <p className="text-sm text-slate-700">{record.grade_name} — {record.section_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Fecha / Hora</p>
              <p className="text-sm text-slate-700">{record.date} a las {record.time}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${incidentColor}`}>
              {getIncidentLabel(record.incident_type)}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Descripcion</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.description}</p>
          </div>
          {record.action_taken && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Accion Tomada</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.action_taken}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Responsable</p>
            <p className="text-sm text-slate-700">{record.responsible}</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
