// MisTutoriasPage — Editor en bulk de comentarios del tutor por sección + bimestre.
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { GraduationCap, Loader2, Lock, Save, AlertTriangle, ExternalLink } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MisTutoriasPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [loadingBulk, setLoadingBulk] = useState(false);
  const [rows, setRows] = useState([]);
  const [periodInfo, setPeriodInfo] = useState(null);
  const [savingMap, setSavingMap] = useState({}); // student_id -> "saving" | "saved" | "error"
  const timersRef = useRef({});
  const headers = { Authorization: `Bearer ${token}` };
  const navigateTo = (path) => navigate(`/${user?.subdomain || ""}${path}`.replace(/\/+/g, "/"));

  // 1) Cargar secciones donde soy tutor + bimestres del año
  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          axios.get(`${API}/mis-tutorias/sections`, { headers }),
          axios.get(`${API}/academic/periods`, { headers }),
        ]);
        const secs = s.data?.sections || [];
        setSections(secs);
        if (secs.length > 0) setSelectedSectionId(secs[0].section_id);
        const periodList = Array.isArray(p.data) ? p.data : (p.data?.periods || []);
        periodList.sort((a, b) => (a.orden || 0) - (b.orden || 0));
        setPeriods(periodList);
        // Default: bimestre activo
        const active = periodList.find(x => x.activo) || periodList[0];
        if (active) setSelectedPeriodId(active.id);
      } catch (err) {
        toast.error(err.response?.data?.detail || "No se pudieron cargar las secciones donde eres tutor.");
      } finally {
        setLoadingSections(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  // 2) Al cambiar sección/bimestre, cargar bulk
  const loadBulk = useCallback(async () => {
    if (!selectedSectionId || !selectedPeriodId) return;
    setLoadingBulk(true);
    setRows([]);
    try {
      const r = await axios.get(`${API}/mis-tutorias/bulk`, {
        params: { section_id: selectedSectionId, period_id: selectedPeriodId },
        headers,
      });
      setRows(r.data?.students || []);
      setPeriodInfo(r.data?.period || null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar la información del bimestre.");
    } finally {
      setLoadingBulk(false);
    }
    // eslint-disable-next-line
  }, [selectedSectionId, selectedPeriodId]);

  useEffect(() => { loadBulk(); }, [loadBulk]);

  // 3) Autosave por celda con debounce 700ms
  const handleChange = (student_id, value) => {
    setRows(prev => prev.map(r => r.student_id === student_id ? { ...r, comment: value } : r));
    if (timersRef.current[student_id]) clearTimeout(timersRef.current[student_id]);
    setSavingMap(prev => ({ ...prev, [student_id]: "pending" }));
    timersRef.current[student_id] = setTimeout(() => saveOne(student_id, value), 700);
  };

  const saveOne = async (student_id, comment) => {
    setSavingMap(prev => ({ ...prev, [student_id]: "saving" }));
    try {
      await axios.put(`${API}/tutor-comments`,
        { student_id, period_id: selectedPeriodId, comment: comment || "" },
        { headers });
      setSavingMap(prev => ({ ...prev, [student_id]: "saved" }));
      setTimeout(() => setSavingMap(prev => { const n = { ...prev }; delete n[student_id]; return n; }), 1500);
    } catch (err) {
      setSavingMap(prev => ({ ...prev, [student_id]: "error" }));
      if (err.response?.status === 423) toast.error("Este bimestre ya está cerrado.");
      else toast.error(err.response?.data?.detail || "No se pudo guardar el comentario.");
    }
  };

  const selectedSection = sections.find(s => s.section_id === selectedSectionId);
  const sectionLabel = (s) => `${s.grado_nombre || "—"} ${s.nombre || ""} ${s.nivel_nombre ? s.nivel_nombre.charAt(0).toUpperCase() + s.nivel_nombre.slice(1).toLowerCase() : ""}`.replace(/\s+/g, " ").trim();
  const filledCount = rows.filter(r => (r.comment || "").trim().length > 0).length;
  const emptyCount = rows.length - filledCount;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-indigo-600" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Comentarios del Tutor</h1>
                <p className="text-sm text-slate-500 mt-0.5">Escribe el comentario para cada alumno de tus secciones. Se guarda automáticamente.</p>
              </div>
            </div>

            {loadingSections ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="mis-tutorias-loading">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-500">Cargando tus tutorías…</p>
              </div>
            ) : sections.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="mis-tutorias-empty">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <p className="text-slate-800 font-semibold mb-1">No tienes secciones asignadas como tutor</p>
                <p className="text-sm text-slate-500">Para acceder a esta vista, el administrador debe asignarte como tutor de al menos una sección.</p>
              </div>
            ) : (
              <>
                {/* Selectores */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sección</label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      data-testid="mis-tutorias-section-select"
                    >
                      {sections.map(s => (
                        <option key={s.section_id} value={s.section_id}>{sectionLabel(s)} · {s.student_count} alumnos</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bimestre</label>
                    <select
                      value={selectedPeriodId}
                      onChange={(e) => setSelectedPeriodId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      data-testid="mis-tutorias-period-select"
                    >
                      {periods.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.activo ? "· activo" : ""}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-slate-500">Estado</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {loadingBulk ? "Cargando…" : (
                          <>
                            {filledCount} de {rows.length} con comentario
                            {emptyCount > 0 && <span className="text-amber-700 font-normal"> · {emptyCount} pendiente{emptyCount === 1 ? "" : "s"}</span>}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {loadingBulk ? (
                    <div className="p-10 text-center">
                      <Loader2 className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-slate-500">Cargando alumnos…</p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 italic">
                      Esta sección no tiene alumnos registrados.
                    </div>
                  ) : (
                    <table className="w-full" data-testid="mis-tutorias-table">
                      <thead className="bg-slate-900 text-white text-sm">
                        <tr>
                          <th className="px-3 py-2.5 text-left w-12">N°</th>
                          <th className="px-3 py-2.5 text-left w-72">APELLIDOS Y NOMBRES</th>
                          <th className="px-3 py-2.5 text-left">COMENTARIO DEL TUTOR — {periodInfo?.nombre}</th>
                          <th className="px-3 py-2.5 text-center w-24"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const closed = r.is_closed;
                          const status = savingMap[r.student_id];
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
                              </td>
                              <td className="px-3 py-2 text-center align-top">
                                {closed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200" title="Bimestre cerrado">
                                    <Lock className="w-3 h-3" />
                                  </span>
                                ) : status === "saving" || status === "pending" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-50 text-slate-500" data-testid={`tutoria-status-${r.number}`}>
                                    <Loader2 className="w-3 h-3 animate-spin" /> Guardando
                                  </span>
                                ) : status === "saved" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200" data-testid={`tutoria-status-${r.number}`}>
                                    <Save className="w-3 h-3" /> Guardado
                                  </span>
                                ) : (
                                  <a
                                    href={`/libreta/${r.student_id}?period_id=${selectedPeriodId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                    title="Abrir libreta completa en pestaña nueva"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Libreta
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {selectedSection && (
                  <p className="text-xs text-slate-400 text-center">
                    Sección: {sectionLabel(selectedSection)} · Tutor: {user?.first_name} {user?.last_name}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
