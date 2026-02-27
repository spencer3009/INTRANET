import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  FileQuestion, Users, CheckCircle, Clock, AlertCircle, Filter, Search,
  Pencil, Loader2, ArrowLeft, Calendar, BookOpen, Send, Archive, Eye,
  X, Check
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Summary Card Component
function SummaryCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    purple: "bg-purple-100 text-purple-600",
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
    slate: "bg-slate-100 text-slate-600"
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
        </div>
      </div>
    </div>
  );
}

// Status Badge
function ExamStatusBadge({ status }) {
  const styles = {
    draft: "bg-slate-100 text-slate-600",
    published: "bg-emerald-100 text-emerald-700",
    scheduled: "bg-blue-100 text-blue-700",
    closed: "bg-amber-100 text-amber-700",
    archived: "bg-red-100 text-red-700"
  };
  const labels = {
    draft: "Borrador",
    published: "Publicado",
    scheduled: "Programado",
    closed: "Cerrado",
    archived: "Archivado"
  };
  
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}

// Edit Exam Modal
function EditExamModal({ isOpen, onClose, exam, onSave, loading }) {
  const [status, setStatus] = useState(exam?.status || "draft");
  const [scheduledDate, setScheduledDate] = useState(exam?.scheduled_date || "");
  const [scheduledTime, setScheduledTime] = useState(exam?.scheduled_time || "");
  
  useEffect(() => {
    if (exam) {
      setStatus(exam.status || "draft");
      setScheduledDate(exam.scheduled_date || "");
      setScheduledTime(exam.scheduled_time || "");
    }
  }, [exam]);
  
  if (!isOpen || !exam) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Editar Examen</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">Examen</p>
            <p className="font-medium text-slate-800">{exam.title}</p>
            <p className="text-sm text-slate-500 mt-2">Asignatura</p>
            <p className="font-medium text-slate-800">{exam.subject_name}</p>
            <p className="text-sm text-slate-500 mt-2">Profesor</p>
            <p className="font-medium text-slate-800">{exam.teacher_name}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="scheduled">Programado</option>
              <option value="closed">Cerrado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          
          {status === "scheduled" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
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
            onClick={() => onSave(exam.id, { status, scheduled_date: scheduledDate, scheduled_time: scheduledTime })}
            disabled={loading}
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

export default function AdminExamsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [exams, setExams] = useState([]);
  const [summary, setSummary] = useState({});
  const [subjects, setSubjects] = useState([]);
  
  // Filters
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal
  const [editingExam, setEditingExam] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    loadExams();
  }, [filterSubject, filterStatus]);

  const loadInitialData = async () => {
    try {
      const [settingsRes, subjectsRes, summaryRes, examsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/academic/subjects`, { headers }),
        axios.get(`${API}/admin/exams/summary`, { headers }),
        axios.get(`${API}/admin/exams`, { headers })
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      setSubjects(subjectsRes.data || []);
      setSummary(summaryRes.data || {});
      setExams(examsRes.data?.exams || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadExams = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.append("subject_id", filterSubject);
      if (filterStatus) params.append("status", filterStatus);
      
      const res = await axios.get(`${API}/admin/exams?${params}`, { headers });
      setExams(res.data?.exams || []);
    } catch (err) {
      console.error("Error loading exams:", err);
    }
  };
  
  const handleSaveExam = async (examId, data) => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/exams/${examId}`, data, { headers });
      loadExams();
      // Reload summary
      const summaryRes = await axios.get(`${API}/admin/exams/summary`, { headers });
      setSummary(summaryRes.data || {});
      setShowEditModal(false);
      setEditingExam(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };
  
  // Filter exams by search
  const filteredExams = exams.filter(e => 
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-exams-page">
      <AdminSidebar
        active="examenes"
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
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigateTo('/admin')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestión de Exámenes</h1>
              <p className="text-sm text-slate-500">Vista general y edición de estado de exámenes</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <SummaryCard icon={FileQuestion} label="Total" value={summary.total || 0} color="purple" />
            <SummaryCard icon={CheckCircle} label="Borradores" value={summary.draft || 0} color="slate" />
            <SummaryCard icon={Send} label="Publicados" value={summary.published || 0} color="emerald" />
            <SummaryCard icon={Calendar} label="Programados" value={summary.scheduled || 0} color="blue" />
            <SummaryCard icon={Clock} label="Cerrados" value={summary.closed || 0} color="amber" />
            <SummaryCard icon={Archive} label="Archivados" value={summary.archived || 0} color="red" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-700">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm text-slate-600 mb-1">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Todos los estados</option>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="scheduled">Programado</option>
                  <option value="closed">Cerrado</option>
                  <option value="archived">Archivado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar examen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Exams Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Exámenes ({filteredExams.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Examen</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Asignatura</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Profesor</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Preguntas</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Duración</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha prog.</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No hay exámenes para mostrar
                      </td>
                    </tr>
                  ) : (
                    filteredExams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                              <FileQuestion className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 line-clamp-1">{exam.title}</p>
                              <p className="text-xs text-slate-400">{formatDate(exam.created_at)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{exam.subject_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{exam.teacher_name}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {exam.questions_count || exam.questions?.length || 0}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {exam.time_limit ? `${exam.time_limit} min` : "-"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ExamStatusBadge status={exam.status} />
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {exam.scheduled_date ? (
                            <div>
                              <p>{formatDate(exam.scheduled_date)}</p>
                              {exam.scheduled_time && <p className="text-xs text-slate-400">{exam.scheduled_time}</p>}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => { setEditingExam(exam); setShowEditModal(true); }}
                            className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Editar estado/fecha"
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
        </div>
      </main>
      
      <EditExamModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingExam(null); }}
        exam={editingExam}
        onSave={handleSaveExam}
        loading={saving}
      />
    </div>
  );
}
