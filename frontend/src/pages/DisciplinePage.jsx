import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { 
  AlertTriangle, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  Eye, Filter, Clock, FileText, Download, ChevronRight, User,
  CheckCircle2, XCircle, AlertOctagon, FileImage, File
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Priority configuration
const PRIORITIES = {
  low: { label: "Baja", color: "#22C55E", bgClass: "bg-green-100", textClass: "text-green-700" },
  medium: { label: "Media", color: "#EAB308", bgClass: "bg-yellow-100", textClass: "text-yellow-700" },
  high: { label: "Alta", color: "#F97316", bgClass: "bg-orange-100", textClass: "text-orange-700" },
  critical: { label: "Crítica", color: "#EF4444", bgClass: "bg-red-100", textClass: "text-red-700" }
};

// Status configuration
const STATUSES = {
  open: { label: "Abierto", color: "#3B82F6", bgClass: "bg-blue-100", textClass: "text-blue-700" },
  in_review: { label: "En revisión", color: "#8B5CF6", bgClass: "bg-purple-100", textClass: "text-purple-700" },
  resolved: { label: "Resuelto", color: "#22C55E", bgClass: "bg-green-100", textClass: "text-green-700" },
  archived: { label: "Archivado", color: "#64748B", bgClass: "bg-slate-100", textClass: "text-slate-700" }
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ══════════════════════════════════════════════════════════════════════════════
function DisciplineSkeleton() {
  return (
    <div className="space-y-4" data-testid="discipline-skeleton">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-3 h-12 bg-slate-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
            <div className="h-6 bg-slate-200 rounded-full w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState({ onCreateNew, canCreate }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center" data-testid="discipline-empty">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">No hay reportes disciplinarios</h3>
      <p className="text-slate-500 mb-6 max-w-md mx-auto">
        {canCreate 
          ? "Aún no se han registrado incidencias. Crea un reporte cuando sea necesario."
          : "No hay reportes disponibles para ti en este momento."
        }
      </p>
      {canCreate && (
        <button
          onClick={onCreateNew}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition-all flex items-center gap-2 mx-auto"
          data-testid="create-first-report-btn"
        >
          <Plus className="w-5 h-5" />
          Crear reporte
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS CARDS
// ══════════════════════════════════════════════════════════════════════════════
function StatsCards({ stats }) {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
        <div className="text-2xl font-bold text-blue-600">{stats.by_status?.open || 0}</div>
        <div className="text-sm text-slate-500">Abiertos</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
        <div className="text-2xl font-bold text-purple-600">{stats.by_status?.in_review || 0}</div>
        <div className="text-sm text-slate-500">En revisión</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
        <div className="text-2xl font-bold text-green-600">{stats.by_status?.resolved || 0}</div>
        <div className="text-sm text-slate-500">Resueltos</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
        <div className="text-2xl font-bold text-red-600">{stats.by_priority?.critical || 0}</div>
        <div className="text-sm text-slate-500">Críticos</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORT TABLE
// ══════════════════════════════════════════════════════════════════════════════
function ReportTable({ reports, onView, onEdit, onStatusChange, onDelete, isAdmin, currentUserId }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="reports-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Creado por</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estudiante</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Grado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sección</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Opciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map(report => {
              const priorityInfo = PRIORITIES[report.priority] || PRIORITIES.medium;
              const statusInfo = STATUSES[report.status] || STATUSES.open;
              const canEdit = isAdmin || (report.created_by === currentUserId && report.status === "open");
              
              return (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors" data-testid={`report-row-${report.id}`}>
                  {/* Priority */}
                  <td className="px-4 py-3">
                    <div 
                      className="w-3 h-10 rounded-full"
                      style={{ backgroundColor: priorityInfo.color }}
                      title={priorityInfo.label}
                    />
                  </td>
                  
                  {/* Date */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">
                      {new Date(report.incident_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                    </span>
                  </td>
                  
                  {/* Created by */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{report.created_by_name}</span>
                  </td>
                  
                  {/* Student */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {report.student_photo ? (
                        <img src={report.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700">{report.student_name}</span>
                    </div>
                  </td>
                  
                  {/* Grade */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{report.grade_name}</span>
                  </td>
                  
                  {/* Section */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{report.section_name}</span>
                  </td>
                  
                  {/* Title */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="text-sm text-slate-800 font-medium truncate block" title={report.title}>
                      {report.title}
                    </span>
                  </td>
                  
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onView(report)}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Ver detalle"
                        data-testid={`view-report-${report.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {canEdit && report.status !== "resolved" && (
                        <button
                          onClick={() => onEdit(report)}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Editar"
                          data-testid={`edit-report-${report.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {isAdmin && report.status !== "archived" && (
                        <button
                          onClick={() => onStatusChange(report)}
                          className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Cambiar estado"
                          data-testid={`status-report-${report.id}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                      
                      {isAdmin && (
                        <button
                          onClick={() => onDelete(report)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                          data-testid={`delete-report-${report.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ReportFormModal({ isOpen, onClose, report, onSave, grades, sections, students, token }) {
  const [formData, setFormData] = useState({
    title: "",
    grade_id: "",
    section_id: "",
    student_id: "",
    priority: "medium",
    incident_date: new Date().toISOString().split("T")[0],
    description: "",
    attachments: []
  });
  const [filteredSections, setFilteredSections] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (report) {
      setFormData({
        title: report.title || "",
        grade_id: report.grade_id || "",
        section_id: report.section_id || "",
        student_id: report.student_id || "",
        priority: report.priority || "medium",
        incident_date: report.incident_date || new Date().toISOString().split("T")[0],
        description: report.description || "",
        attachments: report.attachments || []
      });
    } else {
      setFormData({
        title: "",
        grade_id: "",
        section_id: "",
        student_id: "",
        priority: "medium",
        incident_date: new Date().toISOString().split("T")[0],
        description: "",
        attachments: []
      });
    }
    setError("");
  }, [report, isOpen]);

  // Filter sections when grade changes
  useEffect(() => {
    if (formData.grade_id) {
      const filtered = sections.filter(s => s.grado_id === formData.grade_id);
      setFilteredSections(filtered);
      // Reset section and student if grade changed
      if (!filtered.find(s => s.id === formData.section_id)) {
        setFormData(prev => ({ ...prev, section_id: "", student_id: "" }));
      }
    } else {
      setFilteredSections([]);
    }
  }, [formData.grade_id, sections]);

  // Filter students when section changes
  useEffect(() => {
    if (formData.grade_id && formData.section_id) {
      const filtered = students.filter(s => 
        s.grado_id === formData.grade_id && 
        s.seccion_id === formData.section_id
      );
      setFilteredStudents(filtered);
      // Reset student if not in filtered list
      if (!filtered.find(s => s.id === formData.student_id)) {
        setFormData(prev => ({ ...prev, student_id: "" }));
      }
    } else {
      setFilteredStudents([]);
    }
  }, [formData.grade_id, formData.section_id, students]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      // Get Cloudinary signature
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/discipline`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newAttachments = [];
      
      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        formDataUpload.append("api_key", sigRes.data.api_key);
        formDataUpload.append("timestamp", sigRes.data.timestamp);
        formDataUpload.append("signature", sigRes.data.signature);
        formDataUpload.append("folder", sigRes.data.folder);
        
        const uploadRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${sigRes.data.cloud_name}/auto/upload`,
          formDataUpload
        );
        
        // Determine file type
        let fileType = "other";
        if (file.type.startsWith("image/")) fileType = "image";
        else if (file.type === "application/pdf") fileType = "pdf";
        else if (file.type.includes("document") || file.type.includes("word")) fileType = "doc";
        
        newAttachments.push({
          url: uploadRes.data.secure_url,
          type: fileType,
          filename: file.name
        });
      }
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    } catch (err) {
      console.error("Upload error:", err);
      setError("Error al subir archivo(s)");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!formData.grade_id) {
      setError("Selecciona un grado");
      return;
    }
    if (!formData.section_id) {
      setError("Selecciona una sección");
      return;
    }
    if (!formData.student_id) {
      setError("Selecciona un estudiante");
      return;
    }
    if (!formData.description.trim()) {
      setError("La descripción es requerida");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar reporte");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="report-form-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {report?.id ? "Editar Reporte" : "Agregar reporte"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" data-testid="close-modal-btn">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título del reporte"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              data-testid="report-title-input"
            />
          </div>

          {/* Grade & Section */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Grado <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="report-grade-select"
              >
                <option value="">Seleccionar</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Sección <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.section_id}
                onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={!formData.grade_id}
                data-testid="report-section-select"
              >
                <option value="">Seleccionar</option>
                {filteredSections.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Student */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Estudiante <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.student_id}
              onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={!formData.section_id}
              data-testid="report-student-select"
            >
              <option value="">Seleccionar</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>
              ))}
            </select>
          </div>

          {/* Priority & Date */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Prioridad <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="report-priority-select"
              >
                {Object.entries(PRIORITIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha del incidente <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.incident_date}
                onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="report-date-input"
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Archivo (opcional)
            </label>
            <div className="flex items-center gap-4">
              <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="text-sm">Seleccionar archivo</span>
              </label>
              <span className="text-sm text-slate-500">
                {formData.attachments.length === 0 
                  ? "Sin archivos seleccionados"
                  : `${formData.attachments.length} archivo(s)`
                }
              </span>
            </div>
            
            {/* Attachments list */}
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    {att.type === "image" ? (
                      <FileImage className="w-4 h-4 text-blue-500" />
                    ) : (
                      <File className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-sm text-slate-700 flex-1 truncate">{att.filename || "Archivo"}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción detallada del incidente..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              data-testid="report-description-input"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center gap-2"
              data-testid="save-report-btn"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Guardar reporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ViewReportModal({ isOpen, onClose, report, isAdmin, onStatusChange }) {
  if (!isOpen || !report) return null;

  const priorityInfo = PRIORITIES[report.priority] || PRIORITIES.medium;
  const statusInfo = STATUSES[report.status] || STATUSES.open;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="view-report-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Detalle del Reporte</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Status & Priority badges */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusInfo.bgClass} ${statusInfo.textClass} font-medium`}>
              {statusInfo.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${priorityInfo.bgClass} ${priorityInfo.textClass} font-medium`}>
              Prioridad: {priorityInfo.label}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-800 mb-4">{report.title}</h3>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Estudiante</p>
              <div className="flex items-center gap-2">
                {report.student_photo ? (
                  <img src={report.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <span className="font-semibold text-slate-800">{report.student_name}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Grado / Sección</p>
              <p className="font-semibold text-slate-800">{report.grade_name} - {report.section_name}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Fecha del incidente</p>
              <p className="font-semibold text-slate-800">
                {new Date(report.incident_date).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Creado por</p>
              <p className="font-semibold text-slate-800">{report.created_by_name}</p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Descripción</h4>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-slate-700 whitespace-pre-wrap">{report.description}</p>
            </div>
          </div>

          {/* Attachments */}
          {report.attachments?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Archivos adjuntos</h4>
              <div className="space-y-2">
                {report.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    {att.type === "image" ? (
                      <FileImage className="w-5 h-5 text-blue-500" />
                    ) : (
                      <File className="w-5 h-5 text-slate-500" />
                    )}
                    <span className="text-sm text-slate-700 flex-1">{att.filename || "Archivo adjunto"}</span>
                    <Download className="w-4 h-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Línea de tiempo</h4>
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
              <div className="relative">
                <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-blue-500" />
                <p className="text-sm font-medium text-slate-800">Creado</p>
                <p className="text-xs text-slate-500">
                  {new Date(report.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              
              {report.reviewed_by && (
                <div className="relative">
                  <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-purple-500" />
                  <p className="text-sm font-medium text-slate-800">Revisado</p>
                  <p className="text-xs text-slate-500">Por: {report.reviewed_by_name || "Director"}</p>
                </div>
              )}
              
              {report.status === "resolved" && (
                <div className="relative">
                  <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-green-500" />
                  <p className="text-sm font-medium text-slate-800">Resuelto</p>
                  <p className="text-xs text-slate-500">
                    {new Date(report.updated_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status change (admin only) */}
          {isAdmin && report.status !== "archived" && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Cambiar estado</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUSES).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onStatusChange(report, key);
                      onClose();
                    }}
                    disabled={report.status === key}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      report.status === key
                        ? `${val.bgClass} ${val.textClass} cursor-not-allowed`
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS CHANGE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function StatusChangeModal({ isOpen, onClose, report, onConfirm }) {
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (report) {
      setNewStatus(report.status);
    }
  }, [report]);

  const handleConfirm = async () => {
    if (newStatus === report.status) {
      onClose();
      return;
    }
    
    setSaving(true);
    try {
      await onConfirm(report.id, newStatus);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="status-change-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Cambiar estado del reporte</h3>
        <p className="text-slate-600 mb-6">"{report.title}"</p>
        
        <div className="space-y-2 mb-6">
          {Object.entries(STATUSES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setNewStatus(key)}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                newStatus === key
                  ? `border-amber-500 ${val.bgClass}`
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: val.color }}
              />
              <span className={`font-medium ${newStatus === key ? val.textClass : "text-slate-700"}`}>
                {val.label}
              </span>
              {report.status === key && (
                <span className="text-xs text-slate-500 ml-auto">(actual)</span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || newStatus === report.status}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function DisciplinePage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Filters
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusReport, setStatusReport] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingReport, setDeletingReport] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);
  const canCreate = ["owner", "admin", "director", "teacher"].includes(user?.role);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadReports();
    }
  }, [filterGrade, filterSection, filterPriority, filterStatus]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, gradesRes, sectionsRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
      setStudents(usersRes.data.filter(u => u.role === "student"));
      
      await loadReports();
      
      if (isAdmin) {
        const statsRes = await axios.get(`${API}/discipline/stats/summary`, { headers });
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const params = {};
      if (filterGrade) params.grade_id = filterGrade;
      if (filterSection) params.section_id = filterSection;
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;
      
      const res = await axios.get(`${API}/discipline`, { headers, params });
      setReports(res.data);
    } catch (err) {
      console.error("Error loading reports:", err);
    }
  };

  const handleCreateNew = () => {
    setEditingReport(null);
    setShowFormModal(true);
  };

  const handleEdit = (report) => {
    setEditingReport(report);
    setShowFormModal(true);
  };

  const handleView = (report) => {
    setViewingReport(report);
    setShowViewModal(true);
  };

  const handleStatusChangeModal = (report) => {
    setStatusReport(report);
    setShowStatusModal(true);
  };

  const handleSaveReport = async (data) => {
    if (editingReport?.id) {
      await axios.put(`${API}/discipline/${editingReport.id}`, data, { headers });
    } else {
      await axios.post(`${API}/discipline`, data, { headers });
    }
    loadReports();
    if (isAdmin) {
      const statsRes = await axios.get(`${API}/discipline/stats/summary`, { headers });
      setStats(statsRes.data);
    }
  };

  const handleStatusChange = async (reportId, newStatus) => {
    await axios.put(`${API}/discipline/${reportId}/status`, { status: newStatus }, { headers });
    loadReports();
    if (isAdmin) {
      const statsRes = await axios.get(`${API}/discipline/stats/summary`, { headers });
      setStats(statsRes.data);
    }
  };

  const handleDeleteClick = (report) => {
    setDeletingReport(report);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!deletingReport) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/discipline/${deletingReport.id}`, { headers });
      loadReports();
      if (isAdmin) {
        const statsRes = await axios.get(`${API}/discipline/stats/summary`, { headers });
        setStats(statsRes.data);
      }
      setShowDeleteModal(false);
      setDeletingReport(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar reporte");
    } finally {
      setDeleting(false);
    }
  };

  // Filter sections based on selected grade
  const filteredSectionsForFilter = filterGrade 
    ? sections.filter(s => s.grado_id === filterGrade)
    : sections;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="discipline-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
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
        <main className="flex-1 p-6 lg:p-8">
          {/* Page Title */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <AlertTriangle className="w-10 h-10 text-amber-600" />
                </div>
                <div className="text-white">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Disciplina</h1>
                  <p className="text-amber-100 text-lg">Gestión de incidencias disciplinarias</p>
                </div>
              </div>
              {canCreate && (
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 bg-white text-amber-600 rounded-xl font-semibold hover:bg-amber-50 transition-colors flex items-center gap-2 shadow-lg"
                  data-testid="create-report-btn"
                >
                  <Plus className="w-5 h-5" />
                  Agregar reporte
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards (admin only) */}
          {isAdmin && <StatsCards stats={stats} />}

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <Filter className="w-5 h-5 text-slate-400" />
              
              {/* Grade filter */}
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value);
                  setFilterSection("");
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="filter-grade"
              >
                <option value="">Todos los grados</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>
                ))}
              </select>
              
              {/* Section filter */}
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={!filterGrade}
                data-testid="filter-section"
              >
                <option value="">Todas las secciones</option>
                {filteredSectionsForFilter.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              
              {/* Priority filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="filter-priority"
              >
                <option value="">Todas las prioridades</option>
                {Object.entries(PRIORITIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                data-testid="filter-status"
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              
              {/* Clear filters */}
              {(filterGrade || filterSection || filterPriority || filterStatus) && (
                <button
                  onClick={() => {
                    setFilterGrade("");
                    setFilterSection("");
                    setFilterPriority("");
                    setFilterStatus("");
                  }}
                  className="px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Reports Table or Empty State */}
          {loading ? (
            <DisciplineSkeleton />
          ) : reports.length === 0 ? (
            <EmptyState canCreate={canCreate} onCreateNew={handleCreateNew} />
          ) : (
            <ReportTable
              reports={reports}
              onView={handleView}
              onEdit={handleEdit}
              onStatusChange={handleStatusChangeModal}
              onDelete={handleDeleteClick}
              isAdmin={isAdmin}
              currentUserId={user?.id}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <ReportFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingReport(null);
        }}
        report={editingReport}
        onSave={handleSaveReport}
        grades={grades}
        sections={sections}
        students={students}
        token={token}
      />

      <ViewReportModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingReport(null);
        }}
        report={viewingReport}
        isAdmin={isAdmin}
        onStatusChange={(report, status) => handleStatusChange(report.id, status)}
      />

      <StatusChangeModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setStatusReport(null);
        }}
        report={statusReport}
        onConfirm={handleStatusChange}
      />
      
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingReport(null); }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Eliminar Reporte"
        message={`¿Estás seguro de eliminar el reporte "${deletingReport?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        icon="delete"
      />
    </div>
  );
}
