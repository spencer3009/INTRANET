import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import CharlaMaterialUploader from "../../components/coordinacion/CharlaMaterialUploader";
import {
  ArrowLeft, Presentation, Clock, MapPin, User, Tag, CheckCircle,
  XCircle, FileText, Image, Film, Link2, Trash2, ExternalLink,
  Loader2, Play, Check, X, Users, Calendar, Paperclip
} from "lucide-react";
import { toast } from "sonner";

/* ─── Status configs ─── */
const STS_CFG = {
  programada: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Programada", from: "#3b82f6", to: "#2563eb", rgb: "59,130,246" },
  en_curso:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "En curso", from: "#f59e0b", to: "#d97706", rgb: "245,158,11" },
  realizada:  { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Realizada", from: "#10b981", to: "#059669", rgb: "16,185,129" },
  cancelada:  { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Cancelada", from: "#ef4444", to: "#dc2626", rgb: "239,68,68" },
};

const MATERIAL_ICONS = { image: Image, pdf: FileText, video: Film, link: Link2 };

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function CharlaDetailPage({ token, subdomain, user: currentUser, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [charla, setCharla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [showAttendance, setShowAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState(null);

  const base = subdomain ? `/${subdomain}` : "";
  const canWrite = ["coordinator", "admin", "owner"].includes(currentUser?.role);

  const loadCharla = useCallback(async () => {
    setLoading(true);
    try {
      const data = await coordinacionApi.getCharla(token, id);
      setCharla(data);
      if (data.attendance?.length) {
        const map = {};
        data.attendance.forEach(a => { map[a.student_id] = a.present; });
        setAttendance(map);
      }
    } catch {
      toast.error("Error al cargar charla");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { loadCharla(); }, [loadCharla]);

  const loadStudents = async () => {
    try {
      const res = await coordinacionApi.getCharlaStudents(token, id);
      setStudents(res.students || []);
      if (!charla?.attendance?.length) {
        const map = {};
        (res.students || []).forEach(s => { map[s.id] = false; });
        setAttendance(map);
      }
    } catch {
      toast.error("Error al cargar estudiantes");
    }
  };

  const toggleAttendance = () => {
    if (!showAttendance) {
      loadStudents();
    }
    setShowAttendance(!showAttendance);
  };

  const saveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const list = Object.entries(attendance).map(([student_id, present]) => ({ student_id, present }));
      await coordinacionApi.saveCharlaAttendance(token, id, list);
      toast.success("Asistencia guardada");
      loadCharla();
      setShowAttendance(false);
    } catch {
      toast.error("Error al guardar asistencia");
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await coordinacionApi.updateCharla(token, id, { status: newStatus });
      toast.success("Estado actualizado");
      loadCharla();
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    setDeletingMaterial(materialId);
    try {
      await coordinacionApi.deleteCharlaMaterial(token, id, materialId);
      toast.success("Material eliminado");
      loadCharla();
    } catch {
      toast.error("Error al eliminar material");
    } finally {
      setDeletingMaterial(null);
    }
  };

  const onMaterialAdded = () => {
    loadCharla();
    toast.success("Material agregado");
  };

  const toggleAll = (val) => {
    const map = {};
    students.forEach(s => { map[s.id] = val; });
    setAttendance(map);
  };

  if (loading) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="charlas">
      <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-400" /></div>
    </CoordinacionLayout>
  );
  if (!charla) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="charlas">
      <div className="text-center py-20 text-slate-400">Charla no encontrada</div>
    </CoordinacionLayout>
  );

  const sts = STS_CFG[charla.status] || STS_CFG.programada;
  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="charlas">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="charla-detail-page">

        {/* Back */}
        <button onClick={() => navigate(`${base}/coordinacion/charlas`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a charlas
        </button>

        {/* ══════════ HEADER CARD ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {/* Status gradient banner */}
          <div className="h-3 relative" style={{ background: `linear-gradient(90deg, ${sts.from} 0%, ${sts.to} 100%)` }} />

          <div className="p-6">
            {/* Top row: badges */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>{sts.label}</span>
              {charla.topics?.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
                  <Tag className="w-3 h-3" /> {t}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2" data-testid="charla-title">
              <Presentation className="w-5 h-5 text-teal-600" /> {charla.title}
            </h1>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 mb-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.20)" }}>
                  <Calendar className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Fecha</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">
                    {charla.scheduled_at ? new Date(charla.scheduled_at).toLocaleString("es-PE") : ""}
                    <span className="text-slate-400 ml-1">({charla.duration_minutes}min)</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 2px 8px rgba(245,158,11,0.20)" }}>
                  <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Lugar</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{charla.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.20)" }}>
                  <User className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Creado por</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{charla.created_by_name}</p>
                </div>
              </div>
              {charla.attendance?.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 2px 8px rgba(16,185,129,0.20)" }}>
                    <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Asistencia</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {charla.attendance.filter(a => a.present).length}/{charla.attendance.length} presentes
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Target grades/sections */}
            {(charla.target_grade_names || charla.target_section_names) && (
              <div className="mb-5 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Dirigido a</p>
                <div className="flex flex-wrap gap-1.5">
                  {charla.target_grade_names && Object.values(charla.target_grade_names).map(n => (
                    <span key={n} className="px-2.5 py-1 rounded-lg text-[11px] bg-teal-50 text-teal-700 border border-teal-200 font-semibold">{n}</span>
                  ))}
                  {charla.target_section_names && Object.values(charla.target_section_names).map(n => (
                    <span key={n} className="px-2.5 py-1 rounded-lg text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">{n}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Descripción</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{charla.description}</p>
            </div>

            {charla.notes && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Notas</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{charla.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ ACTIONS ══════════ */}
        {canWrite && charla.status !== "cancelada" && (
          <div className="flex flex-wrap gap-3">
            {charla.status === "programada" && (
              <button onClick={() => handleStatusChange("en_curso")}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 4px 12px rgba(245,158,11,0.25)" }}
                data-testid="start-charla-btn">
                <Play className="w-4 h-4" /> Iniciar charla
              </button>
            )}
            {(charla.status === "programada" || charla.status === "en_curso") && (
              <button onClick={() => handleStatusChange("realizada")}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}
                data-testid="finish-charla-btn">
                <Check className="w-4 h-4" /> Marcar como realizada
              </button>
            )}
            <button onClick={toggleAttendance}
              className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
              data-testid="toggle-attendance-btn">
              <Users className="w-4 h-4" /> Registrar asistencia
            </button>
            {charla.status !== "realizada" && (
              <button onClick={() => handleStatusChange("cancelada")}
                className="flex items-center gap-2 px-5 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-sm font-semibold transition-colors"
                data-testid="cancel-charla-btn">
                <X className="w-4 h-4" /> Cancelar charla
              </button>
            )}
          </div>
        )}

        {/* ══════════ ATTENDANCE PANEL ══════════ */}
        {showAttendance && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
                  <Users className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Asistencia ({presentCount}/{students.length})</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Marcar presentes y ausentes</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleAll(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  data-testid="mark-all-present">
                  Todos presentes
                </button>
                <button onClick={() => toggleAll(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                  data-testid="mark-all-absent">
                  Todos ausentes
                </button>
              </div>
            </div>

            <div data-testid="attendance-panel">
              {students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">No se encontraron estudiantes para los grados/secciones seleccionados</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto p-4 space-y-1.5">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{s.name} {s.last_name}</span>
                      </div>
                      <button
                        onClick={() => setAttendance(p => ({ ...p, [s.id]: !p[s.id] }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                          attendance[s.id]
                            ? "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                        data-testid={`attendance-toggle-${s.id}`}
                      >
                        {attendance[s.id] ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {attendance[s.id] ? "Presente" : "Ausente"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={saveAttendance} disabled={savingAttendance || students.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 4px 12px rgba(20,184,166,0.25)" }}
                  data-testid="save-attendance-btn">
                  {savingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Guardar asistencia
                </button>
                <button onClick={() => setShowAttendance(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ MATERIALS ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", boxShadow: "0 4px 12px rgba(139,92,246,0.25)" }}>
              <Paperclip className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Materiales ({charla.materials?.length || 0})</h3>
              <p className="text-xs text-slate-400 mt-0.5">Archivos y enlaces adjuntos</p>
            </div>
          </div>

          <div className="p-4">
            {charla.materials?.length > 0 && (
              <div className="space-y-2 mb-4">
                {charla.materials.map(m => {
                  const Icon = MATERIAL_ICONS[m.type] || FileText;
                  return (
                    <div key={m.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 group hover:border-slate-200 transition-all"
                      data-testid={`material-${m.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                             style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", boxShadow: "0 2px 6px rgba(139,92,246,0.20)" }}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                            {m.name} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                          <p className="text-xs text-slate-400">
                            {m.type === "link" ? "Enlace externo" : formatBytes(m.size_bytes)}
                            {m.uploaded_at && ` · ${new Date(m.uploaded_at).toLocaleDateString("es-PE")}`}
                          </p>
                        </div>
                      </div>
                      {canWrite && (
                        <button
                          onClick={() => handleDeleteMaterial(m.id)}
                          disabled={deletingMaterial === m.id}
                          className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                          data-testid={`delete-material-${m.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canWrite && (
              <CharlaMaterialUploader token={token} charlaId={id} onMaterialAdded={onMaterialAdded} />
            )}
          </div>
        </div>

        {/* ══════════ SAVED ATTENDANCE SUMMARY ══════════ */}
        {charla.attendance?.length > 0 && !showAttendance && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
                <CheckCircle className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Asistencia registrada ({charla.attendance.filter(a => a.present).length}/{charla.attendance.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Registro de asistencia guardado</p>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-4 space-y-1.5">
              {charla.attendance.map(a => (
                <div key={a.student_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{a.student_name}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                    a.present
                      ? "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70"
                      : "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70"
                  }`}>
                    {a.present ? "Presente" : "Ausente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CoordinacionLayout>
  );
}
