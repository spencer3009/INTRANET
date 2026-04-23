import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import {
  ArrowLeft, User, Clock, MapPin, CheckCircle, Copy, ExternalLink,
  MessageSquare, Loader2, Calendar, FileText, Handshake, Users, XCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

/* ─── Status configs ─── */
const STS_CFG = {
  programada: { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70", label: "Programada", from: "#3b82f6", to: "#2563eb" },
  confirmada: { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Confirmada", from: "#10b981", to: "#059669" },
  realizada:  { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200", label: "Realizada", from: "#64748b", to: "#475569" },
  cancelada:  { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70", label: "Cancelada", from: "#ef4444", to: "#dc2626" },
  no_asistio: { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70", label: "No asistio", from: "#f59e0b", to: "#d97706" },
};

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

export default function ReunionDetailPage({ token, subdomain, user: currentUser, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reunion, setReunion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "", outcome: "", commitments: "" });

  const base = subdomain ? `/${subdomain}` : "";
  const APP_URL = process.env.REACT_APP_BACKEND_URL;
  const canWrite = ["coordinator", "admin", "owner"].includes(currentUser?.role);

  useEffect(() => { loadReunion(); }, [id]);

  const loadReunion = async () => {
    setLoading(true);
    try {
      const data = await coordinacionApi.getReunion(token, id);
      setReunion(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusForm.status) return;
    setUpdating(true);
    try {
      const payload = { status: statusForm.status };
      if (statusForm.outcome) payload.outcome = statusForm.outcome;
      if (statusForm.commitments) payload.commitments = statusForm.commitments;
      await coordinacionApi.updateReunion(token, id, payload);
      setShowStatusForm(false);
      setStatusForm({ status: "", outcome: "", commitments: "" });
      loadReunion();
      toast.success("Reunion actualizada");
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setUpdating(false);
    }
  };

  const copyConfirmLink = (token_str) => {
    const link = `${APP_URL}/api/coordinacion/reuniones/confirm?token=${token_str}`;
    navigator.clipboard.writeText(link);
    toast.success("Enlace copiado al portapapeles");
  };

  if (loading) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
    </CoordinacionLayout>
  );
  if (!reunion) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="text-center py-20 text-slate-400">Reunion no encontrada</div>
    </CoordinacionLayout>
  );

  const sts = STS_CFG[reunion.status] || STS_CFG.programada;

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="reunion-detail-page">

        {/* Back */}
        <button onClick={() => navigate(`${base}/coordinacion/reuniones`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a reuniones
        </button>

        {/* ══════════ HEADER CARD ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="h-3 relative" style={{ background: `linear-gradient(90deg, ${sts.from} 0%, ${sts.to} 100%)` }} />

          <div className="p-6">
            {/* Status badge */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>{sts.label}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2" data-testid="reunion-title">
              <MessageSquare className="w-5 h-5 text-indigo-600" /> Reunion: {reunion.student_name}
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
                    {reunion.scheduled_at ? new Date(reunion.scheduled_at).toLocaleString("es-PE") : ""}
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
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{reunion.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.20)" }}>
                  <User className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Creado por</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{reunion.created_by_name}</p>
                </div>
              </div>
            </div>

            {/* Agenda */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Agenda</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{reunion.agenda}</p>
            </div>

            {reunion.notes && (
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Notas</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reunion.notes}</p>
              </div>
            )}

            {reunion.outcome && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Resultado</p>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reunion.outcome}</p>
              </div>
            )}

            {reunion.commitments && (
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Compromisos</p>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reunion.commitments}</p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ PARENTS SECTION ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
              <Users className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Padres convocados ({reunion.parent_ids?.length || 0})</h3>
              <p className="text-xs text-slate-400 mt-0.5">Estado de confirmacion</p>
            </div>
          </div>

          <div className="p-4">
            {reunion.parent_names?.length > 0 ? (
              <div className="space-y-2">
                {reunion.parent_names.map((name, idx) => {
                  const pid = reunion.parent_ids[idx];
                  const isConfirmed = reunion.confirmed_parents?.includes(pid);
                  return (
                    <div key={pid} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                        isConfirmed
                          ? "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70"
                          : "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70"
                      }`}>
                        {isConfirmed ? "Confirmado" : "Pendiente"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">No hay padres convocados</p>
              </div>
            )}

            {/* Confirmation links */}
            {reunion.pending_confirmation_links?.length > 0 && canWrite && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-3">Enlaces de confirmacion pendientes</p>
                <div className="space-y-2">
                  {reunion.pending_confirmation_links.map((link) => (
                    <div key={link.parent_id} className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{link.parent_name}</span>
                      </div>
                      <button
                        onClick={() => copyConfirmLink(link.token)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                        style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 6px rgba(59,130,246,0.25)" }}
                        data-testid={`copy-link-${link.parent_id}`}
                      >
                        <Copy className="w-3 h-3" /> Copiar enlace
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">Comparta este enlace por WhatsApp. Expira en 7 días.</p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ ACTIONS ══════════ */}
        {canWrite && reunion.status !== "realizada" && reunion.status !== "cancelada" && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowStatusForm(!showStatusForm)}
              className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
              data-testid="update-reunion-status-btn"
            >
              <RefreshCw className="w-4 h-4" /> Actualizar estado
            </button>
            {reunion.incidencia_id && (
              <button
                onClick={() => navigate(`${base}/coordinacion/incidencias/${reunion.incidencia_id}`)}
                className="flex items-center gap-2 px-5 py-2.5 text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Ver incidencia
              </button>
            )}
          </div>
        )}

        {/* ══════════ STATUS UPDATE FORM ══════════ */}
        {showStatusForm && (
          <div className="bg-white border border-indigo-200 rounded-2xl overflow-visible" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-indigo-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}>
                <RefreshCw className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Actualizar estado de la reunion</h3>
            </div>
            <div className="p-6 space-y-4" data-testid="reunion-status-form">
              <div>
                <label className={labelCls}>Nuevo estado *</label>
                <select value={statusForm.status} onChange={(e) => setStatusForm(p => ({ ...p, status: e.target.value }))}
                  className={inputCls} data-testid="select-reunion-status">
                  <option value="">Seleccionar estado</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="no_asistio">No asistio el padre</option>
                </select>
              </div>
              {statusForm.status === "realizada" && (
                <>
                  <div>
                    <label className={labelCls}>Resultado de la reunion</label>
                    <textarea value={statusForm.outcome} onChange={(e) => setStatusForm(p => ({ ...p, outcome: e.target.value }))}
                      placeholder="Que se discutio y resolvio..." rows={3}
                      className={`${inputCls} resize-none`} data-testid="reunion-outcome" />
                  </div>
                  <div>
                    <label className={labelCls}>Compromisos acordados</label>
                    <textarea value={statusForm.commitments} onChange={(e) => setStatusForm(p => ({ ...p, commitments: e.target.value }))}
                      placeholder="Compromisos del padre/estudiante..." rows={3}
                      className={`${inputCls} resize-none`} data-testid="reunion-commitments" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowStatusForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={handleStatusUpdate} disabled={!statusForm.status || updating}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}
                  data-testid="save-reunion-status">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CoordinacionLayout>
  );
}
