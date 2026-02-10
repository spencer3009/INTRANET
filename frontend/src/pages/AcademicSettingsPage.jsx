import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  BookMarked, GraduationCap, Calendar, Clock,
  Plus, Pencil, Trash2, MoreVertical, Loader2, Check, X,
  BookOpen, Users, ChevronRight, ArrowLeft, Camera,
  AlertCircle, Layers
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Shift color options
const SHIFT_COLORS = [
  { value: "#3B82F6", label: "Azul", class: "bg-blue-500" },
  { value: "#10B981", label: "Verde", class: "bg-emerald-500" },
  { value: "#F59E0B", label: "Amarillo", class: "bg-amber-500" },
  { value: "#EF4444", label: "Rojo", class: "bg-red-500" },
  { value: "#8B5CF6", label: "Violeta", class: "bg-violet-500" },
  { value: "#EC4899", label: "Rosa", class: "bg-pink-500" },
  { value: "#06B6D4", label: "Cyan", class: "bg-cyan-500" },
  { value: "#6366F1", label: "Indigo", class: "bg-indigo-500" },
];

// Academic settings categories
const ACADEMIC_CATEGORIES = [
  {
    id: "niveles",
    label: "Niveles Educativos",
    description: "Inicial, Primaria, Secundaria",
    icon: GraduationCap,
    color: "from-blue-500 to-indigo-600",
    lightColor: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  {
    id: "grados",
    label: "Grados",
    description: "1°, 2°, 3°, 4°, 5°, 6°",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-600",
    lightColor: "from-emerald-50 to-teal-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-100"
  },
  {
    id: "secciones",
    label: "Secciones",
    description: "A, B, C, D",
    icon: Users,
    color: "from-purple-500 to-pink-600",
    lightColor: "from-purple-50 to-pink-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  {
    id: "turnos",
    label: "Turnos",
    description: "Mañana, Tarde, Noche",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
    lightColor: "from-amber-50 to-orange-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    bgColor: "bg-amber-100"
  },
  {
    id: "periodos",
    label: "Períodos Académicos",
    description: "Bimestres, Trimestres, Semestres",
    icon: Calendar,
    color: "from-rose-500 to-red-600",
    lightColor: "from-rose-50 to-red-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-600",
    bgColor: "bg-rose-100"
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// LEVEL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function LevelModal({ isOpen, onClose, token, level, onSuccess }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", descripcion: "", imagen_url: "", activo: true });
  const isEdit = !!level;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      setForm(level ? { nombre: level.nombre || "", descripcion: level.descripcion || "", imagen_url: level.imagen_url || "", activo: level.activo !== false } : { nombre: "", descripcion: "", imagen_url: "", activo: true });
      setError("");
    }
  }, [isOpen, level]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/academic`, { headers });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", folder);
      const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, formData);
      setForm(prev => ({ ...prev, imagen_url: uploadRes.data.secure_url }));
    } catch { setError("Error al subir imagen"); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true);
    try {
      const res = isEdit ? await axios.put(`${API}/academic/levels/${level.id}`, form, { headers }) : await axios.post(`${API}/academic/levels`, form, { headers });
      onSuccess(res.data.level, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-white" />
              <div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Nivel</h2></div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 flex flex-col items-center justify-center text-blue-600 hover:border-blue-500 overflow-hidden">
                  {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : form.imagen_url ? <img src={form.imagen_url} alt="" className="w-full h-full object-cover" /> : <><Camera className="w-8 h-8 mb-1" /><span className="text-xs">Subir imagen</span></>}
                </button>
                {form.imagen_url && <button type="button" onClick={() => setForm(p => ({ ...p, imagen_url: "" }))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button>}
              </div>
            </div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: Primaria" required /></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl resize-none" rows={3} /></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-blue-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GRADE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function GradeModal({ isOpen, onClose, token, grade, levels, onSuccess, preselectedLevelId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", nivel_id: "", orden: 0, activo: true });
  const isEdit = !!grade;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      setForm(grade ? { nombre: grade.nombre || "", nivel_id: grade.nivel_id || "", orden: grade.orden || 0, activo: grade.activo !== false } : { nombre: "", nivel_id: preselectedLevelId || "", orden: 0, activo: true });
      setError("");
    }
  }, [isOpen, grade, preselectedLevelId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.nivel_id) { setError("Selecciona un nivel"); return; }
    setLoading(true);
    try {
      const res = isEdit ? await axios.put(`${API}/academic/grades/${grade.id}`, form, { headers }) : await axios.post(`${API}/academic/grades`, form, { headers });
      onSuccess(res.data.grade, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><BookOpen className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Grado</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nivel <span className="text-red-500">*</span></label><select value={form.nivel_id} onChange={(e) => setForm(p => ({ ...p, nivel_id: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required><option value="">Seleccionar...</option>{levels.filter(l => l.activo).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: 1°" required /></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Orden</label><input type="number" value={form.orden} onChange={(e) => setForm(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" min={0} /><p className="text-xs text-slate-500 mt-1">0 = automático</p></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SectionModal({ isOpen, onClose, token, section, grades, levels, onSuccess, preselectedGradeId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [form, setForm] = useState({ nombre: "", grado_id: "", capacidad_maxima: "", activo: true });
  const isEdit = !!section;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (section) {
        setForm({ nombre: section.nombre || "", grado_id: section.grado_id || "", capacidad_maxima: section.capacidad_maxima || "", activo: section.activo !== false });
        setSelectedLevelId(section.nivel_id || "");
      } else {
        const preGrade = grades.find(g => g.id === preselectedGradeId);
        setForm({ nombre: "", grado_id: preselectedGradeId || "", capacidad_maxima: "", activo: true });
        setSelectedLevelId(preGrade?.nivel_id || "");
      }
      setError("");
    }
  }, [isOpen, section, preselectedGradeId, grades]);

  const filteredGrades = selectedLevelId ? grades.filter(g => g.nivel_id === selectedLevelId && g.activo) : grades.filter(g => g.activo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.grado_id) { setError("Selecciona un grado"); return; }
    setLoading(true);
    try {
      const submitData = { ...form, capacidad_maxima: form.capacidad_maxima ? parseInt(form.capacidad_maxima) : null };
      const res = isEdit ? await axios.put(`${API}/academic/sections/${section.id}`, submitData, { headers }) : await axios.post(`${API}/academic/sections`, submitData, { headers });
      onSuccess(res.data.section, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><Users className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nueva"} Sección</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Filtrar por Nivel</label><select value={selectedLevelId} onChange={(e) => { setSelectedLevelId(e.target.value); setForm(p => ({ ...p, grado_id: "" })); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"><option value="">Todos los niveles</option>{levels.filter(l => l.activo).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Grado <span className="text-red-500">*</span></label><select value={form.grado_id} onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required><option value="">Seleccionar...</option>{filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>)}</select></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: A, B, C" required /></div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Capacidad máxima</label><input type="number" value={form.capacidad_maxima} onChange={(e) => setForm(p => ({ ...p, capacidad_maxima: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: 30" min={1} /><p className="text-xs text-slate-500 mt-1">Opcional - Cantidad máxima de estudiantes</p></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activa" : "Inactiva"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-purple-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHIFT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ShiftModal({ isOpen, onClose, token, shift, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", hora_inicio: "07:00", hora_fin: "12:00", color: "#3B82F6", activo: true });
  const isEdit = !!shift;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      setForm(shift ? { nombre: shift.nombre || "", hora_inicio: shift.hora_inicio || "07:00", hora_fin: shift.hora_fin || "12:00", color: shift.color || "#3B82F6", activo: shift.activo !== false } : { nombre: "", hora_inicio: "07:00", hora_fin: "12:00", color: "#3B82F6", activo: true });
      setError("");
    }
  }, [isOpen, shift]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (form.hora_inicio >= form.hora_fin) { setError("La hora de inicio debe ser menor que la hora de fin"); return; }
    setLoading(true);
    try {
      const res = isEdit ? await axios.put(`${API}/academic/shifts/${shift.id}`, form, { headers }) : await axios.post(`${API}/academic/shifts`, form, { headers });
      onSuccess(res.data.shift, isEdit ? "update" : "create");
      onClose();
    } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><Clock className="w-8 h-8 text-white" /><div className="text-white"><h2 className="text-xl font-bold">{isEdit ? "Editar" : "Nuevo"} Turno</h2></div></div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Nombre <span className="text-red-500">*</span></label><input type="text" value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Ej: Mañana" required /></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Hora inicio <span className="text-red-500">*</span></label><input type="time" value={form.hora_inicio} onChange={(e) => setForm(p => ({ ...p, hora_inicio: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Hora fin <span className="text-red-500">*</span></label><input type="time" value={form.hora_fin} onChange={(e) => setForm(p => ({ ...p, hora_fin: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
            </div>
            <div className="mb-4"><label className="block text-sm font-semibold text-slate-700 mb-2">Color</label><div className="flex flex-wrap gap-2">{SHIFT_COLORS.map(c => <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, color: c.value }))} className={`w-10 h-10 rounded-xl ${c.class} ${form.color === c.value ? "ring-2 ring-offset-2 ring-slate-400" : ""}`} />)}</div></div>
            <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl"><div><p className="font-semibold text-slate-700">Estado</p><p className="text-sm text-slate-500">{form.activo ? "Activo" : "Inactivo"}</p></div><button type="button" onClick={() => setForm(p => ({ ...p, activo: !p.activo }))} className={`relative w-14 h-8 rounded-full transition-colors ${form.activo ? "bg-amber-500" : "bg-slate-300"}`}><span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.activo ? "left-7" : "left-1"}`} /></button></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">Cancelar</button><button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{isEdit ? "Guardar" : "Crear"}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademicSettingsPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Data states
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  // Modal states
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  
  // Menu states
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("");
  
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, levelsRes, gradesRes] = await Promise.all([
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/academic/levels`, { headers }),
          axios.get(`${API}/academic/grades`, { headers })
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        setLevels(levelsRes.data);
        setGrades(gradesRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  // Load sections/shifts when category selected
  useEffect(() => {
    if (selectedCategory === "secciones") loadSections();
    if (selectedCategory === "turnos") loadShifts();
  }, [selectedCategory]);

  const loadSections = async () => {
    try { const res = await axios.get(`${API}/academic/sections`, { headers }); setSections(res.data); } catch (err) { console.error(err); }
  };
  const loadShifts = async () => {
    try { const res = await axios.get(`${API}/academic/shifts`, { headers }); setShifts(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const handleClick = () => setMenuOpen(null);
    if (menuOpen) { document.addEventListener("click", handleClick); return () => document.removeEventListener("click", handleClick); }
  }, [menuOpen]);

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  // Success handlers
  const handleLevelSuccess = (level, action) => { if (action === "create") setLevels(p => [...p, level]); else setLevels(p => p.map(l => l.id === level.id ? level : l)); };
  const handleGradeSuccess = (grade, action) => {
    if (action === "create") { setGrades(p => [...p, grade]); setLevels(p => p.map(l => l.id === grade.nivel_id ? { ...l, grade_count: (l.grade_count || 0) + 1 } : l)); }
    else setGrades(p => p.map(g => g.id === grade.id ? grade : g));
  };
  const handleSectionSuccess = (section, action) => {
    if (action === "create") { setSections(p => [...p, section]); setGrades(p => p.map(g => g.id === section.grado_id ? { ...g, section_count: (g.section_count || 0) + 1 } : g)); }
    else setSections(p => p.map(s => s.id === section.id ? section : s));
  };
  const handleShiftSuccess = (shift, action) => { if (action === "create") setShifts(p => [...p, shift]); else setShifts(p => p.map(s => s.id === shift.id ? shift : s)); };

  // Delete handlers
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/academic/${deleteTarget.type}s/${deleteTarget.item.id}`, { headers });
      if (deleteTarget.type === "level") setLevels(p => p.filter(l => l.id !== deleteTarget.item.id));
      else if (deleteTarget.type === "grade") { setGrades(p => p.filter(g => g.id !== deleteTarget.item.id)); setLevels(p => p.map(l => l.id === deleteTarget.item.nivel_id ? { ...l, grade_count: Math.max(0, (l.grade_count || 1) - 1) } : l)); }
      else if (deleteTarget.type === "section") { setSections(p => p.filter(s => s.id !== deleteTarget.item.id)); setGrades(p => p.map(g => g.id === deleteTarget.item.grado_id ? { ...g, section_count: Math.max(0, (g.section_count || 1) - 1) } : g)); }
      else if (deleteTarget.type === "shift") setShifts(p => p.filter(s => s.id !== deleteTarget.item.id));
      setShowDeleteModal(false); setDeleteTarget(null);
    } catch (err) { alert(err.response?.data?.detail || "Error al eliminar"); }
    finally { setDeleteLoading(false); }
  };

  const openDelete = (type, item) => { setDeleteTarget({ type, item }); setShowDeleteModal(true); setMenuOpen(null); };

  // Categories grid
  const renderCategoriesGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {ACADEMIC_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = cat.id === "niveles" ? levels.length : cat.id === "grados" ? grades.length : cat.id === "secciones" ? sections.length : cat.id === "turnos" ? shifts.length : 0;
        return (
          <button key={cat.id} onClick={() => !cat.disabled && setSelectedCategory(cat.id)} disabled={cat.disabled} className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${cat.borderColor} bg-gradient-to-br ${cat.lightColor} ${cat.disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${cat.color} opacity-10`} />
            {cat.disabled && <div className="absolute top-3 right-3 px-2 py-1 bg-slate-200 text-slate-500 text-xs font-medium rounded-full">Próximamente</div>}
            <div className="relative z-10">
              <div className="flex justify-center mb-4"><div className={`w-20 h-20 rounded-2xl bg-white shadow-lg p-4 border-2 ${cat.borderColor}`}><Icon className={`w-full h-full ${cat.textColor}`} /></div></div>
              <h3 className={`text-xl font-bold text-center mb-2 ${cat.textColor}`}>{cat.label}</h3>
              <div className="flex justify-center"><span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border ${cat.borderColor} ${cat.textColor} font-medium text-sm`}><span className={`w-2 h-2 rounded-full bg-gradient-to-r ${cat.color}`}></span>{cat.disabled ? cat.description : `${count} registros`}</span></div>
              {!cat.disabled && <div className="flex justify-center mt-4"><div className={`w-10 h-10 rounded-full bg-gradient-to-r ${cat.color} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0`}><ChevronRight className="w-5 h-5 text-white" /></div></div>}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Section header component
  const SectionHeader = ({ category, count, countLabel, onAdd, addLabel }) => (
    <div className={`relative overflow-hidden bg-gradient-to-r ${category.color} text-white rounded-3xl p-8 mb-8 shadow-xl`}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="relative z-10">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-white/80 hover:text-white mb-6 group"><div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30"><ArrowLeft className="w-4 h-4" /></div><span className="font-medium">Volver</span></button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center"><category.icon className={`w-14 h-14 ${category.textColor}`} /></div>
            <div><h1 className="text-4xl font-bold mb-2">{category.label}</h1><span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium">{count} {countLabel}</span></div>
          </div>
          <button onClick={onAdd} className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:shadow-xl"><div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center`}><Plus className="w-5 h-5 text-white" /></div><span>{addLabel}</span></button>
        </div>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = ({ category, message, onAdd, addLabel }) => (
    <div className={`relative overflow-hidden bg-gradient-to-br ${category.lightColor} rounded-3xl p-16 text-center border-2 ${category.borderColor}`}>
      <div className="relative z-10">
        <div className={`w-32 h-32 mx-auto mb-6 bg-white rounded-3xl shadow-lg p-6 border-2 ${category.borderColor}`}><category.icon className={`w-full h-full ${category.textColor} opacity-50`} /></div>
        <h3 className={`text-2xl font-bold ${category.textColor} mb-2`}>Sin {category.label.toLowerCase()}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{message}</p>
        {onAdd && <button onClick={onAdd} className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${category.color} text-white rounded-xl font-semibold hover:shadow-xl`}><Plus className="w-5 h-5" />{addLabel}</button>}
      </div>
    </div>
  );

  // Item card component with menu
  const ItemCard = ({ item, category, onEdit, onDelete, children, badge }) => (
    <div className={`group relative overflow-hidden bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border-2 ${category.borderColor} hover:-translate-y-1`}>
      <div className={`h-2 bg-gradient-to-r ${category.color}`}></div>
      <div className="p-6 relative">
        <div className="absolute top-2 right-2">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === item.id ? null : item.id); }} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><MoreVertical className="w-5 h-5" /></button>
          {menuOpen === item.id && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border py-2 min-w-[160px] z-10">
              <button onClick={() => { onEdit(item); setMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Pencil className="w-4 h-4 text-blue-600" /></div>Editar</button>
              <button onClick={() => onDelete(item)} className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-600" /></div>Eliminar</button>
            </div>
          )}
        </div>
        {children}
        <div className={`mt-4 pt-4 border-t ${category.borderColor} flex items-center justify-between`}>
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${item.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`w-1.5 h-1.5 rounded-full ${item.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>{item.activo ? "Activo" : "Inactivo"}</span>
          {badge}
        </div>
      </div>
    </div>
  );

  // Niveles section
  const renderNiveles = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "niveles");
    return (
      <div>
        <SectionHeader category={cat} count={levels.length} countLabel={levels.length === 1 ? "nivel" : "niveles"} onAdd={() => { setEditingLevel(null); setShowLevelModal(true); }} addLabel="Nuevo Nivel" />
        {levels.length === 0 ? <EmptyState category={cat} message="Crea el primer nivel para comenzar." onAdd={() => { setEditingLevel(null); setShowLevelModal(true); }} addLabel="Crear nivel" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map(level => (
              <ItemCard key={level.id} item={level} category={cat} onEdit={(l) => { setEditingLevel(l); setShowLevelModal(true); }} onDelete={(l) => openDelete("level", l)} badge={<span className="text-xs text-slate-500"><Layers className="w-3 h-3 inline mr-1" />{level.grade_count || 0} grados</span>}>
                <div className="flex flex-col items-center text-center mb-2">
                  <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 ${cat.borderColor} shadow-lg mb-4 bg-gradient-to-br ${cat.lightColor}`}>
                    {level.imagen_url ? <img src={level.imagen_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className={`w-10 h-10 ${cat.textColor}`} /></div>}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{level.nombre}</h3>
                  {level.descripcion && <p className="text-sm text-slate-500 line-clamp-2">{level.descripcion}</p>}
                </div>
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Grados section
  const renderGrados = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "grados");
    const filteredGrades = selectedLevelFilter ? grades.filter(g => g.nivel_id === selectedLevelFilter) : grades;
    const gradesByLevel = {};
    filteredGrades.forEach(g => { if (!gradesByLevel[g.nivel_id]) gradesByLevel[g.nivel_id] = { nivel_nombre: g.nivel_nombre, grades: [] }; gradesByLevel[g.nivel_id].grades.push(g); });

    return (
      <div>
        <SectionHeader category={cat} count={grades.length} countLabel={grades.length === 1 ? "grado" : "grados"} onAdd={() => { setEditingGrade(null); setShowGradeModal(true); }} addLabel="Nuevo Grado" />
        {levels.length > 0 && <div className="mb-6 flex flex-wrap gap-2"><button onClick={() => setSelectedLevelFilter("")} className={`px-4 py-2 rounded-xl font-medium transition-all ${!selectedLevelFilter ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>Todos</button>{levels.filter(l => l.activo).map(l => <button key={l.id} onClick={() => setSelectedLevelFilter(l.id)} className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedLevelFilter === l.id ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>{l.nombre}</button>)}</div>}
        {Object.keys(gradesByLevel).length === 0 ? <EmptyState category={cat} message={levels.length === 0 ? "Primero crea un nivel educativo." : "Crea el primer grado."} onAdd={levels.length > 0 ? () => { setEditingGrade(null); setShowGradeModal(true); } : null} addLabel="Crear grado" /> : (
          <div className="space-y-8">
            {Object.entries(gradesByLevel).map(([nivelId, data]) => (
              <div key={nivelId}>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-blue-500" />{data.nivel_nombre}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {data.grades.map(g => (
                    <div key={g.id} className={`group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border-2 ${cat.borderColor} hover:-translate-y-1 overflow-hidden`}>
                      <div className={`h-1.5 bg-gradient-to-r ${cat.color}`}></div>
                      <div className="p-4 relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === g.id ? null : g.id); }} className="absolute top-1 right-1 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></button>
                        {menuOpen === g.id && <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl border py-2 min-w-[140px] z-10"><button onClick={() => { setEditingGrade(g); setShowGradeModal(true); setMenuOpen(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-500" />Editar</button><button onClick={() => openDelete("grade", g)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />Eliminar</button></div>}
                        <div className="text-center pt-2"><div className={`w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br ${cat.lightColor} border-2 ${cat.borderColor} flex items-center justify-center`}><span className={`text-lg font-bold ${cat.textColor}`}>{g.nombre}</span></div><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${g.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`w-1 h-1 rounded-full ${g.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>{g.activo ? "Activo" : "Inactivo"}</span></div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingGrade(null); setShowGradeModal(true); }} className={`rounded-xl border-2 border-dashed ${cat.borderColor} hover:border-emerald-400 hover:bg-emerald-50 p-4 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600 min-h-[100px]`}><Plus className="w-6 h-6 mb-1" /><span className="text-xs font-medium">Agregar</span></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Secciones section
  const renderSecciones = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "secciones");
    const filteredSections = selectedLevelFilter ? sections.filter(s => s.nivel_id === selectedLevelFilter) : sections;
    const sectionsByGrade = {};
    filteredSections.forEach(s => { const key = `${s.nivel_id}-${s.grado_id}`; if (!sectionsByGrade[key]) sectionsByGrade[key] = { nivel_nombre: s.nivel_nombre, grado_nombre: s.grado_nombre, grado_id: s.grado_id, sections: [] }; sectionsByGrade[key].sections.push(s); });

    return (
      <div>
        <SectionHeader category={cat} count={sections.length} countLabel={sections.length === 1 ? "sección" : "secciones"} onAdd={() => { setEditingSection(null); setShowSectionModal(true); }} addLabel="Nueva Sección" />
        {levels.length > 0 && <div className="mb-6 flex flex-wrap gap-2"><button onClick={() => setSelectedLevelFilter("")} className={`px-4 py-2 rounded-xl font-medium transition-all ${!selectedLevelFilter ? "bg-purple-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>Todos</button>{levels.filter(l => l.activo).map(l => <button key={l.id} onClick={() => setSelectedLevelFilter(l.id)} className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedLevelFilter === l.id ? "bg-purple-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50 border"}`}>{l.nombre}</button>)}</div>}
        {Object.keys(sectionsByGrade).length === 0 ? <EmptyState category={cat} message={grades.length === 0 ? "Primero crea grados." : "Crea la primera sección."} onAdd={grades.length > 0 ? () => { setEditingSection(null); setShowSectionModal(true); } : null} addLabel="Crear sección" /> : (
          <div className="space-y-8">
            {Object.entries(sectionsByGrade).map(([key, data]) => (
              <div key={key}>
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-500" />{data.nivel_nombre} - {data.grado_nombre}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {data.sections.map(s => (
                    <div key={s.id} className={`group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border-2 ${cat.borderColor} hover:-translate-y-1 overflow-hidden`}>
                      <div className={`h-1.5 bg-gradient-to-r ${cat.color}`}></div>
                      <div className="p-4 relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === s.id ? null : s.id); }} className="absolute top-1 right-1 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></button>
                        {menuOpen === s.id && <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl border py-2 min-w-[140px] z-10"><button onClick={() => { setEditingSection(s); setShowSectionModal(true); setMenuOpen(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-500" />Editar</button><button onClick={() => openDelete("section", s)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />Eliminar</button></div>}
                        <div className="text-center pt-2">
                          <div className={`w-14 h-14 mx-auto mb-2 rounded-xl bg-gradient-to-br ${cat.lightColor} border-2 ${cat.borderColor} flex items-center justify-center`}><span className={`text-xl font-bold ${cat.textColor}`}>{s.nombre}</span></div>
                          {s.capacidad_maxima && <p className="text-xs text-slate-500 mb-1">Cap: {s.capacidad_maxima}</p>}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${s.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`w-1 h-1 rounded-full ${s.activo ? "bg-emerald-500" : "bg-slate-400"}`}></span>{s.activo ? "Activa" : "Inactiva"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingSection(null); setShowSectionModal(true); }} className={`rounded-xl border-2 border-dashed ${cat.borderColor} hover:border-purple-400 hover:bg-purple-50 p-4 flex flex-col items-center justify-center text-slate-400 hover:text-purple-600 min-h-[100px]`}><Plus className="w-6 h-6 mb-1" /><span className="text-xs font-medium">Agregar</span></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Turnos section
  const renderTurnos = () => {
    const cat = ACADEMIC_CATEGORIES.find(c => c.id === "turnos");
    return (
      <div>
        <SectionHeader category={cat} count={shifts.length} countLabel={shifts.length === 1 ? "turno" : "turnos"} onAdd={() => { setEditingShift(null); setShowShiftModal(true); }} addLabel="Nuevo Turno" />
        {shifts.length === 0 ? <EmptyState category={cat} message="Crea el primer turno para organizar horarios." onAdd={() => { setEditingShift(null); setShowShiftModal(true); }} addLabel="Crear turno" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts.map(shift => (
              <ItemCard key={shift.id} item={shift} category={cat} onEdit={(s) => { setEditingShift(s); setShowShiftModal(true); }} onDelete={(s) => openDelete("shift", s)} badge={<span className="text-sm text-slate-600 font-medium">{shift.hora_inicio} - {shift.hora_fin}</span>}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: shift.color + "20" }}><Clock className="w-8 h-8" style={{ color: shift.color }} /></div>
                  <div><h3 className="text-lg font-bold text-slate-800">{shift.nombre}</h3><p className="text-slate-500">{shift.hora_inicio} - {shift.hora_fin}</p></div>
                </div>
                <div className="mt-4 flex gap-2">{SHIFT_COLORS.map(c => <div key={c.value} className={`w-6 h-6 rounded-full ${c.class} ${shift.color === c.value ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-30"}`} />)}</div>
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" /></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar active="ajustes-academicos" onNavigate={() => {}} expanded={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} />
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {!selectedCategory && (
            <div className="relative overflow-hidden rounded-3xl mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600"><div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div></div>
              <div className="relative px-8 py-10 flex items-center gap-6"><div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl"><BookMarked className="w-10 h-10 text-indigo-600" /></div><div className="text-white"><h1 className="text-4xl font-bold tracking-tight mb-2">Ajustes Académicos</h1><p className="text-indigo-200 text-lg">Configura la estructura académica de tu institución</p></div></div>
            </div>
          )}
          {!selectedCategory && renderCategoriesGrid()}
          {selectedCategory === "niveles" && renderNiveles()}
          {selectedCategory === "grados" && renderGrados()}
          {selectedCategory === "secciones" && renderSecciones()}
          {selectedCategory === "turnos" && renderTurnos()}
        </main>
      </div>
      <LevelModal isOpen={showLevelModal} onClose={() => { setShowLevelModal(false); setEditingLevel(null); }} token={token} level={editingLevel} onSuccess={handleLevelSuccess} />
      <GradeModal isOpen={showGradeModal} onClose={() => { setShowGradeModal(false); setEditingGrade(null); }} token={token} grade={editingGrade} levels={levels} onSuccess={handleGradeSuccess} preselectedLevelId={selectedLevelFilter} />
      <SectionModal isOpen={showSectionModal} onClose={() => { setShowSectionModal(false); setEditingSection(null); }} token={token} section={editingSection} grades={grades} levels={levels} onSuccess={handleSectionSuccess} preselectedGradeId="" />
      <ShiftModal isOpen={showShiftModal} onClose={() => { setShowShiftModal(false); setEditingShift(null); }} token={token} shift={editingShift} onSuccess={handleShiftSuccess} />
      <ConfirmModal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }} onConfirm={confirmDelete} title={`Eliminar ${deleteTarget?.type === "level" ? "Nivel" : deleteTarget?.type === "grade" ? "Grado" : deleteTarget?.type === "section" ? "Sección" : "Turno"}`} message={`¿Eliminar "${deleteTarget?.item?.nombre}"? Esta acción no se puede deshacer.`} confirmText="Sí, eliminar" type="danger" loading={deleteLoading} />
    </div>
  );
}
