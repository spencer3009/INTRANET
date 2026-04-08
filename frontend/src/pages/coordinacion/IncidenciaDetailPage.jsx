import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertTriangle, Clock, User, Plus,
  MessageSquare, Edit, Trash2, CheckCircle, ArrowRightLeft,
  FileWarning, Shield, Calendar, Pen, ChevronRight, Lock, GraduationCap
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { coordinacionApi } from "@/api/coordinacion";
import { toast } from "sonner";

/* ─── Label maps ─── */
const TYPE_LABELS = {
  conducta_disruptiva: "Conducta disruptiva", falta_respeto: "Falta de respeto",
  agresion_verbal: "Agresión verbal", agresion_fisica: "Agresión física",
  incumplimiento_normas: "Incumplimiento de normas", conflicto_companeros: "Conflicto entre compañeros",
  ausencias_reiteradas: "Ausencias reiteradas", incumplimiento_academico: "Incumplimiento académico",
  observacion_preventiva: "Observación preventiva"
};

const STATUS_OPTIONS = [
  { id: "nueva", label: "Nueva" }, { id: "en_revision", label: "En revisión" },
  { id: "en_seguimiento", label: "En seguimiento" }, { id: "citacion_programada", label: "Citación programada" },
  { id: "derivada", label: "Derivada" }, { id: "resuelta", label: "Resuelta" }, { id: "cerrada", label: "Cerrada" }
];

const PARENT_OPTIONS = [
  { id: "ninguna", label: "Ninguna" }, { id: "informada", label: "Informada" },
  { id: "presente", label: "Presente" }, { id: "comprometida", label: "Comprometida" }
];

/* ─── Badge configs ─── */
const SEV_CFG = {
  baja:    { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Baja",    from: "#10b981", to: "#059669", rgb: "16,185,129" },
  media:   { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70",     label: "Media",   from: "#f59e0b", to: "#d97706", rgb: "245,158,11" },
  alta:    { cls: "bg-gradient-to-br from-red-100/70 to-red-50/50 text-red-700 border-red-200/70",              label: "Alta",    from: "#ef4444", to: "#dc2626", rgb: "239,68,68" },
  critica: { cls: "bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200",                       label: "Crítica", from: "#dc2626", to: "#b91c1c", rgb: "220,38,38" },
};

const STS_CFG = {
  nueva:               { cls: "bg-gradient-to-br from-blue-100/70 to-blue-50/50 text-blue-700 border-blue-200/70",     label: "Nueva" },
  en_revision:         { cls: "bg-gradient-to-br from-indigo-100/70 to-indigo-50/50 text-indigo-700 border-indigo-200/70", label: "En revisión" },
  en_seguimiento:      { cls: "bg-gradient-to-br from-violet-100/70 to-violet-50/50 text-violet-700 border-violet-200/70", label: "En seguimiento" },
  citacion_programada: { cls: "bg-gradient-to-br from-amber-100/70 to-amber-50/50 text-amber-700 border-amber-200/70",    label: "Citación programada" },
  derivada:            { cls: "bg-gradient-to-br from-cyan-100/70 to-cyan-50/50 text-cyan-700 border-cyan-200/70",        label: "Derivada" },
  resuelta:            { cls: "bg-gradient-to-br from-emerald-100/70 to-emerald-50/50 text-emerald-700 border-emerald-200/70", label: "Resuelta" },
  cerrada:             { cls: "bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 border-slate-200",              label: "Cerrada" },
};

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider";

export default function IncidenciaDetailPage({ user, token, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const sub = user?.subdomain;

  const [inc, setInc] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSeguimientoForm, setShowSeguimientoForm] = useState(false);
  const [savingSeg, setSavingSeg] = useState(false);
  const [segForm, setSegForm] = useState({
    observation: "", commitment: "", student_response: "",
    parent_involvement: "ninguna", next_steps: "", next_review_at: "", new_status: ""
  });
  const [showDerivarForm, setShowDerivarForm] = useState(false);
  const [derivForm, setDerivForm] = useState({ to_area: "", priority: "media", reason: "", notes: "" });
  const [savingDeriv, setSavingDeriv] = useState(false);

  const canWrite = user?.role === "coordinator" || user?.role === "admin" || user?.role === "owner";

  const loadData = async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [incData, segData] = await Promise.all([
        coordinacionApi.getIncidencia(token, id),
        coordinacionApi.listSeguimientos(token, id)
      ]);
      setInc(incData);
      setSeguimientos(segData.items || []);
      setSegForm(prev => ({ ...prev, new_status: incData.status }));
    } catch (e) {
      toast.error("Error al cargar incidencia");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token, id]);

  const handleCreateSeguimiento = async (e) => {
    e.preventDefault();
    if (!segForm.observation || !segForm.new_status) { toast.error("Completa la observación y el nuevo estado"); return; }
    setSavingSeg(true);
    try {
      await coordinacionApi.createSeguimiento(token, id, segForm);
      toast.success("Seguimiento registrado");
      setShowSeguimientoForm(false);
      setSegForm({ observation: "", commitment: "", student_response: "", parent_involvement: "ninguna", next_steps: "", next_review_at: "", new_status: inc?.status || "" });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Error al crear seguimiento"); }
    finally { setSavingSeg(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Estás seguro de eliminar esta incidencia? Se eliminarán también sus seguimientos y derivaciones.")) return;
    try { await coordinacionApi.deleteIncidencia(token, id); toast.success("Incidencia eliminada"); navigate(`/${sub}/coordinacion/incidencias`); }
    catch (err) { toast.error(err.response?.data?.detail || "Error al eliminar"); }
  };

  const handleDerivar = async (e) => {
    e.preventDefault();
    if (!derivForm.to_area || !derivForm.reason) { toast.error("Completa el área y el motivo de la derivación"); return; }
    setSavingDeriv(true);
    try {
      await coordinacionApi.createDerivacion(token, { incidencia_id: id, to_area: derivForm.to_area, priority: derivForm.priority, reason: derivForm.reason, notes: derivForm.notes || null });
      toast.success("Derivación creada correctamente");
      setShowDerivarForm(false);
      setDerivForm({ to_area: "", priority: "media", reason: "", notes: "" });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Error al crear derivación"); }
    finally { setSavingDeriv(false); }
  };

  if (loading) {
    return (
      <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
        <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
      </CoordinacionLayout>
    );
  }
  if (!inc) {
    return (
      <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
        <div className="text-center py-20 text-slate-400">Incidencia no encontrada</div>
      </CoordinacionLayout>
    );
  }

  const sev = SEV_CFG[inc.severity] || SEV_CFG.baja;
  const sts = STS_CFG[inc.status] || STS_CFG.nueva;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="px-6 md:px-8 py-8 min-h-full space-y-6" data-testid="incidencia-detail-page">

        {/* Back */}
        <button onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a incidencias
        </button>

        {/* ══════════ HEADER CARD ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          {/* Severity gradient banner */}
          <div className="h-3 relative" style={{ background: `linear-gradient(90deg, ${sev.from} 0%, ${sev.to} 100%)` }} />

          <div className="p-6">
            {/* Top row: badges + actions */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sev.cls}`}>{sev.label}</span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sts.cls}`}>{sts.label}</span>
                {inc.confidential && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-[11px] font-bold text-red-600">
                    <Lock className="w-3 h-3" /> Confidencial
                  </span>
                )}
              </div>
              {(user?.role === "admin" || user?.role === "owner") && (
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-semibold transition-colors"
                  data-testid="delete-incidencia-btn">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              )}
            </div>

            {/* Title + student */}
            <h1 className="text-2xl font-bold text-slate-900 mb-2" data-testid="incidencia-title">{inc.title}</h1>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-sm font-medium text-slate-700">{inc.student_name}</span>
              {inc.grade_name && (
                <>
                  <span className="text-slate-300 text-xs">&bull;</span>
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-sm text-slate-500">{inc.grade_name}{inc.section_name && ` - ${inc.section_name}`}</span>
                </>
              )}
            </div>

            {/* Action buttons */}
            {canWrite && inc.status !== "derivada" && inc.status !== "cerrada" && (
              <div className="mb-5">
                <button onClick={() => setShowDerivarForm(!showDerivarForm)}
                  className="flex items-center gap-2 px-4 py-2.5 text-white font-semibold rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}
                  data-testid="derivar-incidencia-btn">
                  <ArrowRightLeft className="w-4 h-4" /> Derivar
                </button>
              </div>
            )}
            {inc.status === "derivada" && (
              <div className="mb-5">
                <button onClick={() => navigate(`/${sub}/coordinacion/derivaciones`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-xl text-sm font-semibold transition-colors"
                  data-testid="ver-derivaciones-btn">
                  <ArrowRightLeft className="w-4 h-4" /> Ver derivaciones
                </button>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 2px 8px rgba(245,158,11,0.20)" }}>
                  <FileWarning className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{TYPE_LABELS[inc.type] || inc.type}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.20)" }}>
                  <Calendar className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Fecha del incidente</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{new Date(inc.occurred_at).toLocaleString("es-PE")}</p>
                </div>
              </div>
              {inc.initial_action && (
                <div className="sm:col-span-2 flex items-start gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.20)" }}>
                    <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Acción inmediata</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{inc.initial_action}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Pen className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Descripción</p>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" data-testid="incidencia-description">
                {inc.description}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════ DERIVAR FORM ══════════ */}
        {showDerivarForm && (
          <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 border-b border-teal-100 flex items-center gap-3"
                 style={{ background: "linear-gradient(180deg, rgba(240,253,244,0.6) 0%, white 100%)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 2px 8px rgba(16,185,129,0.25)" }}>
                <ArrowRightLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">Crear derivación</h3>
            </div>
            <form onSubmit={handleDerivar} className="p-6 space-y-4" data-testid="derivar-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Área de derivación *</label>
                  <select value={derivForm.to_area} onChange={e => setDerivForm(p => ({...p, to_area: e.target.value}))}
                    className={inputCls} data-testid="select-deriv-area">
                    <option value="">Seleccionar área</option>
                    <option value="psicologia">Psicología</option>
                    <option value="direccion">Dirección</option>
                    <option value="tutoria">Tutoría</option>
                    <option value="orientacion_familiar">Orientación familiar</option>
                    <option value="externa">Derivación externa</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prioridad</label>
                  <select value={derivForm.priority} onChange={e => setDerivForm(p => ({...p, priority: e.target.value}))}
                    className={inputCls} data-testid="select-deriv-priority">
                    <option value="baja">Baja</option><option value="media">Media</option>
                    <option value="alta">Alta</option><option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Motivo de la derivación *</label>
                <textarea rows={3} maxLength={4000} value={derivForm.reason}
                  onChange={e => setDerivForm(p => ({...p, reason: e.target.value}))}
                  className={`${inputCls} resize-none`} data-testid="deriv-reason" placeholder="Explica por qué se deriva este caso..." />
              </div>
              <div>
                <label className={labelCls}>Notas adicionales</label>
                <textarea rows={2} value={derivForm.notes}
                  onChange={e => setDerivForm(p => ({...p, notes: e.target.value}))}
                  className={`${inputCls} resize-none`} data-testid="deriv-notes" placeholder="Opcional..." />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowDerivarForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">Cancelar</button>
                <button type="submit" disabled={savingDeriv}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}
                  data-testid="submit-derivacion-btn">
                  {savingDeriv ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Crear derivación
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════ SEGUIMIENTOS ══════════ */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
               style={{ background: "linear-gradient(180deg, #fafbfc 0%, white 100%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 4px 12px rgba(59,130,246,0.25)" }}>
                <MessageSquare className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Seguimientos ({seguimientos.length})</h2>
                <p className="text-xs text-slate-400 mt-0.5">Historial de revisiones</p>
              </div>
            </div>
            {canWrite && (
              <button onClick={() => setShowSeguimientoForm(!showSeguimientoForm)}
                className="flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.25)" }}
                data-testid="add-seguimiento-btn">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            )}
          </div>

          {/* Form */}
          {showSeguimientoForm && (
            <form onSubmit={handleCreateSeguimiento} className="p-6 border-b border-slate-100 space-y-4"
                  style={{ background: "linear-gradient(180deg, rgba(239,246,255,0.4) 0%, white 100%)" }}>
              <div>
                <label className={labelCls}>Observación *</label>
                <textarea rows={3} maxLength={4000} value={segForm.observation}
                  onChange={e => setSegForm(p => ({...p, observation: e.target.value}))}
                  className={`${inputCls} resize-none`} data-testid="seg-observation" placeholder="Qué se observó o acordó..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Compromiso asumido</label>
                  <input type="text" value={segForm.commitment}
                    onChange={e => setSegForm(p => ({...p, commitment: e.target.value}))}
                    className={inputCls} data-testid="seg-commitment" placeholder="Ej: El alumno se compromete a..." />
                </div>
                <div>
                  <label className={labelCls}>Participación de padres</label>
                  <select value={segForm.parent_involvement}
                    onChange={e => setSegForm(p => ({...p, parent_involvement: e.target.value}))}
                    className={inputCls} data-testid="seg-parent-involvement">
                    {PARENT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nuevo estado *</label>
                  <select value={segForm.new_status} onChange={e => setSegForm(p => ({...p, new_status: e.target.value}))}
                    className={inputCls} data-testid="seg-new-status">
                    {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Próxima revisión</label>
                  <input type="date" value={segForm.next_review_at}
                    onChange={e => setSegForm(p => ({...p, next_review_at: e.target.value}))}
                    className={inputCls} data-testid="seg-next-review" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSeguimientoForm(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors">Cancelar</button>
                <button type="submit" disabled={savingSeg}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", boxShadow: "0 4px 12px rgba(59,130,246,0.25)" }}
                  data-testid="save-seguimiento-btn">
                  {savingSeg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Registrar seguimiento
                </button>
              </div>
            </form>
          )}

          {/* Timeline items */}
          <div className="p-4 space-y-2.5">
            {seguimientos.length > 0 ? seguimientos.map(seg => {
              const segSts = STS_CFG[seg.new_status] || STS_CFG.nueva;
              return (
                <div key={seg.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-white"
                  data-testid={`seguimiento-${seg.id}`}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}>
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[13px] font-semibold text-slate-900">{seg.created_by_name || "Coordinador"}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${segSts.cls}`}>{segSts.label}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(seg.entry_date).toLocaleString("es-PE")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{seg.observation}</p>
                    {(seg.commitment || seg.next_steps) && (
                      <div className="mt-2.5 flex flex-wrap gap-3">
                        {seg.commitment && (
                          <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-blue-600 uppercase">Compromiso</p>
                              <p className="text-xs text-slate-600">{seg.commitment}</p>
                            </div>
                          </div>
                        )}
                        {seg.next_steps && (
                          <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-indigo-50/60 border border-indigo-100">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-indigo-600 uppercase">Próximos pasos</p>
                              <p className="text-xs text-slate-600">{seg.next_steps}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">No hay seguimientos registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </CoordinacionLayout>
  );
}
