import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { MessageSquare, Plus, User, Clock, CheckCircle, XCircle, ChevronRight, Calendar } from "lucide-react";

const STATUS_COLORS = {
  programada: "bg-blue-100 text-blue-800",
  confirmada: "bg-green-100 text-green-700",
  realizada: "bg-slate-200 text-slate-700",
  cancelada: "bg-red-100 text-red-600",
  no_asistio: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS = {
  programada: "Programada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistio",
};

export default function ReunionesListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [reuniones, setReuniones] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);

  const [form, setForm] = useState({
    grade_id: "", section_id: "", student_id: "",
    scheduled_at: "", location: "Oficina de Coordinacion",
    agenda: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await coordinacionApi.listReuniones(token, params);
      setReuniones(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Error loading reuniones:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCreateForm && grades.length === 0) {
      coordinacionApi.getEnums(token).catch(() => {});
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/coordinacion/grades`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => setGrades(d.grades || [])).catch(() => {});
    }
  }, [showCreateForm]);

  const loadSections = async (gradeId) => {
    setForm(p => ({ ...p, grade_id: gradeId, section_id: "", student_id: "" }));
    setSections([]); setStudents([]); setParents([]);
    if (!gradeId) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/coordinacion/sections?grade_id=${gradeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSections(data.sections || []);
    } catch {}
  };

  const loadStudents = async (sectionId) => {
    setForm(p => ({ ...p, section_id: sectionId, student_id: "" }));
    setStudents([]); setParents([]);
    if (!sectionId) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/coordinacion/students?section_id=${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch {}
  };

  const loadParents = async (studentId) => {
    setForm(p => ({ ...p, student_id: studentId }));
    setParents([]);
    if (!studentId) return;
    try {
      const res = await coordinacionApi.getStudentParents(token, studentId);
      setParents(res.parents || []);
    } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.scheduled_at || !form.agenda) return;
    setCreating(true);
    try {
      const payload = {
        student_id: form.student_id,
        scheduled_at: form.scheduled_at,
        location: form.location,
        agenda: form.agenda,
        notes: form.notes || null,
        parent_ids: parents.map(p => p.id),
      };
      await coordinacionApi.createReunion(token, payload);
      setShowCreateForm(false);
      setForm({ grade_id: "", section_id: "", student_id: "", scheduled_at: "", location: "Oficina de Coordinacion", agenda: "", notes: "" });
      load();
    } catch (err) {
      console.error("Error creating reunion:", err);
    } finally {
      setCreating(false);
    }
  };

  const goToDetail = (id) => {
    const base = subdomain ? `/${subdomain}` : "";
    navigate(`${base}/coordinacion/reuniones/${id}`);
  };

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="reuniones">
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="reuniones-list-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            Reuniones con Padres
          </h1>
          <p className="text-sm text-slate-500 mt-1">{total} reunion(es)</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          data-testid="new-reunion-btn"
        >
          <Plus className="w-4 h-4" /> Nueva reunion
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          data-testid="filter-reunion-status"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-indigo-200 p-5 mb-5 space-y-4" data-testid="reunion-form">
          <h3 className="font-bold text-slate-800">Programar reunion</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={form.grade_id} onChange={(e) => loadSections(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reunion-grade">
              <option value="">Grado</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <select value={form.section_id} onChange={(e) => loadStudents(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reunion-section">
              <option value="">Seccion</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select value={form.student_id} onChange={(e) => loadParents(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reunion-student">
              <option value="">Estudiante</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>)}
            </select>
          </div>
          {parents.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-semibold text-slate-500 mb-1">Padres vinculados ({parents.length})</p>
              {parents.map(p => (
                <p key={p.id} className="text-sm text-slate-700">{p.full_name} - {p.email || "Sin email"}</p>
              ))}
            </div>
          )}
          {form.student_id && parents.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">No hay padres vinculados a este estudiante.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora *</label>
              <input type="datetime-local" value={form.scheduled_at}
                onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reunion-datetime" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lugar</label>
              <input type="text" value={form.location}
                onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="reunion-location" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agenda / Motivo *</label>
            <textarea rows={3} value={form.agenda}
              onChange={(e) => setForm(p => ({ ...p, agenda: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" data-testid="reunion-agenda"
              placeholder="Temas a tratar en la reunion..." />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={creating || !form.student_id || !form.scheduled_at || !form.agenda}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="submit-reunion">
              {creating ? "Creando..." : "Programar reunion"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : reuniones.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No hay reuniones programadas</div>
      ) : (
        <div className="space-y-3">
          {reuniones.map((r) => (
            <div
              key={r.id}
              onClick={() => goToDetail(r.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
              data-testid={`reunion-row-${r.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("es-PE") : ""}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{r.student_name}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{r.agenda}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{r.location}</span>
                    {r.confirmed_parents?.length > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> {r.confirmed_parents.length}/{r.parent_ids?.length || 0} confirmado(s)
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
