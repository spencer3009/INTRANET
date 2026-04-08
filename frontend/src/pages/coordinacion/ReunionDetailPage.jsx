import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { ArrowLeft, User, Clock, MapPin, CheckCircle, Copy, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  programada: "bg-blue-100 text-blue-800",
  confirmada: "bg-green-100 text-green-700",
  realizada: "bg-slate-200 text-slate-700",
  cancelada: "bg-red-100 text-red-600",
  no_asistio: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS = {
  programada: "Programada", confirmada: "Confirmada", realizada: "Realizada",
  cancelada: "Cancelada", no_asistio: "No asistio",
};

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

  useEffect(() => {
    loadReunion();
  }, [id]);

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

  const canWrite = ["coordinator", "admin", "owner"].includes(currentUser?.role);

  if (loading) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="p-6 text-center text-slate-400">Cargando...</div>
    </CoordinacionLayout>
  );
  if (!reunion) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
      <div className="p-6 text-center text-red-500">Reunion no encontrada</div>
    </CoordinacionLayout>
  );

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="reuniones">
    <div className="p-4 md:p-6" data-testid="reunion-detail-page">
      <button onClick={() => navigate(`${base}/coordinacion/reuniones`)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a reuniones
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[reunion.status]}`}>
            {STATUS_LABELS[reunion.status]}
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-1" data-testid="reunion-title">
          Reunion: {reunion.student_name}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Fecha:</span>
            {reunion.scheduled_at ? new Date(reunion.scheduled_at).toLocaleString("es-PE") : ""}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Lugar:</span> {reunion.location}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Creado por:</span> {reunion.created_by_name}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Agenda</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{reunion.agenda}</p>
        </div>

        {reunion.notes && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Notas</p>
            <p className="text-sm text-slate-700">{reunion.notes}</p>
          </div>
        )}

        {reunion.outcome && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Resultado</p>
            <p className="text-sm text-slate-700">{reunion.outcome}</p>
          </div>
        )}

        {reunion.commitments && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Compromisos</p>
            <p className="text-sm text-slate-700">{reunion.commitments}</p>
          </div>
        )}
      </div>

      {/* Parents section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h3 className="font-bold text-slate-800 mb-3">Padres convocados ({reunion.parent_ids?.length || 0})</h3>
        {reunion.parent_names?.length > 0 ? (
          <div className="space-y-2">
            {reunion.parent_names.map((name, idx) => {
              const pid = reunion.parent_ids[idx];
              const isConfirmed = reunion.confirmed_parents?.includes(pid);
              return (
                <div key={pid} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{name}</span>
                    {isConfirmed ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Confirmado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No hay padres convocados</p>
        )}

        {/* Confirmation links */}
        {reunion.pending_confirmation_links?.length > 0 && canWrite && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Enlaces de confirmacion pendientes</p>
            {reunion.pending_confirmation_links.map((link) => (
              <div key={link.parent_id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 mb-2">
                <span className="text-sm text-slate-700">{link.parent_name}</span>
                <button
                  onClick={() => copyConfirmLink(link.token)}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                  data-testid={`copy-link-${link.parent_id}`}
                >
                  <Copy className="w-3 h-3" /> Copiar enlace
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-400 mt-1">Comparta este enlace por WhatsApp. Expira en 7 dias.</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {canWrite && reunion.status !== "realizada" && reunion.status !== "cancelada" && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setShowStatusForm(!showStatusForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            data-testid="update-reunion-status-btn"
          >
            <CheckCircle className="w-4 h-4" /> Actualizar estado
          </button>
          {reunion.incidencia_id && (
            <button
              onClick={() => navigate(`${base}/coordinacion/incidencias/${reunion.incidencia_id}`)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink className="w-4 h-4" /> Ver incidencia
            </button>
          )}
        </div>
      )}

      {/* Status form */}
      {showStatusForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4" data-testid="reunion-status-form">
          <h3 className="font-semibold text-slate-800 mb-3">Actualizar estado de la reunion</h3>
          <select value={statusForm.status} onChange={(e) => setStatusForm(p => ({ ...p, status: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3" data-testid="select-reunion-status">
            <option value="">Seleccionar estado</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="no_asistio">No asistio el padre</option>
          </select>
          {statusForm.status === "realizada" && (
            <>
              <textarea value={statusForm.outcome} onChange={(e) => setStatusForm(p => ({ ...p, outcome: e.target.value }))}
                placeholder="Resultado de la reunion" rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 resize-none" data-testid="reunion-outcome" />
              <textarea value={statusForm.commitments} onChange={(e) => setStatusForm(p => ({ ...p, commitments: e.target.value }))}
                placeholder="Compromisos acordados" rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 resize-none" data-testid="reunion-commitments" />
            </>
          )}
          <div className="flex gap-2">
            <button onClick={handleStatusUpdate} disabled={!statusForm.status || updating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="save-reunion-status">
              {updating ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setShowStatusForm(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
