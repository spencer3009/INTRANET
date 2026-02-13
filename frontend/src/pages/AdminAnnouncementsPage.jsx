import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Megaphone, Plus, Search, Filter, Pencil, Trash2, Send,
  Calendar, Users, FileText, Image, Paperclip, X, Check,
  Loader2, ArrowLeft, Eye, Clock, AlertCircle, Download
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status Badge
function StatusBadge({ status }) {
  const styles = {
    draft: "bg-slate-100 text-slate-600",
    published: "bg-emerald-100 text-emerald-700",
    scheduled: "bg-blue-100 text-blue-700",
    archived: "bg-amber-100 text-amber-700"
  };
  const labels = {
    draft: "Borrador",
    published: "Publicado",
    scheduled: "Programado",
    archived: "Archivado"
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  );
}

// Audience Badge
function AudienceBadge({ audience }) {
  const labels = {
    all: "Todos",
    teachers: "Profesores",
    students: "Estudiantes",
    parents: "Padres"
  };
  return (
    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">
      {labels[audience] || audience}
    </span>
  );
}

// File Preview Component
function FilePreview({ file, onRemove }) {
  const isImage = file.type?.startsWith('image/') || file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  
  return (
    <div className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
      {isImage ? (
        <Image className="w-8 h-8 text-blue-500" />
      ) : (
        <FileText className="w-8 h-8 text-red-500" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {file.name || file.url?.split('/').pop()}
        </p>
        <p className="text-xs text-slate-500">
          {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
        </p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Create/Edit Announcement Modal
function AnnouncementModal({ isOpen, onClose, announcement, onSave, loading, headers }) {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    audience: "all",
    status: "draft",
    publish_date: "",
    attachments: []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title || "",
        content: announcement.content || "",
        audience: announcement.audience || "all",
        status: announcement.status || "draft",
        publish_date: announcement.publish_date?.split('T')[0] || "",
        attachments: announcement.attachments || []
      });
    } else {
      setFormData({
        title: "",
        content: "",
        audience: "all",
        status: "draft",
        publish_date: "",
        attachments: []
      });
    }
  }, [announcement, isOpen]);
  
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Validate max 3 files
    if (formData.attachments.length + files.length > 3) {
      setUploadError("Máximo 3 archivos permitidos");
      return;
    }
    
    // Validate each file
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setUploadError("Solo se permiten imágenes (JPG, PNG, WebP) y PDF");
        return;
      }
      if (file.size > maxSize) {
        setUploadError(`"${file.name}" excede el tamaño máximo de 10MB`);
        return;
      }
    }
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const uploadedFiles = [];
      
      for (const file of files) {
        // Get upload signature
        const signRes = await axios.post(`${API}/upload/signature`, {
          folder: "announcements",
          resource_type: file.type === 'application/pdf' ? 'raw' : 'image'
        }, { headers });
        
        const { signature, timestamp, cloud_name, api_key, folder } = signRes.data;
        
        // Upload to Cloudinary
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('signature', signature);
        formDataUpload.append('timestamp', timestamp);
        formDataUpload.append('api_key', api_key);
        formDataUpload.append('folder', folder);
        
        const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
        const uploadRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`,
          formDataUpload
        );
        
        uploadedFiles.push({
          name: file.name,
          url: uploadRes.data.secure_url,
          type: file.type,
          size: file.size
        });
      }
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }));
      
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Error al subir archivo. Intente de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">
            {announcement ? "Editar Comunicado" : "Nuevo Comunicado"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              placeholder="Título del comunicado"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contenido *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
              rows={6}
              placeholder="Escribe el contenido del comunicado..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audiencia</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData(prev => ({ ...prev, audience: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="all">Todos</option>
                <option value="teachers">Solo Profesores</option>
                <option value="students">Solo Estudiantes</option>
                <option value="parents">Solo Padres</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicar ahora</option>
                <option value="scheduled">Programar</option>
              </select>
            </div>
          </div>
          
          {formData.status === "scheduled" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de publicación</label>
              <input
                type="date"
                value={formData.publish_date}
                onChange={(e) => setFormData(prev => ({ ...prev, publish_date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
          
          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Archivos adjuntos ({formData.attachments.length}/3)
            </label>
            
            {formData.attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.attachments.map((file, idx) => (
                  <FilePreview 
                    key={idx} 
                    file={file} 
                    onRemove={() => removeAttachment(idx)} 
                  />
                ))}
              </div>
            )}
            
            {formData.attachments.length < 3 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="text-slate-600">
                    {uploading ? "Subiendo..." : "Agregar archivo (PDF o imagen, máx 10MB)"}
                  </span>
                </button>
              </>
            )}
            
            {uploadError && (
              <p className="text-sm text-red-600 mt-2">{uploadError}</p>
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={loading || !formData.title.trim() || !formData.content.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-xl flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {announcement ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [announcements, setAnnouncements] = useState([]);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAudience, setFilterAudience] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, announcementsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/announcements`, { headers }).catch(() => ({ data: { announcements: [] } }))
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      setAnnouncements(announcementsRes.data?.announcements || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingAnnouncement) {
        await axios.put(`${API}/admin/announcements/${editingAnnouncement.id}`, formData, { headers });
      } else {
        await axios.post(`${API}/admin/announcements`, formData, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingAnnouncement(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    try {
      await axios.delete(`${API}/admin/announcements/${announcementToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setAnnouncementToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setShowModal(true);
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Filter announcements
  const filteredAnnouncements = announcements.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterAudience && a.audience !== filterAudience) return false;
    if (searchTerm && !a.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

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
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-announcements-page">
      <AdminSidebar
        active="comunicados"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name || "EduNet"}
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
          schoolName={settings?.system_name}
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
                <h1 className="text-2xl font-bold text-slate-800">Comunicados</h1>
                <p className="text-sm text-slate-500">Gestión de comunicados oficiales</p>
              </div>
            </div>
            
            <button
              onClick={() => { setEditingAnnouncement(null); setShowModal(true); }}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo comunicado
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por título..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="scheduled">Programado</option>
                <option value="archived">Archivado</option>
              </select>
              <select
                value={filterAudience}
                onChange={(e) => setFilterAudience(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">Todas las audiencias</option>
                <option value="all">Todos</option>
                <option value="teachers">Profesores</option>
                <option value="students">Estudiantes</option>
                <option value="parents">Padres</option>
              </select>
            </div>
          </div>

          {/* Announcements List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">
                Comunicados ({filteredAnnouncements.length})
              </h2>
            </div>
            
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay comunicados</p>
                <button
                  onClick={() => { setEditingAnnouncement(null); setShowModal(true); }}
                  className="mt-4 text-purple-600 hover:text-purple-800 font-medium"
                >
                  Crear el primero →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAnnouncements.map((a) => (
                  <div key={a.id} className="px-6 py-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-800 truncate">{a.title}</h3>
                          <StatusBadge status={a.status} />
                          <AudienceBadge audience={a.audience} />
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">{a.content}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(a.created_at)}
                          </span>
                          {a.attachments?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {a.attachments.length} archivo(s)
                            </span>
                          )}
                          {a.status === "scheduled" && a.publish_date && (
                            <span className="flex items-center gap-1 text-blue-500">
                              <Clock className="w-3 h-3" />
                              Publicar: {formatDate(a.publish_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                        <button
                          onClick={() => handleEdit(a)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setAnnouncementToDelete(a); setShowDeleteModal(true); }}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      <AnnouncementModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAnnouncement(null); }}
        announcement={editingAnnouncement}
        onSave={handleSave}
        loading={saving}
        headers={headers}
      />
      
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setAnnouncementToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Comunicado"
        message={`¿Eliminar el comunicado "${announcementToDelete?.title}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}
