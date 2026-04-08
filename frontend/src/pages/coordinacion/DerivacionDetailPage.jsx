import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { ArrowLeft, ArrowRightLeft, User, Clock, FileText, CheckCircle, UserPlus } from "lucide-react";

const STATUS_COLORS = {
  pendiente: "bg-yellow-100 text-yellow-800",
  en_proceso: "bg-blue-100 text-blue-800",
  resuelta: "bg-green-100 text-green-800",
  cancelada: "bg-slate-100 text-slate-600",
};

const AREA_LABELS = {
  psicologia: "Psicologia",
  direccion: "Dirección",
  tutoria: "Tutoria",
  orientacion_familiar: "Orientacion familiar",
  externa: "Derivacion externa",
};

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

  useEffect(() => {
    loadDerivacion();
  }, [id]);

  const loadDerivacion = async () => {
    setLoading(true);
    try {
      const data = await coordinacionApi.getDerivacion(token, id);
      setDeriv(data);
    } catch (err) {
      console.error("Error loading derivacion:", err);
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
    } catch (err) {
      console.error("Error updating:", err);
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
    } catch (err) {
      console.error("Error assigning:", err);
    } finally {
      setUpdating(false);
    }
  };

  const loadStaff = async (area) => {
    try {
      const res = await coordinacionApi.getStaffByArea(token, area);
      setStaff(res.staff || []);
    } catch {
      setStaff([]);
    }
  };

  const base = subdomain ? `/${subdomain}` : "";

  if (loading) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="p-6 text-center text-slate-400">Cargando...</div>
    </CoordinacionLayout>
  );
  if (!deriv) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
      <div className="p-6 text-center text-red-500">Derivacion no encontrada</div>
    </CoordinacionLayout>
  );

  const canUpdateStatus = ["coordinator", "psicologo", "admin", "owner", "director"].includes(currentUser?.role);
  const canAssign = ["admin", "owner", "director"].includes(currentUser?.role);

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="derivaciones">
    <div className="p-4 md:p-6" data-testid="derivacion-detail-page">
      <button
        onClick={() => navigate(`${base}/coordinacion/derivaciones`)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a derivaciones
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[deriv.status]}`}>
            {deriv.status?.replace("_", " ")}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
            {AREA_LABELS[deriv.to_area] || deriv.to_area}
          </span>
          {!deriv.to_user_id && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">
              Sin asignar
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-1" data-testid="derivacion-title">
          Derivacion: {deriv.incidencia_title}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Estudiante:</span> {deriv.student_name}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Derivado por:</span> {deriv.from_user_name}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Asignado a:</span> {deriv.to_user_name}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Fecha:</span> {deriv.created_at ? new Date(deriv.created_at).toLocaleString() : ""}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Motivo de la derivacion</p>
          <p className="text-sm text-slate-700">{deriv.reason}</p>
        </div>

        {deriv.notes && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Notas</p>
            <p className="text-sm text-slate-700">{deriv.notes}</p>
          </div>
        )}

        {deriv.resolution_notes && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Notas de resolucion</p>
            <p className="text-sm text-slate-700">{deriv.resolution_notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        {canUpdateStatus && deriv.status !== "resuelta" && deriv.status !== "cancelada" && (
          <button
            onClick={() => setShowStatusForm(!showStatusForm)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            data-testid="update-deriv-status-btn"
          >
            <CheckCircle className="w-4 h-4" /> Actualizar estado
          </button>
        )}
        {canAssign && !deriv.to_user_id && (
          <button
            onClick={() => {
              setShowAssignForm(!showAssignForm);
              if (!showAssignForm) loadStaff(deriv.to_area);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            data-testid="assign-deriv-btn"
          >
            <UserPlus className="w-4 h-4" /> Asignar responsable
          </button>
        )}
        <button
          onClick={() => navigate(`${base}/coordinacion/incidencias/${deriv.incidencia_id}`)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          data-testid="go-to-incidencia-btn"
        >
          <FileText className="w-4 h-4" /> Ver incidencia
        </button>
      </div>

      {/* Status update form */}
      {showStatusForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4" data-testid="status-update-form">
          <h3 className="font-semibold text-slate-800 mb-3">Actualizar estado</h3>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3"
            data-testid="select-deriv-new-status"
          >
            <option value="">Seleccionar nuevo estado</option>
            <option value="en_proceso">En proceso</option>
            <option value="resuelta">Resuelta</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Notas de resolucion (opcional)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 resize-none"
            rows={3}
            data-testid="deriv-resolution-notes"
          />
          <div className="flex gap-2">
            <button
              onClick={handleStatusUpdate}
              disabled={!newStatus || updating}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="save-deriv-status-btn"
            >
              {updating ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => setShowStatusForm(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Assign form */}
      {showAssignForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4" data-testid="assign-form">
          <h3 className="font-semibold text-slate-800 mb-3">Asignar responsable</h3>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500 mb-3">No hay personal disponible para esta area en el colegio.</p>
          ) : (
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3"
              data-testid="select-assign-staff"
            >
              <option value="">Seleccionar</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAssign}
              disabled={!selectedStaff || updating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="save-assign-btn"
            >
              {updating ? "Asignando..." : "Asignar"}
            </button>
            <button
              onClick={() => setShowAssignForm(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
    </CoordinacionLayout>
  );
}
