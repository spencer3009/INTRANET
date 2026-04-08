import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  MessageSquare, Plus, User, Clock, CheckCircle, ChevronRight, ChevronLeft,
  Calendar, MapPin, Loader2, Users, XCircle
} from "lucide-react";

/* ─── Status badge configs (premium) ─── */
const STS_BADGE = {
  programada: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Programada", dot: "#3b82f6" },
  confirmada: { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Confirmada", dot: "#10b981" },
  realizada:  { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Realizada", dot: "#64748b" },
  cancelada:  { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Cancelada", dot: "#ef4444" },
  no_asistio: { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "No asistio", dot: "#f59e0b" },
};

/* ─── KPI card config ─── */
const KPI_CONFIG = [
  { key: "total",       label: "Total",        icon: MessageSquare, from: "#6366f1", to: "#4f46e5", rgb: "99, 102, 241" },
  { key: "programadas", label: "Programadas",  icon: Calendar,      from: "#3b82f6", to: "#2563eb", rgb: "59, 130, 246" },
  { key: "confirmadas", label: "Confirmadas",  icon: CheckCircle,   from: "#10b981", to: "#059669", rgb: "16, 185, 129" },
  { key: "realizadas",  label: "Realizadas",   icon: Users,         from: "#64748b", to: "#475569", rgb: "100, 116, 139" },
];

const TABS = [
  { val: "", label: "Todas" },
  { val: "programada", label: "Programadas" },
  { val: "confirmada", label: "Confirmadas" },
  { val: "realizada", label: "Realizadas" },
  { val: "cancelada", label: "Canceladas" },
  { val: "no_asistio", label: "No asistio" },
];

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

export default function ReunionesListPage({ token, subdomain, user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reuniones, setReuniones] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const filterStatus = searchParams.get("status") || "";

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

  const [kpis, setKpis] = useState({ total: 0, programadas: 0, confirmadas: 0, realizadas: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (filterStatus) params.status = filterStatus;
      const res = await coordinacionApi.listReuniones(token, params);
      setReuniones(res.items || []);
      setTotal(res.total || 0);

      if (!filterStatus) {
        const items = res.items || [];
        setKpis({
          total: res.total || 0,
          programadas: items.filter(r => r.status === "programada").length,
          confirmadas: items.filter(r => r.status === "confirmada").length,
          realizadas: items.filter(r => r.status === "realizada").length,
        });
      }
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

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const goToDetail = (id) => {
    const base = subdomain ? `/${subdomain}` : "";
    navigate(`${base}/coordinacion/reuniones/${id}`);
  };

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="reuniones-list-page">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Reuniones con Padres</h1>
            <p className="text-sm text-slate-500 mt-1">{total} reunion{total !== 1 ? "es" : ""} registrada{total !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="group flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.30)",
            }}
            data-testid="new-reunion-btn"
          >
            <Plus className="w-4 h-4" />
            Nueva reunion
          </button>
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
          <div className="bg-white border border-indigo-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-indigo-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}>
                <MessageSquare className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Programar nueva reunion</h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4" data-testid="reunion-form">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Grado</label>
                  <select value={form.grade_id} onChange={(e) => loadSections(e.target.value)}
                    className={inputCls} data-testid="reunion-grade">
                    <option value="">Seleccionar grado</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Seccion</label>
                  <select value={form.section_id} onChange={(e) => loadStudents(e.target.value)}
                    className={inputCls} data-testid="reunion-section">
                    <option value="">Seleccionar seccion</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Estudiante *</label>
                  <select value={form.student_id} onChange={(e) => loadParents(e.target.value)}
                    className={inputCls} data-testid="reunion-student">
                    <option value="">Seleccionar estudiante</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>)}
                  </select>
                </div>
              </div>

              {parents.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-2">Padres vinculados ({parents.length})</p>
                  {parents.map(p => (
                    <div key={p.id} className="flex items-center gap-2 py-1">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{p.full_name}</span>
                      <span className="text-xs text-slate-400">{p.email || "Sin email"}</span>
                    </div>
                  ))}
                </div>
              )}
              {form.student_id && parents.length === 0 && (
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                  <p className="text-sm text-amber-700 font-medium">No hay padres vinculados a este estudiante.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha y hora *</label>
                  <input type="datetime-local" value={form.scheduled_at}
                    onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                    className={inputCls} data-testid="reunion-datetime" />
                </div>
                <div>
                  <label className={labelCls}>Lugar</label>
                  <input type="text" value={form.location}
                    onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                    className={inputCls} data-testid="reunion-location" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Agenda / Motivo *</label>
                <textarea rows={3} value={form.agenda}
                  onChange={(e) => setForm(p => ({ ...p, agenda: e.target.value }))}
                  className={`${inputCls} resize-none`} data-testid="reunion-agenda"
                  placeholder="Temas a tratar en la reunion..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creating || !form.student_id || !form.scheduled_at || !form.agenda}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
                  data-testid="submit-reunion">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Programar reunion
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="flex gap-1.5 flex-wrap">
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
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.30)"
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
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
              <MessageSquare className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Listado de reuniones</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filterStatus ? TABS.find(t => t.val === filterStatus)?.label : "Mostrando todas"}
                {total > 0 && ` · Pagina ${page} de ${totalPages}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            </div>
          ) : reuniones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-indigo-300" />
              </div>
              <p className="font-semibold text-slate-400 text-sm">No hay reuniones programadas</p>
              <p className="text-xs text-slate-300 mt-1">Ajusta los filtros o programa una nueva</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {reuniones.map((r) => {
                const sts = STS_BADGE[r.status] || STS_BADGE.programada;
                const confirmedCount = r.confirmed_parents?.length || 0;
                const totalParents = r.parent_ids?.length || 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => goToDetail(r.id)}
                    className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left bg-white"
                    style={{ borderLeftWidth: "3px", borderLeftColor: sts.dot }}
                    data-testid={`reunion-row-${r.id}`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: sts.dot, boxShadow: `0 0 0 3px ${sts.dot}22` }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>
                          {sts.label}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("es-PE") : ""}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                        {r.student_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{r.agenda}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" /> {r.location}
                        </span>
                        {totalParents > 0 && (
                          <span className={`flex items-center gap-1 text-xs ${confirmedCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            <CheckCircle className="w-3 h-3" /> {confirmedCount}/{totalParents} confirmado{confirmedCount !== 1 ? "s" : ""}
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

          {total > 25 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium tabular-nums">Pagina {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => updateFilter("page", String(page - 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="prev-page">
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button disabled={page >= totalPages} onClick={() => updateFilter("page", String(page + 1))}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors" data-testid="next-page">
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
