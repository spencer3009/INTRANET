import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, Brain, RefreshCw, Loader2, Plus, X, Check,
  Clock, Calendar, Edit2, Trash2, Eye, Filter, UserCheck,
  Activity, AlertTriangle, Bell
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RECORD_TYPES = [
  { value: "conductual", label: "Conductual" },
  { value: "emocional", label: "Emocional" },
  { value: "academico_relacionado", label: "Academico-relacionado" },
  { value: "otro", label: "Otro" },
];

const ALERT_LEVELS = [
  { value: "bajo", label: "Bajo", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { value: "medio", label: "Medio", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { value: "alto", label: "Alto", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
];

const STATUS_OPTIONS = [
  { value: "en_seguimiento", label: "En seguimiento", color: "bg-blue-100 text-blue-700" },
  { value: "caso_cerrado", label: "Caso cerrado", color: "bg-green-100 text-green-700" },
  { value: "derivado_externamente", label: "Derivado externamente", color: "bg-purple-100 text-purple-700" },
];

const RECORD_TYPE_COLORS = {
  conductual: "bg-orange-100 text-orange-700",
  emocional: "bg-pink-100 text-pink-700",
  academico_relacionado: "bg-indigo-100 text-indigo-700",
  otro: "bg-slate-100 text-slate-700",
};

const STORAGE_KEYS = { GRADE: "psicologia_last_grade", SECTION: "psicologia_last_section" };

function getAlertBadge(level) {
  return ALERT_LEVELS.find((a) => a.value === level) || { label: level, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
}
function getStatusBadge(status) {
  return STATUS_OPTIONS.find((o) => o.value === status) || { label: status, color: "bg-slate-100 text-slate-600" };
}
function getRecordTypeLabel(type) {
  return RECORD_TYPES.find((t) => t.value === type)?.label || type;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function PsicologiaPage({ user, token, onLogout, renderSidebar, renderHeader, backPath, canWrite: canWriteProp }) {
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

  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("alumnos");

  // ─── Load grades ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadGrades();
    const lg = localStorage.getItem(STORAGE_KEYS.GRADE);
    const ls = localStorage.getItem(STORAGE_KEYS.SECTION);
    if (lg) setSelectedGrade(lg);
    if (ls) setSelectedSection(ls);
  }, []);

  useEffect(() => {
    if (selectedGrade) {
      loadSections(selectedGrade);
      localStorage.setItem(STORAGE_KEYS.GRADE, selectedGrade);
    }
  }, [selectedGrade]);

  useEffect(() => {
    if (selectedSection) localStorage.setItem(STORAGE_KEYS.SECTION, selectedSection);
  }, [selectedSection]);

  const loadGrades = async () => {
    try {
      const res = await axios.get(`${API}/academic/grades`, { headers });
      const order = { inicial: 1, primaria: 2, secundaria: 3 };
      setGrades(
        res.data.filter((g) => g.activo).sort((a, b) => {
          const la = order[a.nivel_nombre?.toLowerCase()] || 99;
          const lb = order[b.nivel_nombre?.toLowerCase()] || 99;
          return la !== lb ? la - lb : (a.orden || 0) - (b.orden || 0);
        })
      );
    } catch (err) { console.error(err); }
  };

  const loadSections = async (gradeId) => {
    try {
      const res = await axios.get(`${API}/academic/sections`, { headers });
      const filtered = res.data.filter((s) => s.activo && s.grado_id === gradeId);
      setSections(filtered);
      if (!filtered.find((s) => s.id === selectedSection)) setSelectedSection("");
    } catch (err) { console.error(err); }
  };

  // ─── Load students + records ──────────────────────────────────────────────
  const handleLoad = async () => {
    if (!selectedGrade || !selectedSection) { toast.error("Selecciona grado y seccion"); return; }
    setLoading(true);
    setLoaded(false);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await axios.get(`${API}/attendance/students`, {
        headers, params: { grade_id: selectedGrade, section_id: selectedSection, date: today },
      });
      setStudents(res.data.students || []);
      setLoaded(true);
      loadRecords();
    } catch (err) { toast.error("Error al cargar alumnos"); } finally { setLoading(false); }
  };

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await axios.get(`${API}/health/psicologia`, {
        headers, params: { grade_id: selectedGrade, section_id: selectedSection, limit: 100 },
      });
      setRecords(res.data.records || []);
    } catch (err) { console.error(err); } finally { setLoadingRecords(false); }
  };

  const openNewRecord = (student) => { setModalStudent(student); setEditingRecord(null); setShowModal(true); };
  const openEditRecord = (record) => { setModalStudent(null); setEditingRecord(record); setShowModal(true); };
  const handleSaved = () => { setShowModal(false); loadRecords(); };

  const handleDelete = async (recordId) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await axios.delete(`${API}/health/psicologia/${recordId}`, { headers });
      toast.success("Registro eliminado");
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (detailRecord?.id === recordId) setDetailRecord(null);
    } catch (err) { toast.error("Error al eliminar"); }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const gradeName = grades.find((g) => g.id === selectedGrade);
  const sectionName = sections.find((s) => s.id === selectedSection);
  const gradeLabel = gradeName ? `${gradeName.nivel_nombre} - ${gradeName.nombre}` : "";
  const sectionLabel = sectionName?.nombre || "";

  // Per-student stats
  const studentStats = {};
  records.forEach((r) => {
    if (!studentStats[r.student_id]) studentStats[r.student_id] = { count: 0, highAlerts: 0, needsFollowup: false };
    studentStats[r.student_id].count++;
    if (r.alert_level === "alto") studentStats[r.student_id].highAlerts++;
    if (r.requires_followup) studentStats[r.student_id].needsFollowup = true;
  });

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="psicologia-page">
      {renderSidebar ? renderSidebar() : (
        <Sidebar active="salud-bienestar" onNavigate={() => {}} expanded={false} onToggle={() => {}} onLogout={onLogout} schoolName={user?.name || "EduNet"} subdomain={subdomain} token={token} user={user} />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        {renderHeader ? renderHeader() : (
          <DashboardHeader user={user} onMenuClick={() => {}} onLogout={onLogout} schoolName={user?.name || "EduNet"} subdomain={subdomain} token={token} />
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(resolvedBackPath)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors" data-testid="back-btn">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Brain className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Psicologia</h1>
                <p className="text-sm text-slate-400">Seguimiento Emocional y Conductual</p>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6" data-testid="psicologia-filters">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-violet-600" />
              Filtros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="grade-select">
                  <option value="">Seleccionar grado</option>
                  {grades.map((g) => (<option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Seccion</label>
                <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedGrade} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" data-testid="section-select">
                  <option value="">Seleccionar seccion</option>
                  {sections.map((s) => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleLoad} disabled={loading || !selectedGrade || !selectedSection} className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all" data-testid="load-btn">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  Cargar
                </button>
              </div>
            </div>
          </div>

          {/* Tabs + Content */}
          {loaded && (
            <>
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 mb-6 w-fit" data-testid="psicologia-tabs">
                <button onClick={() => setActiveTab("alumnos")} className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "alumnos" ? "bg-violet-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`} data-testid="tab-alumnos">
                  <UserCheck className="w-4 h-4 inline mr-2" />Alumnos ({students.length})
                </button>
                <button onClick={() => setActiveTab("historial")} className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "historial" ? "bg-violet-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`} data-testid="tab-historial">
                  <Activity className="w-4 h-4 inline mr-2" />Historial ({records.length})
                </button>
              </div>

              {/* Alumnos Tab */}
              {activeTab === "alumnos" && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="students-list">
                  <div className="divide-y divide-slate-100">
                    {students.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">No se encontraron alumnos</div>
                    ) : students.map((s, idx) => {
                      const stats = studentStats[s.student_id];
                      return (
                        <div key={s.student_id || idx} className="flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors">
                          {s.photo_url ? (
                            <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0">
                            {(s.name || s.first_name || "?")[0].toUpperCase()}
                          </div>
                          )}
                          <div className="ml-3 flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">
                              {s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim()}
                            </p>
                            {stats && (
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {stats.highAlerts > 0 && (
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />{stats.highAlerts} alerta{stats.highAlerts > 1 ? "s" : ""} alta{stats.highAlerts > 1 ? "s" : ""}
                                  </span>
                                )}
                                {stats.needsFollowup && (
                                  <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Bell className="w-3 h-3" />Requiere seguimiento
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {stats?.count > 0 && (
                            <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full mr-3">
                              {stats.count} registro{stats.count > 1 ? "s" : ""}
                            </span>
                          )}
                          {canWrite && (
                          <button onClick={() => openNewRecord(s)} className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5" data-testid={`register-btn-${s.student_id}`}>
                            <Plus className="w-4 h-4" />Registrar Sesion
                          </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historial Tab */}
              {activeTab === "historial" && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="records-list">
                  {loadingRecords ? (
                    <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-500" /></div>
                  ) : records.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">No hay registros para esta seccion</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {records.map((r) => {
                        const alertBadge = getAlertBadge(r.alert_level);
                        const statusBadge = getStatusBadge(r.status);
                        const typeColor = RECORD_TYPE_COLORS[r.record_type] || RECORD_TYPE_COLORS.otro;
                        return (
                          <div key={r.id} className={`flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors ${r.alert_level === "alto" ? "border-l-4 border-l-red-400" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-800 text-sm">{r.student_name}</p>
                                {r.requires_followup && (
                                  <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Bell className="w-3 h-3" />Seguimiento
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{r.date}</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{r.time}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>{getRecordTypeLabel(r.record_type)}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${alertBadge.color}`}>{alertBadge.label}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>{statusBadge.label}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              <button onClick={() => setDetailRecord(r)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                              {canWrite && (
                              <>
                              <button onClick={() => openEditRecord(r)} className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-500 transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(r.id)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
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

      {showModal && (
        <RecordModal token={token} student={modalStudent} record={editingRecord} gradeId={selectedGrade} gradeLabel={gradeLabel} sectionId={selectedSection} sectionLabel={sectionLabel} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
      {detailRecord && <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORD MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function RecordModal({ token, student, record, gradeId, gradeLabel, sectionId, sectionLabel, onClose, onSaved }) {
  const headers = { Authorization: `Bearer ${token}` };
  const isEdit = !!record;
  const now = new Date();

  const [date, setDate] = useState(record?.date || now.toISOString().split("T")[0]);
  const [time, setTime] = useState(record?.time || now.toTimeString().slice(0, 5));
  const [recordType, setRecordType] = useState(record?.record_type || "conductual");
  const [reason, setReason] = useState(record?.reason || "");
  const [observation, setObservation] = useState(record?.professional_observation || "");
  const [alertLevel, setAlertLevel] = useState(record?.alert_level || "bajo");
  const [requiresFollowup, setRequiresFollowup] = useState(record?.requires_followup || false);
  const [status, setStatus] = useState(record?.status || "en_seguimiento");
  const [responsible, setResponsible] = useState(record?.responsible || "");
  const [saving, setSaving] = useState(false);

  const studentName = student ? (student.name || `${student.first_name || ""} ${student.last_name || ""}`.trim()) : record?.student_name || "";
  const studentId = student?.student_id || record?.student_id || "";

  const handleSave = async () => {
    if (!reason.trim()) { toast.error("El motivo es obligatorio"); return; }
    if (!responsible.trim()) { toast.error("El responsable es obligatorio"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await axios.put(`${API}/health/psicologia/${record.id}`, {
          date, time, record_type: recordType, reason, professional_observation: observation,
          alert_level: alertLevel, requires_followup: requiresFollowup, status, responsible,
        }, { headers });
        toast.success("Registro actualizado");
      } else {
        await axios.post(`${API}/health/psicologia`, {
          student_id: studentId, student_name: studentName,
          grade_id: gradeId, grade_name: gradeLabel, section_id: sectionId, section_name: sectionLabel,
          date, time, record_type: recordType, reason, professional_observation: observation,
          alert_level: alertLevel, requires_followup: requiresFollowup, status, responsible,
        }, { headers });
        toast.success("Registro creado");
      }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Error al guardar"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" data-testid="record-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{isEdit ? "Editar Registro" : "Registrar Sesion"}</h3>
            <p className="text-sm text-slate-400">{studentName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-date" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hora</label>
              <TimePicker value={time} onChange={(val) => setTime(val)} label="Hora" data-testid="modal-time" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Registro</label>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-record-type">
              {RECORD_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo de la sesion *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Motivo de la sesion..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-reason" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Observacion profesional</label>
            <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} placeholder="Observaciones del profesional..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-observation" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nivel de Alerta</label>
              <select value={alertLevel} onChange={(e) => setAlertLevel(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-alert-level">
                {ALERT_LEVELS.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-status">
                {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
            <input type="checkbox" checked={requiresFollowup} onChange={(e) => setRequiresFollowup(e.target.checked)} className="w-4 h-4 text-violet-600 rounded" data-testid="modal-followup" />
            <span className="text-sm font-semibold text-amber-700">Requiere seguimiento</span>
          </label>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Responsable *</label>
            <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nombre del profesional" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" data-testid="modal-responsible" />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center gap-2" data-testid="modal-save-btn">
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
  const alertBadge = getAlertBadge(record.alert_level);
  const statusBadge = getStatusBadge(record.status);
  const typeColor = RECORD_TYPE_COLORS[record.record_type] || RECORD_TYPE_COLORS.otro;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" data-testid="detail-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800">Detalle del Registro</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${typeColor}`}>{getRecordTypeLabel(record.record_type)}</span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${alertBadge.color}`}>{alertBadge.label}</span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusBadge.color}`}>{statusBadge.label}</span>
            {record.requires_followup && (
              <span className="text-xs px-3 py-1 rounded-full font-semibold bg-amber-100 text-amber-700 flex items-center gap-1"><Bell className="w-3 h-3" />Seguimiento</span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Motivo</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.reason}</p>
          </div>
          {record.professional_observation && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Observacion Profesional</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.professional_observation}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Responsable</p>
            <p className="text-sm text-slate-700">{record.responsible}</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
