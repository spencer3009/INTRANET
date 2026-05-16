// MisTutoriasPage — Portal del Profesor-Tutor (Fase C)
//
// Soporta múltiples secciones. Si el tutor tiene >1 salón, muestra grid de
// tarjetas de selección. Al elegir una sección, abre un dashboard con 3 tabs:
//   1. Conducta + Comentarios (bulk edit, autosave)
//   2. Consolidado del salón (read-only — el tutor ve todas las materias
//      incluyendo cursos que él no dicta)
//   3. Libretas individuales (cards con link a la libreta completa)
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  GraduationCap, Loader2, Lock, Save, AlertTriangle, ExternalLink,
  ArrowLeft, Users, MessageSquare, BarChart3, BookOpen, ChevronRight, RefreshCw,
  Bell, AlertCircle, Info, CheckCircle2, Send, X,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TeacherSidebar from "@/components/TeacherSidebar";
import DashboardHeader from "@/components/DashboardHeader";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MisTutoriasPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sections + periods
  const [loadingSections, setLoadingSections] = useState(true);
  const [sections, setSections] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [schoolSettings, setSchoolSettings] = useState(null);

  // Cargar settings del colegio (logo, nombre) para el header
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

  // Selected section (from query param or auto)
  const selectedSectionId = searchParams.get("section_id") || "";
  const activeTab = searchParams.get("tab") || "comentarios"; // comentarios | consolidado | libretas

  // Step 1 — load sections + periods
  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          axios.get(`${API}/mis-tutorias/sections`, { headers }),
          axios.get(`${API}/academic/periods`, { headers }),
        ]);
        const secs = s.data?.sections || [];
        setSections(secs);
        const periodList = Array.isArray(p.data) ? p.data : (p.data?.periods || []);
        periodList.sort((a, b) => (a.orden || 0) - (b.orden || 0));
        setPeriods(periodList);
        const active = periodList.find(x => x.activo) || periodList[0];
        if (active) setSelectedPeriodId(active.id);
        // Auto-select if exactly 1 section
        if (secs.length === 1 && !selectedSectionId) {
          setSearchParams({ section_id: secs[0].section_id, tab: "comentarios" }, { replace: true });
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || "No se pudieron cargar tus tutorías.");
      } finally {
        setLoadingSections(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const goToSection = (sectionId, tab = "comentarios") => {
    setSearchParams({ section_id: sectionId, tab }, { replace: false });
  };
  const switchTab = (tab) => {
    setSearchParams({ section_id: selectedSectionId, tab }, { replace: true });
  };
  const backToCards = () => {
    setSearchParams({}, { replace: false });
  };

  const selectedSection = sections.find(s => s.section_id === selectedSectionId);
  const sectionLabel = (s) =>
    `${s.grado_nombre || "—"} ${s.nombre || ""}`.replace(/\s+/g, " ").trim();
  const fullSectionLabel = (s) =>
    `${(s.nivel_nombre || "").toUpperCase()} · ${s.grado_nombre || ""} ${s.nombre || ""}`.replace(/\s+/g, " ").trim();

  // Render: loading | empty | cards | dashboard
  const renderBody = () => {
    if (loadingSections) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="mis-tutorias-loading">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Cargando tus tutorías…</p>
        </div>
      );
    }
    if (sections.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="mis-tutorias-empty">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-800 font-semibold mb-1">No tienes secciones asignadas como tutor</p>
          <p className="text-sm text-slate-500">Para acceder a esta vista, el administrador debe asignarte como tutor de al menos una sección.</p>
        </div>
      );
    }
    if (!selectedSectionId) {
      // Grid de tarjetas
      return (
        <SectionCardsGrid sections={sections} onPick={goToSection} fullLabel={fullSectionLabel} />
      );
    }
    // Dashboard de la sección
    if (!selectedSection) {
      return (
        <div className="bg-white rounded-2xl border border-amber-200 p-6 text-amber-800 text-sm">
          La sección seleccionada ya no está asignada a ti.{" "}
          <button onClick={backToCards} className="underline font-semibold">Volver a mis salones</button>.
        </div>
      );
    }
    return (
      <SectionDashboard
        user={user}
        headers={headers}
        section={selectedSection}
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        onChangePeriod={setSelectedPeriodId}
        activeTab={activeTab}
        onSwitchTab={switchTab}
        onBack={sections.length > 1 ? backToCards : null}
      />
    );
  };

  const navigateTo = (path) => navigate(`/${user?.subdomain || ""}${path}`.replace(/\/+/g, "/"));

  // Render appropriate sidebar based on user role
  const isTeacherRole = user?.role === "teacher";
  const SidebarComponent = isTeacherRole ? TeacherSidebar : Sidebar;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <SidebarComponent
        active="mis-tutorias"
        onNavigate={(r) => navigateTo(r)}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={user?.school_name}
        subdomain={user?.subdomain}
        user={user}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(!sidebarOpen)} logoUrl={logoUrl} schoolName={schoolName} subdomain={user?.subdomain} token={token} />

        <div className="flex-1 p-6 lg:p-8" data-testid="mis-tutorias-page">
          <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-indigo-600" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">Mis Tutorías</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Gestiona la conducta, los comentarios y revisa el rendimiento de los salones donde eres tutor.
                </p>
              </div>
            </header>
            {renderBody()}
          </div>
        </div>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1) GRID DE TARJETAS DE SECCIÓN
// ════════════════════════════════════════════════════════════════════════════
function SectionCardsGrid({ sections, onPick, fullLabel }) {
  return (
    <div data-testid="mis-tutorias-cards-grid">
      <p className="text-sm text-slate-600 mb-4">
        Eres tutor de <strong>{sections.length}</strong> sección{sections.length === 1 ? "" : "es"}. Elige una para gestionar:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(s => (
          <button
            key={s.section_id}
            onClick={() => onPick(s.section_id)}
            className="group bg-white border-2 border-slate-200 hover:border-indigo-400 hover:shadow-lg rounded-2xl p-5 text-left transition-all"
            data-testid={`tutoring-card-${s.section_id}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                <Users className="w-6 h-6 text-indigo-700" strokeWidth={1.8} />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{s.nivel_nombre || "—"}</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{s.grado_nombre || "—"} · Sección {s.nombre}</h3>
            <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {s.student_count} alumno{s.student_count === 1 ? "" : "s"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2) DASHBOARD DE SECCIÓN — Header + Tabs
// ════════════════════════════════════════════════════════════════════════════
function SectionDashboard({ user, headers, section, periods, selectedPeriodId, onChangePeriod, activeTab, onSwitchTab, onBack }) {
  return (
    <div className="space-y-4">
      {/* Encabezado del salón */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            data-testid="back-to-cards-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Mis salones
          </button>
        )}
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{section.nivel_nombre || "—"}</p>
          <h2 className="text-xl font-bold text-slate-900">
            {section.grado_nombre} · Sección {section.nombre}
            <span className="ml-2 text-sm text-slate-500 font-normal">({section.student_count} alumnos)</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Bimestre:</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => onChangePeriod(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            data-testid="dashboard-period-select"
          >
            {periods.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? " · activo" : ""}</option>)}
          </select>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 inline-flex flex-wrap gap-1" data-testid="dashboard-tabs">
        <TabButton id="comentarios" label="Conducta & Comentarios" icon={MessageSquare} active={activeTab === "comentarios"} onClick={() => onSwitchTab("comentarios")} />
        <TabButton id="observaciones" label="Mensajes del profesor" icon={Bell} active={activeTab === "observaciones"} onClick={() => onSwitchTab("observaciones")} />
        <TabButton id="consolidado" label="Consolidado del salón" icon={BarChart3} active={activeTab === "consolidado"} onClick={() => onSwitchTab("consolidado")} />
        <TabButton id="libretas" label="Libretas individuales" icon={BookOpen} active={activeTab === "libretas"} onClick={() => onSwitchTab("libretas")} />
      </div>

      {/* Tab content */}
      <div data-testid={`tab-content-${activeTab}`}>
        {activeTab === "comentarios" && (
          <BulkConductCommentsTab user={user} headers={headers} sectionId={section.section_id} periodId={selectedPeriodId} />
        )}
        {activeTab === "observaciones" && (
          <TutorObservationsInboxTab headers={headers} sectionId={section.section_id} user={user} />
        )}
        {activeTab === "consolidado" && (
          <ConsolidatedTab headers={headers} sectionId={section.section_id} periodId={selectedPeriodId} />
        )}
        {activeTab === "libretas" && (
          <LibretasTab user={user} headers={headers} sectionId={section.section_id} periodId={selectedPeriodId} />
        )}
      </div>
    </div>
  );
}

function TabButton({ id, label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
      }`}
      data-testid={`tab-${id}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — Conducta + Comentarios bulk (preserva la lógica del archivo anterior)
// ════════════════════════════════════════════════════════════════════════════
function BulkConductCommentsTab({ user, headers, sectionId, periodId }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [periodInfo, setPeriodInfo] = useState(null);
  const [savingMap, setSavingMap] = useState({});
  const timersRef = useRef({});

  const load = useCallback(async () => {
    if (!sectionId || !periodId) return;
    setLoading(true);
    setRows([]);
    try {
      const r = await axios.get(`${API}/mis-tutorias/bulk`, {
        params: { section_id: sectionId, period_id: periodId }, headers,
      });
      setRows(r.data?.students || []);
      setPeriodInfo(r.data?.period || null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar la información del bimestre.");
    } finally {
      setLoading(false);
    }
  }, [sectionId, periodId, headers]);
  useEffect(() => { load(); }, [load]);

  // Autosave comentario debounced 700ms
  const handleChange = (student_id, value) => {
    setRows(prev => prev.map(r => r.student_id === student_id ? { ...r, comment: value } : r));
    if (timersRef.current[student_id]) clearTimeout(timersRef.current[student_id]);
    setSavingMap(prev => ({ ...prev, [student_id]: "pending" }));
    timersRef.current[student_id] = setTimeout(() => saveOne(student_id, value), 700);
  };
  const saveOne = async (student_id, comment) => {
    setSavingMap(prev => ({ ...prev, [student_id]: "saving" }));
    try {
      await axios.put(`${API}/tutor-comments`, { student_id, period_id: periodId, comment: comment || "" }, { headers });
      setSavingMap(prev => ({ ...prev, [student_id]: "saved" }));
      setTimeout(() => setSavingMap(prev => { const n = { ...prev }; delete n[student_id]; return n; }), 1500);
    } catch (err) {
      setSavingMap(prev => ({ ...prev, [student_id]: "error" }));
      if (err.response?.status === 423) toast.error("Este bimestre ya está cerrado.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar el comentario.");
    }
  };
  const saveConduct = async (student_id, letra) => {
    const prevLetra = rows.find(r => r.student_id === student_id)?.conduct_letra;
    setRows(prev => prev.map(r => r.student_id === student_id ? { ...r, conduct_letra: letra || null } : r));
    setSavingMap(prev => ({ ...prev, [student_id + "_c"]: "saving" }));
    try {
      if (!letra) {
        setRows(prev => prev.map(r => r.student_id === student_id ? { ...r, conduct_letra: prevLetra || null } : r));
        toast.info("La conducta no puede dejarse vacía. Elige AD, A, B o C.");
        return;
      }
      await axios.put(`${API}/conduct`, { student_id, period_id: periodId, letra }, { headers });
      setSavingMap(prev => ({ ...prev, [student_id + "_c"]: "saved" }));
      setTimeout(() => setSavingMap(prev => { const n = { ...prev }; delete n[student_id + "_c"]; return n; }), 1500);
    } catch (err) {
      setRows(prev => prev.map(r => r.student_id === student_id ? { ...r, conduct_letra: prevLetra || null } : r));
      setSavingMap(prev => ({ ...prev, [student_id + "_c"]: "error" }));
      if (err.response?.status === 423) toast.error("Bimestre cerrado. No se puede modificar la conducta.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar la conducta.");
    }
  };

  const filledCom = rows.filter(r => (r.comment || "").trim().length > 0).length;
  const filledCon = rows.filter(r => !!r.conduct_letra).length;

  return (
    <div className="space-y-3">
      {/* Mini-resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Alumnos" value={rows.length} />
        <MiniStat label="Comentarios" value={`${filledCom}/${rows.length}`} accent={filledCom === rows.length && rows.length > 0 ? "emerald" : "amber"} />
        <MiniStat label="Conducta" value={`${filledCon}/${rows.length}`} accent={filledCon === rows.length && rows.length > 0 ? "emerald" : "amber"} />
        <MiniStat label="Bimestre" value={periodInfo?.nombre || "—"} accent={periodInfo?.activo ? "indigo" : "slate"} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" /><p className="text-sm text-slate-500">Cargando alumnos…</p></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-500 italic">Esta sección no tiene alumnos registrados.</div>
        ) : (
          <table className="w-full" data-testid="mis-tutorias-table">
            <thead className="bg-slate-900 text-white text-sm">
              <tr>
                <th className="px-3 py-2.5 text-left w-12">N°</th>
                <th className="px-3 py-2.5 text-left w-72">APELLIDOS Y NOMBRES</th>
                <th className="px-3 py-2.5 text-left">COMENTARIO DEL TUTOR — {periodInfo?.nombre}</th>
                <th className="px-3 py-2.5 text-center w-28">CONDUCTA</th>
                <th className="px-3 py-2.5 text-center w-32">LIBRETA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const closed = r.is_closed;
                const status = savingMap[r.student_id];
                const condStatus = savingMap[r.student_id + "_c"];
                return (
                  <tr key={r.student_id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`tutoria-row-${r.number}`}>
                    <td className="px-3 py-2 text-sm text-slate-600 align-top">{r.number}</td>
                    <td className="px-3 py-2 align-top">
                      <p className="text-sm font-medium text-slate-900">{r.student_name}</p>
                      {r.student_code && <p className="text-xs text-slate-400">{r.student_code}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={r.comment || ""}
                        onChange={(e) => handleChange(r.student_id, e.target.value)}
                        placeholder={closed ? "Este bimestre ya está cerrado" : "Escribir comentario..."}
                        readOnly={closed}
                        rows={2}
                        className={`w-full px-3 py-2 text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 ${closed ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"}`}
                        data-testid={`tutoria-textarea-${r.number}`}
                      />
                      <div className="h-4 mt-1 text-[11px]">
                        {closed ? <span className="text-amber-700 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> bloqueado</span>
                          : status === "saving" || status === "pending" ? <span className="text-slate-500 inline-flex items-center gap-1" data-testid={`tutoria-status-${r.number}`}><Loader2 className="w-3 h-3 animate-spin" /> guardando…</span>
                          : status === "saved" ? <span className="text-emerald-700 inline-flex items-center gap-1" data-testid={`tutoria-status-${r.number}`}><Save className="w-3 h-3" /> guardado</span>
                          : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      <select
                        value={r.conduct_letra || ""}
                        onChange={(e) => saveConduct(r.student_id, e.target.value)}
                        disabled={closed}
                        className={`px-2 py-1.5 text-sm border rounded-lg w-20 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-center ${closed ? "bg-slate-100 text-slate-400 cursor-not-allowed" : r.conduct_letra ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                        data-testid={`tutoria-conduct-${r.number}`}
                      >
                        <option value="">—</option>
                        <option value="AD">AD</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                      <div className="h-4 mt-1 text-[11px]">
                        {condStatus === "saving" ? <span className="text-slate-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> guardando</span>
                          : condStatus === "saved" ? <span className="text-emerald-700">✓ guardado</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      <a
                        href={`/${user?.subdomain || "elroble"}/libreta/${r.student_id}?period_id=${periodId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                        data-testid={`tutoria-libreta-link-${r.number}`}
                      >
                        <ExternalLink className="w-3 h-3" /> Ver
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  const ring = accent === "emerald" ? "ring-emerald-100"
    : accent === "amber" ? "ring-amber-100"
    : accent === "indigo" ? "ring-indigo-100"
    : "ring-slate-100";
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ring-2 ${ring}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — Consolidado del salón (read-only)
// ════════════════════════════════════════════════════════════════════════════
function ConsolidatedTab({ headers, sectionId, periodId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!sectionId || !periodId) return;
    setLoading(true); setError(null);
    try {
      const r = await axios.get(`${API}/mis-tutorias/sections/${sectionId}/consolidated`, {
        params: { period_id: periodId }, headers,
      });
      setData(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo cargar el consolidado.");
    } finally {
      setLoading(false);
    }
  }, [sectionId, periodId, headers]);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando consolidado…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6 text-amber-800 text-sm" data-testid="consolidated-error">
        <AlertTriangle className="w-5 h-5 inline mr-1" /> {error}
      </div>
    );
  }
  if (!data || !data.students?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 italic">
        No hay notas registradas para este bimestre todavía.
      </div>
    );
  }

  const subjects = data.subjects || [];
  const students = data.students || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Consolidado · {data.grade_name} {data.section_name}</h3>
          <p className="text-xs text-slate-500">{data.period_name} · {students.length} alumnos · {subjects.length} asignaturas · Vista de solo lectura</p>
        </div>
        <button onClick={load} className="text-xs px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5" data-testid="consolidated-reload">
          <RefreshCw className="w-3.5 h-3.5" /> Recargar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="consolidated-table">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Apellidos y Nombres</th>
              {subjects.map(s => (
                <th key={s.id} className="px-3 py-2 text-center" title={s.name}>
                  {s.code || s.name?.slice(0, 8)}
                </th>
              ))}
              <th className="px-3 py-2 text-center">Prom.</th>
              <th className="px-3 py-2 text-center">Orden</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => (
              <tr key={st.student_id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`consolidated-row-${st.number}`}>
                <td className="px-3 py-1.5 text-slate-500">{st.number}</td>
                <td className="px-3 py-1.5 font-medium text-slate-900">{st.student_name}</td>
                {subjects.map(s => {
                  const g = st.grades?.[s.id];
                  const color = g == null ? "text-slate-300" : g < 11 ? "text-red-600 font-semibold" : "text-slate-700";
                  return <td key={s.id} className={`px-3 py-1.5 text-center ${color}`}>{g == null ? "—" : g}</td>;
                })}
                <td className="px-3 py-1.5 text-center font-bold text-slate-900">{st.average ?? "—"}</td>
                <td className="px-3 py-1.5 text-center text-slate-500">{st.rank ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — Libretas individuales
// ════════════════════════════════════════════════════════════════════════════
function LibretasTab({ user, headers, sectionId, periodId }) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (!sectionId || !periodId) return;
    setLoading(true);
    (async () => {
      try {
        const r = await axios.get(`${API}/mis-tutorias/bulk`, {
          params: { section_id: sectionId, period_id: periodId }, headers,
        });
        setStudents(r.data?.students || []);
      } catch (err) {
        toast.error(err.response?.data?.detail || "No se pudieron cargar los alumnos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sectionId, periodId, headers]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando alumnos…</p>
      </div>
    );
  }
  if (!students.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 italic">
        No hay alumnos en esta sección.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4" data-testid="libretas-grid">
      <p className="text-xs text-slate-500 mb-3 px-1">Haz clic en una tarjeta para abrir la libreta completa del alumno en una pestaña nueva.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.map(st => {
          const initials = (st.student_name || "??").split(",").pop().trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <a
              key={st.student_id}
              href={`/${user?.subdomain || "elroble"}/libreta/${st.student_id}?period_id=${periodId}`}
              target="_blank" rel="noopener noreferrer"
              className="group bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl p-3 flex items-center gap-3 transition-all"
              data-testid={`libreta-card-${st.number}`}
            >
              <div className="w-11 h-11 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{st.student_name}</p>
                <p className="text-xs text-slate-500">{st.student_code || `Alumno N° ${st.number}`}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// TAB — Observaciones del Aula (bandeja del Tutor)
// ════════════════════════════════════════════════════════════════════════════
const OBS_CATEGORIES = {
  academica:  { label: "Académica",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  conductual: { label: "Conductual",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  asistencia: { label: "Asistencia",  color: "bg-purple-100 text-purple-700 border-purple-200" },
  salud:      { label: "Salud",       color: "bg-pink-100 text-pink-700 border-pink-200" },
  otro:       { label: "Otro",        color: "bg-slate-100 text-slate-700 border-slate-200" },
};
const OBS_SEVERITIES = {
  info:     { label: "Informativa",        icon: Info,           color: "bg-slate-100 text-slate-700 border-slate-200" },
  atencion: { label: "Requiere atención",  icon: AlertCircle,    color: "bg-amber-100 text-amber-700 border-amber-200" },
  urgente:  { label: "Urgente",            icon: AlertTriangle,  color: "bg-red-100 text-red-700 border-red-200" },
};
const OBS_STATUSES = {
  abierta:        { label: "Abierta",        color: "bg-blue-100 text-blue-700" },
  en_seguimiento: { label: "En seguimiento", color: "bg-amber-100 text-amber-700" },
  cerrada:        { label: "Cerrada",        color: "bg-emerald-100 text-emerald-700" },
};

function ObsCategoryBadge({ value }) {
  const c = OBS_CATEGORIES[value] || OBS_CATEGORIES.otro;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.color}`}>{c.label}</span>;
}
function ObsSeverityBadge({ value }) {
  const s = OBS_SEVERITIES[value] || OBS_SEVERITIES.info;
  const Icon = s.icon;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${s.color}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}
function ObsStatusBadge({ value }) {
  const s = OBS_STATUSES[value] || OBS_STATUSES.abierta;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>;
}

function TutorObservationsInboxTab({ headers, sectionId, user }) {
  const [loading, setLoading] = useState(false);
  const [observations, setObservations] = useState([]);
  const [counts, setCounts] = useState({ total: 0, abierta: 0, en_seguimiento: 0, cerrada: 0, unread: 0 });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/tutor/observations`, {
        params: { section_id: sectionId }, headers,
      });
      setObservations(r.data?.observations || []);
      setCounts(r.data?.counts || { total: 0, abierta: 0, en_seguimiento: 0, cerrada: 0, unread: 0 });
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar la bandeja de mensajes");
    } finally {
      setLoading(false);
    }
  }, [sectionId, headers]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = observations;
    if (filterStatus !== "all") list = list.filter(o => o.status === filterStatus);
    if (filterSeverity !== "all") list = list.filter(o => o.severity === filterSeverity);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.student?.full_name || "").toLowerCase().includes(q) ||
        (o.title || "").toLowerCase().includes(q) ||
        (o.author_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [observations, filterStatus, filterSeverity, search]);

  const openObservation = async (obs) => {
    try {
      const r = await axios.get(`${API}/teacher/observations/${obs.id}`, { headers });
      setActive(r.data);
      setObservations(prev => prev.map(o => o.id === obs.id ? { ...o, ...r.data } : o));
      // Refrescar contadores si pasó de no-leído a leído
      if (!obs.read_by_tutor_at) {
        setCounts(prev => ({ ...prev, unread: Math.max(0, (prev.unread || 0) - 1) }));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar el mensaje");
    }
  };

  const handleUpdated = (updated) => {
    setActive(updated);
    setObservations(prev => {
      const next = prev.map(o => o.id === updated.id ? updated : o);
      // Recalcular counts
      setCounts({
        total: next.length,
        abierta: next.filter(o => o.status === "abierta").length,
        en_seguimiento: next.filter(o => o.status === "en_seguimiento").length,
        cerrada: next.filter(o => o.status === "cerrada").length,
        unread: next.filter(o => !o.read_by_tutor_at).length,
      });
      return next;
    });
  };

  return (
    <div className="space-y-3" data-testid="tutor-obs-inbox">
      {/* Mini-stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Total" value={counts.total} />
        <MiniStat label="Sin leer" value={counts.unread} accent={counts.unread > 0 ? "amber" : "slate"} />
        <MiniStat label="Abiertos" value={counts.abierta} accent="indigo" />
        <MiniStat label="En seguimiento" value={counts.en_seguimiento} accent="amber" />
        <MiniStat label="Cerrados" value={counts.cerrada} accent="emerald" />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar alumno, asunto o profesor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            data-testid="tutor-obs-search"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          data-testid="tutor-obs-status-filter"
        >
          <option value="all">Todos los estados</option>
          <option value="abierta">Abiertos</option>
          <option value="en_seguimiento">En seguimiento</option>
          <option value="cerrada">Cerrados</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          data-testid="tutor-obs-severity-filter"
        >
          <option value="all">Cualquier severidad</option>
          <option value="urgente">Urgente</option>
          <option value="atencion">Requiere atención</option>
          <option value="info">Informativa</option>
        </select>
        <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Recargar" data-testid="tutor-obs-reload">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Cargando observaciones...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="tutor-obs-empty">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold mb-1">No hay mensajes</p>
          <p className="text-sm text-slate-500">
            {counts.total === 0
              ? "Cuando un profesor te envíe un mensaje sobre un alumno de esta sección, aparecerá aquí."
              : "Ajusta los filtros para ver más resultados."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100" data-testid="tutor-obs-list">
          {filtered.map(o => (
            <TutorObservationRow key={o.id} obs={o} onOpen={() => openObservation(o)} />
          ))}
        </div>
      )}

      {active && (
        <TutorDetailModal
          obs={active}
          headers={headers}
          currentUserId={user?.id}
          onClose={() => setActive(null)}
          onUpdate={handleUpdated}
        />
      )}
    </div>
  );
}

function TutorObservationRow({ obs, onOpen }) {
  const replies = obs.thread?.length || 0;
  const unread = !obs.read_by_tutor_at;
  return (
    <button
      onClick={onOpen}
      className={`w-full p-4 hover:bg-slate-50/60 transition-colors text-left flex items-start gap-3 ${unread ? "bg-indigo-50/40" : ""}`}
      data-testid={`tutor-obs-row-${obs.id}`}
    >
      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0 relative">
        {(obs.student?.full_name || "??").split(",").pop().trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
        {unread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`truncate ${unread ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>{obs.student?.full_name}</p>
          <span className="text-xs text-slate-400">·</span>
          <p className="text-xs text-slate-500 truncate">mensaje de {obs.author_name}</p>
        </div>
        <p className="text-sm text-slate-700 mt-1 line-clamp-1">{obs.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <ObsCategoryBadge value={obs.category} />
          <ObsSeverityBadge value={obs.severity} />
          <ObsStatusBadge value={obs.status} />
          {replies > 0 && (
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {replies} respuesta{replies === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <p className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(obs.created_at).toLocaleDateString("es-PE")}</p>
        <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </button>
  );
}

function TutorDetailModal({ obs: initial, headers, currentUserId, onClose, onUpdate }) {
  const [obs, setObs] = useState(initial);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/teacher/observations/${obs.id}/reply`, { text: reply.trim() }, { headers });
      setObs(r.data); onUpdate(r.data); setReply("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo enviar la respuesta");
    } finally { setSending(false); }
  };  const changeStatus = async (status) => {
    setUpdatingStatus(true);
    try {
      const r = await axios.patch(`${API}/tutor/observations/${obs.id}/status`, { status }, { headers });
      setObs(r.data); onUpdate(r.data);
      toast.success(status === "cerrada" ? "Hilo cerrado" : status === "en_seguimiento" ? "Marcado en seguimiento" : "Reabierto");
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cambiar el estado");
    } finally { setUpdatingStatus(false); }
  };

  const isClosed = obs.status === "cerrada";

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={onClose} data-testid="tutor-detail-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-sm flex-shrink-0">
              {(obs.student?.full_name || "??").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{obs.student?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">
                {obs.student?.grade_name} {obs.student?.section_name} · Mensaje de <strong>{obs.author_name}</strong> · {new Date(obs.created_at).toLocaleString("es-PE")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-100 rounded-lg flex-shrink-0" data-testid="tutor-detail-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <ObsCategoryBadge value={obs.category} />
            <ObsSeverityBadge value={obs.severity} />
            <ObsStatusBadge value={obs.status} />
            {obs.fecha_incidente && (
              <span className="text-[11px] text-slate-500">Incidente: {obs.fecha_incidente}</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{obs.title}</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.description}</p>

          {/* Acciones de estado */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {obs.status !== "en_seguimiento" && !isClosed && (
              <button
                onClick={() => changeStatus("en_seguimiento")}
                disabled={updatingStatus}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg inline-flex items-center gap-1.5"
                data-testid="tutor-status-seguimiento"
              >
                <AlertCircle className="w-3.5 h-3.5" /> Marcar en seguimiento
              </button>
            )}
            {!isClosed && (
              <button
                onClick={() => changeStatus("cerrada")}
                disabled={updatingStatus}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg inline-flex items-center gap-1.5"
                data-testid="tutor-status-cerrar"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Cerrar hilo
              </button>
            )}
            {isClosed && (
              <button
                onClick={() => changeStatus("en_seguimiento")}
                disabled={updatingStatus}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg inline-flex items-center gap-1.5"
                data-testid="tutor-status-reabrir"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reabrir hilo
              </button>
            )}
          </div>

          {/* Thread */}
          {obs.thread && obs.thread.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hilo de conversación</p>
              {obs.thread.map(msg => {
                const mine = msg.author_id === currentUserId;
                return (
                  <div key={msg.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                      {(msg.author_name || "?").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] ${mine ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-800"} rounded-2xl px-3.5 py-2`}>
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
            <p className="text-sm text-slate-500 text-center py-2">El hilo está cerrado. Reábrelo para responder al profesor.</p>
          ) : (
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder al profesor..."
                rows={2}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                data-testid="tutor-reply-input"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-semibold flex items-center gap-1.5"
                data-testid="tutor-reply-btn"
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
