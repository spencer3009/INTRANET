import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  Presentation, Plus, Clock, Users, Paperclip, ChevronRight, ChevronLeft,
  Calendar, MapPin, Loader2, Search
} from "lucide-react";

/* ─── Status badge configs (premium) ─── */
const STS_BADGE = {
  programada: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Programada", dot: "#3b82f6" },
  en_curso:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "En curso", dot: "#f59e0b" },
  realizada:  { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Realizada", dot: "#10b981" },
  cancelada:  { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Cancelada", dot: "#ef4444" },
};

/* ─── KPI card config ─── */
const KPI_CONFIG = [
  { key: "total",       label: "Total charlas",  icon: Presentation, from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241" },
  { key: "programadas", label: "Programadas",     icon: Calendar,     from: "#3b82f6", to: "#2563eb", rgb: "59, 130, 246" },
  { key: "en_curso",    label: "En curso",        icon: Clock,        from: "#f59e0b", to: "#d97706", rgb: "245, 158, 11" },
  { key: "realizadas",  label: "Realizadas",      icon: Users,        from: "#10b981", to: "#059669", rgb: "16, 185, 129" },
];

const TABS = [
  { val: "", label: "Todas" },
  { val: "programada", label: "Programadas" },
  { val: "en_curso", label: "En curso" },
  { val: "realizada", label: "Realizadas" },
  { val: "cancelada", label: "Canceladas" },
];

function formatRelativeDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CharlasListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [charlas, setCharlas] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const filterStatus = searchParams.get("status") || "";

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

  /* ─── KPI summary computed from loaded list ─── */
  const [kpis, setKpis] = useState({ total: 0, programadas: 0, en_curso: 0, realizadas: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (filterStatus) params.status = filterStatus;
      const res = await coordinacionApi.listCharlas(token, params);
      setCharlas(res.items || []);
      setTotal(res.total || 0);

      // Also load all to compute KPIs (only when no filter)
      if (!filterStatus) {
        const items = res.items || [];
        setKpis({
          total: res.total || 0,
          programadas: items.filter(c => c.status === "programada").length,
          en_curso: items.filter(c => c.status === "en_curso").length,
          realizadas: items.filter(c => c.status === "realizada").length,
        });
      }
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
      navigate(`${subdomain ? `/${subdomain}` : ""}/coordinación/charlas/${created.id}`);
    } catch (err) {
      console.error("Error creating charla:", err);
    } finally {
      setCreating(false);
    }
  };

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const goToDetail = (id) => {
    navigate(`${subdomain ? `/${subdomain}` : ""}/coordinación/charlas/${id}`);
  };

  const canWrite = ["coordinator", "admin", "owner"].includes(user?.role);
  const totalPages = Math.ceil(total / 25) || 1;

  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="charlas">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="charlas-list-page">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Charlas grupales</h1>
            <p className="text-sm text-slate-500 mt-1">{total} charla{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}</p>
          </div>
          {canWrite && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="group flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                boxShadow: "0 4px 14px rgba(20, 184, 166, 0.30)",
              }}
              data-testid="new-charla-btn"
            >
              <Plus className="w-4 h-4" />
              Nueva charla
            </button>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {KPI_CONFIG.map(({ key, label, icon: Icon, from, to, rgb }) => (
            <div
              key={key}
              className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
                boxShadow: `0 4px 16px rgba(${rgb}, 0.20)`,
              }}
              data-testid={`kpi-${key}`}
            >
              {/* Semi-circle decorations */}
              <div className="absolute pointer-events-none rounded-full" style={{ width: "140px", height: "140px", top: "-30px", right: "-40px", background: "rgba(255,255,255,0.12)" }} />
              <div className="absolute pointer-events-none rounded-full" style={{ width: "90px", height: "90px", bottom: "-30px", right: "-10px", background: "rgba(255,255,255,0.07)" }} />

              <div className="relative flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/20"
                     style={{ background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                  <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-semibold text-white/90">{label}</span>
              </div>
              <div className="relative text-[32px] font-bold text-white leading-none tabular-nums tracking-tight">
                {kpis[key] ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* ── Create Form ── */}
        {showCreateForm && (
          <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-teal-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(240,253,250,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 2px 8px rgba(20,184,166,0.25)" }}>
                <Presentation className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Programar nueva charla</h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4" data-testid="charla-form">
              <div>
                <label className={labelCls}>Título *</label>
                <input type="text" value={form.title} maxLength={200}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  placeholder="Ej: Taller de prevencion de bullying"
                  data-testid="charla-title" />
              </div>
              <div>
                <label className={labelCls}>Descripción *</label>
                <textarea rows={3} value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  className={`${inputCls} resize-none`}
                  placeholder="Descripción de la charla..."
                  data-testid="charla-description" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Fecha y hora *</label>
                  <input type="datetime-local" value={form.scheduled_at}
                    onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                    className={inputCls} data-testid="charla-datetime" />
                </div>
                <div>
                  <label className={labelCls}>Duración (min)</label>
                  <input type="number" value={form.duration_minutes} min={15} max={480}
                    onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
                    className={inputCls} data-testid="charla-duration" />
                </div>
                <div>
                  <label className={labelCls}>Lugar</label>
                  <input type="text" value={form.location}
                    onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                    className={inputCls} data-testid="charla-location" />
                </div>
              </div>

              {/* Target grades */}
              <div>
                <label className={labelCls}>Grados objetivo</label>
                <div className="flex flex-wrap gap-2">
                  {grades.map(g => (
                    <button key={g.id} type="button" onClick={() => handleGradeToggle(g.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                        selectedGrades.includes(g.id)
                          ? "text-white border-teal-400"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                      style={selectedGrades.includes(g.id) ? {
                        background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                        boxShadow: "0 2px 6px rgba(20,184,166,0.25)"
                      } : {}}
                      data-testid={`grade-chip-${g.id}`}>
                      {g.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target sections */}
              {sections.filter(s => selectedGrades.includes(s.grado_id)).length > 0 && (
                <div>
                  <label className={labelCls}>Secciones (opcional)</label>
                  <div className="flex flex-wrap gap-2">
                    {sections.filter(s => selectedGrades.includes(s.grado_id)).map(s => (
                      <button key={s.id} type="button" onClick={() => handleSectionToggle(s.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                          selectedSections.includes(s.id)
                            ? "text-white border-blue-400"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                        style={selectedSections.includes(s.id) ? {
                          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          boxShadow: "0 2px 6px rgba(59,130,246,0.25)"
                        } : {}}
                        data-testid={`section-chip-${s.id}`}>
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Temas (separados por coma)</label>
                <input type="text" value={form.topics}
                  onChange={(e) => setForm(p => ({ ...p, topics: e.target.value }))}
                  className={inputCls}
                  placeholder="Ej: Bullying, Convivencia, Respeto"
                  data-testid="charla-topics" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateForm(false); setSelectedGrades([]); setSelectedSections([]); }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creating || !form.title || !form.scheduled_at || !form.description}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 4px 12px rgba(20,184,166,0.25)" }}
                  data-testid="submit-charla">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
                  Programar charla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="flex gap-1.5">
            {TABS.map(opt => (
              <button
                key={opt.val}
                onClick={() => updateFilter("status", opt.val)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  filterStatus === opt.val
                    ? "text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={filterStatus === opt.val ? {
                  background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                  boxShadow: "0 2px 8px rgba(20,184,166,0.30)"
                } : {}}
                data-testid={`filter-status-${opt.val || "all"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {/* List header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 4px 12px rgba(20,184,166,0.25)" }}
            >
              <Presentation className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Listado de charlas</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filterStatus ? TABS.find(t => t.val === filterStatus)?.label : "Mostrando todas"}
                {total > 0 && ` · Página ${page} de ${totalPages}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-teal-400" />
            </div>
          ) : charlas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20" data-testid="charlas-empty">
              <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                <Presentation className="w-7 h-7 text-teal-300" />
              </div>
              <p className="font-semibold text-slate-400 text-sm">No hay charlas registradas</p>
              <p className="text-xs text-slate-300 mt-1">Ajusta los filtros o programa una nueva</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {charlas.map((c) => {
                const sts = STS_BADGE[c.status] || STS_BADGE.programada;
                return (
                  <button
                    key={c.id}
                    onClick={() => goToDetail(c.id)}
                    className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left bg-white"
                    style={{ borderLeftWidth: "3px", borderLeftColor: sts.dot }}
                    data-testid={`charla-row-${c.id}`}
                  >
                    {/* Status dot */}
                    <div className="flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sts.dot, boxShadow: `0 0 0 3px ${sts.dot}22` }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>
                          {sts.label}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeDate(c.scheduled_at)}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{c.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" /> {c.duration_minutes}min
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" /> {c.location}
                        </span>
                        {c.attendance_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <Users className="w-3 h-3" /> {c.attendance_count} asistentes
                          </span>
                        )}
                        {c.materials_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-indigo-500">
                            <Paperclip className="w-3 h-3" /> {c.materials_count}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 25 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", String(page - 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  data-testid="prev-page"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter("page", String(page + 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  data-testid="next-page"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CoordinacionLayout>
  );
}
