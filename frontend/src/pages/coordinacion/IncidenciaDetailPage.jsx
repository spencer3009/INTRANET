import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertTriangle, Clock, User, Plus,
  MessageSquare, ChevronDown, Edit, Trash2, CheckCircle, ArrowRightLeft
} from "lucide-react";
import CoordinacionLayout from "@/components/coordinacion/CoordinacionLayout";
import { SeverityBadge, StatusPill } from "@/components/coordinacion/SharedBadges";
import { coordinacionApi } from "@/api/coordinacion";
import { toast } from "sonner";

const TYPE_LABELS = {
  conducta_disruptiva: "Conducta disruptiva", falta_respeto: "Falta de respeto",
  agresion_verbal: "Agresion verbal", agresion_fisica: "Agresion fisica",
  incumplimiento_normas: "Incumplimiento de normas", conflicto_companeros: "Conflicto entre companeros",
  ausencias_reiteradas: "Ausencias reiteradas", incumplimiento_academico: "Incumplimiento academico",
  observacion_preventiva: "Observacion preventiva"
};

const STATUS_OPTIONS = [
  { id: "nueva", label: "Nueva" }, { id: "en_revision", label: "En revision" },
  { id: "en_seguimiento", label: "En seguimiento" }, { id: "citacion_programada", label: "Citacion programada" },
  { id: "derivada", label: "Derivada" }, { id: "resuelta", label: "Resuelta" }, { id: "cerrada", label: "Cerrada" }
];

const PARENT_OPTIONS = [
  { id: "ninguna", label: "Ninguna" }, { id: "informada", label: "Informada" },
  { id: "presente", label: "Presente" }, { id: "comprometida", label: "Comprometida" }
];

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
    parent_involvement: "ninguna", next_steps: "", next_review_at: "",
    new_status: ""
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
    if (!segForm.observation || !segForm.new_status) {
      toast.error("Completa la observacion y el nuevo estado");
      return;
    }
    setSavingSeg(true);
    try {
      await coordinacionApi.createSeguimiento(token, id, segForm);
      toast.success("Seguimiento registrado");
      setShowSeguimientoForm(false);
      setSegForm({ observation: "", commitment: "", student_response: "", parent_involvement: "ninguna", next_steps: "", next_review_at: "", new_status: inc?.status || "" });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear seguimiento");
    } finally {
      setSavingSeg(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Estas seguro de eliminar esta incidencia? Se eliminaran tambien sus seguimientos y derivaciones.")) return;
    try {
      await coordinacionApi.deleteIncidencia(token, id);
      toast.success("Incidencia eliminada");
      navigate(`/${sub}/coordinacion/incidencias`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleDerivar = async (e) => {
    e.preventDefault();
    if (!derivForm.to_area || !derivForm.reason) {
      toast.error("Completa el area y el motivo de la derivacion");
      return;
    }
    setSavingDeriv(true);
    try {
      await coordinacionApi.createDerivacion(token, {
        incidencia_id: id,
        to_area: derivForm.to_area,
        priority: derivForm.priority,
        reason: derivForm.reason,
        notes: derivForm.notes || null,
      });
      toast.success("Derivacion creada correctamente");
      setShowDerivarForm(false);
      setDerivForm({ to_area: "", priority: "media", reason: "", notes: "" });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear derivacion");
    } finally {
      setSavingDeriv(false);
    }
  };

  if (loading) {
    return (
      <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
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

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection="incidencias">
      <div className="p-4 md:p-6 space-y-5" data-testid="incidencia-detail-page">
        {/* Back */}
        <button onClick={() => navigate(`/${sub}/coordinacion/incidencias`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a incidencias
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <SeverityBadge severity={inc.severity} />
                <StatusPill status={inc.status} />
                {inc.confidential && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Confidencial</span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-800" data-testid="incidencia-title">{inc.title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                <span className="font-medium text-slate-700">{inc.student_name}</span>
                {inc.grade_name && <> &middot; {inc.grade_name}</>}
                {inc.section_name && <> - {inc.section_name}</>}
              </p>
            </div>
            {(user?.role === "admin" || user?.role === "owner") && (
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
                data-testid="delete-incidencia-btn">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            )}
          </div>

          {/* Action buttons */}
          {canWrite && inc.status !== "derivada" && inc.status !== "cerrada" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setShowDerivarForm(!showDerivarForm)}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-sm font-medium transition-colors"
                data-testid="derivar-incidencia-btn">
                <ArrowRightLeft className="w-4 h-4" /> Derivar
              </button>
            </div>
          )}
          {inc.status === "derivada" && (
            <div className="mt-4">
              <button onClick={() => navigate(`/${sub}/coordinacion/derivaciones`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-sm font-medium transition-colors"
                data-testid="ver-derivaciones-btn">
                <ArrowRightLeft className="w-4 h-4" /> Ver derivaciones
              </button>
            </div>
          )}

          {/* Details grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</p>
              <p className="text-sm text-slate-800 mt-0.5">{TYPE_LABELS[inc.type] || inc.type}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha del incidente</p>
              <p className="text-sm text-slate-800 mt-0.5">{new Date(inc.occurred_at).toLocaleString("es-PE")}</p>
            </div>
            {inc.initial_action && (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Accion inmediata</p>
                <p className="text-sm text-slate-800 mt-0.5">{inc.initial_action}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descripcion</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" data-testid="incidencia-description">
              {inc.description}
            </p>
          </div>
        </div>

        {/* Derivar Form */}
        {showDerivarForm && (
          <form onSubmit={handleDerivar} className="bg-white rounded-2xl shadow-sm border border-teal-200 p-6 space-y-4" data-testid="derivar-form">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-teal-600" /> Crear derivacion
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Area de derivacion *</label>
                <select value={derivForm.to_area}
                  onChange={e => setDerivForm(p => ({...p, to_area: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                  data-testid="select-deriv-area">
                  <option value="">Seleccionar area</option>
                  <option value="psicologia">Psicologia</option>
                  <option value="direccion">Direccion</option>
                  <option value="tutoria">Tutoria</option>
                  <option value="orientacion_familiar">Orientacion familiar</option>
                  <option value="externa">Derivacion externa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Prioridad</label>
                <select value={derivForm.priority}
                  onChange={e => setDerivForm(p => ({...p, priority: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                  data-testid="select-deriv-priority">
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo de la derivacion *</label>
              <textarea rows={3} maxLength={4000} value={derivForm.reason}
                onChange={e => setDerivForm(p => ({...p, reason: e.target.value}))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm resize-none"
                data-testid="deriv-reason" placeholder="Explica por que se deriva este caso..." />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notas adicionales</label>
              <textarea rows={2} value={derivForm.notes}
                onChange={e => setDerivForm(p => ({...p, notes: e.target.value}))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm resize-none"
                data-testid="deriv-notes" placeholder="Opcional..." />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowDerivarForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button type="submit" disabled={savingDeriv}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                data-testid="submit-derivacion-btn">
                {savingDeriv ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Crear derivacion
              </button>
            </div>
          </form>
        )}

        {/* Seguimientos Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Seguimientos ({seguimientos.length})</h2>
            {canWrite && (
              <button onClick={() => setShowSeguimientoForm(!showSeguimientoForm)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                data-testid="add-seguimiento-btn">
                <Plus className="w-4 h-4" /> Agregar
              </button>
            )}
          </div>

          {/* Form */}
          {showSeguimientoForm && (
            <form onSubmit={handleCreateSeguimiento} className="p-6 bg-blue-50/50 border-b border-slate-100 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Observacion *</label>
                <textarea rows={3} maxLength={4000} value={segForm.observation}
                  onChange={e => setSegForm(p => ({...p, observation: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm resize-none"
                  data-testid="seg-observation" placeholder="Que se observo o acordó..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Compromiso asumido</label>
                  <input type="text" value={segForm.commitment}
                    onChange={e => setSegForm(p => ({...p, commitment: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                    data-testid="seg-commitment" placeholder="Ej: El alumno se compromete a..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Participacion de padres</label>
                  <select value={segForm.parent_involvement}
                    onChange={e => setSegForm(p => ({...p, parent_involvement: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                    data-testid="seg-parent-involvement">
                    {PARENT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nuevo estado *</label>
                  <select value={segForm.new_status}
                    onChange={e => setSegForm(p => ({...p, new_status: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                    data-testid="seg-new-status">
                    {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Proxima revision</label>
                  <input type="date" value={segForm.next_review_at}
                    onChange={e => setSegForm(p => ({...p, next_review_at: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
                    data-testid="seg-next-review" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSeguimientoForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={savingSeg}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  data-testid="save-seguimiento-btn">
                  {savingSeg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Registrar seguimiento
                </button>
              </div>
            </form>
          )}

          {/* Timeline */}
          <div className="divide-y divide-slate-100">
            {seguimientos.length > 0 ? seguimientos.map(seg => (
              <div key={seg.id} className="px-6 py-4" data-testid={`seguimiento-${seg.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{seg.created_by_name || "Coordinador"}</span>
                      <StatusPill status={seg.new_status} />
                      <span className="text-xs text-slate-400">
                        {new Date(seg.entry_date).toLocaleString("es-PE")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap">{seg.observation}</p>
                    {seg.commitment && (
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-semibold">Compromiso:</span> {seg.commitment}
                      </p>
                    )}
                    {seg.next_steps && (
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-semibold">Proximos pasos:</span> {seg.next_steps}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <p className="px-6 py-8 text-center text-slate-400 text-sm">No hay seguimientos registrados</p>
            )}
          </div>
        </div>
      </div>
    </CoordinacionLayout>
  );
}
