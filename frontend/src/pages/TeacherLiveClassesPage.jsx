import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import StudentHeader from "../components/StudentHeader";
import {
  Video, Plus, Calendar, Clock, ExternalLink, Users, Trash2, Edit3,
  Loader2, AlertCircle, CheckCircle, X, Link as LinkIcon, Monitor
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLATFORMS = [
  { id: "meet", label: "Google Meet", color: "text-green-600 bg-green-50" },
  { id: "zoom", label: "Zoom", color: "text-blue-600 bg-blue-50" },
  { id: "otro", label: "Otro enlace", color: "text-slate-600 bg-slate-50" },
];

function StatusBadge({ status }) {
  const map = {
    scheduled: { label: "Programada", cls: "bg-blue-100 text-blue-700" },
    active: { label: "En vivo", cls: "bg-emerald-100 text-emerald-700 animate-pulse" },
    finished: { label: "Finalizada", cls: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] || map.scheduled;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.cls}`} data-testid={`status-${status}`}>{s.label}</span>;
}

function ClassFormModal({ isOpen, onClose, onSave, courses, editData }) {
  const [form, setForm] = useState({ title: "", description: "", subject_id: "", section_id: "", date: "", start_time: "", end_time: "", meeting_link: "", platform: "meet" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editData) {
      setForm({ title: editData.title || "", description: editData.description || "", subject_id: editData.subject_id || "", section_id: editData.section_id || "", date: editData.date || "", start_time: editData.start_time || "", end_time: editData.end_time || "", meeting_link: editData.meeting_link || "", platform: editData.platform || "meet" });
    } else {
      setForm({ title: "", description: "", subject_id: "", section_id: "", date: "", start_time: "", end_time: "", meeting_link: "", platform: "meet" });
    }
    setError("");
  }, [editData, isOpen]);

  const handleCourseChange = (e) => {
    const val = e.target.value;
    if (!val) { setForm(f => ({ ...f, subject_id: "", section_id: "" })); return; }
    const [subjectId, sectionId] = val.split("__");
    setForm(f => ({ ...f, subject_id: subjectId, section_id: sectionId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.subject_id || !form.date || !form.start_time || !form.end_time || !form.meeting_link.trim()) {
      setError("Completa todos los campos obligatorios"); return;
    }
    if (form.start_time >= form.end_time) {
      setError("La hora de inicio debe ser menor que la de fin"); return;
    }
    setSaving(true); setError("");
    try { await onSave(form); onClose(); } catch (err) { setError(err.response?.data?.detail || "Error al guardar"); } finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="class-form-modal">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-slate-800">{editData ? "Editar Clase" : "Programar Clase"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título de la clase *</label>
            <input data-testid="class-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none" placeholder="Ej: Clase de repaso - Ecuaciones" />
          </div>
          {!editData && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Curso / Asignatura *</label>
              <select data-testid="class-course" value={form.subject_id ? `${form.subject_id}__${form.section_id}` : ""} onChange={handleCourseChange} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none bg-white">
                <option value="">Selecciona un curso</option>
                {courses.map(c => (
                  <option key={`${c.id}__${c.section_id}`} value={`${c.id}__${c.section_id}`}>
                    {c.name} — {c.section_name || c.grade_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha *</label>
              <input data-testid="class-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Inicio *</label>
                <input data-testid="class-start" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Fin *</label>
                <input data-testid="class-end" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Plataforma</label>
            <div className="flex gap-2">
              {PLATFORMS.map(p => (
                <button key={p.id} type="button" onClick={() => setForm(f => ({ ...f, platform: p.id }))} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${form.platform === p.id ? `${p.color} border-current` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`} data-testid={`platform-${p.id}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Enlace de la reunión *</label>
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <input data-testid="class-link" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none" placeholder="https://meet.google.com/abc-defg-hij" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción (opcional)</label>
            <textarea data-testid="class-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none resize-none" placeholder="Temas a tratar..." />
          </div>
          <button type="submit" disabled={saving} data-testid="class-save-btn" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {editData ? "Guardar cambios" : "Programar clase"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AttendancePanel({ classId, token }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/live-classes/${classId}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
        setRecords(data.attendance || []);
      } catch { setRecords([]); }
      setLoading(false);
    })();
  }, [classId, token]);

  if (loading) return <div className="flex items-center gap-2 py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Cargando asistencia...</div>;
  if (!records.length) return <p className="text-sm text-slate-400 py-4">Aún no hay alumnos conectados.</p>;

  return (
    <div className="space-y-2" data-testid="attendance-panel">
      <p className="text-sm font-semibold text-slate-600 mb-2">Asistencia en vivo ({records.length})</p>
      {records.map(r => (
        <div key={r.id} className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl">
          {r.student_photo ? <img src={r.student_photo} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-xs font-bold">{(r.student_name || "A")[0]}</div>}
          <span className="text-sm font-medium text-slate-700 flex-1">{r.student_name}</span>
          <span className="text-xs text-slate-400">{r.join_time}</span>
        </div>
      ))}
    </div>
  );
}

export default function TeacherLiveClassesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/live-classes`, { headers });
      setClasses(data.classes || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/teacher/courses`, { headers });
      setCourses(data.courses || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchClasses(); fetchCourses(); }, [fetchClasses, fetchCourses]);

  const handleSave = async (form) => {
    if (editData) {
      await axios.put(`${API}/live-classes/${editData.id}`, form, { headers });
    } else {
      await axios.post(`${API}/live-classes`, form, { headers });
    }
    setEditData(null);
    fetchClasses();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta clase?")) return;
    try { await axios.delete(`${API}/live-classes/${id}`, { headers }); fetchClasses(); } catch { /* ignore */ }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayClasses = classes.filter(c => c.date === today);
  const upcomingClasses = classes.filter(c => c.date > today);
  const pastClasses = classes.filter(c => c.date < today);

  return (
    <div className="flex min-h-screen bg-slate-50" data-testid="teacher-live-classes-page">
      <TeacherSidebar active="clases-en-vivo" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={user?.school_name} subdomain={subdomain || user?.subdomain} user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader title="Clases en Vivo" onMenuToggle={() => setSidebarExpanded(!sidebarExpanded)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3" data-testid="page-title">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center"><Video className="w-5 h-5 text-sky-600" /></div>
                Clases en Vivo
              </h1>
              <p className="text-sm text-slate-500 mt-1">Programa clases virtuales con Google Meet o Zoom</p>
            </div>
            <button onClick={() => { setEditData(null); setShowForm(true); }} data-testid="create-class-btn" className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Programar Clase
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando clases...</div>
          ) : classes.length === 0 ? (
            <div className="text-center py-20">
              <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">No hay clases programadas</h3>
              <p className="text-sm text-slate-400 mb-6">Programa tu primera clase virtual para tus alumnos</p>
              <button onClick={() => { setEditData(null); setShowForm(true); }} className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm rounded-xl transition-colors">Programar Clase</button>
            </div>
          ) : (
            <div className="space-y-8">
              {todayClasses.length > 0 && <ClassSection title="Hoy" classes={todayClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onEdit={c => { setEditData(c); setShowForm(true); }} onDelete={handleDelete} token={token} />}
              {upcomingClasses.length > 0 && <ClassSection title="Próximas" classes={upcomingClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onEdit={c => { setEditData(c); setShowForm(true); }} onDelete={handleDelete} token={token} />}
              {pastClasses.length > 0 && <ClassSection title="Anteriores" classes={pastClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onEdit={c => { setEditData(c); setShowForm(true); }} onDelete={handleDelete} token={token} />}
            </div>
          )}
        </main>
        <MobileBottomNav role="teacher" active="clases-en-vivo" subdomain={subdomain || user?.subdomain} />
      </div>
      <ClassFormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditData(null); }} onSave={handleSave} courses={courses} editData={editData} />
    </div>
  );
}

function ClassSection({ title, classes, expandedClass, setExpandedClass, onEdit, onDelete, token }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">
        {classes.map(c => (
          <ClassCard key={c.id} cls={c} isExpanded={expandedClass === c.id} onToggle={() => setExpandedClass(expandedClass === c.id ? null : c.id)} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} token={token} />
        ))}
      </div>
    </div>
  );
}

function ClassCard({ cls, isExpanded, onToggle, onEdit, onDelete, token }) {
  const platform = PLATFORMS.find(p => p.id === cls.platform) || PLATFORMS[2];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow" data-testid={`class-card-${cls.id}`}>
      <div className="p-4 sm:p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <StatusBadge status={cls.status} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platform.color}`}>{platform.label}</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 truncate">{cls.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{cls.subject_name} — {cls.section_name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{cls.date}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{cls.start_time} - {cls.end_time}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
          <span className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" />{cls.attendance_count || 0} asistentes</span>
          {cls.status !== "finished" && (
            <a href={cls.meeting_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 ml-auto">
              <ExternalLink className="w-3.5 h-3.5" />Abrir enlace
            </a>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50">
          {cls.description && <p className="text-sm text-slate-600 mb-4">{cls.description}</p>}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={e => { e.stopPropagation(); onEdit(); }} data-testid={`edit-class-${cls.id}`} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" />Editar</button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }} data-testid={`delete-class-${cls.id}`} className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Eliminar</button>
          </div>
          <AttendancePanel classId={cls.id} token={token} />
        </div>
      )}
    </div>
  );
}
