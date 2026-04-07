import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function IncidenciaFormPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const sub = user?.subdomain;

  const [enums, setEnums] = useState(null);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    student_id: "", grade_id: "", section_id: "",
    type: "", severity: "baja", title: "", description: "",
    occurred_at: new Date().toISOString().slice(0, 16),
    initial_action: "", confidential: false, notify_parents: false, tags: []
  });

  useEffect(() => {
    if (!token) return;
    coordinacionApi.getEnums(token).then(setEnums).catch(() => {});
    // Load grades from coordinacion endpoint
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

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

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

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="max-w-3xl mx-auto space-y-5" data-testid="incidencia-form-page">
        <button
          onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a incidencias
        </button>

        <h1 className="text-2xl font-bold text-slate-800">Nueva incidencia</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          {/* Grade + Section + Student */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grado *</label>
              <select value={form.grade_id} onChange={e => { set("grade_id", e.target.value); set("section_id", ""); set("student_id", ""); }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="select-grade">
                <option value="">Seleccionar...</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Seccion *</label>
              <select value={form.section_id} onChange={e => { set("section_id", e.target.value); set("student_id", ""); }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="select-section">
                <option value="">Seleccionar...</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estudiante *</label>
              <select value={form.student_id} onChange={e => set("student_id", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="select-student">
                <option value="">Seleccionar...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>)}
              </select>
            </div>
          </div>

          {/* Type + Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo de incidencia *</label>
              <select value={form.type} onChange={e => set("type", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="select-type">
                <option value="">Seleccionar...</option>
                {enums?.types?.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Severidad *</label>
              <select value={form.severity} onChange={e => set("severity", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="select-severity">
                {enums?.severities?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Titulo *</label>
            <input type="text" maxLength={140} value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Descripcion breve del incidente"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="input-title" />
            <p className="text-xs text-slate-400 mt-1 text-right">{form.title.length}/140</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripcion detallada *</label>
            <textarea rows={5} maxLength={4000} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Detalla los hechos, contexto, personas involucradas..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none" data-testid="input-description" />
            <p className="text-xs text-slate-400 mt-1 text-right">{form.description.length}/4000</p>
          </div>

          {/* Date + Initial action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha y hora del incidente</label>
              <input type="datetime-local" value={form.occurred_at} onChange={e => set("occurred_at", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="input-occurred-at" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Accion inmediata tomada</label>
              <input type="text" value={form.initial_action} onChange={e => set("initial_action", e.target.value)}
                placeholder="Ej: Se separo al alumno, se llamo a los padres..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" data-testid="input-initial-action" />
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.confidential} onChange={e => set("confidential", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600" data-testid="check-confidential" />
              <span className="text-sm text-slate-700">Confidencial</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.notify_parents} onChange={e => set("notify_parents", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600" data-testid="check-notify-parents" />
              <span className="text-sm text-slate-700">Notificar a padres</span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
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
