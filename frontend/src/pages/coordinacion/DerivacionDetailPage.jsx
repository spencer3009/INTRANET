import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  ArrowLeft, ArrowRightLeft, User, Clock, FileText, CheckCircle, UserPlus,
  Loader2, Calendar, RefreshCw, Pen, UserX
} from "lucide-react";
import { toast } from "sonner";

/* ─── Status configs ─── */
const STS_CFG = {
  pendiente:  { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "Pendiente", from: "#f59e0b", to: "#d97706" },
  en_proceso: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "En proceso", from: "#3b82f6", to: "#2563eb" },
  resuelta:   { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Resuelta", from: "#10b981", to: "#059669" },
  cancelada:  { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Cancelada", from: "#64748b", to: "#475569" },
};

const AREA_LABELS = {
  psicologia: "Psicologia",
  direccion: "Dirección",
  tutoria: "Tutoria",
  orientacion_familiar: "Orientacion familiar",
  externa: "Derivación externa",
};

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

export default function DerivacionDetailPage({ token, subdomain, user: currentUser, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deriv, setDeriv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [staff, setStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");

  const base = subdomain ? `/${subdomain}` : "";
  const canUpdateStatus = ["coordinator", "psicologo", "admin", "owner", "director"].includes(currentUser?.role);
  const canAssign = ["admin", "owner", "director"].includes(currentUser?.role);

  useEffect(() => { loadDerivacion(); }, [id]);

  const loadDerivacion = async () => {
    setLoading(true);
    try {
      const data = await coordinacionApi.getDerivacion(token, id);
      setDeriv(data);
    } catch (err) {
      console.error("Error loading derivación:", err);
      toast.error("Error al cargar derivación");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const payload = { status: newStatus };
      if (resolutionNotes) payload.resolution_notes = resolutionNotes;
      await coordinacionApi.updateDerivacion(token, id, payload);
      setShowStatusForm(false);
      setNewStatus("");
      setResolutionNotes("");
      loadDerivacion();
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error("Error al actualizar");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedStaff) return;
    setUpdating(true);
    try {
      await coordinacionApi.updateDerivacion(token, id, { to_user_id: selectedStaff });
      setShowAssignForm(false);
      setSelectedStaff("");
      loadDerivacion();
      toast.success("Responsable asignado");
    } catch (err) {
      toast.error("Error al asignar");
    } finally {
      setUpdating(false);
    }
  };

  const loadStaff = async (area) => {
    try {
      const res = await coordinacionApi.getStaffByArea(token, área);
      setStaff(res.staff || []);
    } catch {
      setStaff([]);
    }
  };

  if (loading) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
    </CoordinacionLayout>
  );
  if (!deriv) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="text-center py-20 text-slate-400">Derivación no encontrada</div>
    </CoordinacionLayout>
  );

  const sts = STS_CFG[deriv.status] || STS_CFG.pendiente;

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="derivacion-detail-page">

        {/* Back */}
        <button onClick={() => navigate(`${base}/coordinacion/derivaciones`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a derivaciones
        </button>

        {/* ══════════ HEADER CARD ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="h-3 relative" style={{ background: `linear-gradient(90deg, ${sts.from} 0%, ${sts.to} 100%)` }} />

          <div className="p-6">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>{sts.label}</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-gradient-to-br from-teal-100/70 to-teal-50/50 text-teal-700 border-teal-200/70">
                {AREA_LABELS[deriv.to_area] || deriv.to_area}
              </span>
              {!deriv.to_user_id && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70 flex items-center gap-1">
                  <UserX className="w-3 h-3" /> Sin asignar
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2" data-testid="derivacion-title">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" /> Derivacion: {deriv.incidencia_title}
            </h1>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 mb-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.20)" }}>
                  <User className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Estudiante</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{deriv.student_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 2px 8px rgba(245,158,11,0.20)" }}>
                  <ArrowRightLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Derivado por</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{deriv.from_user_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 2px 8px rgba(16,185,129,0.20)" }}>
                  <UserPlus className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Asignado a</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{deriv.to_user_name || "Sin asignar"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.20)" }}>
                  <Calendar className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Fecha</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{deriv.created_at ? new Date(deriv.created_at).toLocaleString("es-PE") : ""}</p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Pen className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Motivo de la derivación</p>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{deriv.reason}</p>
            </div>

            {deriv.notes && (
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Notas</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{deriv.notes}</p>
              </div>
            )}

            {deriv.resolution_notes && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Notas de resolución</p>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{deriv.resolution_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ ACTIONS ══════════ */}
        <div className="flex flex-wrap gap-3">
          {canUpdateStatus && deriv.status !== "resuelta" && deriv.status !== "cancelada" && (
            <button
              onClick={() => setShowStatusForm(!showStatusForm)}
              className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 4px 12px rgba(20,184,166,0.25)" }}
              data-testid="update-deriv-status-btn"
            >
              <RefreshCw className="w-4 h-4" /> Actualizar estado
            </button>
          )}
          {canAssign && !deriv.to_user_id && (
            <button
              onClick={() => { setShowAssignForm(!showAssignForm); if (!showAssignForm) loadStaff(deriv.to_area); }}
              className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
              data-testid="assign-deriv-btn"
            >
              <UserPlus className="w-4 h-4" /> Asignar responsable
            </button>
          )}
          <button
            onClick={() => navigate(`${base}/coordinacion/incidencias/${deriv.incidencia_id}`)}
            className="flex items-center gap-2 px-5 py-2.5 text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold transition-colors"
            data-testid="go-to-incidencia-btn"
          >
            <FileText className="w-4 h-4" /> Ver incidencia
          </button>
        </div>

        {/* ══════════ STATUS UPDATE FORM ══════════ */}
        {showStatusForm && (
          <div className="bg-white border border-teal-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-teal-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(240,253,250,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 2px 8px rgba(20,184,166,0.25)" }}>
                <RefreshCw className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Actualizar estado</h3>
            </div>
            <div className="p-6 space-y-4" data-testid="status-update-form">
              <div>
                <label className={labelCls}>Nuevo estado *</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                  className={inputCls} data-testid="select-deriv-new-status">
                  <option value="">Seleccionar nuevo estado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="resuelta">Resuelta</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Notas de resolución</label>
                <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Notas de resolución (opcional)" rows={3}
                  className={`${inputCls} resize-none`} data-testid="deriv-resolution-notes" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowStatusForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={handleStatusUpdate} disabled={!newStatus || updating}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", boxShadow: "0 4px 12px rgba(20,184,166,0.25)" }}
                  data-testid="save-deriv-status-btn">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ASSIGN FORM ══════════ */}
        {showAssignForm && (
          <div className="bg-white border border-indigo-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-indigo-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}>
                <UserPlus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Asignar responsable</h3>
            </div>
            <div className="p-6 space-y-4" data-testid="assign-form">
              {staff.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                  <p className="text-sm text-amber-700 font-medium">No hay personal disponible para esta área en el colegio.</p>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Seleccionar responsable *</label>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
                    className={inputCls} data-testid="select-assign-staff">
                    <option value="">Seleccionar</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAssignForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAssign} disabled={!selectedStaff || updating}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
                  data-testid="save-assign-btn">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Asignar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CoordinacionLayout>
  );
}
