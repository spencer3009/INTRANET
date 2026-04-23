import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import MessageCenter from "../components/MessageCenter";
import StudentHeader from "../components/StudentHeader";
import {
  Users,
  Search,
  Filter,
  Loader2,
  User,
  Mail,
  MapPin,
  Calendar,
  X,
  BookOpen,
  CalendarCheck,
  BarChart3,
  GraduationCap,
  MoreVertical,
  CheckCircle,
  Eye
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
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroGrado, setFiltroGrado] = useState("todos");
  const [filtroSeccion, setFiltroSeccion] = useState("todos");
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

  // Cascade filter options — derived ONLY from teacher's own students
  const nivelSeleccionado = filtroNivel !== "";

  const nivelesDisponibles = useMemo(() =>
    [...new Set(students.map(s => s.level_name).filter(Boolean))].sort()
  , [students]);

  const gradosDisponibles = useMemo(() => {
    if (!nivelSeleccionado) return [];
    return [...new Set(students.filter(s => s.level_name === filtroNivel).map(s => s.grade_name).filter(Boolean))].sort();
  }, [students, filtroNivel, nivelSeleccionado]);

  const seccionesDisponibles = useMemo(() => {
    if (!nivelSeleccionado || filtroGrado === "todos") return [];
    return [...new Set(students.filter(s => s.level_name === filtroNivel && s.grade_name === filtroGrado).map(s => s.section_name).filter(Boolean))].sort();
  }, [students, filtroNivel, filtroGrado, nivelSeleccionado]);

  const filteredStudents = useMemo(() => {
    if (!nivelSeleccionado) return [];
    return students.filter(s => {
      if (s.level_name !== filtroNivel) return false;
      if (filtroGrado !== "todos" && s.grade_name !== filtroGrado) return false;
      if (filtroSeccion !== "todos" && s.section_name !== filtroSeccion) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fullName = `${s.name || ""} ${s.last_name || ""}`.toLowerCase();
        if (!fullName.includes(q) && !s.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [students, filtroNivel, filtroGrado, filtroSeccion, searchTerm, nivelSeleccionado]);

  const handleNivelChange = (val) => { setFiltroNivel(val); setFiltroGrado("todos"); setFiltroSeccion("todos"); };
  const handleGradoChange = (val) => { setFiltroGrado(val); setFiltroSeccion("todos"); };
  const handleLimpiarFiltros = () => { setFiltroNivel(""); setFiltroGrado("todos"); setFiltroSeccion("todos"); };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando alumnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 flex" data-testid="teacher-students-page">
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

      {/* Main Content */}
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

        {/* Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Hero Banner */}
          <div 
            className="relative rounded-3xl overflow-hidden shadow-xl mb-6"
            style={{ 
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)'
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
            
            {/* Content */}
            <div className="relative z-10 p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-5">
                {/* Icon */}
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                
                {/* Title */}
                <div>
                  <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                    Estudiantes
                  </h1>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-violet-400 text-white text-sm font-semibold rounded-full shadow-lg">
                      {students.length} estudiantes
                    </span>
                    <span className="text-white/80 text-sm flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Gestión de personal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm" data-testid="teacher-students-filter-bar">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                data-testid="student-search-input"
              />
            </div>
            {/* Cascade filters */}
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel <span className="text-red-400">*</span></label>
                <select value={filtroNivel} onChange={(e) => handleNivelChange(e.target.value)} data-testid="filter-nivel"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="">Selecciona un nivel</option>
                  {nivelesDisponibles.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
                <select value={filtroGrado} onChange={(e) => handleGradoChange(e.target.value)} disabled={!nivelSeleccionado} data-testid="filter-grado"
                  title={!nivelSeleccionado ? "Selecciona un nivel primero" : ""}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="todos">Todos los grados</option>
                  {gradosDisponibles.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sección</label>
                <select value={filtroSeccion} onChange={(e) => setFiltroSeccion(e.target.value)} disabled={!nivelSeleccionado || filtroGrado === "todos"} data-testid="filter-seccion"
                  title={filtroGrado === "todos" ? "Selecciona un grado primero" : ""}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="todos">Todas las secciones</option>
                  {seccionesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {nivelSeleccionado && (
                <button onClick={handleLimpiarFiltros} className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap" data-testid="filter-limpiar">
                  <X className="w-4 h-4" /> Limpiar
                </button>
              )}
            </div>
            {/* Counter */}
            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              Mostrando <span className="font-semibold text-slate-700">{filteredStudents.length}</span> de {students.length} estudiantes
            </p>
          </div>

          {/* Students Grid or Empty State */}
          {!nivelSeleccionado ? (
            <div className="text-center py-16" data-testid="empty-state-select-nivel">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/10">
                <Filter className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Selecciona un nivel para ver tus alumnos</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">Usa los filtros de arriba para elegir el nivel educativo y acceder a la lista de estudiantes.</p>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl border-t-4 border-t-indigo-500 border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
                  data-testid={`student-card-${student.id}`}
                >
                  {/* Card Header with Menu */}
                  <div className="p-5 relative">
                    {/* Menu Button */}
                    <button 
                      onClick={() => handleStudentClick(student)}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {/* Student Photo */}
                    <div className="flex flex-col items-center mb-4">
                      <div className="relative">
                        {student.photo_url ? (
                          <img 
                            src={student.photo_url} 
                            alt="" 
                            className="w-24 h-24 rounded-2xl object-cover ring-4 ring-indigo-100 shadow-lg"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center ring-4 ring-indigo-50 shadow-lg">
                            <User className="w-12 h-12 text-indigo-400" />
                          </div>
                        )}
                        {/* Verified Badge */}
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Student Name */}
                    <h3 className="text-xl font-bold text-slate-800 text-center mb-1">
                      {student.name} {student.last_name}
                    </h3>
                    
                    {/* Email */}
                    <p className="text-sm text-slate-500 text-center mb-4">
                      {student.email || "Sin correo"}
                    </p>
                    
                    {/* Role Badge */}
                    <div className="flex justify-center mb-4">
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold rounded-full shadow-md">
                        <span className="w-2 h-2 bg-white rounded-full" />
                        Estudiante
                      </span>
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-slate-100" />
                  
                  {/* Card Footer */}
                  <div className="p-5 bg-gradient-to-b from-slate-50 to-white">
                    <div className="flex items-start justify-between">
                      {/* Info */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                          <span>{student.level_name || "N/A"} - {student.grade_name || "N/A"} - {student.section_name || "N/A"}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span>Registrado: {formatDate(student.created_at)}</span>
                        </div>
                      </div>
                      
                      {/* QR Code */}
                      <div className="flex flex-col items-center">
                        <div className="p-2 bg-white rounded-xl shadow-md border border-slate-200">
                          <QRCodeSVG 
                            value={student.qr_code || student.id || "N/A"}
                            size={60}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 font-medium">QR</span>
                      </div>
                    </div>
                    
                    {/* View Profile Button */}
                    <button
                      onClick={() => handleStudentClick(student)}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Perfil Completo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm" data-testid="empty-state-no-results">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No hay alumnos que coincidan</h3>
              <p className="text-slate-500 mb-4">No se encontraron alumnos con los filtros seleccionados.</p>
              <button onClick={handleLimpiarFiltros} className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-medium">Limpiar filtros</button>
            </div>
          )}
        </main>
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div 
              className="px-6 py-5 flex items-center justify-between"
              style={{ 
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
              }}
            >
              <h3 className="text-xl font-bold text-white">Perfil Académico</h3>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentDetail(null);
                }}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                data-testid="close-student-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {loadingDetail ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                  <p className="text-slate-500">Cargando información...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Student Info */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {selectedStudent.photo_url ? (
                        <img 
                          src={selectedStudent.photo_url} 
                          alt="" 
                          className="w-20 h-20 rounded-2xl object-cover ring-4 ring-indigo-100 shadow-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center ring-4 ring-indigo-50">
                          <User className="w-10 h-10 text-indigo-400" />
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-slate-800">
                        {selectedStudent.name} {selectedStudent.last_name}
                      </h4>
                      <p className="text-indigo-600 font-medium">{selectedStudent.section_name}</p>
                      {selectedStudent.email && (
                        <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                          <Mail className="w-3.5 h-3.5" />
                          {selectedStudent.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-200">
                      <QRCodeSVG 
                        value={selectedStudent.qr_code || selectedStudent.id || "N/A"}
                        size={120}
                        level="M"
                        includeMargin={false}
                      />
                      <p className="text-center text-xs text-slate-400 mt-2 font-medium">Código QR del estudiante</p>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center">
                      <CalendarCheck className="w-7 h-7 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">
                        {studentDetail?.attendance_summary?.present || 0}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Asistencias</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-4 text-center">
                      <BarChart3 className="w-7 h-7 text-indigo-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-indigo-700">
                        {studentDetail?.grades_summary?.average?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-indigo-600 font-medium">Promedio</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 text-center">
                      <BookOpen className="w-7 h-7 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-700">
                        {studentDetail?.pending_tasks || 0}
                      </p>
                      <p className="text-xs text-purple-600 font-medium">Pendientes</p>
                    </div>
                  </div>

                  {/* Attendance Details */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5">
                    <h5 className="font-semibold text-slate-700 mb-4">Resumen de Asistencia</h5>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xl font-bold text-emerald-600">
                          {studentDetail?.attendance_summary?.present || 0}
                        </p>
                        <p className="text-xs text-slate-500">Presente</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xl font-bold text-red-600">
                          {studentDetail?.attendance_summary?.absent || 0}
                        </p>
                        <p className="text-xs text-slate-500">Faltas</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xl font-bold text-amber-600">
                          {studentDetail?.attendance_summary?.late || 0}
                        </p>
                        <p className="text-xs text-slate-500">Tardanzas</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xl font-bold text-blue-600">
                          {studentDetail?.attendance_summary?.justified || 0}
                        </p>
                        <p className="text-xs text-slate-500">Justific.</p>
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
      <MobileBottomNav role="teacher" />
    </div>
  );
}
