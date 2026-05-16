// TeacherObservationsPage — Portal del profesor para reportar observaciones
// del aula al tutor de cada alumno. Sin acceso para padres.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  AlertCircle, Plus, Search, Filter, Send, Clock, Loader2,
  MessageSquare, X, ChevronRight, AlertTriangle, Info, Bell,
  CheckCircle2, GraduationCap, RefreshCw, User, Lock,
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
    <div className="min-h-screen bg-[#FAFAFA] flex" data-testid="teacher-observations-page">
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

        <div className="flex-1 px-6 lg:px-10 py-8 lg:py-12">
          <div className="max-w-7xl mx-auto flex flex-col gap-8">
            {/* Header — Linear/Notion style */}
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  <span className="w-1 h-1 rounded-full bg-[#0B2C5F]" /> Comunicación interna
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">Mensajes al Tutor</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Comunícate directamente con el <span className="text-gray-800 font-medium">tutor del salón</span> sobre cualquier incidencia o situación particular de un alumno. Esta conversación es <span className="text-gray-800 font-medium">privada</span> — ni padres ni alumnos la ven.
                </p>
              </div>
              <button
                onClick={() => setShowComposer(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B2C5F] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#082046] focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/30 active:scale-[0.98] transition-all whitespace-nowrap"
                data-testid="new-observation-btn"
              >
                <Plus className="w-4 h-4" strokeWidth={2.2} /> Nuevo mensaje
              </button>
            </header>

            {/* Stats — 4 cards con elevación sutil tipo Linear */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PremiumStat icon={Send} label="Mensajes enviados" value={counts.total} accent="navy" />
              <PremiumStat icon={Bell} label="Abiertos" value={counts.abierta} accent="emerald" />
              <PremiumStat icon={Clock} label="En seguimiento" value={counts.en_seguimiento} accent="blue" />
              <PremiumStat icon={CheckCircle2} label="Cerrados" value={counts.cerrada} accent="slate" />
            </div>

            {/* Filtros — barra encapsulada estilo Stripe */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-1.5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar alumno, tutor o asunto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400 text-gray-900"
                  data-testid="obs-search"
                />
              </div>
              <div className="h-6 w-px bg-gray-200 hidden sm:block" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 text-sm font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer hover:text-gray-900 transition-colors"
                data-testid="obs-status-filter"
              >
                <option value="all">Todos los estados</option>
                <option value="abierta">Abiertos</option>
                <option value="en_seguimiento">En seguimiento</option>
                <option value="cerrada">Cerrados</option>
              </select>
              <button onClick={load} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors" title="Recargar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Lista */}
            {loading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
                <Loader2 className="w-7 h-7 text-gray-300 animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Cargando mensajes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center" data-testid="obs-empty">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#0B2C5F]/5 border border-[#0B2C5F]/10 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-[#0B2C5F]" strokeWidth={1.6} />
                </div>
                <p className="text-base font-semibold text-gray-900 mb-1">No hay mensajes que coincidan</p>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">{counts.total === 0 ? "Aún no le has escrito a ningún tutor. Pulsa \u201cNuevo mensaje\u201d para empezar." : "Ajusta los filtros para ver más resultados."}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="obs-list">
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

function PremiumStat({ icon: Icon, label, value, accent }) {
  const accents = {
    navy:    { iconBg: "bg-[#0B2C5F]/5",  iconColor: "text-[#0B2C5F]" },
    emerald: { iconBg: "bg-emerald-50",   iconColor: "text-emerald-600" },
    blue:    { iconBg: "bg-blue-50",      iconColor: "text-blue-600" },
    slate:   { iconBg: "bg-gray-100",     iconColor: "text-gray-500" },
  };
  const a = accents[accent] || accents.slate;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg ${a.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${a.iconColor}`} strokeWidth={1.8} />
        </div>
      </div>
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
  return <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">{c.label}</span>;
}

function SeverityBadge({ value }) {
  const map = {
    info:     { label: "Informativa",       Icon: Info,          cls: "bg-blue-50 text-blue-700 border-blue-100" },
    atencion: { label: "Requiere atención", Icon: AlertCircle,   cls: "bg-amber-50 text-amber-800 border-amber-200" },
    urgente:  { label: "Urgente",           Icon: AlertTriangle, cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[value] || map.info;
  const { Icon } = s;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function StatusBadge({ value }) {
  const map = {
    abierta:        { label: "Abierta",        cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
    en_seguimiento: { label: "En seguimiento", cls: "bg-blue-50 text-blue-700 border-blue-100",          dot: "bg-blue-500" },
    cerrada:        { label: "Cerrada",        cls: "bg-gray-100 text-gray-600 border-gray-200",         dot: "bg-gray-400" },
  };
  const s = map[value] || map.abierta;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}

function ObservationRow({ obs, onOpen }) {
  const replies = obs.thread?.length || 0;
  const isUrgent = obs.severity === "urgente";
  const initials = (obs.student?.full_name || "??").split(",").pop().trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <button
      onClick={onOpen}
      className={`group relative w-full flex items-start gap-4 px-5 py-4 text-left border-b border-gray-100 last:border-0 transition-colors duration-150 hover:bg-gray-50/70 ${isUrgent ? "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:bg-red-500 before:rounded-r-full" : ""}`}
      data-testid={`obs-row-${obs.id}`}
    >
      <div className="w-10 h-10 rounded-full bg-[#0B2C5F]/8 ring-1 ring-[#0B2C5F]/10 flex items-center justify-center text-[#0B2C5F] font-semibold text-xs flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{obs.student?.full_name}</p>
          <span className="text-gray-300">·</span>
          <p className="text-xs text-gray-500 truncate">{obs.student?.grade_name} {obs.student?.section_name}</p>
        </div>
        <p className="text-sm text-gray-700 line-clamp-1 mb-2">{obs.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge value={obs.category} />
          <SeverityBadge value={obs.severity} />
          <StatusBadge value={obs.status} />
          {replies > 0 && (
            <span className="text-[11px] text-gray-500 inline-flex items-center gap-1 ml-1">
              <MessageSquare className="w-3 h-3" /> {replies}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
        <p className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">{new Date(obs.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</p>
        <p className="text-[11px] text-gray-500 max-w-[140px] truncate">para {obs.tutor_name}</p>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
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
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose} data-testid="composer-modal">
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#0B2C5F]/5 border border-[#0B2C5F]/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-[#0B2C5F]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-gray-900">Nuevo mensaje al tutor</h2>
              <p className="text-xs text-gray-500 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Privado — solo tú y el tutor del alumno</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors" data-testid="composer-close">
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
          {/* Alumno */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2 block">Alumno</label>
            {selectedStudent ? (
              <div className="flex items-center gap-3 bg-[#0B2C5F]/3 border border-[#0B2C5F]/12 rounded-xl p-3.5">
                <div className="w-11 h-11 rounded-full bg-[#0B2C5F] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {(selectedStudent.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate text-sm">{selectedStudent.full_name}</p>
                  <p className="text-xs text-gray-500 mb-1">{selectedStudent.grade_name} {selectedStudent.section_name}</p>
                  {selectedStudent.tutor ? (
                    <p className="text-xs text-gray-700 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-[#0B2C5F]" /> Tutor: <span className="font-medium">{selectedStudent.tutor.name}</span>
                      {selectedStudent.tutor.self && <span className="text-amber-700"> (eres tú)</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sin tutor asignado</p>
                  )}
                </div>
                <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-white transition-colors" title="Cambiar alumno" data-testid="change-student-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o grado..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/20 focus:border-[#0B2C5F] transition-all"
                    data-testid="composer-student-search"
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50/40">
                  {loadingStudents ? (
                    <div className="p-5 text-center text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Cargando alumnos...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-5 text-center text-sm text-gray-500">No hay alumnos que coincidan</div>
                  ) : filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStudent(s); setStudentSearch(""); }}
                      className="w-full px-3 py-2.5 hover:bg-white border-b border-gray-100 last:border-0 text-left flex items-center gap-3 transition-colors"
                      data-testid={`composer-student-${s.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold text-xs flex-shrink-0">
                        {(s.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{s.grade_name} {s.section_name} {s.tutor ? `· Tutor: ${s.tutor.name}` : "· Sin tutor"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {noTutorBlocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div><strong>Esta sección no tiene tutor asignado.</strong> No podrás enviar el mensaje. Pide al administrador del colegio que asigne uno desde &ldquo;Gestión de Tutorías&rdquo;.</div>
            </div>
          )}
          {isSelfTutor && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-sm text-blue-800 flex items-start gap-2.5">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>Eres el tutor de este alumno. Registra esta nota directamente desde &ldquo;Mis Tutorías&rdquo; en lugar de aquí.</div>
            </div>
          )}

          {/* Categoría — chips */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2 block">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => {
                const isOn = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all ${isOn ? "border-[#0B2C5F] bg-[#0B2C5F] text-white shadow-sm" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
                    data-testid={`composer-category-${c.value}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severidad — radio cards */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2 block">Severidad</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SEVERITIES.map(s => {
                const Icon = s.icon;
                const isOn = severity === s.value;
                const ring = s.value === "info" ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/50"
                  : s.value === "atencion" ? "border-amber-500 ring-1 ring-amber-500 bg-amber-50/50"
                  : "border-red-500 ring-1 ring-red-500 bg-red-50/50";
                const iconColor = s.value === "info" ? "text-blue-600" : s.value === "atencion" ? "text-amber-600" : "text-red-600";
                return (
                  <button
                    key={s.value}
                    onClick={() => setSeverity(s.value)}
                    className={`relative flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left shadow-sm transition-all ${isOn ? ring : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"}`}
                    data-testid={`composer-severity-${s.value}`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${isOn ? iconColor : "text-gray-400"}`} strokeWidth={1.8} />
                    <span className={`text-sm font-medium ${isOn ? "text-gray-900" : "text-gray-700"}`}>{s.label === "Urgente · notifica al tutor" ? "Urgente" : s.label}</span>
                    <span className="text-[11px] text-gray-500 leading-snug">
                      {s.value === "info" && "Solo a modo informativo"}
                      {s.value === "atencion" && "Requiere atención del tutor"}
                      {s.value === "urgente" && "Notifica push al tutor"}
                    </span>
                    {s.value === "urgente" && isOn && <Bell className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-red-500" />}
                  </button>
                );
              })}
            </div>
            {severity === "urgente" && (
              <p className="text-xs text-red-600 mt-2 inline-flex items-center gap-1"><Bell className="w-3 h-3" /> Se enviará una notificación push inmediata al tutor.</p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2 block">Fecha del incidente</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/20 focus:border-[#0B2C5F] transition-all"
              data-testid="composer-fecha"
            />
          </div>

          {/* Asunto — ghost input estilo Notion */}
          <div className="pt-2 border-t border-gray-100">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Asunto del mensaje..."
              className="w-full bg-transparent text-2xl font-semibold tracking-tight text-gray-900 placeholder:text-gray-300 focus:outline-none border-0"
              data-testid="composer-title"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-gray-400">Sé claro y breve — ej: &ldquo;No trajo el material de matemáticas&rdquo;</p>
              <p className="text-[11px] text-gray-400 tabular-nums">{title.length}/200</p>
            </div>
          </div>

          {/* Mensaje — ghost textarea */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={6}
              placeholder="Escribe tu mensaje al tutor. Incluye contexto, qué pasó y qué acción tomaste si la hubo..."
              className="w-full bg-transparent text-base text-gray-700 placeholder:text-gray-400 focus:outline-none border-0 resize-none leading-relaxed min-h-[140px]"
              data-testid="composer-description"
            />
            <p className="text-[11px] text-gray-400 tabular-nums text-right">{description.length}/4000</p>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 sticky bottom-0 z-10">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1.5"><Lock className="w-3 h-3" /> El tutor recibirá tu mensaje y podrá responderte en el hilo.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
            <button
              onClick={submit}
              disabled={submitting || noTutorBlocked || isSelfTutor || !selectedStudent}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B2C5F] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#082046] disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/30 active:scale-[0.98] transition-all"
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
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose} data-testid="detail-modal">
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#0B2C5F] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {(obs.student?.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{obs.student?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{obs.student?.grade_name} {obs.student?.section_name} · {new Date(obs.created_at).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge value={obs.category} />
            <SeverityBadge value={obs.severity} />
            <StatusBadge value={obs.status} />
            {obs.fecha_incidente && (
              <span className="text-[11px] text-gray-500 ml-1">Incidente: {obs.fecha_incidente}</span>
            )}
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 mb-2">{obs.title}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{obs.description}</p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-600 flex items-center gap-2.5">
            <GraduationCap className="w-4 h-4 text-[#0B2C5F]" />
            <span>Mensaje enviado a <strong className="text-gray-900">{obs.tutor_name}</strong> · tutor del salón</span>
            {obs.read_by_tutor_at && (
              <span className="ml-auto inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Leído</span>
            )}
          </div>

          {/* Thread — chat bubbles premium */}
          {obs.thread && obs.thread.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Hilo de conversación</p>
              <div className="flex flex-col gap-3">
                {obs.thread.map(msg => {
                  const mine = msg.author_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                        <p className="text-[10px] font-medium text-gray-500 px-1">{mine ? "Tú" : msg.author_name}</p>
                        <div className={`px-4 py-2.5 ${mine ? "bg-[#0B2C5F] text-white rounded-2xl rounded-tr-md" : "bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-md"} shadow-sm`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                        <p className={`text-[10px] ${mine ? "text-gray-400" : "text-gray-400"} px-1 tabular-nums`}>{new Date(msg.ts).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 bg-white sticky bottom-0 z-10">
          {isClosed ? (
            <p className="text-sm text-gray-500 text-center py-2 inline-flex items-center justify-center gap-1.5 w-full"><Lock className="w-3.5 h-3.5" /> El hilo está cerrado. El tutor puede reabrirlo desde su inbox.</p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder en el hilo..."
                rows={2}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/20 focus:border-[#0B2C5F] resize-none transition-all placeholder:text-gray-400"
                data-testid="detail-reply-input"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#0B2C5F] hover:bg-[#082046] disabled:bg-gray-200 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0B2C5F]/30 active:scale-[0.95] transition-all flex-shrink-0"
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
