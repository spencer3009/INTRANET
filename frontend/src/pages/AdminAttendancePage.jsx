import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  CalendarCheck, Users, TrendingUp, AlertTriangle, Filter, Search,
  Pencil, Check, X, Loader2, ArrowLeft, Clock, UserX, UserCheck,
  Calendar, ChevronDown
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Summary Card Component
function SummaryCard({ icon: Icon, label, value, color, percentage }) {
  const colorClasses = {
    emerald: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600"
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
        {percentage !== undefined && (
          <span className={`text-sm font-medium ${colorClasses[color].replace('bg-', 'text-').replace('-100', '-600')}`}>
            {percentage}%
          </span>
        )}
      </div>
    </div>
  );
}

// Status Badge
function StatusBadge({ status }) {
  const styles = {
    present: "bg-emerald-100 text-emerald-700",
    absent: "bg-red-100 text-red-700",
    late: "bg-amber-100 text-amber-700",
    justified: "bg-blue-100 text-blue-700"
  };
  const labels = {
    present: "Presente",
    absent: "Ausente",
    late: "Tardanza",
    justified: "Justificado"
  };
  
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}

// Edit Attendance Modal
function EditAttendanceModal({ isOpen, onClose, record, onSave, loading }) {
  const [newStatus, setNewStatus] = useState(record?.status || "present");
  const [motivo, setMotivo] = useState("");
  
  useEffect(() => {
    if (record) {
      setNewStatus(record.status || "present");
      setMotivo("");
    }
  }, [record]);
  
  if (!isOpen || !record) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Corregir Asistencia</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">Estudiante</p>
            <p className="font-medium text-slate-800">{record.student_name}</p>
            <p className="text-sm text-slate-500 mt-2">Fecha</p>
            <p className="font-medium text-slate-800">{record.date}</p>
            <p className="text-sm text-slate-500 mt-2">Estado actual</p>
            <StatusBadge status={record.status} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo Estado *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "present", label: "Presente", icon: UserCheck, color: "emerald" },
                { value: "absent", label: "Ausente", icon: UserX, color: "red" },
                { value: "late", label: "Tardanza", icon: Clock, color: "amber" },
                { value: "justified", label: "Justificado", icon: Check, color: "blue" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNewStatus(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-colors ${
                    newStatus === opt.value 
                      ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
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
              placeholder="Ej: El padre presentó certificado médico..."
            />
          </div>
          
          {record.last_admin_edit && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700">
                Última corrección: {record.last_admin_edit.admin_name} - {new Date(record.last_admin_edit.timestamp).toLocaleDateString()}
              </p>
              <p className="text-xs text-amber-600 mt-1">Motivo: {record.last_admin_edit.motivo}</p>
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
            onClick={() => onSave(record.id, newStatus, motivo)}
            disabled={loading || motivo.length < 5 || newStatus === record.status}
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

export default function AdminAttendancePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [sections, setSections] = useState([]);
  
  // Filters
  const [filterSection, setFilterSection] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState("summary");
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    if (viewMode === "summary") {
      loadSummary();
    }
  }, [dateFrom, dateTo, viewMode]);
  
  useEffect(() => {
    if (viewMode === "detail") {
      loadRecords();
    }
  }, [filterSection, filterStatus, dateFrom, dateTo, viewMode]);

  const loadInitialData = async () => {
    try {
      const [settingsRes, sectionsRes, summaryRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/admin/attendance/summary?date_from=${dateFrom}&date_to=${dateTo}`, { headers })
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      setSections(sectionsRes.data || []);
      setSummary(summaryRes.data?.summary || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API}/admin/attendance/summary?date_from=${dateFrom}&date_to=${dateTo}`, { headers });
      setSummary(res.data?.summary || []);
    } catch (err) {
      console.error("Error loading summary:", err);
    }
  };
  
  const loadRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSection) params.append("section_id", filterSection);
      if (filterStatus) params.append("status", filterStatus);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      
      const res = await axios.get(`${API}/admin/attendance?${params}`, { headers });
      setRecords(res.data?.records || []);
    } catch (err) {
      console.error("Error loading records:", err);
    }
  };
  
  const handleSaveAttendance = async (recordId, newStatus, motivo) => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/attendance/${recordId}`, { status: newStatus, motivo }, { headers });
      loadRecords();
      loadSummary();
      setShowEditModal(false);
      setEditingRecord(null);
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
  
  // Filter records by search
  const filteredRecords = records.filter(r => 
    r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.section_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Calculate totals from summary
  const totalPresent = summary.reduce((acc, s) => acc + s.present, 0);
  const totalAbsent = summary.reduce((acc, s) => acc + s.absent, 0);
  const totalLate = summary.reduce((acc, s) => acc + s.late, 0);
  const totalJustified = summary.reduce((acc, s) => acc + s.justified, 0);
  const totalRecords = summary.reduce((acc, s) => acc + s.total, 0);
  const avgAttendance = summary.length > 0 
    ? summary.reduce((acc, s) => acc + s.attendance_rate, 0) / summary.length 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-attendance-page">
      <AdminSidebar
        active="asistencia"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

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
                <h1 className="text-2xl font-bold text-slate-800">Gestión de Asistencia</h1>
                <p className="text-sm text-slate-500">Control y corrección administrativa de asistencias</p>
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
                Registros
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Período:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <span className="text-slate-400">a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard icon={UserCheck} label="Presentes" value={totalPresent} color="emerald" />
            <SummaryCard icon={UserX} label="Ausentes" value={totalAbsent} color="red" />
            <SummaryCard icon={Clock} label="Tardanzas" value={totalLate} color="amber" />
            <SummaryCard icon={Check} label="Justificados" value={totalJustified} color="blue" />
            <SummaryCard 
              icon={TrendingUp} 
              label="% Asistencia" 
              value={avgAttendance.toFixed(1)} 
              color="purple" 
              percentage={avgAttendance.toFixed(0)}
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
                      <th className="text-center px-4 py-3 text-xs font-semibold text-emerald-600 uppercase">Presentes</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-red-600 uppercase">Ausentes</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 uppercase">Tardanzas</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600 uppercase">Justif.</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">% Asist.</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-slate-500">No hay datos disponibles</td>
                      </tr>
                    ) : (
                      summary.map((item) => (
                        <tr key={item.section_id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-600">{item.level_name || "-"}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.grade_name || "-"}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.section_name}</td>
                          <td className="px-4 py-4 text-sm text-center text-emerald-600 font-medium">{item.present}</td>
                          <td className="px-4 py-4 text-sm text-center text-red-600 font-medium">{item.absent}</td>
                          <td className="px-4 py-4 text-sm text-center text-amber-600 font-medium">{item.late}</td>
                          <td className="px-4 py-4 text-sm text-center text-blue-600 font-medium">{item.justified}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-sm font-medium ${
                              item.attendance_rate >= 90 ? "bg-emerald-100 text-emerald-700" :
                              item.attendance_rate >= 75 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {item.attendance_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setFilterSection(item.section_id);
                                setViewMode("detail");
                              }}
                              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                            >
                              Ver registros
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Sección</label>
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">Todas las secciones</option>
                      {sections.filter(s => s.activo).map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
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
                      <option value="present">Presente</option>
                      <option value="absent">Ausente</option>
                      <option value="late">Tardanza</option>
                      <option value="justified">Justificado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar estudiante..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Records Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-800">
                    Registros ({filteredRecords.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estudiante</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sección</th>
                        <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                        <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500">
                            No hay registros para mostrar
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.slice(0, 100).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-sm text-slate-600">{r.date}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {r.student_photo ? (
                                  <img src={r.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <span className="font-medium text-slate-800">{r.student_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{r.section_name}</td>
                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={r.status} />
                              {r.last_admin_edit && (
                                <span className="ml-2 text-xs text-amber-600" title="Corregido por administración">⚠️</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => { setEditingRecord(r); setShowEditModal(true); }}
                                className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Corregir asistencia"
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
                {filteredRecords.length > 100 && (
                  <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                    Mostrando 100 de {filteredRecords.length} registros. Use los filtros para reducir resultados.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      
      <EditAttendanceModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingRecord(null); }}
        record={editingRecord}
        onSave={handleSaveAttendance}
        loading={saving}
      />
    </div>
  );
}
