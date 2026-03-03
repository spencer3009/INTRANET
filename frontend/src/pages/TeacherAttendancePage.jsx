import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import StudentHeader from "../components/StudentHeader";
import QRScannerTab from "../components/QRScannerTab";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  ClipboardCheck, Users, UserCheck, FileText, Calendar, ChevronRight,
  Loader2, AlertCircle, Check, Clock, X, Save, RefreshCw, Download,
  User, Filter, CheckCircle2, XCircle, AlertTriangle, QrCode, Circle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tab configurations for teacher (no teachers tab)
const ATTENDANCE_TABS = [
  { id: "students", label: "Estudiantes", icon: Users, description: "Asistencia de alumnos" },
  { id: "qr-scanner", label: "Escanear QR", icon: QrCode, description: "Asistencia por código QR" },
  { id: "reports", label: "Reportes", icon: FileText, description: "Reportes de asistencia" }
];

// Status configurations
const STUDENT_STATUSES = [
  { id: "pending", label: "Pendiente", icon: Circle, color: "slate", bgColor: "bg-slate-100", textColor: "text-slate-500", borderColor: "border-slate-300" },
  { id: "present", label: "Presente", icon: CheckCircle2, color: "emerald", bgColor: "bg-emerald-100", textColor: "text-emerald-700", borderColor: "border-emerald-500" },
  { id: "late", label: "Tardanza", icon: Clock, color: "amber", bgColor: "bg-amber-100", textColor: "text-amber-700", borderColor: "border-amber-500" },
  { id: "absent", label: "Ausente", icon: XCircle, color: "red", bgColor: "bg-red-100", textColor: "text-red-700", borderColor: "border-red-500" }
];

// Local storage keys for filter persistence
const STORAGE_KEYS = {
  SECTION: "teacher_attendance_last_section",
  DATE: "teacher_attendance_last_date"
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
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
        isActive
          ? `${status.bgColor} ${status.textColor} border-2 ${status.borderColor} shadow-sm`
          : "bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{status.label}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT ATTENDANCE TAB FOR TEACHER
// ══════════════════════════════════════════════════════════════════════════════
function StudentAttendanceTab({ token, user }) {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasSavedRecords, setHasSavedRecords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [markingEntry, setMarkingEntry] = useState(null);
  const [markingExit, setMarkingExit] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load teacher's sections on mount
  useEffect(() => {
    loadSections();
    // Restore last selection from localStorage
    const lastSection = localStorage.getItem(STORAGE_KEYS.SECTION);
    const lastDate = localStorage.getItem(STORAGE_KEYS.DATE);
    if (lastSection) setSelectedSection(lastSection);
    if (lastDate) setSelectedDate(lastDate);
  }, []);

  const loadSections = async () => {
    try {
      // Get teacher's assigned courses (which include sections)
      const res = await axios.get(`${API}/teacher/courses`, { headers });
      const courses = res.data.courses || [];
      
      // Extract unique sections
      const uniqueSections = [];
      const seenIds = new Set();
      courses.forEach(course => {
        if (course.section_id && !seenIds.has(course.section_id)) {
          seenIds.add(course.section_id);
          uniqueSections.push({
            id: course.section_id,
            nombre: course.section_name,
            grade_name: course.grade_name,
            level_name: course.level_name
          });
        }
      });
      setSections(uniqueSections);
    } catch (err) {
      console.error("Error loading sections:", err);
    } finally {
      setLoadingSections(false);
    }
  };

  // Load attendance when section changes
  useEffect(() => {
    if (selectedSection && selectedDate) {
      loadAttendance();
    }
  }, [selectedSection, selectedDate]);

  const loadAttendance = async () => {
    if (!selectedSection) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    // Save selection to localStorage
    localStorage.setItem(STORAGE_KEYS.SECTION, selectedSection);
    localStorage.setItem(STORAGE_KEYS.DATE, selectedDate);
    
    try {
      // Get students from the section
      const studentsRes = await axios.get(`${API}/teacher/students?section_id=${selectedSection}`, { headers });
      const sectionStudents = studentsRes.data.students || [];
      
      // Get existing attendance for this date using teacher endpoint
      const attendanceRes = await axios.get(
        `${API}/teacher/attendance?section_id=${selectedSection}&date=${selectedDate}`, 
        { headers }
      ).catch(() => ({ data: { records: [] } }));
      
      const existingAttendance = attendanceRes.data?.records || [];
      setHasSavedRecords(existingAttendance.length > 0);
      
      // Map students with their attendance status
      const studentsWithAttendance = sectionStudents.map(student => {
        const attendance = existingAttendance.find(a => a.student_id === student.id);
        return {
          ...student,
          full_name: `${student.name} ${student.last_name}`,
          status: attendance?.status || "pending",
          original_status: attendance?.status || "pending",
          entry_time: attendance?.entry_time || null,
          exit_time: attendance?.exit_time || null,
          entry_method: attendance?.entry_method || null,
          exit_method: attendance?.exit_method || null,
          total_minutes: attendance?.total_minutes || null
        };
      });
      
      setStudents(studentsWithAttendance);
      setHasChanges(false);
    } catch (err) {
      console.error("Error loading attendance:", err);
      setError("Error al cargar la asistencia");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, status: newStatus } : s
    ));
    setHasChanges(true);
    setSuccess("");
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

  const saveAttendance = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      // Prepare attendance records - filter out pending
      const records = students
        .filter(s => s.status !== "pending")
        .map(s => ({
          student_id: s.id,
          status: s.status
        }));
      
      await axios.post(`${API}/teacher/attendance`, {
        section_id: selectedSection,
        date: selectedDate,
        records
      }, { headers });
      
      // Update original status to mark as saved
      setStudents(prev => prev.map(s => ({ ...s, original_status: s.status })));
      setHasChanges(false);
      setHasSavedRecords(true);
      setSuccess("Asistencia guardada correctamente");
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving attendance:", err);
      setError(err.response?.data?.detail || "Error al guardar la asistencia");
    } finally {
      setSaving(false);
    }
  };

  // Count summary
  const summary = {
    total: students.length,
    present: students.filter(s => s.status === "present" || s.status === "late").length,
    late: students.filter(s => s.status === "late").length,
    absent: students.filter(s => s.status === "absent").length,
    pending: students.filter(s => s.status === "pending").length,
    with_entry: students.filter(s => s.entry_time).length,
    with_exit: students.filter(s => s.exit_time).length
  };

  // Get section info
  const selectedSectionInfo = sections.find(s => s.id === selectedSection);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Section selector */}
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-slate-700">Sección:</span>
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={loadingSections}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
          >
            <option value="">Seleccionar sección</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>
                {section.level_name} - {section.grade_name} - {section.nombre}
              </option>
            ))}
          </select>
          
          {/* Date selector */}
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-slate-700">Fecha:</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          
          <button
            onClick={loadAttendance}
            disabled={loading || !selectedSection}
            className="px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Cargar
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

      {/* Student list */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  Asistencia del {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <p className="text-teal-100">
                  {selectedSectionInfo?.level_name} - {selectedSectionInfo?.grade_name} - {selectedSectionInfo?.nombre} • {summary.total} estudiantes
                </p>
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
                className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                      {student.name?.charAt(0) || "E"}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="min-w-0 w-40">
                  <p className="font-semibold text-slate-800 text-sm truncate">{student.full_name}</p>
                </div>

                {/* Entry/Exit times */}
                <div className="flex gap-3 items-center min-w-[220px]">
                  {/* Entry */}
                  <div className="flex items-center gap-1.5" data-testid={`entry-${student.id}`}>
                    {student.entry_time ? (
                      <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
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
                  {/* Exit */}
                  <div className="flex items-center gap-1.5" data-testid={`exit-${student.id}`}>
                    {student.exit_time ? (
                      <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
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
                <div className="flex gap-2 flex-wrap justify-end ml-auto">
                  {STUDENT_STATUSES.map(status => (
                    <StatusButton
                      key={status.id}
                      status={status}
                      isActive={student.status === status.id}
                      onClick={(newStatus) => handleStatusChange(student.id, newStatus)}
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
                  ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-lg"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
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
                  Guardar Asistencia
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && students.length === 0 && selectedSection && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Sin estudiantes</h3>
          <p className="text-slate-500">No hay estudiantes en esta sección o no se pudo cargar la información.</p>
        </div>
      )}

      {/* Initial state */}
      {!loading && !selectedSection && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Pasar Lista</h3>
          <p className="text-slate-500">Selecciona una sección y fecha para registrar la asistencia.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB FOR TEACHER
// ══════════════════════════════════════════════════════════════════════════════
function ReportsTab({ token, user }) {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Load sections on mount
  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      const res = await axios.get(`${API}/teacher/courses`, { headers });
      const courses = res.data.courses || [];
      
      const uniqueSections = [];
      const seenIds = new Set();
      courses.forEach(course => {
        if (course.section_id && !seenIds.has(course.section_id)) {
          seenIds.add(course.section_id);
          uniqueSections.push({
            id: course.section_id,
            nombre: course.section_name,
            grade_id: course.grade_id,
            grade_name: course.grade_name,
            level_name: course.level_name
          });
        }
      });
      setSections(uniqueSections);
    } catch (err) {
      console.error("Error loading sections:", err);
    } finally {
      setLoadingSections(false);
    }
  };

  const loadReport = async () => {
    if (!selectedSection) return;
    
    const section = sections.find(s => s.id === selectedSection);
    if (!section) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        grade_id: section.grade_id,
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

  // Get section names for display
  const selectedSectionInfo = sections.find(s => s.id === selectedSection);

  // Export to PDF function
  const exportToPDF = () => {
    if (!report) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(13, 148, 136); // Teal color
    doc.text("Reporte de Asistencia de Estudiantes", pageWidth / 2, 20, { align: "center" });
    
    // Subtitle
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const subtitle = `${selectedSectionInfo?.level_name} - ${selectedSectionInfo?.grade_name} - ${selectedSectionInfo?.nombre}`;
    const dateRange = `Período: ${new Date(startDate + 'T12:00:00').toLocaleDateString("es-PE")} - ${new Date(endDate + 'T12:00:00').toLocaleDateString("es-PE")}`;
    doc.text(subtitle, pageWidth / 2, 28, { align: "center" });
    doc.text(dateRange, pageWidth / 2, 34, { align: "center" });
    
    // Table
    const tableData = report.report.map(item => [
      item.student_name,
      item.total_days,
      item.present,
      item.late,
      item.absent,
      `${item.attendance_rate}%`
    ]);
    
    autoTable(doc, {
      startY: 45,
      head: [['Estudiante', 'Días', 'Asistencias', 'Tardanzas', 'Inasistencias', '% Asistencia']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136] },
    });
    
    doc.save(`asistencia_${selectedSectionInfo?.nombre}_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-slate-700">Sección:</span>
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={loadingSections}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
          >
            <option value="">Seleccionar sección</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>
                {section.level_name} - {section.grade_name} - {section.nombre}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-slate-700">Desde:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          
          <span className="font-semibold text-slate-700">Hasta:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          
          <button
            onClick={loadReport}
            disabled={loading || !selectedSection}
            className="px-6 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Generar Reporte
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">Reporte de Asistencia</h3>
                <p className="text-teal-100">
                  {selectedSectionInfo?.level_name} - {selectedSectionInfo?.grade_name} - {selectedSectionInfo?.nombre}
                </p>
              </div>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl flex items-center gap-2 font-medium transition-colors"
              >
                <Download className="w-5 h-5" />
                Exportar PDF
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-slate-700">{report.summary.total_students}</p>
                <p className="text-sm text-slate-500">Estudiantes</p>
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Sin datos</h3>
              <p className="text-slate-500">No hay registros de asistencia en el rango seleccionado.</p>
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!report && !loading && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Reporte de Asistencia</h3>
          <p className="text-slate-500 mb-4">Selecciona una sección y rango de fechas para generar el reporte.</p>
          <p className="text-sm text-slate-400">El reporte mostrará las asistencias, tardanzas e inasistencias de cada alumno.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function TeacherAttendancePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("students");
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const res = await axios.get(`${API}/settings/public/${currentSubdomain}`);
      setSettings(res.data);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="teacher-attendance-page">
      <TeacherSidebar 
        active="asistencia"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Page Title */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
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

          {/* Tabs */}
          <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
            {ATTENDANCE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-white shadow-lg text-teal-600 border-2 border-teal-200" 
                      : "bg-white/50 text-slate-600 hover:bg-white hover:shadow border-2 border-transparent"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-teal-100" : "bg-slate-100"}`}>
                    <Icon className={`w-6 h-6 ${isActive ? "text-teal-600" : "text-slate-500"}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{tab.label}</p>
                    <p className="text-xs opacity-60">{tab.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-5 h-5 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "students" && (
            <StudentAttendanceTab token={token} user={user} />
          )}
          
          {activeTab === "qr-scanner" && (
            <QRScannerTab token={token} schoolId={user?.school_id} />
          )}
          
          {activeTab === "reports" && (
            <ReportsTab token={token} user={user} />
          )}
        </main>
      </div>
    </div>
  );
}
