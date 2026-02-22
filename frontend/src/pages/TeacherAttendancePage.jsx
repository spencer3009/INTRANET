import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import TeacherFooter from "../components/TeacherFooter";
import {
  CalendarCheck,
  Loader2,
  Users,
  BookOpen,
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  FileText
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Attendance status options
const ATTENDANCE_STATUSES = [
  { value: "present", label: "Presente", icon: CheckCircle, color: "emerald" },
  { value: "absent", label: "Falta", icon: XCircle, color: "red" },
  { value: "late", label: "Tardanza", icon: Clock, color: "amber" },
  { value: "justified", label: "Justificado", icon: FileText, color: "blue" }
];

export default function TeacherAttendancePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState({});
  const [editedAttendance, setEditedAttendance] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [existingRecord, setExistingRecord] = useState(false);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [coursesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/courses`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      const coursesData = coursesRes.data.courses || [];
      setCourses(coursesData);
      setSettings(settingsRes.data);
      
      // Extract unique sections
      const uniqueSections = [];
      const seenIds = new Set();
      coursesData.forEach(course => {
        if (course.section_id && !seenIds.has(course.section_id)) {
          seenIds.add(course.section_id);
          uniqueSections.push({
            id: course.section_id,
            name: course.section_name,
            grade_name: course.grade_name
          });
        }
      });
      setSections(uniqueSections);
    } catch (err) {
      console.error("Error loading sections:", err);
      setCourses([]);
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const loadSectionData = async (section, date = selectedDate) => {
    setSelectedSection(section);
    setLoading(true);
    try {
      // Load students for this section
      const studentsRes = await axios.get(`${API}/api/teacher/students?section_id=${section.id}`, { headers });
      setStudents(studentsRes.data.students || []);
      
      // Load existing attendance for this date
      const attendanceRes = await axios.get(
        `${API}/api/teacher/attendance?section_id=${section.id}&date=${date}`, 
        { headers }
      );
      
      // Build attendance map
      const attendanceMap = {};
      const records = attendanceRes.data.records || [];
      records.forEach(r => {
        attendanceMap[r.student_id] = r.status;
      });
      setAttendance(attendanceMap);
      setEditedAttendance({});
      setExistingRecord(records.length > 0);
    } catch (err) {
      console.error("Error loading section data:", err);
      setStudents([]);
      setAttendance({});
      setExistingRecord(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    if (selectedSection) {
      loadSectionData(selectedSection, newDate);
    }
  };

  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    handleDateChange(current.toISOString().split("T")[0]);
  };

  const handleStatusChange = (studentId, status) => {
    setEditedAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const getDisplayStatus = (studentId) => {
    if (editedAttendance.hasOwnProperty(studentId)) {
      return editedAttendance[studentId];
    }
    return attendance[studentId] || null;
  };

  const hasChanges = () => {
    return Object.keys(editedAttendance).length > 0;
  };

  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach(student => {
      if (!getDisplayStatus(student.id)) {
        newAttendance[student.id] = "present";
      }
    });
    setEditedAttendance(prev => ({ ...prev, ...newAttendance }));
  };

  const saveAttendance = async () => {
    if (!hasChanges()) return;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      // Prepare attendance records to save
      const recordsToSave = Object.entries(editedAttendance).map(([studentId, status]) => ({
        student_id: studentId,
        status: status
      }));
      
      await axios.post(`${API}/api/teacher/attendance`, {
        section_id: selectedSection.id,
        date: selectedDate,
        records: recordsToSave
      }, { headers });
      
      // Update local state
      const newAttendance = { ...attendance };
      recordsToSave.forEach(r => {
        newAttendance[r.student_id] = r.status;
      });
      setAttendance(newAttendance);
      setEditedAttendance({});
      setExistingRecord(true);
      
      setSaveMessage({ type: "success", text: "Asistencia guardada correctamente" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving attendance:", err);
      setSaveMessage({ type: "error", text: "Error al guardar la asistencia" });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  if (loading && !selectedSection) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-attendance-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="asistencia"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Asistencia</h1>
                <p className="text-sm text-slate-500">
                  {selectedSection 
                    ? `${selectedSection.name} - ${formatDate(selectedDate)}`
                    : "Selecciona una sección para pasar lista"
                  }
                </p>
              </div>
            </div>
            
            {selectedSection && (
              <div className="flex items-center gap-2">
                {!existingRecord && students.length > 0 && (
                  <button
                    onClick={markAllPresent}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar todos presentes
                  </button>
                )}
                
                {hasChanges() && (
                  <button
                    onClick={saveAttendance}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    data-testid="save-attendance-btn"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    <span className="hidden sm:inline">Guardar</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Save message */}
          {saveMessage && (
            <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
              saveMessage.type === "success" 
                ? "bg-emerald-50 text-emerald-700" 
                : "bg-red-50 text-red-700"
            }`}>
              {saveMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {saveMessage.text}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {!selectedSection ? (
            /* Section Selection */
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Selecciona una sección</h2>
              
              {sections.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => loadSectionData(section)}
                      className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all group"
                      data-testid={`attendance-section-${section.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                          <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {section.name}
                          </h3>
                          {section.grade_name && (
                            <p className="text-sm text-slate-500">{section.grade_name}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin secciones asignadas</h3>
                  <p className="text-slate-500">Contacta a coordinación para asignaciones.</p>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            /* Attendance List */
            <div className="space-y-4">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedSection(null);
                    setStudents([]);
                    setAttendance({});
                    setEditedAttendance({});
                  }}
                  className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  <span>Volver a secciones</span>
                </button>
                
                {/* Date Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeDate(-1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    data-testid="attendance-date-input"
                  />
                  
                  <button
                    onClick={() => changeDate(1)}
                    disabled={selectedDate >= new Date().toISOString().split("T")[0]}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Existing record indicator */}
              {existingRecord && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle className="w-4 h-4" />
                  Ya existe un registro de asistencia para esta fecha. Puedes editarlo.
                </div>
              )}
              
              {students.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {students.map((student) => {
                      const currentStatus = getDisplayStatus(student.id);
                      const isModified = editedAttendance.hasOwnProperty(student.id);
                      
                      return (
                        <div 
                          key={student.id}
                          className={`px-5 py-4 ${isModified ? "bg-amber-50/50" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Student info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {student.photo_url ? (
                                <img 
                                  src={student.photo_url} 
                                  alt="" 
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-slate-500" />
                                </div>
                              )}
                              <span className="font-medium text-slate-800 truncate">
                                {student.name} {student.last_name}
                              </span>
                            </div>
                            
                            {/* Status buttons */}
                            <div className="flex items-center gap-1">
                              {ATTENDANCE_STATUSES.map((status) => {
                                const Icon = status.icon;
                                const isSelected = currentStatus === status.value;
                                
                                return (
                                  <button
                                    key={status.value}
                                    onClick={() => handleStatusChange(student.id, status.value)}
                                    className={`p-2 rounded-lg transition-all ${
                                      isSelected
                                        ? `bg-${status.color}-100 text-${status.color}-600`
                                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                    }`}
                                    title={status.label}
                                    data-testid={`attendance-${student.id}-${status.value}`}
                                  >
                                    <Icon className="w-5 h-5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin estudiantes</h3>
                  <p className="text-slate-500">No hay estudiantes en esta sección.</p>
                </div>
              )}
              
              {/* Summary */}
              {students.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-medium text-slate-700 mb-3">Resumen</h4>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    {ATTENDANCE_STATUSES.map((status) => {
                      const count = students.filter(s => getDisplayStatus(s.id) === status.value).length;
                      return (
                        <div key={status.value}>
                          <p className={`text-2xl font-bold text-${status.color}-600`}>{count}</p>
                          <p className="text-xs text-slate-500">{status.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
