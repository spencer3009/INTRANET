import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { 
  Newspaper, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  Eye, Clock, Pin, PinOff, Archive, Send, MoreHorizontal, Image,
  ChevronLeft, ChevronRight, Globe, Users, GraduationCap
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status configuration
const STATUS_CONFIG = {
  draft: { label: "Borrador", color: "#64748B", bgClass: "bg-slate-100", textClass: "text-slate-700" },
  published: { label: "Publicado", color: "#22C55E", bgClass: "bg-green-100", textClass: "text-green-700" },
  archived: { label: "Archivado", color: "#94A3B8", bgClass: "bg-slate-100", textClass: "text-slate-500" }
};

// Role labels
const ROLE_LABELS = {
  teacher: "Profesores",
  student: "Estudiantes",
  parent: "Padres",
  admin: "Administradores",
  director: "Directores"
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ══════════════════════════════════════════════════════════════════════════════
function NewsSkeleton() {
  return (
    <div className="space-y-6" data-testid="news-skeleton">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
          <div className="h-48 bg-slate-200" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-slate-200 rounded-full" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-3 bg-slate-200 rounded w-24" />
              </div>
            </div>
            <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
            <div className="h-4 bg-slate-200 rounded w-full mb-2" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState({ isAdmin, onCreateNew }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center" data-testid="news-empty">
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Newspaper className="w-10 h-10 text-blue-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">No hay noticias</h3>
      <p className="text-slate-500 mb-6 max-w-md mx-auto">
        {isAdmin 
          ? "Aún no se han publicado noticias. Crea la primera noticia para mantener informada a tu comunidad."
          : "No hay noticias disponibles en este momento."
        }
      </p>
      {isAdmin && (
        <button
          onClick={onCreateNew}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center gap-2 mx-auto"
          data-testid="create-first-news-btn"
        >
          <Plus className="w-5 h-5" />
          Crear noticia
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEWS CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function NewsCard({ news, isAdmin, onView, onEdit, onPublish, onArchive, onPin, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  const statusInfo = STATUS_CONFIG[news.status] || STATUS_CONFIG.draft;
  
  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-PE", { 
      day: "numeric", 
      month: "long", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <article 
      className={`bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all ${
        news.pinned ? "ring-2 ring-amber-400" : ""
      }`}
      data-testid={`news-card-${news.id}`}
    >
      {/* Cover Image */}
      {news.cover_image && (
        <div className="relative h-48 md:h-56 overflow-hidden cursor-pointer" onClick={() => onView(news)}>
          <img 
            src={news.cover_image} 
            alt={news.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Pinned badge */}
          {news.pinned && (
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-amber-500 text-white rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-lg">
              <Pin className="w-4 h-4" />
              Destacado
            </div>
          )}
          {/* Status badge for drafts */}
          {news.status !== "published" && (
            <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
              {statusInfo.label}
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-6">
        {/* Header with author and menu */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {news.author_photo ? (
              <img src={news.author_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {news.author_name?.charAt(0) || "N"}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">{news.author_name}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(news.published_at || news.created_at)}
              </p>
            </div>
          </div>
          
          {/* Admin menu */}
          {isAdmin && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid={`news-menu-${news.id}`}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-10">
                  <button
                    onClick={() => { onView(news); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" /> Ver noticia
                  </button>
                  <button
                    onClick={() => { onEdit(news); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                  
                  {news.status === "draft" && (
                    <button
                      onClick={() => { onPublish(news); setMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Publicar
                    </button>
                  )}
                  
                  {news.status === "published" && (
                    <>
                      <button
                        onClick={() => { onPin(news); setMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                      >
                        {news.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        {news.pinned ? "Quitar destacado" : "Destacar"}
                      </button>
                      <button
                        onClick={() => { onArchive(news); setMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" /> Archivar
                      </button>
                    </>
                  )}
                  
                  <hr className="my-2 border-slate-100" />
                  <button
                    onClick={() => { onDelete(news); setMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Pinned badge (if no cover image) */}
        {!news.cover_image && news.pinned && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-3">
            <Pin className="w-4 h-4" />
            Destacado
          </div>
        )}
        
        {/* Title */}
        <h2 
          className="text-xl font-bold text-slate-800 mb-3 hover:text-blue-600 cursor-pointer line-clamp-2"
          onClick={() => onView(news)}
        >
          {news.title}
        </h2>
        
        {/* Summary or truncated content */}
        <p className="text-slate-600 line-clamp-3 mb-4">
          {news.summary || news.content?.replace(/<[^>]*>/g, '').substring(0, 200)}
        </p>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => onView(news)}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
            data-testid={`read-more-${news.id}`}
          >
            Leer más
            <ChevronRight className="w-4 h-4" />
          </button>
          
          {/* Visibility indicator */}
          {news.visibility && (news.visibility.roles?.length > 0 || news.visibility.grades?.length > 0) && (
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Users className="w-3.5 h-3.5" />
              <span>Restringido</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE/EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function NewsFormModal({ isOpen, onClose, news, onSave, grades, sections, token }) {
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    content: "",
    cover_image: "",
    gallery: [],
    visibility: { roles: [], grades: [], sections: [] },
    status: "draft",
    pinned: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    if (news) {
      setFormData({
        title: news.title || "",
        summary: news.summary || "",
        content: news.content || "",
        cover_image: news.cover_image || "",
        gallery: news.gallery || [],
        visibility: news.visibility || { roles: [], grades: [], sections: [] },
        status: news.status || "draft",
        pinned: news.pinned || false
      });
    } else {
      setFormData({
        title: "",
        summary: "",
        content: "",
        cover_image: "",
        gallery: [],
        visibility: { roles: [], grades: [], sections: [] },
        status: "draft",
        pinned: false
      });
    }
    setError("");
    setActiveTab("content");
  }, [news, isOpen]);

  const handleImageUpload = async (e, type = "cover") => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/news`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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
      
      if (type === "cover") {
        setFormData(prev => ({ ...prev, cover_image: uploadRes.data.secure_url }));
      } else {
        setFormData(prev => ({
          ...prev,
          gallery: [...prev.gallery, { url: uploadRes.data.secure_url, type: "image" }]
        }));
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryItem = (index) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index)
    }));
  };

  const toggleRole = (role) => {
    const roles = formData.visibility.roles.includes(role)
      ? formData.visibility.roles.filter(r => r !== role)
      : [...formData.visibility.roles, role];
    setFormData(prev => ({
      ...prev,
      visibility: { ...prev.visibility, roles }
    }));
  };

  const toggleGrade = (gradeId) => {
    const gradesList = formData.visibility.grades.includes(gradeId)
      ? formData.visibility.grades.filter(g => g !== gradeId)
      : [...formData.visibility.grades, gradeId];
    setFormData(prev => ({
      ...prev,
      visibility: { ...prev.visibility, grades: gradesList }
    }));
  };

  const handleSubmit = async (publish = false) => {
    setError("");

    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!formData.content.trim()) {
      setError("El contenido es requerido");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        status: publish ? "published" : formData.status
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar noticia");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="news-form-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {news?.id ? "Editar Noticia" : "Nueva Noticia"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" data-testid="close-modal-btn">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("content")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "content"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Contenido
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "media"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Multimedia
          </button>
          <button
            onClick={() => setActiveTab("visibility")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "visibility"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Visibilidad
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Content Tab */}
          {activeTab === "content" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título de la noticia"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="news-title-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Resumen <span className="text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="Breve resumen de la noticia..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  data-testid="news-summary-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Contenido <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escribe el contenido completo de la noticia..."
                  rows={10}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  data-testid="news-content-input"
                />
              </div>
            </div>
          )}

          {/* Media Tab */}
          {activeTab === "media" && (
            <div className="space-y-6">
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Imagen principal
                </label>
                {formData.cover_image ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={formData.cover_image} alt="Cover" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cover_image: "" }))}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "cover")}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    ) : (
                      <>
                        <Image className="w-10 h-10 text-slate-400 mb-2" />
                        <span className="text-slate-500">Arrastra o haz clic para subir</span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* Gallery */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Galería <span className="text-slate-400">(opcional)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {formData.gallery.map((item, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden aspect-square">
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg aspect-square cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "gallery")}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Plus className="w-8 h-8 text-slate-400" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Visibility Tab */}
          {activeTab === "visibility" && (
            <div className="space-y-6">
              {/* Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <Globe className="w-5 h-5 inline mr-2" />
                Si no seleccionas ninguna restricción, la noticia será visible para todos.
              </div>

              {/* Roles */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Restringir por roles
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-4 py-2 rounded-xl border-2 transition-all ${
                        formData.visibility.roles.includes(role)
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grades */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Restringir por grados
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => toggleGrade(grade.id)}
                      className={`px-4 py-2 rounded-xl border-2 transition-all ${
                        formData.visibility.grades.includes(grade.id)
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {grade.nivel_nombre} - {grade.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pinned */}
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={formData.pinned}
                  onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked }))}
                  className="w-5 h-5 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="pinned" className="flex items-center gap-2 text-amber-800 font-medium cursor-pointer">
                  <Pin className="w-5 h-5" />
                  Fijar noticia como destacada
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          {!news?.id && (
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="px-6 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="save-draft-btn"
            >
              Guardar borrador
            </button>
          )}
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="publish-news-btn"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {news?.id ? "Actualizar" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW NEWS MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ViewNewsModal({ isOpen, onClose, news }) {
  if (!isOpen || !news) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-PE", { 
      day: "numeric", 
      month: "long", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="view-news-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Cover Image */}
        {news.cover_image && (
          <div className="relative h-64 overflow-hidden">
            <img src={news.cover_image} alt={news.title} className="w-full h-full object-cover" />
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="w-5 h-5" />
            </button>
            {news.pinned && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-amber-500 text-white rounded-full text-sm font-semibold flex items-center gap-1.5">
                <Pin className="w-4 h-4" />
                Destacado
              </div>
            )}
          </div>
        )}

        <div className="p-8 overflow-y-auto max-h-[calc(90vh-256px)]">
          {/* Close button (if no cover) */}
          {!news.cover_image && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Author */}
          <div className="flex items-center gap-3 mb-6">
            {news.author_photo ? (
              <img src={news.author_photo} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                {news.author_name?.charAt(0) || "N"}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">{news.author_name}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDate(news.published_at || news.created_at)}
              </p>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-slate-800 mb-6">{news.title}</h1>

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{news.content}</p>
          </div>

          {/* Gallery */}
          {news.gallery?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Galería</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {news.gallery.map((item, idx) => (
                  <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer">
                    <img src={item.url} alt="" className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function NewsPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [newsList, setNewsList] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingNews, setViewingNews] = useState(null);
  
  // Confirmation modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = ["owner", "admin", "director"].includes(user?.role);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadNews();
    }
  }, [statusFilter, currentPage]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, gradesRes, sectionsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
      
      await loadNews();
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadNews = async () => {
    try {
      const params = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      
      const res = await axios.get(`${API}/news`, { headers, params });
      setNewsList(res.data.news || []);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Error loading news:", err);
    }
  };

  const handleCreateNew = () => {
    setEditingNews(null);
    setShowFormModal(true);
  };

  const handleEdit = (news) => {
    setEditingNews(news);
    setShowFormModal(true);
  };

  const handleView = (news) => {
    setViewingNews(news);
    setShowViewModal(true);
  };

  const handleSaveNews = async (data) => {
    if (editingNews?.id) {
      await axios.put(`${API}/news/${editingNews.id}`, data, { headers });
    } else {
      await axios.post(`${API}/news`, data, { headers });
    }
    loadNews();
  };

  const handlePublishClick = (news) => {
    setSelectedNews(news);
    setShowPublishModal(true);
  };
  
  const handlePublishConfirm = async () => {
    if (!selectedNews) return;
    setProcessing(true);
    try {
      await axios.put(`${API}/news/${selectedNews.id}/publish`, {}, { headers });
      loadNews();
      setShowPublishModal(false);
      setSelectedNews(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al publicar");
    } finally {
      setProcessing(false);
    }
  };

  const handleArchiveClick = (news) => {
    setSelectedNews(news);
    setShowArchiveModal(true);
  };
  
  const handleArchiveConfirm = async () => {
    if (!selectedNews) return;
    setProcessing(true);
    try {
      await axios.put(`${API}/news/${selectedNews.id}/archive`, {}, { headers });
      loadNews();
      setShowArchiveModal(false);
      setSelectedNews(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al archivar");
    } finally {
      setProcessing(false);
    }
  };

  const handlePin = async (news) => {
    try {
      await axios.put(`${API}/news/${news.id}/pin`, {}, { headers });
      loadNews();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cambiar destacado");
    }
  };

  const handleDeleteClick = (news) => {
    setSelectedNews(news);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!selectedNews) return;
    setProcessing(true);
    try {
      await axios.delete(`${API}/news/${selectedNews.id}`, { headers });
      loadNews();
      setShowDeleteModal(false);
      setSelectedNews(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" data-testid="news-page">
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
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative px-8 py-10 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <Newspaper className="w-10 h-10 text-blue-600" />
                </div>
                <div className="text-white">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Noticias</h1>
                  <p className="text-blue-100 text-lg">Mantente informado de las novedades institucionales</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                  data-testid="create-news-btn"
                >
                  <Plus className="w-5 h-5" />
                  Nueva noticia
                </button>
              )}
            </div>
          </div>

          {/* Filters (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600">Filtrar por estado:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStatusFilter(""); setCurrentPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      statusFilter === ""
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid="filter-all"
                  >
                    Todas
                  </button>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        statusFilter === key
                          ? `${config.bgClass} ${config.textClass}`
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      data-testid={`filter-${key}`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* News Feed */}
          {loading ? (
            <NewsSkeleton />
          ) : newsList.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onCreateNew={handleCreateNew} />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                {newsList.map(news => (
                  <NewsCard
                    key={news.id}
                    news={news}
                    isAdmin={isAdmin}
                    onView={handleView}
                    onEdit={handleEdit}
                    onPublish={handlePublishClick}
                    onArchive={handleArchiveClick}
                    onPin={handlePin}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-slate-600">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <NewsFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingNews(null);
        }}
        news={editingNews}
        onSave={handleSaveNews}
        grades={grades}
        sections={sections}
        token={token}
      />

      <ViewNewsModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingNews(null);
        }}
        news={viewingNews}
      />
    </div>
  );
}
