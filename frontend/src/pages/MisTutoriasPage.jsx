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
        <DashboardHeader user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

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
        <TabButton id="consolidado" label="Consolidado del salón" icon={BarChart3} active={activeTab === "consolidado"} onClick={() => onSwitchTab("consolidado")} />
        <TabButton id="libretas" label="Libretas individuales" icon={BookOpen} active={activeTab === "libretas"} onClick={() => onSwitchTab("libretas")} />
      </div>

      {/* Tab content */}
      <div data-testid={`tab-content-${activeTab}`}>
        {activeTab === "comentarios" && (
          <BulkConductCommentsTab user={user} headers={headers} sectionId={section.section_id} periodId={selectedPeriodId} />
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
