import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save, ArrowLeft, Loader2, Search, X, Users, FileWarning,
  Calendar, Shield, Bell, ChevronDown, Clock, Pen
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const SEV_DOT = {
  baja: "#10b981", media: "#f59e0b", alta: "#ef4444", critica: "#dc2626",
};

export default function IncidenciaFormPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const sub = user?.subdomain;

  const [enums, setEnums] = useState(null);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);

  /* Autocomplete */
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [form, setForm] = useState({
    student_id: "", grade_id: "", section_id: "",
    type: "", severity: "baja", title: "", description: "",
    occurred_at: new Date().toISOString().slice(0, 16),
    initial_action: "", confidential: false, notify_parents: false, tags: []
  });

  useEffect(() => {
    if (!token) return;
    coordinacionApi.getEnums(token).then(setEnums).catch(() => {});
    axios.get(`${API}/api/coordinacion/grades`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setGrades(r.data || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!form.grade_id || !token) { setSections([]); setStudents([]); return; }
    axios.get(`${API}/api/coordinacion/sections?grade_id=${form.grade_id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSections(r.data || []))
      .catch(() => setSections([]));
  }, [form.grade_id, token]);

  useEffect(() => {
    if (!form.section_id || !token) { setStudents([]); return; }
    axios.get(`${API}/api/coordinacion/students?section_id=${form.section_id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setStudents(r.data || []))
      .catch(() => setStudents([]));
  }, [form.section_id, token]);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleStudentSelect = (s) => {
    set("student_id", s.id);
    setSearchText(`${s.name} ${s.last_name}`);
    setShowDropdown(false);
  };

  const clearStudent = () => {
    set("student_id", "");
    setSearchText("");
  };

  const filteredStudents = students.filter(s => {
    const full = `${s.name} ${s.last_name}`.toLowerCase();
    return full.includes(searchText.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.type || !form.title) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    setSaving(true);
    try {
      const inc = await coordinacionApi.createIncidencia(token, form);
      toast.success("Incidencia creada correctamente");
      navigate(`/${sub}/coordinacion/incidencias/${inc.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear incidencia");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="px-6 md:px-8 py-8 min-h-full" data-testid="incidencia-form-page">

        {/* Back link */}
        <button
          onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a incidencias
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Nueva incidencia</h1>
          <p className="text-sm text-slate-500 mt-1">Registra un nuevo incidente de conducta o convivencia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ══════════ Section 1: Alumno ══════════ */}
          <div className="bg-white border border-slate-200 rounded-2xl" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)", overflow: "visible" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}>
                <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900">Identificación del alumno</h2>
            </div>
            <div className="p-6 overflow-visible relative" style={{ zIndex: 20 }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Grado *</label>
                  <select value={form.grade_id} onChange={e => { set("grade_id", e.target.value); set("section_id", ""); set("student_id", ""); setSearchText(""); }}
                    className={inputCls} data-testid="select-grade">
                    <option value="">Seleccionar grado</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sección *</label>
                  <select value={form.section_id} onChange={e => { set("section_id", e.target.value); set("student_id", ""); setSearchText(""); }}
                    className={inputCls} data-testid="select-section">
                    <option value="">Seleccionar sección</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                  </select>
                </div>
                {/* Student autocomplete */}
                <div ref={dropdownRef} className="relative">
                  <label className={labelCls}>Estudiante *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
                      onFocus={() => { if (students.length > 0) setShowDropdown(true); }}
                      placeholder={students.length > 0 ? "Buscar alumno..." : "Primero selecciona grado y sección"}
                      disabled={students.length === 0}
                      className={`${inputCls} pl-9 pr-9 disabled:opacity-50 disabled:cursor-not-allowed`}
                      data-testid="select-student"
                    />
                    {searchText && (
                      <button type="button" onClick={clearStudent} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showDropdown && students.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto"
                         style={{ boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}>
                      {filteredStudents.length > 0 ? filteredStudents.map(s => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => handleStudentSelect(s)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/60 transition-colors text-left border-b border-slate-50 last:border-0"
                        >
                          {s.photo_url ? (
                            <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }} />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                 style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                              <span className="text-xs font-bold text-white">{(s.name || "?").charAt(0)}{(s.last_name || "").charAt(0)}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 truncate">{s.name} {s.last_name}</div>
                          </div>
                        </button>
                      )) : (
                        <div className="px-4 py-5 text-center text-sm text-slate-400">No se encontraron alumnos</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ Section 2: Clasificación ══════════ */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 2px 8px rgba(245,158,11,0.25)" }}>
                <FileWarning className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900">Clasificación</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tipo de incidencia *</label>
                  <select value={form.type} onChange={e => set("type", e.target.value)}
                    className={inputCls} data-testid="select-type">
                    <option value="">Seleccionar tipo</option>
                    {enums?.types?.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Severidad *</label>
                  <div className="relative">
                    <div
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ background: SEV_DOT[form.severity] || "#10b981", boxShadow: `0 0 0 3px ${SEV_DOT[form.severity] || "#10b981"}22` }}
                    />
                    <select value={form.severity} onChange={e => set("severity", e.target.value)}
                      className={`${inputCls} pl-9`} data-testid="select-severity">
                      {enums?.severities?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ Section 3: Detalle ══════════ */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.25)" }}>
                <Pen className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900">Detalle del incidente</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Título *</label>
                <input type="text" maxLength={140} value={form.title} onChange={e => set("title", e.target.value)}
                  placeholder="Descripción breve del incidente"
                  className={inputCls} data-testid="input-title" />
                <p className="text-xs text-slate-400 mt-1 text-right tabular-nums">{form.title.length}/140</p>
              </div>
              <div>
                <label className={labelCls}>Descripción detallada *</label>
                <textarea rows={5} maxLength={4000} value={form.description} onChange={e => set("description", e.target.value)}
                  placeholder="Detalla los hechos, contexto, personas involucradas..."
                  className={`${inputCls} resize-none`} data-testid="input-description" />
                <p className="text-xs text-slate-400 mt-1 text-right tabular-nums">{form.description.length}/4000</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha y hora del incidente</label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="datetime-local" value={form.occurred_at} onChange={e => set("occurred_at", e.target.value)}
                      className={`${inputCls} pl-10`} data-testid="input-occurred-at" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Acción inmediata tomada</label>
                  <input type="text" value={form.initial_action} onChange={e => set("initial_action", e.target.value)}
                    placeholder="Ej: Se separó al alumno, se llamó a los padres..."
                    className={inputCls} data-testid="input-initial-action" />
                </div>
              </div>
            </div>
          </div>

          {/* ══════════ Section 4: Opciones ══════════ */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 2px 8px rgba(16,185,129,0.25)" }}>
                <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900">Opciones</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4">
                {/* Confidencial toggle */}
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-200 cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                  <input type="checkbox" checked={form.confidential} onChange={e => set("confidential", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" data-testid="check-confidential" />
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-slate-700">Confidencial</span>
                  </div>
                </label>
                {/* Notificar padres toggle */}
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-200 cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                  <input type="checkbox" checked={form.notify_parents} onChange={e => set("notify_parents", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" data-testid="check-notify-parents" />
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-slate-700">Notificar a padres</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ══════════ Action buttons ══════════ */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
              className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 text-sm"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 14px rgba(99,102,241,0.30)" }}
              data-testid="submit-incidencia">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando..." : "Crear incidencia"}
            </button>
          </div>
        </form>
      </div>
    </CoordinacionLayout>
  );
}
