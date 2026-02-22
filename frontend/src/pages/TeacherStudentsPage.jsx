import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import TeacherFooter from "../components/TeacherFooter";
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  Loader2,
  User,
  Mail,
  Eye,
  X,
  BookOpen,
  CalendarCheck,
  BarChart3
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function TeacherStudentsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentSubdomain = subdomain || user?.subdomain || 'elroble';
      const [studentsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/teacher/students`, { headers }),
        axios.get(`${API}/api/settings/public/${currentSubdomain}`).catch(() => ({ data: null }))
      ]);
      setStudents(studentsRes.data.students || []);
      setSections(studentsRes.data.sections || []);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error loading students:", err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Mi Colegio";

  const loadStudentDetail = async (studentId) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/api/teacher/students/${studentId}`, { headers });
      setStudentDetail(res.data);
    } catch (err) {
      console.error("Error loading student detail:", err);
      // Set basic data if detail endpoint fails
      const student = students.find(s => s.id === studentId);
      setStudentDetail({
        user: student,
        attendance_summary: { present: 0, absent: 0, late: 0 },
        grades_summary: { average: null, subjects_count: 0 },
        pending_tasks: 0
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    loadStudentDetail(student.id);
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const fullName = `${student.name || ""} ${student.last_name || ""}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = !filterSection || student.section_id === filterSection;
    return matchesSearch && matchesSection;
  });

  // Group students by section
  const studentsBySection = filteredStudents.reduce((acc, student) => {
    const sectionName = student.section_name || "Sin sección";
    if (!acc[sectionName]) {
      acc[sectionName] = [];
    }
    acc[sectionName].push(student);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando alumnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-students-page">
      {/* Teacher Sidebar */}
      <TeacherSidebar
        active="alumnos"
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
                <h1 className="text-xl font-bold text-slate-800">Mis Alumnos</h1>
                <p className="text-sm text-slate-500">{students.length} alumnos en tus secciones</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  data-testid="student-search-input"
                />
              </div>
              
              {sections.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white appearance-none cursor-pointer"
                    data-testid="student-filter-section"
                  >
                    <option value="">Todas las secciones</option>
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>{section.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Students by Section */}
          {Object.keys(studentsBySection).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(studentsBySection).map(([sectionName, sectionStudents]) => (
                <div key={sectionName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      {sectionName}
                      <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                        {sectionStudents.length} alumnos
                      </span>
                    </h2>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {sectionStudents.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => handleStudentClick(student)}
                        className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4"
                        data-testid={`student-row-${student.id}`}
                      >
                        {student.photo_url ? (
                          <img 
                            src={student.photo_url} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800">
                            {student.name} {student.last_name}
                          </p>
                          {student.email && (
                            <p className="text-sm text-slate-500 truncate">{student.email}</p>
                          )}
                        </div>
                        
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStudentClick(student);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">Ver perfil</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {searchTerm || filterSection ? "Sin resultados" : "Sin alumnos asignados"}
              </h3>
              <p className="text-slate-500">
                {searchTerm || filterSection 
                  ? "No se encontraron alumnos con los filtros aplicados" 
                  : "No tienes secciones asignadas con alumnos. Contacta a coordinación."
                }
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600">
              <h3 className="text-lg font-semibold text-white">Perfil Académico</h3>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentDetail(null);
                }}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                data-testid="close-student-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {loadingDetail ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                  <p className="text-slate-500">Cargando información...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Student Info */}
                  <div className="flex items-center gap-4">
                    {selectedStudent.photo_url ? (
                      <img 
                        src={selectedStudent.photo_url} 
                        alt="" 
                        className="w-16 h-16 rounded-full object-cover ring-4 ring-emerald-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center ring-4 ring-emerald-50">
                        <User className="w-8 h-8 text-emerald-500" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-lg font-semibold text-slate-800">
                        {selectedStudent.name} {selectedStudent.last_name}
                      </h4>
                      <p className="text-slate-500">{selectedStudent.section_name}</p>
                      {selectedStudent.email && (
                        <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                          <Mail className="w-3.5 h-3.5" />
                          {selectedStudent.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <CalendarCheck className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">
                        {studentDetail?.attendance_summary?.present || 0}
                      </p>
                      <p className="text-xs text-blue-600">Asistencias</p>
                    </div>
                    
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <BarChart3 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-amber-700">
                        {studentDetail?.grades_summary?.average?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-amber-600">Promedio</p>
                    </div>
                    
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <BookOpen className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-700">
                        {studentDetail?.pending_tasks || 0}
                      </p>
                      <p className="text-xs text-purple-600">Pendientes</p>
                    </div>
                  </div>

                  {/* Attendance Details */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h5 className="font-medium text-slate-700 mb-3">Resumen de Asistencia</h5>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="font-semibold text-emerald-600">
                          {studentDetail?.attendance_summary?.present || 0}
                        </p>
                        <p className="text-slate-500">Presente</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-600">
                          {studentDetail?.attendance_summary?.absent || 0}
                        </p>
                        <p className="text-slate-500">Faltas</p>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-600">
                          {studentDetail?.attendance_summary?.late || 0}
                        </p>
                        <p className="text-slate-500">Tardanzas</p>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-600">
                          {studentDetail?.attendance_summary?.justified || 0}
                        </p>
                        <p className="text-slate-500">Justific.</p>
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  <p className="text-xs text-slate-400 text-center">
                    Vista de solo lectura. Para editar información del alumno, contacta a administración.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
