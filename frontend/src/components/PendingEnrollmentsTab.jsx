import { useState, useEffect } from "react";
import axios from "axios";
import {
  UserPlus, Check, X, Loader2, Clock, ChevronDown,
  Phone, Calendar, AlertTriangle, Search, ArrowLeft, User
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PendingEnrollmentsTab({ token, onClose, levels: externalLevels }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  // Approve modal
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveForm, setApproveForm] = useState({ nivel_id: "", grade_id: "", section_id: "", turno_id: "" });
  const [approving, setApproving] = useState(false);
  const [levels, setLevels] = useState([]);
  const [allGrades, setAllGrades] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [turnos, setTurnos] = useState([]);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { loadPending(); loadAcademicData(); }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/enrollment/pending`, { headers });
      setPending(res.data.pending || []);
    } catch (err) {
      toast.error("Error al cargar solicitudes pendientes");
    } finally { setLoading(false); }
  };

  const loadAcademicData = async () => {
    try {
      const [levelsRes, gradesRes, sectionsRes, shiftsRes] = await Promise.all([
        axios.get(`${API}/api/academic/levels`, { headers }),
        axios.get(`${API}/api/academic/grades`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/academic/sections`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/academic/shifts`, { headers }).catch(() => ({ data: [] })),
      ]);
      setLevels(levelsRes.data || []);
      setAllGrades(gradesRes.data || []);
      setAllSections(sectionsRes.data || []);
      setTurnos(shiftsRes.data || []);
    } catch {}
  };

  // Filter grades/sections based on selection
  const filteredGrades = approveForm.nivel_id
    ? allGrades.filter(g => g.nivel_id === approveForm.nivel_id && g.activo !== false)
    : [];
  const filteredSections = approveForm.grade_id
    ? allSections.filter(s => s.grado_id === approveForm.grade_id && s.activo !== false)
    : [];

  const updateApproveField = (field, value) => {
    setApproveForm(p => {
      const updated = { ...p, [field]: value };
      if (field === "nivel_id") { updated.grade_id = ""; updated.section_id = ""; }
      if (field === "grade_id") { updated.section_id = ""; }
      return updated;
    });
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      await axios.post(`${API}/api/enrollment/${approveTarget.id}/approve`, approveForm, { headers });
      toast.success(`Matrícula de ${approveTarget.name} aprobada`);
      setApproveTarget(null);
      setApproveForm({ nivel_id: "", grade_id: "", section_id: "", turno_id: "" });
      loadPending();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al aprobar");
    } finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await axios.post(`${API}/api/enrollment/${rejectTarget.id}/reject`, { reason: rejectReason.trim() }, { headers });
      toast.success(`Solicitud de ${rejectTarget.name} rechazada`);
      setRejectTarget(null);
      setRejectReason("");
      loadPending();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al rechazar");
    } finally { setRejecting(false); }
  };

  const openApproveModal = (student) => {
    setApproveTarget(student);
    setApproveForm({
      nivel_id: student.nivel_id || "",
      grade_id: student.grado_id || "",
      section_id: student.seccion_id || "",
      turno_id: student.turno_id || "",
    });
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const selectCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

  return (
    <div className="space-y-4" data-testid="pending-enrollments-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" data-testid="pending-back-btn">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Matrículas Pendientes
            </h2>
            <p className="text-xs text-slate-500">{pending.length} solicitud{pending.length !== 1 ? "es" : ""} por revisar</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <span className="ml-3 text-slate-500">Cargando solicitudes...</span>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Sin solicitudes pendientes</h3>
          <p className="text-sm text-slate-500">Todas las matrículas han sido procesadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((student) => {
            const parentName = student.parent_info
              ? `${student.parent_info.name || ""} ${student.parent_info.last_name || ""}`.trim()
              : "—";
            const parentPhone = student.parent_info?.phone || student.parent_info?.email || "—";
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-amber-200 transition-colors" data-testid={`pending-student-${student.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Student info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{student.name} {student.last_name || ""}</p>
                      <p className="text-xs text-slate-500">DNI: {student.dni || "—"}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{student.nivel_name} {student.grado_name} {student.seccion_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Parent info */}
                  <div className="flex-shrink-0 text-sm">
                    <p className="text-xs text-slate-400 font-medium">Registrado por:</p>
                    <p className="font-medium text-slate-700">{parentName}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {parentPhone}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-sm">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(student.enrollment_submitted_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openApproveModal(student)} data-testid={`approve-btn-${student.id}`}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                    <button onClick={() => { setRejectTarget(student); setRejectReason(""); }} data-testid={`reject-btn-${student.id}`}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-red-200">
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Modal */}
      {approveTarget && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={() => setApproveTarget(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()} data-testid="approve-modal">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Aprobar matrícula</h3>
            <p className="text-sm text-slate-500 mb-5">
              Asigna el grado y sección oficial para <span className="font-semibold text-slate-700">{approveTarget.name} {approveTarget.last_name || ""}</span>
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className={labelCls}>Nivel</label>
                <select value={approveForm.nivel_id} onChange={e => updateApproveField("nivel_id", e.target.value)} className={selectCls}>
                  <option value="">Seleccionar nivel</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.nombre || l.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Grado</label>
                <select value={approveForm.grade_id} onChange={e => updateApproveField("grade_id", e.target.value)} className={selectCls} disabled={!approveForm.nivel_id}>
                  <option value="">Seleccionar grado</option>
                  {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sección</label>
                <select value={approveForm.section_id} onChange={e => updateApproveField("section_id", e.target.value)} className={selectCls} disabled={!approveForm.grade_id}>
                  <option value="">Seleccionar sección</option>
                  {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Turno</label>
                <select value={approveForm.turno_id} onChange={e => updateApproveField("turno_id", e.target.value)} className={selectCls}>
                  <option value="">Seleccionar turno</option>
                  {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre || t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              <p className="text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Al aprobar, el alumno quedara activo y podra acceder a todos los servicios del colegio.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setApproveTarget(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleApprove} disabled={approving} data-testid="confirm-approve-btn"
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aprobar matrícula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()} data-testid="reject-modal">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Rechazar solicitud</h3>
            <p className="text-sm text-slate-500 mb-5">
              Indica el motivo del rechazo para <span className="font-semibold text-slate-700">{rejectTarget.name} {rejectTarget.last_name || ""}</span>
            </p>

            <div className="mb-5">
              <label className={labelCls}>Motivo del rechazo *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className={`${selectCls} min-h-[100px]`}
                placeholder="Escribe el motivo del rechazo..."
                rows={4}
                maxLength={500}
                data-testid="reject-reason-input"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{rejectReason.length}/500</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRejectTarget(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleReject} disabled={rejecting || !rejectReason.trim()} data-testid="confirm-reject-btn"
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Rechazar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
