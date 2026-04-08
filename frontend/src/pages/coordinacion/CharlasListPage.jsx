import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { Presentation, Plus, Clock, Users, Paperclip, ChevronRight, Calendar } from "lucide-react";

const STATUS_COLORS = {
  programada: "bg-blue-100 text-blue-800",
  en_curso: "bg-amber-100 text-amber-800",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-600",
};

const STATUS_LABELS = {
  programada: "Programada",
  en_curso: "En curso",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export default function CharlasListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [charlas, setCharlas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);

  const [form, setForm] = useState({
    title: "", description: "", scheduled_at: "",
    duration_minutes: 60, location: "Auditorio",
    topics: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await coordinacionApi.listCharlas(token, params);
      setCharlas(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Error loading charlas:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCreateForm && grades.length === 0) {
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/coordinacion/grades`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => setGrades(d || [])).catch(() => {});
    }
  }, [showCreateForm, token, grades.length]);

  const loadSectionsForGrade = async (gradeId) => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/coordinacion/sections?grade_id=${gradeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      return data.sections || [];
    } catch { return []; }
  };

  const handleGradeToggle = async (gradeId) => {
    const isSelected = selectedGrades.includes(gradeId);
    if (isSelected) {
      setSelectedGrades(p => p.filter(g => g !== gradeId));
      setSelectedSections(p => p.filter(s => !sections.filter(sec => sec.grado_id === gradeId).map(sec => sec.id).includes(s)));
    } else {
      setSelectedGrades(p => [...p, gradeId]);
      const gradeSections = await loadSectionsForGrade(gradeId);
      setSections(p => [...p.filter(s => s.grado_id !== gradeId), ...gradeSections]);
    }
  };

  const handleSectionToggle = (sectionId) => {
    setSelectedSections(p =>
      p.includes(sectionId) ? p.filter(s => s !== sectionId) : [...p, sectionId]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_at || !form.description) return;
    setCreating(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        scheduled_at: form.scheduled_at,
        duration_minutes: parseInt(form.duration_minutes) || 60,
        location: form.location,
        target_grades: selectedGrades,
        target_sections: selectedSections,
        topics: form.topics ? form.topics.split(",").map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
      };
      const created = await coordinacionApi.createCharla(token, payload);
      setShowCreateForm(false);
      setForm({ title: "", description: "", scheduled_at: "", duration_minutes: 60, location: "Auditorio", topics: "", notes: "" });
      setSelectedGrades([]);
      setSelectedSections([]);
      navigate(`${subdomain ? `/${subdomain}` : ""}/coordinacion/charlas/${created.id}`);
    } catch (err) {
      console.error("Error creating charla:", err);
    } finally {
      setCreating(false);
    }
  };

  const goToDetail = (id) => {
    navigate(`${subdomain ? `/${subdomain}` : ""}/coordinacion/charlas/${id}`);
  };

  const canWrite = ["coordinator", "admin", "owner"].includes(user?.role);

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="charlas">
    <div className="p-4 md:p-6 max-w-6xl mx-auto" data-testid="charlas-list-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Presentation className="w-6 h-6 text-teal-600" />
            Charlas grupales
          </h1>
          <p className="text-sm text-slate-500 mt-1">{total} charla(s)</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            data-testid="new-charla-btn"
          >
            <Plus className="w-4 h-4" /> Nueva charla
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          data-testid="filter-charla-status"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-teal-200 p-5 mb-5 space-y-4" data-testid="charla-form">
          <h3 className="font-bold text-slate-800">Programar charla</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
            <input type="text" value={form.title} maxLength={200}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Ej: Taller de prevencion de bullying"
              data-testid="charla-title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion *</label>
            <textarea rows={3} value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              placeholder="Descripcion de la charla..."
              data-testid="charla-description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora *</label>
              <input type="datetime-local" value={form.scheduled_at}
                onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="charla-datetime" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duracion (min)</label>
              <input type="number" value={form.duration_minutes} min={15} max={480}
                onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="charla-duration" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lugar</label>
              <input type="text" value={form.location}
                onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="charla-location" />
            </div>
          </div>

          {/* Target grades */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grados objetivo</label>
            <div className="flex flex-wrap gap-2">
              {grades.map(g => (
                <button key={g.id} type="button" onClick={() => handleGradeToggle(g.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedGrades.includes(g.id)
                      ? "bg-teal-100 text-teal-800 border-teal-300"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  data-testid={`grade-chip-${g.id}`}>
                  {g.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Target sections */}
          {sections.filter(s => selectedGrades.includes(s.grado_id)).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Secciones (opcional — dejar vacio para todo el grado)</label>
              <div className="flex flex-wrap gap-2">
                {sections.filter(s => selectedGrades.includes(s.grado_id)).map(s => (
                  <button key={s.id} type="button" onClick={() => handleSectionToggle(s.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedSections.includes(s.id)
                        ? "bg-teal-100 text-teal-800 border-teal-300"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    data-testid={`section-chip-${s.id}`}>
                    {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Temas (separados por coma)</label>
            <input type="text" value={form.topics}
              onChange={(e) => setForm(p => ({ ...p, topics: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Ej: Bullying, Convivencia, Respeto"
              data-testid="charla-topics" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowCreateForm(false); setSelectedGrades([]); setSelectedSections([]); }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={creating || !form.title || !form.scheduled_at || !form.description}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-teal-700 transition-colors"
              data-testid="submit-charla">
              {creating ? "Creando..." : "Programar charla"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : charlas.length === 0 ? (
        <div className="text-center py-12 text-slate-400" data-testid="charlas-empty">
          No hay charlas registradas
        </div>
      ) : (
        <div className="space-y-3">
          {charlas.map((c) => (
            <div
              key={c.id}
              onClick={() => goToDetail(c.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer"
              data-testid={`charla-row-${c.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || ""}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("es-PE") : ""}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{c.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {c.duration_minutes}min
                    </span>
                    <span>{c.location}</span>
                    {c.attendance_count > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Users className="w-3 h-3" /> {c.attendance_count} asistentes
                      </span>
                    )}
                    {c.materials_count > 0 && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <Paperclip className="w-3 h-3" /> {c.materials_count}
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

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Anterior</button>
          <span className="px-3 py-1.5 text-sm text-slate-600">Pagina {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={charlas.length < 20}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
