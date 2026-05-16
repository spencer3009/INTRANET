// TeacherObservationsPage — Portal del profesor para reportar observaciones
// del aula al tutor de cada alumno. Sin acceso para padres.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  AlertCircle, Plus, Search, Filter, Send, Clock, Loader2,
  MessageSquare, X, ChevronRight, AlertTriangle, Info, Bell,
  CheckCircle2, GraduationCap, RefreshCw, User,
} from "lucide-react";
import TeacherSidebar from "@/components/TeacherSidebar";
import DashboardHeader from "@/components/DashboardHeader";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: "academica", label: "Académica", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "conductual", label: "Conductual", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "asistencia", label: "Asistencia", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "salud", label: "Salud", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "otro", label: "Otro", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

const SEVERITIES = [
  { value: "info", label: "Informativa", icon: Info, color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "atencion", label: "Requiere atención", icon: AlertCircle, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "urgente", label: "Urgente · notifica al tutor", icon: AlertTriangle, color: "bg-red-100 text-red-700 border-red-200" },
];

const STATUS_LABELS = {
  abierta: { label: "Abierta", color: "bg-blue-100 text-blue-700" },
  en_seguimiento: { label: "En seguimiento", color: "bg-amber-100 text-amber-700" },
  cerrada: { label: "Cerrada", color: "bg-emerald-100 text-emerald-700" },
};

export default function TeacherObservationsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [activeObs, setActiveObs] = useState(null); // detalle
  const [schoolSettings, setSchoolSettings] = useState(null);

  // Cargar settings del colegio (logo, nombre)
  useEffect(() => {
    (async () => {
      try {
        const settingsUrl = ["owner", "admin", "director"].includes(user?.role)
          ? `${API}/settings`
          : `${process.env.REACT_APP_BACKEND_URL}/api/settings/public/${user?.subdomain}`;
        const res = await axios.get(settingsUrl, { headers });
        setSchoolSettings(res.data);
      } catch (err) {
        // logo fallback handled by DashboardHeader
      }
    })();
  }, [headers, user?.role, user?.subdomain]);
  const logoUrl = schoolSettings?.logo_url;
  const schoolName = schoolSettings?.system_name || user?.school_name;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/teacher/observations/sent`, { headers });
      setObservations(r.data?.observations || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudieron cargar las observaciones");
    } finally {
      setLoading(false);
    }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = observations;
    if (filterStatus !== "all") list = list.filter(o => o.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.student?.full_name || "").toLowerCase().includes(q) ||
        (o.title || "").toLowerCase().includes(q) ||
        (o.tutor_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [observations, filterStatus, search]);

  const counts = useMemo(() => ({
    total: observations.length,
    abierta: observations.filter(o => o.status === "abierta").length,
    en_seguimiento: observations.filter(o => o.status === "en_seguimiento").length,
    cerrada: observations.filter(o => o.status === "cerrada").length,
  }), [observations]);

  const navigateTo = (path) => navigate(`/${user?.subdomain || ""}${path}`.replace(/\/+/g, "/"));

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="teacher-observations-page">
      <TeacherSidebar
        active="observaciones"
        onNavigate={(r) => navigateTo(r)}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={user?.subdomain}
        user={user}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={user?.subdomain} token={token} />

        <div className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <header className="flex flex-wrap items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-amber-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">Mensajes al Tutor</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Comunícate directamente con el <strong>tutor del salón</strong> para reportarle cualquier incidencia, observación o situación particular de un alumno. Esta conversación es <strong>privada entre tú y el tutor</strong> — ni los padres ni el alumno la ven.
                </p>
              </div>
              <button
                onClick={() => setShowComposer(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-sm transition-colors"
                data-testid="new-observation-btn"
              >
                <Plus className="w-4 h-4" /> Nuevo mensaje
              </button>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Mensajes enviados" value={counts.total} accent="slate" />
              <StatCard label="Abiertos" value={counts.abierta} accent="blue" />
              <StatCard label="En seguimiento" value={counts.en_seguimiento} accent="amber" />
              <StatCard label="Cerrados" value={counts.cerrada} accent="emerald" />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar alumno, tutor o asunto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  data-testid="obs-search"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                data-testid="obs-status-filter"
              >
                <option value="all">Todos los estados</option>
                <option value="abierta">Abiertos</option>
                <option value="en_seguimiento">En seguimiento</option>
                <option value="cerrada">Cerrados</option>
              </select>
              <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Recargar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Cargando mensajes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="obs-empty">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-700 font-semibold mb-1">No hay mensajes que coincidan</p>
                <p className="text-sm text-slate-500">{counts.total === 0 ? "Aún no le has escrito a ningún tutor. Pulsa 'Nuevo mensaje' para empezar." : "Ajusta los filtros para ver más resultados."}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100" data-testid="obs-list">
                {filtered.map(o => (
                  <ObservationRow key={o.id} obs={o} onOpen={() => setActiveObs(o)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showComposer && (
        <ComposerModal
          headers={headers}
          onClose={() => setShowComposer(false)}
          onCreated={(o) => {
            setShowComposer(false);
            setObservations(prev => [o, ...prev]);
            toast.success("Mensaje enviado al tutor");
          }}
        />
      )}

      {activeObs && (
        <DetailModal
          obs={activeObs}
          headers={headers}
          currentUserId={user?.id}
          onClose={() => setActiveObs(null)}
          onUpdate={(updated) => {
            setActiveObs(updated);
            setObservations(prev => prev.map(o => o.id === updated.id ? updated : o));
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const ring = accent === "blue" ? "ring-blue-100"
    : accent === "amber" ? "ring-amber-100"
    : accent === "emerald" ? "ring-emerald-100"
    : "ring-slate-100";
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ring-2 ${ring}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function CategoryBadge({ value }) {
  const c = CATEGORIES.find(x => x.value === value) || CATEGORIES[CATEGORIES.length - 1];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.color}`}>{c.label}</span>;
}

function SeverityBadge({ value }) {
  const s = SEVERITIES.find(x => x.value === value) || SEVERITIES[0];
  const Icon = s.icon;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${s.color}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function StatusBadge({ value }) {
  const s = STATUS_LABELS[value] || STATUS_LABELS.abierta;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>;
}

function ObservationRow({ obs, onOpen }) {
  const replies = obs.thread?.length || 0;
  return (
    <button
      onClick={onOpen}
      className="w-full p-4 hover:bg-slate-50/60 transition-colors text-left flex items-start gap-3"
      data-testid={`obs-row-${obs.id}`}
    >
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
        {(obs.student?.full_name || "??").split(",").pop().trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900 truncate">{obs.student?.full_name}</p>
          <span className="text-xs text-slate-400">·</span>
          <p className="text-xs text-slate-500 truncate">{obs.student?.grade_name} {obs.student?.section_name}</p>
        </div>
        <p className="text-sm text-slate-700 mt-1 line-clamp-1">{obs.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <CategoryBadge value={obs.category} />
          <SeverityBadge value={obs.severity} />
          <StatusBadge value={obs.status} />
          {replies > 0 && (
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {replies} respuesta{replies === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <p className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(obs.created_at).toLocaleDateString("es-PE")}</p>
        <p className="text-[11px] text-slate-400">para {obs.tutor_name}</p>
        <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPOSER MODAL — Nueva observación
// ════════════════════════════════════════════════════════════════════════════
function ComposerModal({ headers, onClose, onCreated }) {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [category, setCategory] = useState("academica");
  const [severity, setSeverity] = useState("info");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/teacher/students-with-tutor`, { headers });
        setStudents(r.data?.students || []);
      } catch (err) {
        toast.error("No se pudieron cargar tus alumnos");
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [headers]);

  const filteredStudents = useMemo(() => {
    // Excluir alumnos donde el profesor es el propio tutor (debe usar Mis Tutorías)
    const base = students.filter(s => !s.tutor?.self);
    if (!studentSearch.trim()) return base;
    const q = studentSearch.toLowerCase();
    return base.filter(s =>
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.grade_name || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const submit = async () => {
    if (!selectedStudent) return toast.error("Selecciona un alumno");
    if (!title.trim()) return toast.error("Escribe un título");
    if (!description.trim()) return toast.error("Describe el mensaje al tutor");
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/teacher/observations`, {
        student_id: selectedStudent.id,
        category, severity,
        title: title.trim(), description: description.trim(),
        fecha_incidente: fecha,
      }, { headers });
      onCreated(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo enviar el mensaje");
    } finally {
      setSubmitting(false);
    }
  };

  const noTutorBlocked = selectedStudent && !selectedStudent.tutor;
  const isSelfTutor = selectedStudent && selectedStudent.tutor?.self;

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={onClose} data-testid="composer-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Nuevo mensaje al tutor</h2>
              <p className="text-xs text-slate-500">Esta conversación es privada — solo tú y el tutor del alumno</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="composer-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Alumno */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Alumno *</label>
            {selectedStudent ? (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-sm">
                  {(selectedStudent.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{selectedStudent.full_name}</p>
                  <p className="text-xs text-slate-500">{selectedStudent.grade_name} {selectedStudent.section_name}</p>
                  {selectedStudent.tutor ? (
                    <p className="text-xs text-slate-700 mt-0.5 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" /> Tutor: <strong>{selectedStudent.tutor.name}</strong>
                      {selectedStudent.tutor.self && <span className="text-amber-700"> (eres tú)</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sin tutor asignado</p>
                  )}
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-1.5 hover:bg-amber-100 rounded-lg" title="Cambiar alumno" data-testid="change-student-btn">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o grado..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    data-testid="composer-student-search"
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50/30">
                  {loadingStudents ? (
                    <div className="p-4 text-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Cargando alumnos...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No hay alumnos que coincidan</div>
                  ) : filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStudent(s); setStudentSearch(""); }}
                      className="w-full p-2.5 hover:bg-amber-50 border-t border-slate-100 first:border-t-0 text-left flex items-center gap-3"
                      data-testid={`composer-student-${s.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {(s.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
                        <p className="text-xs text-slate-500">{s.grade_name} {s.section_name} {s.tutor ? `· Tutor: ${s.tutor.name}` : "· Sin tutor"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {noTutorBlocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Esta sección no tiene tutor asignado.</strong> No podrás enviar el mensaje. Pide al administrador del colegio que asigne uno desde "Gestión de Tutorías".
              </div>
            </div>
          )}
          {isSelfTutor && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>Eres el tutor de este alumno. Registra esta nota directamente desde "Mis Tutorías" en lugar de aquí.</div>
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Categoría *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${category === c.value ? c.color + " ring-2 ring-offset-1 ring-amber-400" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  data-testid={`composer-category-${c.value}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severidad */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Severidad *</label>
            <div className="space-y-1.5">
              {SEVERITIES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => setSeverity(s.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 transition-all ${severity === s.value ? s.color + " ring-2 ring-offset-1 ring-amber-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    data-testid={`composer-severity-${s.value}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{s.label}</span>
                    {s.value === "urgente" && <Bell className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                );
              })}
            </div>
            {severity === "urgente" && (
              <p className="text-xs text-red-600 mt-1.5">Se enviará una notificación push inmediata al tutor.</p>
            )}
          </div>

          {/* Fecha del incidente */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Fecha del incidente</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              data-testid="composer-fecha"
            />
          </div>

          {/* Título */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Asunto *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Resumen breve (ej: No trajo el material de matemáticas)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              data-testid="composer-title"
            />
            <p className="text-[11px] text-slate-400 mt-1">{title.length}/200</p>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Mensaje al tutor *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={5}
              placeholder="Describe la situación con detalle al tutor. Incluye contexto, qué pasó y qué acción tomaste si la hubo."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-y"
              data-testid="composer-description"
            />
            <p className="text-[11px] text-slate-400 mt-1">{description.length}/4000</p>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-500">El tutor recibirá tu mensaje y podrá responderte en el hilo.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button
              onClick={submit}
              disabled={submitting || noTutorBlocked || isSelfTutor || !selectedStudent}
              className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg inline-flex items-center gap-1.5"
              data-testid="composer-submit"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar al tutor
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL — Detalle + hilo de respuestas
// ════════════════════════════════════════════════════════════════════════════
function DetailModal({ obs: initial, headers, currentUserId, onClose, onUpdate }) {
  const [obs, setObs] = useState(initial);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/teacher/observations/${obs.id}/reply`, { text: reply.trim() }, { headers });
      setObs(r.data);
      onUpdate(r.data);
      setReply("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo enviar la respuesta");
    } finally {
      setSending(false);
    }
  };

  const isClosed = obs.status === "cerrada";

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={onClose} data-testid="detail-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-sm flex-shrink-0">
              {(obs.student?.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{obs.student?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{obs.student?.grade_name} {obs.student?.section_name} · {new Date(obs.created_at).toLocaleString("es-PE")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-lg flex-shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge value={obs.category} />
            <SeverityBadge value={obs.severity} />
            <StatusBadge value={obs.status} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{obs.title}</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.description}</p>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-slate-400" />
            <span>Mensaje enviado a <strong className="text-slate-800">{obs.tutor_name}</strong> (tutor del salón)</span>
            {obs.read_by_tutor_at && (
              <span className="ml-auto inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Leído</span>
            )}
          </div>

          {/* Thread */}
          {obs.thread && obs.thread.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hilo de conversación</p>
              {obs.thread.map(msg => {
                const mine = msg.author_id === currentUserId;
                return (
                  <div key={msg.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                      {(msg.author_name || "?").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] ${mine ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-800"} rounded-2xl px-3.5 py-2`}>
                      <p className="text-[11px] font-semibold mb-0.5">{msg.author_name}</p>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <p className="text-[10px] opacity-70 mt-1">{new Date(msg.ts).toLocaleString("es-PE")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-100 bg-slate-50">
          {isClosed ? (
            <p className="text-sm text-slate-500 text-center py-2">El hilo está cerrado. El tutor puede reabrirlo desde su inbox.</p>
          ) : (
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder en el hilo..."
                rows={2}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                data-testid="detail-reply-input"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg font-semibold flex items-center gap-1.5"
                data-testid="detail-reply-btn"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
