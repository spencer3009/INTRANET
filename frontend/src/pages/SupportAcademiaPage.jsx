import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Video, FolderOpen, Plus, Search, Edit2, Trash2, X, Loader2,
  Eye, Play, ChevronUp, ChevronDown, Tag, Check, AlertCircle,
  Film, BarChart3, Clock, Globe, Share2, ArrowRightLeft
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
};

// ═══════════════════════════════════════════════════════════
// CATEGORY MANAGER MODAL
// ═══════════════════════════════════════════════════════════
function CategoryManagerModal({ isOpen, onClose, token, onRefresh }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [newSubName, setNewSubName] = useState({});
  const [editingCat, setEditingCat] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingSub, setEditingSub] = useState(null);
  const [editingSubName, setEditingSubName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/academia/categories`, { headers });
      setCategories(res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await axios.post(`${API}/academia/categories`, { name: newCatName.trim() }, { headers });
      setNewCatName("");
      load();
      onRefresh();
      toast.success("Categoria creada");
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const saveEditCat = async (catId) => {
    if (!editingCatName.trim()) return;
    try {
      await axios.put(`${API}/academia/categories/${catId}`, { name: editingCatName.trim() }, { headers });
      setEditingCat(null);
      load();
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const deleteCat = async (cat) => {
    if (!window.confirm(`Eliminar "${cat.name}"?`)) return;
    try {
      await axios.delete(`${API}/academia/categories/${cat.id}`, { headers });
      load(); onRefresh();
      toast.success("Categoria eliminada");
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const toggleCat = async (cat) => {
    await axios.put(`${API}/academia/categories/${cat.id}`, { is_active: !cat.is_active }, { headers });
    load(); onRefresh();
  };

  const moveCat = async (index, dir) => {
    const arr = [...categories];
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
    await axios.put(`${API}/academia/categories/reorder`, { ordered_ids: arr.map(c => c.id) }, { headers });
    load(); onRefresh();
  };

  const addSub = async (catId) => {
    const name = (newSubName[catId] || "").trim();
    if (!name) return;
    try {
      await axios.post(`${API}/academia/categories/${catId}/subcategories`, { name }, { headers });
      setNewSubName(p => ({ ...p, [catId]: "" }));
      load(); onRefresh();
      toast.success("Subcategoria creada");
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const saveEditSub = async (subId) => {
    if (!editingSubName.trim()) return;
    try {
      await axios.put(`${API}/academia/subcategories/${subId}`, { name: editingSubName.trim() }, { headers });
      setEditingSub(null);
      load(); onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const deleteSub = async (sub) => {
    if (!window.confirm(`Eliminar subcategoria "${sub.name}"?`)) return;
    try {
      await axios.delete(`${API}/academia/subcategories/${sub.id}`, { headers });
      load(); onRefresh();
      toast.success("Subcategoria eliminada");
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" data-testid="category-manager-modal">
        <div className="bg-gradient-to-r from-[#0a1628] to-[#1a2d4a] px-6 py-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Gestionar Categorias</h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div> : (
            <>
              {categories.map((cat, idx) => (
                <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden" data-testid={`cat-manager-${cat.id}`}>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
                    <div className="flex flex-col">
                      <button onClick={() => moveCat(idx, -1)} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveCat(idx, 1)} disabled={idx === categories.length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <FolderOpen className="w-4 h-4 text-emerald-500" />
                    {editingCat === cat.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEditCat(cat.id)}
                          className="flex-1 px-2 py-1 border border-emerald-300 rounded-lg text-sm focus:outline-none" autoFocus />
                        <button onClick={() => saveEditCat(cat.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingCat(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-800 flex-1">{cat.name}</span>
                        <span className="text-xs text-slate-400">{cat.video_count} videos</span>
                      </>
                    )}
                    <button onClick={() => toggleCat(cat)} className={`w-9 h-5 rounded-full transition-colors relative ${cat.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all ${cat.is_active ? "translate-x-4" : ""}`} />
                    </button>
                    {editingCat !== cat.id && (
                      <>
                        <button onClick={() => { setEditingCat(cat.id); setEditingCatName(cat.name); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteCat(cat)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                  {/* Subcategories */}
                  <div className="px-4 py-2 space-y-1.5">
                    {cat.subcategories?.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 pl-6 py-1" data-testid={`sub-manager-${sub.id}`}>
                        <Tag className="w-3 h-3 text-slate-400" />
                        {editingSub === sub.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input value={editingSubName} onChange={e => setEditingSubName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEditSub(sub.id)}
                              className="flex-1 px-2 py-0.5 border border-emerald-300 rounded text-xs focus:outline-none" autoFocus />
                            <button onClick={() => saveEditSub(sub.id)} className="p-0.5 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingSub(null)} className="p-0.5 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-slate-600 flex-1">{sub.name}</span>
                            <span className="text-[10px] text-slate-400">{sub.video_count}v</span>
                            <button onClick={() => { setEditingSub(sub.id); setEditingSubName(sub.name); }} className="p-0.5 text-slate-300 hover:text-blue-500"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => deleteSub(sub)} className="p-0.5 text-slate-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pl-6">
                      <input value={newSubName[cat.id] || ""} onChange={e => setNewSubName(p => ({ ...p, [cat.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addSub(cat.id)} placeholder="Nueva subcategoria..."
                        className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-300 rounded-lg focus:outline-none focus:border-emerald-400" />
                      <button onClick={() => addSub(cat.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Add category */}
              <div className="flex gap-2">
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()}
                  placeholder="Nueva categoria..." className="flex-1 px-4 py-2.5 border border-dashed border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400"
                  data-testid="new-category-input" />
                <button onClick={addCategory} className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 flex items-center gap-1.5"
                  data-testid="add-category-btn"><Plus className="w-4 h-4" /> Agregar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// VIDEO FORM MODAL
// ═══════════════════════════════════════════════════════════
function VideoFormModal({ isOpen, onClose, token, categories, editingVideo, onRefresh, autoCategoryId, autoSubcategoryId }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState({ youtube_url: "", title: "", description: "", duration: "", is_published: false, platform: "youtube" });
  const [moveCategoryId, setMoveCategoryId] = useState("");
  const [moveSubcategoryId, setMoveSubcategoryId] = useState("");
  const [preview, setPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const moveSubcategories = categories.find(c => c.id === moveCategoryId)?.subcategories || [];

  useEffect(() => {
    if (editingVideo) {
      setForm({
        youtube_url: editingVideo.youtube_url || "",
        title: editingVideo.title || "",
        description: editingVideo.description || "",
        duration: editingVideo.duration || "",
        is_published: editingVideo.is_published || false,
        platform: editingVideo.platform || "youtube",
      });
      setMoveCategoryId(editingVideo.category_id || "");
      setMoveSubcategoryId(editingVideo.subcategory_id || "");
      setPreview(editingVideo.youtube_video_id ? { thumbnail_url: editingVideo.thumbnail_url, youtube_video_id: editingVideo.youtube_video_id, platform: editingVideo.platform || "youtube" } : null);
    } else {
      setForm({ youtube_url: "", title: "", description: "", duration: "", is_published: false, platform: "youtube" });
      setMoveCategoryId("");
      setMoveSubcategoryId("");
      setPreview(null);
    }
    setError("");
  }, [editingVideo, isOpen]);

  const detectPlatformFromUrl = (url) => {
    if (/vimeo\.com\/\d+/.test(url)) return "vimeo";
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
    return null;
  };

  const handleUrlChange = (url) => {
    setForm(p => ({ ...p, youtube_url: url }));
    const detected = detectPlatformFromUrl(url);
    if (detected && detected !== form.platform) {
      setForm(p => ({ ...p, youtube_url: url, platform: detected }));
    }
  };

  const extractInfo = async () => {
    if (!form.youtube_url.trim()) return;
    setExtracting(true); setPreview(null); setError("");
    try {
      const res = await axios.post(`${API}/academia/youtube/extract`, { url: form.youtube_url }, { headers });
      if (res.data.is_valid) {
        setPreview(res.data);
        if (res.data.platform) setForm(p => ({ ...p, platform: res.data.platform }));
        if (!form.title && res.data.title) setForm(p => ({ ...p, title: res.data.title }));
      } else {
        setError(res.data.error || "URL no valida");
      }
    } catch { setError("Error al extraer datos"); }
    finally { setExtracting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (!form.youtube_url.trim()) { setError(`URL de ${form.platform === "vimeo" ? "Vimeo" : "YouTube"} requerida`); return; }
    if (!form.title.trim()) { setError("Titulo requerido"); return; }
    const categoryId = editingVideo ? moveCategoryId : autoCategoryId;
    const subcategoryId = editingVideo ? moveSubcategoryId : autoSubcategoryId;
    if (!categoryId) { setError("No hay categoria seleccionada"); return; }
    setSaving(true);
    try {
      if (editingVideo) {
        const updatePayload = { ...form };
        // Include category/subcategory if changed
        if (moveCategoryId !== editingVideo.category_id || moveSubcategoryId !== (editingVideo.subcategory_id || "")) {
          updatePayload.category_id = moveCategoryId;
          updatePayload.subcategory_id = moveSubcategoryId || null;
        }
        await axios.put(`${API}/academia/videos/${editingVideo.id}`, updatePayload, { headers });
        toast.success("Video actualizado");
      } else {
        await axios.post(`${API}/academia/videos`, { ...form, category_id: categoryId, subcategory_id: subcategoryId || null }, { headers });
        toast.success("Video agregado");
      }
      onRefresh(); onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" data-testid="video-form-modal">
        <div className="bg-gradient-to-r from-[#0a1628] to-[#1a2d4a] px-6 py-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">{editingVideo ? "Editar Video" : "Agregar Video"}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Platform Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1" data-testid="platform-toggle">
            <button type="button" onClick={() => setForm(p => ({ ...p, platform: "youtube" }))}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${form.platform === "youtube" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              data-testid="platform-youtube-btn">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube
            </button>
            <button type="button" onClick={() => setForm(p => ({ ...p, platform: "vimeo" }))}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${form.platform === "vimeo" ? "bg-white text-[#1ab7ea] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              data-testid="platform-vimeo-btn">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.123C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
              Vimeo
            </button>
          </div>

          {/* Category/Subcategory selector - only when editing */}
          {editingVideo && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3" data-testid="move-video-section">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">Mover a otra categoría</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                  <select
                    value={moveCategoryId}
                    onChange={e => { setMoveCategoryId(e.target.value); setMoveSubcategoryId(""); }}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    data-testid="move-category-select"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subcategoría</label>
                  <select
                    value={moveSubcategoryId}
                    onChange={e => setMoveSubcategoryId(e.target.value)}
                    disabled={!moveCategoryId || moveSubcategories.length === 0}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:bg-slate-50"
                    data-testid="move-subcategory-select"
                  >
                    <option value="">Todas / Sin subcategoría</option>
                    {moveSubcategories.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {moveCategoryId && moveCategoryId !== editingVideo.category_id && (
                <p className="text-xs text-amber-600 font-medium" data-testid="move-indicator">
                  El video se moverá a "{categories.find(c => c.id === moveCategoryId)?.name}" al guardar.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {form.platform === "vimeo" ? "URL de Vimeo *" : "URL de YouTube *"}
            </label>
            <div className="flex gap-2">
              <input type="url" value={form.youtube_url} onChange={e => handleUrlChange(e.target.value)}
                onBlur={extractInfo} placeholder={form.platform === "vimeo" ? "https://vimeo.com/123456789" : "https://www.youtube.com/watch?v=..."}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                data-testid="video-url-input" />
              <button type="button" onClick={extractInfo} disabled={extracting} className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {preview && (
            <div className="flex gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl" data-testid="video-preview">
              <img src={preview.thumbnail_url} alt="" className="w-24 h-16 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{form.title || preview.title}</p>
                <p className="text-[10px] text-emerald-600 mt-1">
                  {(preview.platform || form.platform) === "vimeo" ? "Vimeo" : "YouTube"} &middot; ID: {preview.youtube_video_id}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Titulo *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={200}
              placeholder="Titulo del video" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              data-testid="video-title-input" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripcion (opcional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              placeholder="Notas sobre el video..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
              data-testid="video-desc-input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Duracion</label>
              <input type="text" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                placeholder="4:32" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                data-testid="video-duration-input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estado</label>
              <select value={form.is_published ? "true" : "false"} onChange={e => setForm(p => ({ ...p, is_published: e.target.value === "true" }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                data-testid="video-status-select">
                <option value="false">Borrador</option>
                <option value="true">Publicado</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="save-video-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingVideo ? "Actualizar" : "Agregar Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// VIDEO PLAYER MODAL
// ═══════════════════════════════════════════════════════════
function VideoPlayerModal({ video, onClose, token, onRefresh }) {
  const headers = { Authorization: `Bearer ${token}` };
  if (!video) return null;

  const togglePublish = async () => {
    try {
      await axios.patch(`${API}/academia/videos/${video.id}/publish`, {}, { headers });
      onRefresh();
      toast.success(video.is_published ? "Despublicado" : "Publicado");
    } catch { toast.error("Error"); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" data-testid="video-player-modal">
        <div className="bg-gradient-to-r from-[#0a1628] to-[#1a2d4a] px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-bold text-white truncate flex-1 mr-4">{video.title}</h2>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-xl"
              src={video.platform === "vimeo" ? `https://player.vimeo.com/video/${video.youtube_video_id}?autoplay=1` : `https://www.youtube.com/embed/${video.youtube_video_id}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          </div>
          {video.description && <p className="text-sm text-slate-600 mt-4">{video.description}</p>}
          <div className="flex items-center gap-3 mt-4">
            <button onClick={togglePublish}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${video.is_published ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
              data-testid="toggle-publish-btn">
              {video.is_published ? "Despublicar" : "Publicar"}
            </button>
            {video.duration && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {video.duration}</span>}
            <span className="text-xs text-slate-400">{formatDate(video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function SupportAcademiaPage({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({ total_videos: 0, total_categories: 0, published_count: 0, draft_count: 0 });
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [playerVideo, setPlayerVideo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [catsRes, statsRes] = await Promise.all([
        axios.get(`${API}/academia/categories`, { headers }),
        axios.get(`${API}/academia/stats`, { headers }),
      ]);
      setCategories(catsRes.data);
      setStats(statsRes.data);
      if (!selectedCat && catsRes.data.length > 0) setSelectedCat(catsRes.data[0]);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadVideos = useCallback(async () => {
    const params = {};
    if (selectedCat) params.category_id = selectedCat.id;
    if (selectedSub) params.subcategory_id = selectedSub.id;
    if (searchText) params.search = searchText;
    try {
      const res = await axios.get(`${API}/academia/videos`, { headers, params });
      setVideos(res.data);
    } catch {}
  }, [selectedCat, selectedSub, searchText]);

  useEffect(() => { loadVideos(); }, [selectedCat, selectedSub, searchText]);

  const handleSelectCat = (cat) => {
    setSelectedCat(cat);
    setSelectedSub(null);
  };

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Eliminar "${video.title}"?`)) return;
    try {
      await axios.delete(`${API}/academia/videos/${video.id}`, { headers });
      toast.success("Video eliminado");
      loadVideos(); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Error"); }
  };

  const handleTogglePublish = async (video) => {
    try {
      const res = await axios.patch(`${API}/academia/videos/${video.id}/publish`, {}, { headers });
      toast.success(res.data.is_published ? "Video publicado" : "Video despublicado");
      loadVideos(); loadData();
    } catch { toast.error("Error"); }
  };

  return (
    <div className="space-y-6" data-testid="academia-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Academia</h1>
          <p className="text-sm text-gray-500">Centro de videos tutoriales</p>
        </div>
        <button onClick={() => setShowCatModal(true)}
          className="px-4 py-2.5 bg-[#0a1628] text-white rounded-xl text-sm font-semibold hover:bg-[#1a2d4a] transition-colors flex items-center gap-2"
          data-testid="manage-categories-btn">
          <FolderOpen className="w-4 h-4" /> Gestionar categorias
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="academia-stats">
        {[
          { label: "Total Videos", value: stats.total_videos, icon: Film, color: "text-blue-600 bg-blue-100" },
          { label: "Categorias", value: stats.total_categories, icon: FolderOpen, color: "text-emerald-600 bg-emerald-100" },
          { label: "Publicados", value: stats.published_count, icon: Globe, color: "text-green-600 bg-green-100" },
          { label: "Borradores", value: stats.draft_count, icon: Edit2, color: "text-amber-600 bg-amber-100" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar videos por titulo..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          data-testid="academia-search" />
      </div>

      {/* 2-column layout */}
      <div className="flex gap-6">
        {/* Left: Categories */}
        <div className="w-[280px] flex-shrink-0 hidden lg:block">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-24" data-testid="categories-panel">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Categorias</span>
              <button onClick={() => setShowCatModal(true)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div> :
                categories.length === 0 ? <p className="text-center text-xs text-slate-400 py-6">Sin categorias</p> :
                categories.map(cat => (
                  <div key={cat.id}>
                    <button onClick={() => handleSelectCat(cat)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-100 ${
                        selectedCat?.id === cat.id ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-slate-700"
                      }`} data-testid={`cat-btn-${cat.id}`}>
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${selectedCat?.id === cat.id ? "text-emerald-500" : "text-slate-400"}`} />
                      <span className="text-sm font-medium flex-1 truncate">{cat.name}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${selectedCat?.id === cat.id ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-500"}`}>
                        {cat.video_count}
                      </span>
                    </button>
                    {/* Subcategories as vertical list */}
                    {selectedCat?.id === cat.id && cat.subcategories?.length > 0 && (
                      <div className="bg-emerald-50/50 border-b border-slate-100">
                        <button onClick={() => setSelectedSub(null)}
                          className={`w-full text-left pl-11 pr-4 py-2 flex items-center gap-2 text-[12px] font-medium transition-colors ${
                            !selectedSub ? "text-emerald-700 bg-emerald-100/60" : "text-slate-500 hover:text-slate-700 hover:bg-emerald-50"
                          }`}
                          data-testid="sub-all-btn">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${!selectedSub ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className="flex-1">Todos</span>
                          <span className="text-[10px] text-slate-400">{cat.video_count}</span>
                        </button>
                        {cat.subcategories.map(sub => (
                          <button key={sub.id} onClick={() => setSelectedSub(sub)}
                            className={`w-full text-left pl-11 pr-4 py-2 flex items-center gap-2 text-[12px] font-medium transition-colors ${
                              selectedSub?.id === sub.id ? "text-emerald-700 bg-emerald-100/60" : "text-slate-500 hover:text-slate-700 hover:bg-emerald-50"
                            }`}
                            data-testid={`sub-btn-${sub.id}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedSub?.id === sub.id ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className="flex-1">{sub.name}</span>
                            <span className="text-[10px] text-slate-400">{sub.video_count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Right: Videos Grid */}
        <div className="flex-1 min-w-0">
          {selectedCat && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedCat.name}</h2>
                <p className="text-xs text-slate-400">
                  {videos.length} video{videos.length !== 1 ? "s" : ""}
                  {selectedSub && <span> en {selectedSub.name}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Mobile category selector */}
          <div className="lg:hidden mb-4">
            <select value={selectedCat?.id || ""} onChange={e => { const c = categories.find(x => x.id === e.target.value); if (c) handleSelectCat(c); }}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" data-testid="mobile-cat-select">
              {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.video_count})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="videos-grid">
            {videos.map(v => (
              <div key={v.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group" data-testid={`video-card-${v.id}`}>
                <div className="relative cursor-pointer" onClick={() => setPlayerVideo(v)}>
                  <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover bg-slate-100" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <Play className="w-5 h-5 text-slate-800 ml-0.5" />
                    </div>
                  </div>
                  {v.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">{v.duration}</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 flex-1">{v.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${v.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {v.is_published ? "Publicado" : "Borrador"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{formatDate(v.created_at)}</p>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                    <button onClick={() => setPlayerVideo(v)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" data-testid={`view-video-${v.id}`}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingVideo(v); setShowVideoModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" data-testid={`edit-video-${v.id}`}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleTogglePublish(v)}
                      className={`p-1.5 rounded-lg ${v.is_published ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}
                      data-testid={`publish-video-${v.id}`} title={v.is_published ? "Despublicar" : "Publicar"}>
                      <Globe className="w-4 h-4" />
                    </button>
                    <button onClick={async () => {
                      const url = v.youtube_url;
                      if (navigator.share) {
                        try { await navigator.share({ title: v.title, url }); } catch {}
                      } else {
                        try { await navigator.clipboard.writeText(url); toast.success("Enlace copiado al portapapeles"); } catch { toast.error("No se pudo copiar el enlace"); }
                      }
                    }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" data-testid={`share-video-${v.id}`} title="Compartir enlace de YouTube">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteVideo(v)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-auto" data-testid={`delete-video-${v.id}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add video card */}
            <div onClick={() => { setEditingVideo(null); setShowVideoModal(true); }}
              className="bg-white rounded-xl border-2 border-dashed border-slate-300 overflow-hidden hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[240px] group"
              data-testid="add-video-card">
              <div className="w-14 h-14 bg-slate-100 group-hover:bg-emerald-100 rounded-full flex items-center justify-center mb-3 transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-500 group-hover:text-emerald-700">Agregar video</p>
              <p className="text-xs text-slate-400 mt-1">Pega un link de YouTube</p>
            </div>
          </div>

          {!selectedCat && !loading && (
            <div className="text-center py-12">
              <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Selecciona una categoria para ver los videos</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CategoryManagerModal isOpen={showCatModal} onClose={() => setShowCatModal(false)} token={token} onRefresh={loadData} />
      <VideoFormModal isOpen={showVideoModal} onClose={() => { setShowVideoModal(false); setEditingVideo(null); }} token={token}
        categories={categories} editingVideo={editingVideo} onRefresh={() => { loadVideos(); loadData(); }}
        autoCategoryId={selectedCat?.id} autoSubcategoryId={selectedSub?.id} />
      <VideoPlayerModal video={playerVideo} onClose={() => { setPlayerVideo(null); loadVideos(); }} token={token} onRefresh={() => { loadVideos(); loadData(); }} />
    </div>
  );
}
