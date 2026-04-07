import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import MobileBottomNav from "../components/MobileBottomNav";
import FloatingHelpAvatar from "../components/FloatingHelpAvatar";
import QRScannerTab from "../components/QRScannerTab";
import PaeRegistrosDia from "./pae/PaeRegistrosDia";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ClipboardCheck, Users, UserCheck, FileText, Calendar, ChevronRight,
  Loader2, AlertCircle, Check, Clock, X, Save, RefreshCw, Download,
  User, Filter, CheckCircle2, XCircle, AlertTriangle, QrCode, Circle,
  Eye, ChevronLeft, CheckCircle, UtensilsCrossed, MessageSquareText
} from "lucide-react";
import JustificationModal, { JustificationInfoPopover } from "../components/JustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status configurations
const STUDENT_STATUSES = [
  { id: "pending", label: "Pendiente", icon: Circle, color: "slate", bgColor: "bg-slate-100", textColor: "text-slate-500", borderColor: "border-slate-300" },
  { id: "present", label: "Presente", icon: CheckCircle2, color: "emerald", bgColor: "bg-emerald-100", textColor: "text-emerald-700", borderColor: "border-emerald-500" },
  { id: "late", label: "Tardanza", icon: Clock, color: "amber", bgColor: "bg-amber-100", textColor: "text-amber-700", borderColor: "border-amber-500" },
  { id: "absent", label: "Ausente", icon: XCircle, color: "red", bgColor: "bg-red-100", textColor: "text-red-700", borderColor: "border-red-500" },
  { id: "justified", label: "Justificado", icon: AlertTriangle, color: "blue", bgColor: "bg-blue-100", textColor: "text-blue-700", borderColor: "border-blue-500" }
];

const TEACHER_STATUSES = STUDENT_STATUSES;

// Local storage keys for filter persistence
const STORAGE_KEYS = {
  GRADE: "attendance_last_grade",
  SECTION: "attendance_last_section",
  DATE: "attendance_last_date"
};

// ══════════════════════════════════════════════════════════════════════════════
// STATUS BUTTON COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function StatusButton({ status, isActive, onClick, disabled }) {
  const Icon = status.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(status.id)}
      disabled={disabled}
      className={`flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 sm:flex-row sm:gap-2 sm:px-4 sm:py-2 rounded-xl font-medium transition-all ${
        isActive
          ? `${status.bgColor} ${status.textColor} border-2 ${status.borderColor} shadow-sm`
          : "bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] mt-0.5 sm:mt-0 sm:text-sm">{status.label}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT ATTENDANCE TAB
// ══════════════════════════════════════════════════════════════════════════════
function StudentAttendanceTab({ token, schoolId }) {
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasSavedRecords, setHasSavedRecords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [markingEntry, setMarkingEntry] = useState(null);
  const [markingExit, setMarkingExit] = useState(null);
  const [justifyModal, setJustifyModal] = useState(null); // { studentId, studentName, existingData }
  const [savingJustification, setSavingJustification] = useState(false);
  const [justificationInfo, setJustificationInfo] = useState(null); // data for popover
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load grades on mount
  useEffect(() => {
    loadGrades();
    // Restore last selection from localStorage
    const lastGrade = localStorage.getItem(STORAGE_KEYS.GRADE);
    const lastSection = localStorage.getItem(STORAGE_KEYS.SECTION);
    const lastDate = localStorage.getItem(STORAGE_KEYS.DATE);
    if (lastGrade) setSelectedGrade(lastGrade);
    if (lastSection) setSelectedSection(lastSection);
    if (lastDate) setSelectedDate(lastDate);
  }, []);

  // Load sections when grade changes
  useEffect(() => {
    if (selectedGrade) {
      loadSections(selectedGrade);
      localStorage.setItem(STORAGE_KEYS.GRADE, selectedGrade);
    }
  }, [selectedGrade]);

  // Save section selection
  useEffect(() => {
    if (selectedSection) {
      localStorage.setItem(STORAGE_KEYS.SECTION, selectedSection);
    }
  }, [selectedSection]);

  // Save date selection
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem(STORAGE_KEYS.DATE, selectedDate);
    }
  }, [selectedDate]);

  const loadGrades = async () => {
    try {
      const res = await axios.get(`${API}/academic/grades`, { headers });
      // Sort by level order
      const levelOrder = { 'inicial': 1, 'primaria': 2, 'secundaria': 3 };
      const sortedGrades = res.data.filter(g => g.activo).sort((a, b) => {
        const levelA = levelOrder[a.nivel_nombre?.toLowerCase()] || 99;
        const levelB = levelOrder[b.nivel_nombre?.toLowerCase()] || 99;
        if (levelA !== levelB) return levelA - levelB;
        return (a.orden || 0) - (b.orden || 0);
      });
      setGrades(sortedGrades);
    } catch (err) {
      console.error("Error loading grades:", err);
    }
  };

  const loadSections = async (gradeId) => {
    try {
      const res = await axios.get(`${API}/academic/sections`, { headers });
      const gradeSections = res.data.filter(s => s.activo && s.grado_id === gradeId);
      setSections(gradeSections);
      // If current section not in new list, reset
      if (!gradeSections.find(s => s.id === selectedSection)) {
        setSelectedSection("");
      }
    } catch (err) {
      console.error("Error loading sections:", err);
    }
  };

  const loadAttendance = async () => {
    if (!selectedGrade || !selectedSection || !selectedDate) {
      setError("Selecciona grado, sección y fecha");
      return;
    }
    
    setLoading(true);
    setError("");
    setStudents([]);
    
    try {
      const res = await axios.get(`${API}/attendance/students`, {
        headers,
        params: {
          grade_id: selectedGrade,
          section_id: selectedSection,
          date: selectedDate
        }
      });
      // If no saved records, set all students to "pending" status
      const studentsData = res.data.students.map(s => ({
        ...s,
        status: res.data.has_saved_records ? s.status : "pending"
      }));
      setStudents(studentsData);
      setHasSavedRecords(res.data.has_saved_records);
      setHasChanges(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cargar asistencia");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    if (newStatus === "justified") {
      const student = students.find(s => s.id === studentId);
      setJustifyModal({
        studentId,
        studentName: student?.full_name || "",
        existingData: student?.justification_reason ? {
          justification_reason: student.justification_reason,
          justification_note: student.justification_note,
        } : null
      });
      return;
    }
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, status: newStatus } : s
    ));
    setHasChanges(true);
  };

  const handleJustifySave = async ({ justification_reason, justification_note }) => {
    if (!justifyModal) return;
    setSavingJustification(true);
    try {
      const res = await axios.post(`${API}/attendance/justify`, {
        student_id: justifyModal.studentId,
        date: selectedDate,
        justification_reason,
        justification_note,
      }, { headers });
      setStudents(prev => prev.map(s =>
        s.id === justifyModal.studentId ? {
          ...s,
          status: "justified",
          justification_reason: res.data.justification_reason,
          justification_note: res.data.justification_note,
          justified_by: res.data.justified_by,
          justified_by_name: res.data.justified_by_name,
          justified_at: res.data.justified_at,
        } : s
      ));
      setJustifyModal(null);
      setSuccess("Justificacion registrada correctamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al justificar");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSavingJustification(false);
    }
  };

  const markEntry = async (studentId) => {
    setMarkingEntry(studentId);
    setError("");
    try {
      const res = await axios.post(`${API}/attendance/mark-entry`, {
        student_id: studentId, date: selectedDate, method: "manual"
      }, { headers });
      setStudents(prev => prev.map(s =>
        s.id === studentId ? { ...s, entry_time: res.data.entry_time, status: "present", entry_method: "manual" } : s
      ));
      setSuccess(`Entrada registrada: ${res.data.entry_time}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al registrar entrada");
      setTimeout(() => setError(""), 3000);
    } finally {
      setMarkingEntry(null);
    }
  };

  const markExit = async (studentId) => {
    setMarkingExit(studentId);
    setError("");
    try {
      const res = await axios.post(`${API}/attendance/mark-exit`, {
        student_id: studentId, date: selectedDate, method: "manual"
      }, { headers });
      setStudents(prev => prev.map(s =>
        s.id === studentId ? { ...s, exit_time: res.data.exit_time, total_minutes: res.data.total_minutes, exit_method: "manual" } : s
      ));
      setSuccess(`Salida registrada: ${res.data.exit_time}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al registrar salida");
      setTimeout(() => setError(""), 3000);
    } finally {
      setMarkingExit(null);
    }
  };

  const handleSaveClick = () => {
    if (students.length === 0) return;
    
    // Check for pending students
    const pendingCount = students.filter(s => s.status === "pending").length;
    if (pendingCount > 0) {
      setShowPendingModal(true);
    } else {
      saveAttendance();
    }
  };

  const saveAttendance = async () => {
    if (students.length === 0) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    setShowPendingModal(false);
    
    try {
      // Filter out pending students - only save those with actual status
      const records = students
        .filter(s => s.status !== "pending")
        .map(s => ({
          user_id: s.id,
          status: s.status
        }));
      
      await axios.post(`${API}/attendance/students/save`, {
        date: selectedDate,
        grade_id: selectedGrade,
        section_id: selectedSection,
        records
      }, { headers });
      
      setSuccess("Asistencia guardada correctamente");
      setHasChanges(false);
      setHasSavedRecords(true);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar asistencia");
    } finally {
      setSaving(false);
    }
  };

  // Calculate summary
  const summary = {
    pending: students.filter(s => s.status === "pending").length,
    present: students.filter(s => s.status === "present" || s.status === "late").length,
    late: students.filter(s => s.status === "late").length,
    absent: students.filter(s => s.status === "absent").length,
    total: students.length,
    with_entry: students.filter(s => s.entry_time).length,
    with_exit: students.filter(s => s.exit_time).length
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-600" />
          Filtros de Asistencia
        </h3>
        
        <div className="grid md:grid-cols-4 gap-4">
          {/* Grade */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar grado</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nivel_nombre} - {g.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sección</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedGrade}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Seleccionar sección</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Load button */}
          <div className="flex items-end">
            <button
              onClick={loadAttendance}
              disabled={loading || !selectedGrade || !selectedSection}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              Cargar
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Attendance Table */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header with summary */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">Asistencia del {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</h3>
                <p className="text-blue-100">{summary.total} estudiantes</p>
              </div>
              <div className="flex gap-2 text-sm flex-wrap">
                <div className="bg-white/20 px-3 py-2 rounded-lg" data-testid="counter-entry">
                  <span className="text-emerald-300">Entrada {summary.with_entry}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg" data-testid="counter-exit">
                  <span className="text-blue-300">Salida {summary.with_exit}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg" data-testid="counter-late">
                  <span className="text-amber-300">Tardanza {summary.late}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg" data-testid="counter-absent">
                  <span className="text-red-300">Ausentes {summary.absent}</span>
                </div>
                {summary.pending > 0 && (
                  <div className="bg-white/20 px-3 py-2 rounded-lg" data-testid="counter-pending">
                    <span className="text-slate-300">Pendientes {summary.pending}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Unsaved changes warning */}
            {hasChanges && (
              <div className="mt-3 p-3 bg-amber-500/30 rounded-lg flex items-center gap-2 text-amber-100">
                <AlertTriangle className="w-5 h-5" />
                <span>Tienes cambios pendientes por guardar</span>
              </div>
            )}
          </div>

          {/* Student list */}
          <div className="divide-y divide-slate-100">
            {students.map((student, idx) => (
              <div
                key={student.id}
                data-testid={`student-row-${student.id}`}
                className={`p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-slate-50 transition-colors ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                {/* Avatar + Name row */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold text-sm">
                        {student.name?.charAt(0) || "E"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 md:w-40">
                    <p className="font-semibold text-slate-800 text-sm truncate">{student.full_name}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3 md:flex-nowrap md:flex-1">
                  {/* Entry/Exit times */}
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-1.5" data-testid={`entry-${student.id}`}>
                      {student.entry_time ? (
                        <span className="text-xs md:text-sm font-medium text-emerald-600 bg-emerald-50 px-2 md:px-2.5 py-1 rounded-lg">
                          Entrada {student.entry_time}
                        </span>
                      ) : (
                        <button
                          onClick={() => markEntry(student.id)}
                          disabled={markingEntry === student.id || student.status === "absent"}
                          data-testid={`mark-entry-${student.id}`}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {markingEntry === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : "Marcar Entrada"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5" data-testid={`exit-${student.id}`}>
                      {student.exit_time ? (
                        <span className="text-xs md:text-sm font-medium text-blue-600 bg-blue-50 px-2 md:px-2.5 py-1 rounded-lg">
                          Salida {student.exit_time}
                          {student.total_minutes != null && (
                            <span className="text-xs text-blue-400 ml-1">({student.total_minutes}min)</span>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={() => markExit(student.id)}
                          disabled={!student.entry_time || markingExit === student.id}
                          data-testid={`mark-exit-${student.id}`}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {markingExit === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : "Marcar Salida"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status buttons */}
                  <div className="flex gap-2 flex-wrap md:flex-nowrap md:ml-auto items-center">
                    {STUDENT_STATUSES.map(status => (
                      <StatusButton
                        key={status.id}
                        status={status}
                        isActive={student.status === status.id}
                        onClick={(newStatus) => handleStatusChange(student.id, newStatus)}
                      />
                    ))}
                    {student.status === "justified" && student.justification_reason && (
                      <button
                        onClick={() => setJustificationInfo(student)}
                        className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-colors flex-shrink-0"
                        title="Ver detalle de justificacion"
                        data-testid={`justification-info-${student.id}`}
                      >
                        <MessageSquareText className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save button */}
          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <button
              onClick={handleSaveClick}
              disabled={saving || !hasChanges}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                hasChanges
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  {hasSavedRecords ? "Actualizar Asistencia" : "Guardar Asistencia"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && students.length === 0 && selectedGrade && selectedSection && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Sin estudiantes</h3>
          <p className="text-slate-500">No hay estudiantes registrados en esta sección o no se ha cargado la asistencia.</p>
          <button
            onClick={loadAttendance}
            className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600"
          >
            Cargar asistencia
          </button>
        </div>
      )}

      {/* Pending Confirmation Modal */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
            <div className="p-6 text-center">
              {/* Warning Icon */}
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                Estudiantes sin registrar
              </h3>
              
              {/* Message */}
              <p className="text-slate-500 mb-6">
                Hay <span className="font-bold text-amber-600">{summary.pending} estudiante{summary.pending !== 1 ? 's' : ''}</span> sin registrar asistencia.
                <br />
                ¿Deseas continuar de todas formas?
              </p>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPendingModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveAttendance}
                  className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
                >
                  Guardar de todos modos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Justification Modal */}
      <JustificationModal
        isOpen={!!justifyModal}
        onClose={() => setJustifyModal(null)}
        onSave={handleJustifySave}
        studentName={justifyModal?.studentName || ""}
        existingData={justifyModal?.existingData}
        saving={savingJustification}
      />

      {/* Justification Info Popover */}
      {justificationInfo && (
        <JustificationInfoPopover
          data={justificationInfo}
          onClose={() => setJustificationInfo(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEACHER ATTENDANCE TAB
// ══════════════════════════════════════════════════════════════════════════════
function TeacherAttendanceTab({ token, schoolId }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasSavedRecords, setHasSavedRecords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const headers = { Authorization: `Bearer ${token}` };

  const loadAttendance = async () => {
    setLoading(true);
    setError("");
    
    try {
      const res = await axios.get(`${API}/attendance/teachers`, {
        headers,
        params: { date: selectedDate }
      });
      setTeachers(res.data.teachers);
      setHasSavedRecords(res.data.has_saved_records);
      setHasChanges(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cargar asistencia");
    } finally {
      setLoading(false);
    }
  };

  // Load on date change
  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const handleStatusChange = (teacherId, newStatus) => {
    setTeachers(prev => prev.map(t => 
      t.id === teacherId ? { ...t, status: newStatus } : t
    ));
    setHasChanges(true);
  };

  const saveAttendance = async () => {
    if (teachers.length === 0) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      const records = teachers.map(t => ({
        user_id: t.id,
        status: t.status
      }));
      
      await axios.post(`${API}/attendance/teachers/save`, {
        date: selectedDate,
        records
      }, { headers });
      
      setSuccess("Asistencia de profesores guardada correctamente");
      setHasChanges(false);
      setHasSavedRecords(true);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar asistencia");
    } finally {
      setSaving(false);
    }
  };

  // Calculate summary
  const summary = {
    present: teachers.filter(t => t.status === "present").length,
    late: teachers.filter(t => t.status === "late").length,
    absent: teachers.filter(t => t.status === "absent").length,
    justified: teachers.filter(t => t.status === "justified").length,
    total: teachers.length
  };

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span className="font-semibold text-slate-700">Fecha:</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Actualizar
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Teacher list */}
      {teachers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">Asistencia del {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</h3>
                <p className="text-indigo-100">{summary.total} profesores</p>
              </div>
              <div className="flex gap-3 text-sm flex-wrap">
                <div className="bg-white/20 px-3 py-2 rounded-lg">
                  <span className="text-emerald-300">✓ {summary.present}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg">
                  <span className="text-amber-300">⏰ {summary.late}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg">
                  <span className="text-red-300">✗ {summary.absent}</span>
                </div>
                <div className="bg-white/20 px-3 py-2 rounded-lg">
                  <span className="text-blue-300">📝 {summary.justified}</span>
                </div>
              </div>
            </div>
            
            {hasChanges && (
              <div className="mt-3 p-3 bg-amber-500/30 rounded-lg flex items-center gap-2 text-amber-100">
                <AlertTriangle className="w-5 h-5" />
                <span>Tienes cambios pendientes por guardar</span>
              </div>
            )}
          </div>

          {/* Teacher list */}
          <div className="divide-y divide-slate-100">
            {teachers.map((teacher, idx) => (
              <div
                key={teacher.id}
                className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {teacher.photo_url ? (
                    <img src={teacher.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {teacher.name?.charAt(0) || "P"}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{teacher.full_name}</p>
                  <p className="text-sm text-slate-500">{teacher.email}</p>
                </div>

                {/* Status buttons */}
                <div className="flex gap-2 flex-wrap justify-end">
                  {TEACHER_STATUSES.map(status => (
                    <StatusButton
                      key={status.id}
                      status={status}
                      isActive={teacher.status === status.id}
                      onClick={(newStatus) => handleStatusChange(teacher.id, newStatus)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save button */}
          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <button
              onClick={saveAttendance}
              disabled={saving || !hasChanges}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                hasChanges
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  {hasSavedRecords ? "Actualizar Asistencia" : "Guardar Asistencia"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && teachers.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <UserCheck className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Sin profesores</h3>
          <p className="text-slate-500">No hay profesores registrados en el sistema.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function ReportsTab({ token, schoolId }) {
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [detailModal, setDetailModal] = useState(null); // { studentId, studentName, studentPhoto }
  const [detailRecords, setDetailRecords] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMonth, setDetailMonth] = useState(new Date());
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load grades on mount
  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const res = await axios.get(`${API}/academic/grades`, { headers });
      setGrades(res.data || []);
    } catch (err) {
      console.error("Error loading grades:", err);
    } finally {
      setLoadingGrades(false);
    }
  };

  // Load sections when grade changes
  useEffect(() => {
    if (selectedGrade) {
      loadSections(selectedGrade);
    } else {
      setSections([]);
      setSelectedSection("");
    }
  }, [selectedGrade]);

  const loadSections = async (gradeId) => {
    try {
      const res = await axios.get(`${API}/academic/sections?grado_id=${gradeId}`, { headers });
      setSections(res.data || []);
    } catch (err) {
      console.error("Error loading sections:", err);
    }
  };

  const loadReport = async () => {
    if (!selectedGrade || !selectedSection) {
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        grade_id: selectedGrade,
        section_id: selectedSection,
        start_date: startDate,
        end_date: endDate
      });
      
      const res = await axios.get(`${API}/attendance/reports/students?${params}`, { headers });
      setReport(res.data);
    } catch (err) {
      console.error("Error loading report:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get grade and section names for display
  const gradeName = grades.find(g => g.id === selectedGrade)?.nombre || "";
  const sectionName = sections.find(s => s.id === selectedSection)?.nombre || "";

  // Student detail modal functions
  const openDetailModal = async (studentId, studentName, studentPhoto) => {
    setDetailModal({ studentId, studentName, studentPhoto });
    setDetailMonth(new Date());
    await loadDetailRecords(studentId, new Date());
  };

  const loadDetailRecords = async (studentId, month) => {
    setDetailLoading(true);
    try {
      const y = month.getFullYear();
      const m = month.getMonth();
      const sd = new Date(y, m, 1).toISOString().split("T")[0];
      const ed = new Date(y, m + 1, 0).toISOString().split("T")[0];
      const res = await axios.get(`${API}/attendance/reports/student-detail?student_id=${studentId}&start_date=${sd}&end_date=${ed}`, { headers });
      setDetailRecords(res.data.records || []);
    } catch (err) {
      console.error("Error:", err);
      setDetailRecords([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const changeDetailMonth = (dir) => {
    const newMonth = new Date(detailMonth.getFullYear(), detailMonth.getMonth() + dir, 1);
    if (newMonth <= new Date()) {
      setDetailMonth(newMonth);
      if (detailModal) loadDetailRecords(detailModal.studentId, newMonth);
    }
  };

  // Export to PDF function
  const exportToPDF = () => {
    if (!report) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(88, 28, 135); // Purple color
    doc.text("Reporte de Asistencia de Estudiantes", pageWidth / 2, 20, { align: "center" });
    
    // Subtitle with grade, section and dates
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const subtitle = `${gradeName} - Sección ${sectionName}`;
    const dateRange = `Período: ${new Date(startDate + 'T12:00:00').toLocaleDateString("es-PE")} - ${new Date(endDate + 'T12:00:00').toLocaleDateString("es-PE")}`;
    doc.text(subtitle, pageWidth / 2, 28, { align: "center" });
    doc.text(dateRange, pageWidth / 2, 34, { align: "center" });
    
    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumen General", 14, 48);
    
    // Summary boxes
    const summaryY = 54;
    const boxWidth = 42;
    const boxHeight = 18;
    const startX = 14;
    
    // Total
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(startX, summaryY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(String(report.summary.total_records), startX + boxWidth/2, summaryY + 8, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Total registros", startX + boxWidth/2, summaryY + 14, { align: "center" });
    
    // Asistencias
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(startX + boxWidth + 4, summaryY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setTextColor(4, 120, 87);
    doc.text(String(report.summary.present), startX + boxWidth + 4 + boxWidth/2, summaryY + 8, { align: "center" });
    doc.setFontSize(8);
    doc.text("Asistencias", startX + boxWidth + 4 + boxWidth/2, summaryY + 14, { align: "center" });
    
    // Tardanzas
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(startX + (boxWidth + 4) * 2, summaryY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setTextColor(180, 83, 9);
    doc.text(String(report.summary.late), startX + (boxWidth + 4) * 2 + boxWidth/2, summaryY + 8, { align: "center" });
    doc.setFontSize(8);
    doc.text("Tardanzas", startX + (boxWidth + 4) * 2 + boxWidth/2, summaryY + 14, { align: "center" });
    
    // Inasistencias
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(startX + (boxWidth + 4) * 3, summaryY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28);
    doc.text(String(report.summary.absent), startX + (boxWidth + 4) * 3 + boxWidth/2, summaryY + 8, { align: "center" });
    doc.setFontSize(8);
    doc.text("Inasistencias", startX + (boxWidth + 4) * 3 + boxWidth/2, summaryY + 14, { align: "center" });
    
    // Table
    if (report.report.length > 0) {
      const tableData = report.report.map(item => [
        item.student_name,
        item.total_days,
        item.present,
        item.late,
        item.absent,
        `${item.attendance_rate}%`
      ]);
      
      autoTable(doc, {
        startY: 80,
        head: [['Estudiante', 'Días', 'Asistencias', 'Tardanzas', 'Inasistencias', '% Asistencia']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [124, 58, 237],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 28, halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.text(
        `Generado el ${new Date().toLocaleDateString("es-PE")} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }
    
    // Save
    const fileName = `reporte_asistencia_${gradeName.replace(/\s+/g, '_')}_${sectionName}_${startDate}_${endDate}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6" data-testid="attendance-reports-tab">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-violet-600" />
          Filtros del Reporte de Estudiantes
        </h3>
        
        <div className="grid md:grid-cols-5 gap-4">
          {/* Grade */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
            <select
              data-testid="report-grade-select"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={loadingGrades}
            >
              <option value="">Seleccionar grado...</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sección</label>
            <select
              data-testid="report-section-select"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={!selectedGrade}
            >
              <option value="">Seleccionar sección...</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Desde</label>
            <input
              type="date"
              data-testid="report-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Hasta</label>
            <input
              type="date"
              data-testid="report-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Generate button */}
          <div className="flex items-end">
            <button
              data-testid="report-generate-btn"
              onClick={loadReport}
              disabled={loading || !selectedGrade || !selectedSection}
              className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              Generar Reporte
            </button>
          </div>
        </div>
      </div>

      {/* Report results */}
      {report && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="attendance-report-results">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">Reporte de Asistencia de Estudiantes</h3>
                <p className="text-violet-100">
                  {gradeName} - Sección {sectionName} | {new Date(startDate + 'T12:00:00').toLocaleDateString("es-PE")} - {new Date(endDate + 'T12:00:00').toLocaleDateString("es-PE")}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportToPDF}
                  data-testid="report-export-pdf-btn"
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Exportar PDF
                </button>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="p-6 border-b border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-slate-800">{report.summary.total_records}</p>
                <p className="text-sm text-slate-500">Total registros</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{report.summary.present}</p>
                <p className="text-sm text-emerald-700">Asistencias</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{report.summary.late}</p>
                <p className="text-sm text-amber-700">Tardanzas</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{report.summary.absent}</p>
                <p className="text-sm text-red-700">Inasistencias</p>
              </div>
            </div>
          </div>

          {/* Student breakdown */}
          {report.report.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Estudiante</th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-slate-700">Días</th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-emerald-600">Asistencias</th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-amber-600">Tardanzas</th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-red-600">Inasistencias</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-slate-700">% Asistencia</th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-slate-700">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.report.map((item, idx) => (
                    <tr key={item.student_id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.student_photo ? (
                            <img src={item.student_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold">
                              {item.student_name?.charAt(0) || "E"}
                            </div>
                          )}
                          <span className="font-semibold text-slate-800">{item.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600">{item.total_days}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                          {item.present}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                          {item.late}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                          {item.absent}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                item.attendance_rate >= 90 ? "bg-emerald-500" :
                                item.attendance_rate >= 75 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${item.attendance_rate}%` }}
                            />
                          </div>
                          <span className={`font-bold ${
                            item.attendance_rate >= 90 ? "text-emerald-600" :
                            item.attendance_rate >= 75 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {item.attendance_rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          data-testid={`view-detail-${item.student_id}`}
                          onClick={() => openDetailModal(item.student_id, item.student_name, item.student_photo)}
                          className="w-9 h-9 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors mx-auto"
                          title="Ver detalle mensual"
                        >
                          <Eye className="w-4 h-4 text-violet-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Sin datos de estudiantes</h3>
              <p className="text-slate-500">No hay registros de asistencia en el rango seleccionado para esta sección.</p>
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!report && !loading && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Reporte de Asistencia de Estudiantes</h3>
          <p className="text-slate-500 mb-4">Selecciona un grado, sección y rango de fechas para generar el reporte.</p>
          <p className="text-sm text-slate-400">El reporte mostrará las asistencias, tardanzas e inasistencias de cada alumno.</p>
        </div>
      )}

      {/* Student Detail Drawer (Side Panel) */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="student-detail-drawer">
          <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={() => setDetailModal(null)} />
          <div className="relative w-full max-w-3xl bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right" style={{ animation: "slideInRight 0.3s ease-out" }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                {detailModal.studentPhoto ? (
                  <img src={detailModal.studentPhoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/50" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">{detailModal.studentName?.charAt(0)}</div>
                )}
                <div className="text-white">
                  <h3 className="font-bold text-lg leading-tight">Asistencia de {detailModal.studentName}</h3>
                  <p className="text-violet-200 text-sm">Detalle mensual</p>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4" /></button>
            </div>

            {/* Month Navigation */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <button onClick={() => changeDetailMonth(-1)} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <h4 className="text-lg font-semibold text-slate-800 capitalize">{detailMonth.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}</h4>
              <button onClick={() => changeDetailMonth(1)} disabled={detailMonth.getMonth() === new Date().getMonth() && detailMonth.getFullYear() === new Date().getFullYear()} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>

            {/* Stats */}
            {(() => {
              const st = { present: 0, absent: 0, late: 0, justified: 0, total: detailRecords.length };
              detailRecords.forEach(a => { if (st[a.status] !== undefined) st[a.status]++; });
              const pct = st.total > 0 ? Math.round(((st.present + st.justified) / st.total) * 100) : 0;
              return (
                <div className="px-5 py-3 grid grid-cols-5 gap-2">
                  <div className="bg-emerald-500 rounded-lg p-2 text-white text-center"><p className="text-[10px] text-white/80">Asistencia</p><p className="text-lg font-bold">{pct}%</p></div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center"><p className="text-[10px] text-emerald-600">Asistencias</p><p className="text-lg font-bold text-emerald-700">{st.present}</p></div>
                  <div className="bg-amber-50 rounded-lg p-2 text-center"><p className="text-[10px] text-amber-600">Tardanzas</p><p className="text-lg font-bold text-amber-700">{st.late}</p></div>
                  <div className="bg-red-50 rounded-lg p-2 text-center"><p className="text-[10px] text-red-600">Faltas</p><p className="text-lg font-bold text-red-700">{st.absent}</p></div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-[10px] text-blue-600">Justificadas</p><p className="text-lg font-bold text-blue-700">{st.justified}</p></div>
                </div>
              );
            })()}

            {/* Calendar */}
            <div className="px-5 py-4">
              {detailLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const y = detailMonth.getFullYear(), mo = detailMonth.getMonth();
                      const firstDay = new Date(y, mo, 1).getDay();
                      const daysInMonth = new Date(y, mo + 1, 0).getDate();
                      const cells = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const rec = detailRecords.find(a => a.date === dateStr);
                        const isWeekend = [0, 6].includes(new Date(y, mo, day).getDay());
                        const entryTime = rec?.entry_time ? (() => { try { return new Date(rec.entry_time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); } catch { return null; } })() : null;
                        const exitTime = rec?.exit_time ? (() => { try { return new Date(rec.exit_time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); } catch { return null; } })() : null;

                        if (!rec?.status) {
                          cells.push(<div key={day} className={`h-20 rounded-lg flex items-center justify-center text-sm ${isWeekend ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-600"}`}><span className="font-medium">{day}</span></div>);
                        } else if (rec.status === "absent" || rec.status === "justified") {
                          const cfg = rec.status === "absent" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                          cells.push(
                            <div key={day} className={`h-20 rounded-lg flex flex-col items-center justify-center ${cfg}`}>
                              <span className="font-bold text-sm">{day}</span>
                              {rec.status === "absent" ? <XCircle className="w-3.5 h-3.5 mt-0.5" /> : <FileText className="w-3.5 h-3.5 mt-0.5" />}
                            </div>
                          );
                        } else {
                          const isLate = rec.status === "late";
                          cells.push(
                            <div key={day} className="h-20 rounded-lg overflow-hidden flex flex-col">
                              <div className={`flex-1 flex flex-col items-center justify-center ${entryTime ? "bg-emerald-100" : isLate ? "bg-amber-100" : "bg-emerald-100"}`}>
                                <span className={`font-bold text-sm ${isLate && !entryTime ? "text-amber-700" : "text-emerald-700"}`}>{day}</span>
                                {entryTime ? (
                                  <span className="text-emerald-700 font-medium text-center text-[10px] leading-tight">E {entryTime}</span>
                                ) : isLate ? <Clock className="w-3 h-3 text-amber-600" /> : <CheckCircle className="w-3 h-3 text-emerald-600" />}
                              </div>
                              <div className={`flex-1 flex items-center justify-center ${exitTime ? "bg-blue-100" : entryTime ? "bg-emerald-50" : isLate ? "bg-amber-50" : "bg-emerald-50"}`}>
                                {exitTime && <span className="text-blue-700 font-medium text-center text-[10px] leading-tight">S {exitTime}</span>}
                              </div>
                            </div>
                          );
                        }
                      }
                      return cells;
                    })()}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /><span className="text-slate-600">Entrada</span></div>
                    <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /><span className="text-slate-600">Salida</span></div>
                    <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /><span className="text-slate-600">Tardanza</span></div>
                    <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /><span className="text-slate-600">Falta</span></div>
                    <div className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /><span className="text-slate-600">Justificado</span></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// TEACHER REPORTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function TeacherReportsTab({ token }) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await axios.get(`${API}/attendance/reports/teachers?${params}`, { headers });
      setReport(res.data);
    } catch (err) {
      console.error("Error loading teacher report:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setTextColor(88, 28, 135);
    doc.text("Reporte de Asistencia de Profesores", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const dateRange = `Período: ${new Date(startDate + 'T12:00:00').toLocaleDateString("es-PE")} - ${new Date(endDate + 'T12:00:00').toLocaleDateString("es-PE")}`;
    doc.text(dateRange, pageWidth / 2, 28, { align: "center" });

    if (report.report.length > 0) {
      const tableData = report.report.map(item => [
        item.teacher_name,
        item.total_days,
        item.present,
        item.late,
        item.absent,
        item.justified,
        `${item.attendance_rate}%`
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Profesor', 'Días', 'Presente', 'Tardanza', 'Ausente', 'Justificado', '% Asist.']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 26, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Generado el ${new Date().toLocaleDateString("es-PE")} - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
    }

    doc.save(`reporte_asistencia_profesores_${startDate}_${endDate}.pdf`);
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: "bg-emerald-100 text-emerald-700",
      late: "bg-amber-100 text-amber-700",
      absent: "bg-red-100 text-red-700",
      justified: "bg-blue-100 text-blue-700"
    };
    const labels = { present: "Presente", late: "Tardanza", absent: "Ausente", justified: "Justificado" };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || "bg-slate-100 text-slate-500"}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-6" data-testid="teacher-reports-tab">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-violet-600" />
          Reporte de Asistencia de Profesores
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              data-testid="teacher-report-start-date" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              data-testid="teacher-report-end-date" />
          </div>
          <div className="flex items-end">
            <button onClick={loadReport} disabled={loading}
              className="w-full px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="teacher-report-generate">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              Generar Reporte
            </button>
          </div>
        </div>
      </div>

      {/* Report results */}
      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="teacher-report-summary">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-center">
              <p className="text-2xl font-bold text-slate-800">{report.summary.total_records}</p>
              <p className="text-xs text-slate-500 font-medium">Total registros</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 shadow-sm border border-emerald-200 text-center">
              <p className="text-2xl font-bold text-emerald-700">{report.summary.present}</p>
              <p className="text-xs text-emerald-600 font-medium">Presentes</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-amber-200 text-center">
              <p className="text-2xl font-bold text-amber-700">{report.summary.late}</p>
              <p className="text-xs text-amber-600 font-medium">Tardanzas</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-200 text-center">
              <p className="text-2xl font-bold text-red-700">{report.summary.absent}</p>
              <p className="text-xs text-red-600 font-medium">Ausentes</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 shadow-sm border border-blue-200 text-center">
              <p className="text-2xl font-bold text-blue-700">{report.summary.justified}</p>
              <p className="text-xs text-blue-600 font-medium">Justificados</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-violet-600" />
                Detalle por Profesor ({report.report.length})
              </h3>
              <button onClick={exportToPDF}
                className="px-4 py-2 bg-violet-100 text-violet-700 rounded-xl text-sm font-semibold hover:bg-violet-200 transition-colors flex items-center gap-2"
                data-testid="teacher-report-export-pdf">
                <Download className="w-4 h-4" /> Exportar PDF
              </button>
            </div>

            {report.report.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No hay registros de asistencia en este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Profesor</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase">Días</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-emerald-600 uppercase">Presente</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-amber-600 uppercase">Tardanza</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-red-600 uppercase">Ausente</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-blue-600 uppercase">Justificado</th>
                      <th className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.report.map((t) => (
                      <tr key={t.teacher_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {t.teacher_photo ? (
                              <img src={t.teacher_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                {t.teacher_name?.charAt(0) || "P"}
                              </div>
                            )}
                            <span className="font-medium text-slate-800 text-sm">{t.teacher_name}</span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 text-sm font-medium text-slate-600">{t.total_days}</td>
                        <td className="text-center px-3 py-3"><span className="text-sm font-bold text-emerald-600">{t.present}</span></td>
                        <td className="text-center px-3 py-3"><span className="text-sm font-bold text-amber-600">{t.late}</span></td>
                        <td className="text-center px-3 py-3"><span className="text-sm font-bold text-red-600">{t.absent}</span></td>
                        <td className="text-center px-3 py-3"><span className="text-sm font-bold text-blue-600">{t.justified}</span></td>
                        <td className="text-center px-3 py-3">
                          <span className={`text-sm font-bold ${t.attendance_rate >= 90 ? "text-emerald-600" : t.attendance_rate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                            {t.attendance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent records */}
          {report.records && report.records.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Últimos Registros</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {report.records.slice(0, 20).map((r, idx) => {
                  const teacher = report.report.find(t => t.teacher_id === r.user_id);
                  return (
                    <div key={idx} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {teacher?.teacher_name?.charAt(0) || "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{teacher?.teacher_name || r.user_id}</p>
                        <p className="text-xs text-slate-400">{r.date} — {r.check_in_time || r.entry_time || ""}</p>
                      </div>
                      {getStatusBadge(r.status)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AttendancePage({ user, token, subdomain, onLogout, initialView }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState(initialView || searchParams.get("tab") || "home");
  const [scanContext, setScanContext] = useState(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) setActiveView(tabParam);
  }, [searchParams]);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings`, { headers });
      setSettings(res.data);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  const isMobileQRMode = activeView === "qr-scanner";
  const isSubView = activeView !== "home";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="attendance-page">
      <Sidebar 
        active="asistencias"
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
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {/* Page Title — hidden on mobile when QR scanner is active */}
          <div className={`${isMobileQRMode ? "hidden lg:block" : ""} relative overflow-hidden rounded-3xl mb-8`}>
            <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-emerald-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center gap-6">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <ClipboardCheck className="w-10 h-10 text-teal-600" />
              </div>
              <div className="text-white">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Asistencias</h1>
                <p className="text-teal-200 text-lg">Registro y control de asistencia escolar</p>
              </div>
            </div>
          </div>

          {/* Back button when in sub-view */}
          {isSubView && (
            <button
              onClick={() => setActiveView("home")}
              className={`${isMobileQRMode ? "hidden lg:flex" : "flex"} items-center gap-2 mb-6 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-sm shadow-sm`}
              data-testid="back-to-home"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al panel de asistencia
            </button>
          )}

          {/* ─── HOME: Section Cards ─── */}
          {activeView === "home" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="attendance-home">
              {/* SECTION 1: Estudiantes */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid="section-students">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Estudiantes</h2>
                      <p className="text-blue-200 text-sm">Asistencia de alumnos</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <button
                    onClick={() => { setScanContext("student"); setActiveView("qr-scanner"); }}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-300 rounded-xl transition-all group"
                    data-testid="btn-students-qr"
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-100 group-hover:bg-violet-500 flex items-center justify-center transition-colors">
                      <QrCode className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Escanear QR</p>
                      <p className="text-xs text-slate-400">Registro automático con código QR</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                  <button
                    onClick={() => setActiveView("students")}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-300 rounded-xl transition-all group"
                    data-testid="btn-students-manual"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
                      <ClipboardCheck className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Marcar Manual</p>
                      <p className="text-xs text-slate-400">Lista de alumnos con botones de estado</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                </div>
              </div>

              {/* SECTION 2: Profesores */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid="section-teachers">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Profesores</h2>
                      <p className="text-indigo-200 text-sm">Asistencia de docentes</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <button
                    onClick={() => { setScanContext("teacher"); setActiveView("qr-scanner"); }}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl transition-all group"
                    data-testid="btn-teachers-qr"
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-100 group-hover:bg-violet-500 flex items-center justify-center transition-colors">
                      <QrCode className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Escanear QR</p>
                      <p className="text-xs text-slate-400">Registro automático con código QR</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </button>
                  <button
                    onClick={() => setActiveView("teachers")}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl transition-all group"
                    data-testid="btn-teachers-manual"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 group-hover:bg-indigo-500 flex items-center justify-center transition-colors">
                      <ClipboardCheck className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Marcar Manual</p>
                      <p className="text-xs text-slate-400">Lista de docentes con botones de estado</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </button>
                </div>
              </div>

              {/* SECTION 3: Reportes */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid="section-reports">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Reportes</h2>
                      <p className="text-amber-200 text-sm">Reportes de asistencia</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <button
                    onClick={() => setActiveView("reports")}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                    data-testid="btn-reports-students"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
                      <Users className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Reportes Estudiantes</p>
                      <p className="text-xs text-slate-400">Asistencia por grado y sección</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                  </button>
                  <button
                    onClick={() => setActiveView("reports-teachers")}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                    data-testid="btn-reports-teachers"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 group-hover:bg-indigo-500 flex items-center justify-center transition-colors">
                      <UserCheck className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Reportes Profesores</p>
                      <p className="text-xs text-slate-400">Asistencia de docentes</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                  </button>
                </div>

                {/* Status legend */}
                <div className="px-5 pb-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Estados</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Presente
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 font-medium">
                      <Clock className="w-3 h-3" /> Tardanza
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-medium">
                      <XCircle className="w-3 h-3" /> Ausente
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Justificado
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium">
                      <Circle className="w-3 h-3" /> Pendiente
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Alimentación (PAE) - Solo owner/admin */}
              {(user?.role === "owner" || user?.role === "admin") && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid="section-alimentacion">
                <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <UtensilsCrossed className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Alimentacion</h2>
                      <p className="text-emerald-200 text-sm">Control de comedor escolar</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <button
                    onClick={() => setActiveView("alimentacion")}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-300 rounded-xl transition-all group"
                    data-testid="btn-alimentacion-registros"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                      <ClipboardCheck className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800 text-sm">Registros del dia</p>
                      <p className="text-xs text-slate-400">Ver asistencias de alimentacion</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                  <button
                    disabled
                    className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl opacity-50 cursor-not-allowed"
                    data-testid="btn-alimentacion-reportes"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-500 text-sm">Reportes Alimentacion</p>
                      <p className="text-xs text-slate-400">Proximamente</p>
                    </div>
                  </button>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ─── SUB-VIEWS ─── */}
          {activeView === "students" && (
            <StudentAttendanceTab token={token} schoolId={user?.school_id} />
          )}
          
          {activeView === "teachers" && (
            <TeacherAttendanceTab token={token} schoolId={user?.school_id} />
          )}
          
          {activeView === "qr-scanner" && (
            <QRScannerTab token={token} schoolId={user?.school_id} roleFilter={scanContext} user={user} />
          )}
          
          {activeView === "reports" && (
            <ReportsTab token={token} schoolId={user?.school_id} />
          )}
          
          {activeView === "reports-teachers" && (
            <TeacherReportsTab token={token} schoolId={user?.school_id} />
          )}

          {activeView === "alimentacion" && (
            <PaeRegistrosDia user={user} token={token} subdomain={subdomain} embedded />
          )}
        </main>
      </div>
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
      <FloatingHelpAvatar subdomain={subdomain} />
    </div>
  );
}
