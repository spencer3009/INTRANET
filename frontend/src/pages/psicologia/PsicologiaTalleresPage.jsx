import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import {
  ArrowLeft, Plus, Search, Calendar, Clock, Users, MapPin,
  ChevronRight, X, Check, Eye, Edit2, Trash2, Tag, Target,
  BookOpen, Save, Camera
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CAT_LABELS = {
  manejo_emociones: "Manejo de emociones", prevencion_bullying: "Prevencion bullying",
  autoestima: "Autoestima", habilidades_sociales: "Hab. sociales",
  orientacion_vocacional: "Orient. vocacional", habitos_estudio: "Hab. estudio",
  sexualidad: "Ed. sexual", prevencion_drogas: "Prev. drogas",
  convivencia: "Convivencia", otro: "Otro"
};

const CAT_COLORS = {
  manejo_emociones: "bg-violet-100 text-violet-700", prevencion_bullying: "bg-red-100 text-red-700",
  autoestima: "bg-amber-100 text-amber-700", habilidades_sociales: "bg-blue-100 text-blue-700",
  orientacion_vocacional: "bg-emerald-100 text-emerald-700", habitos_estudio: "bg-cyan-100 text-cyan-700",
  sexualidad: "bg-pink-100 text-pink-700", prevencion_drogas: "bg-orange-100 text-orange-700",
  convivencia: "bg-teal-100 text-teal-700", otro: "bg-gray-100 text-gray-700"
};

const STATUS_LABELS = { planificado: "Planificado", en_curso: "En curso", completado: "Completado", cancelado: "Cancelado" };
const STATUS_COLORS = { planificado: "bg-blue-100 text-blue-700", en_curso: "bg-amber-100 text-amber-700", completado: "bg-green-100 text-green-700", cancelado: "bg-red-100 text-red-700" };

export default function PsicologiaTalleresPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [workshops, setWorkshops] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWs, setSelectedWs] = useState(null);
  const [editingWs, setEditingWs] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const fetchWorkshops = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (tab) params.append("status", tab);
      if (catFilter) params.append("category", catFilter);
      const res = await fetch(`${API}/v1/psychology/workshops?${params}`, { headers });
      if (res.ok) { const d = await res.json(); setWorkshops(d.workshops || []); setTotal(d.total || 0); }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, catFilter, page]);

  useEffect(() => { fetchWorkshops(); }, [fetchWorkshops]);

  const deleteWorkshop = async (id) => {
    if (!window.confirm("Eliminar este taller?")) return;
    try { await fetch(`${API}/v1/psychology/workshops/${id}`, { method: "DELETE", headers }); fetchWorkshops(); setSelectedWs(null); } catch(e) {}
  };

  const startWorkshop = async (id) => {
    try { await fetch(`${API}/v1/psychology/workshops/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ status: "en_curso" }) }); fetchWorkshops(); } catch(e) {}
  };

  const onSaved = () => { setShowCreate(false); setEditingWs(null); fetchWorkshops(); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50" data-testid="psicologia-talleres">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(getSchoolPath("/psicologia"))} className="p-2 hover:bg-slate-100 rounded-xl" data-testid="back-btn">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Talleres Grupales</h1>
            <p className="text-xs text-slate-500">{total} talleres</p>
          </div>
          <button onClick={() => { setEditingWs(null); setShowCreate(true); }}
            className="px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-xl hover:bg-violet-700 flex items-center gap-1.5"
            data-testid="new-workshop-btn">
            <Plus className="w-3.5 h-3.5" /> Nuevo taller
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Tabs & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-0.5 flex-shrink-0">
            {[{v:"",l:"Todos"},{v:"planificado",l:"Planificados"},{v:"completado",l:"Completados"},{v:"cancelado",l:"Cancelados"}].map(t => (
              <button key={t.v} onClick={() => { setTab(t.v); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg ${tab === t.v ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t.l}</button>
            ))}
          </div>
          <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="cat-filter">
            <option value="">Todas las categorias</option>
            {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Workshop Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 animate-pulse h-40" />)}
          </div>
        ) : workshops.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay talleres</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workshops.map(ws => {
              const catColor = CAT_COLORS[ws.topic_category] || CAT_COLORS.otro;
              const sColor = STATUS_COLORS[ws.status] || STATUS_COLORS.planificado;
              const dt = new Date(ws.date);
              return (
                <button key={ws.id} onClick={() => setSelectedWs(ws)}
                  className="bg-white rounded-2xl border border-slate-200/60 p-5 text-left hover:shadow-lg hover:border-slate-300 transition-all group"
                  data-testid={`workshop-${ws.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${catColor}`}>{CAT_LABELS[ws.topic_category] || ws.topic_category}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${sColor}`}>{STATUS_LABELS[ws.status]}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2 line-clamp-2">{ws.title}</h3>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{dt.toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</div>
                    <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })} - {ws.duration_minutes} min</div>
                    {ws.target_level && <div className="flex items-center gap-1.5"><Target className="w-3 h-3" />{ws.target_level} {ws.target_grades?.length ? `(${ws.target_grades.join(", ")})` : ""}</div>}
                    {ws.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{ws.location}</div>}
                  </div>
                  {ws.status === "completado" && ws.actual_attendees != null && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-green-600">{ws.actual_attendees}/{ws.expected_attendees || "?"} asistentes</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selectedWs && (
        <WorkshopDetail
          ws={selectedWs}
          token={token}
          onClose={() => setSelectedWs(null)}
          onEdit={() => { setEditingWs(selectedWs); setShowCreate(true); setSelectedWs(null); }}
          onDelete={() => deleteWorkshop(selectedWs.id)}
          onStart={() => { startWorkshop(selectedWs.id); setSelectedWs(null); }}
          onRefresh={() => { fetchWorkshops(); setSelectedWs(null); }}
        />
      )}

      {showCreate && (
        <WorkshopModal token={token} editing={editingWs} onSaved={onSaved} onClose={() => { setShowCreate(false); setEditingWs(null); }} />
      )}
    </div>
  );
}

function WorkshopDetail({ ws, token, onClose, onEdit, onDelete, onStart, onRefresh }) {
  const [attendees, setAttendees] = useState(ws.attendee_list || []);
  const [observations, setObservations] = useState(ws.observations || "");
  const [outcomes, setOutcomes] = useState(ws.outcomes || "");
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const dt = new Date(ws.date);

  const saveAttendance = async () => {
    setSaving(true);
    try { await fetch(`${API}/v1/psychology/workshops/${ws.id}/attendance`, { method: "PUT", headers, body: JSON.stringify({ attendee_list: attendees }) }); } catch(e) {}
    finally { setSaving(false); }
  };

  const completeWorkshop = async () => {
    setSaving(true);
    try {
      const actual = attendees.filter(a => a.attended).length;
      await fetch(`${API}/v1/psychology/workshops/${ws.id}/complete`, {
        method: "PUT", headers, body: JSON.stringify({ observations, outcomes, actual_attendees: actual })
      });
      onRefresh();
    } catch(e) {}
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto shadow-xl" onClick={e => e.stopPropagation()} data-testid="workshop-detail">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CAT_COLORS[ws.topic_category] || CAT_COLORS.otro}`}>{CAT_LABELS[ws.topic_category]}</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[ws.status]}`}>{STATUS_LABELS[ws.status]}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">{ws.title}</h2>
          {ws.description && <p className="text-sm text-slate-600">{ws.description}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><p className="text-[10px] text-slate-500">Fecha</p><p className="text-sm font-medium text-slate-800">{dt.toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</p></div>
            <div><p className="text-[10px] text-slate-500">Hora</p><p className="text-sm font-medium text-slate-800">{dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p></div>
            <div><p className="text-[10px] text-slate-500">Duracion</p><p className="text-sm font-medium text-slate-800">{ws.duration_minutes} min</p></div>
            <div><p className="text-[10px] text-slate-500">Ubicacion</p><p className="text-sm font-medium text-slate-800">{ws.location || "-"}</p></div>
          </div>

          {ws.objectives?.length > 0 && (
            <div><p className="text-xs font-medium text-slate-600 mb-1">Objetivos</p>
              <ul className="list-disc pl-4 space-y-0.5">{ws.objectives.map((o, i) => <li key={i} className="text-sm text-slate-700">{o}</li>)}</ul>
            </div>
          )}

          {/* Actions for planificado */}
          {ws.status === "planificado" && (
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onEdit} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Editar</button>
              <button type="button" onClick={onStart} className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">Iniciar taller</button>
              <button type="button" onClick={onDelete} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminar</button>
            </div>
          )}

          {/* Attendance for en_curso */}
          {(ws.status === "en_curso" || ws.status === "planificado") && attendees.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Asistencia ({attendees.filter(a => a.attended).length}/{attendees.length})</p>
                <button type="button" onClick={saveAttendance} disabled={saving} className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"><Save className="w-3 h-3" /> Guardar</button>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {attendees.map((a, i) => (
                  <label key={a.student_id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={a.attended}
                      onChange={e => { const arr = [...attendees]; arr[i] = {...arr[i], attended: e.target.checked}; setAttendees(arr); }}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    <span className="text-sm text-slate-700">{a.student_id}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Complete form for en_curso */}
          {ws.status === "en_curso" && (
            <div className="space-y-3 pt-2">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                <textarea value={observations} onChange={e => setObservations(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" rows={3} data-testid="ws-observations" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Resultados/Conclusiones</label>
                <textarea value={outcomes} onChange={e => setOutcomes(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" rows={2} data-testid="ws-outcomes" /></div>
              <button type="button" onClick={completeWorkshop} disabled={saving}
                className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="complete-workshop-btn"><Check className="w-4 h-4" /> Completar taller</button>
            </div>
          )}

          {/* Completed view */}
          {ws.status === "completado" && (
            <div className="space-y-3 pt-2">
              {ws.observations && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-medium text-slate-500 mb-1">Observaciones</p><p className="text-sm text-slate-700">{ws.observations}</p></div>}
              {ws.outcomes && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-medium text-slate-500 mb-1">Resultados</p><p className="text-sm text-slate-700">{ws.outcomes}</p></div>}
              {ws.actual_attendees != null && (
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Asistencia: {ws.actual_attendees}/{ws.expected_attendees || "?"} ({ws.expected_attendees ? Math.round(ws.actual_attendees / ws.expected_attendees * 100) : 0}%)</span></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkshopModal({ token, editing, onSaved, onClose }) {
  const [form, setForm] = useState({
    title: editing?.title || "",
    topic_category: editing?.topic_category || "manejo_emociones",
    description: editing?.description || "",
    date: editing?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    time: editing?.date ? new Date(editing.date).toTimeString().slice(0, 5) : "14:00",
    duration_minutes: editing?.duration_minutes || 60,
    target_level: editing?.target_level || "todos",
    target_grades: editing?.target_grades || [],
    target_sections: editing?.target_sections || [],
    location: editing?.location || "",
    objectives: editing?.objectives || [""],
    methodology: editing?.methodology || "",
  });
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const addObjective = () => setForm(f => ({...f, objectives: [...f.objectives, ""]}));
  const removeObjective = (i) => setForm(f => ({...f, objectives: f.objectives.filter((_, idx) => idx !== i)}));
  const updateObjective = (i, v) => setForm(f => ({...f, objectives: f.objectives.map((o, idx) => idx === i ? v : o)}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      date: `${form.date}T${form.time}:00`,
      duration_minutes: parseInt(form.duration_minutes),
      objectives: form.objectives.filter(o => o.trim()),
    };
    delete body.time;
    try {
      const url = editing ? `${API}/v1/psychology/workshops/${editing.id}` : `${API}/v1/psychology/workshops`;
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers, body: JSON.stringify(body) });
      if (res.ok) onSaved();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-xl" data-testid="workshop-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-800">{editing ? "Editar Taller" : "Nuevo Taller"}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titulo *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="ws-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria *</label>
              <select value={form.topic_category} onChange={e => setForm(f => ({...f, topic_category: e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" data-testid="ws-category">
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nivel *</label>
              <select value={form.target_level} onChange={e => setForm(f => ({...f, target_level: e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" data-testid="ws-level">
                <option value="todos">Todos</option><option value="inicial">Inicial</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripcion</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" rows={2} data-testid="ws-description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" data-testid="ws-date" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hora *</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" data-testid="ws-time" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duracion</label>
              <select value={form.duration_minutes} onChange={e => setForm(f => ({...f, duration_minutes: e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm">
                {[30,45,60,90,120,180].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ubicacion</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
              placeholder="Ej: Auditorio, Sala de usos multiples" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" data-testid="ws-location" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Objetivos</label>
              <button type="button" onClick={addObjective} className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-0.5"><Plus className="w-3 h-3" /> Agregar</button>
            </div>
            <div className="space-y-1.5">
              {form.objectives.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={o} onChange={e => updateObjective(i, e.target.value)} placeholder={`Objetivo ${i + 1}`}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  {form.objectives.length > 1 && <button type="button" onClick={() => removeObjective(i)} className="p-1 text-red-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Metodologia</label>
            <textarea value={form.methodology} onChange={e => setForm(f => ({...f, methodology: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" rows={2} />
          </div>
          <button type="submit" disabled={saving || !form.title}
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50"
            data-testid="save-workshop-btn">
            {saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Taller"}
          </button>
        </form>
      </div>
    </div>
  );
}
