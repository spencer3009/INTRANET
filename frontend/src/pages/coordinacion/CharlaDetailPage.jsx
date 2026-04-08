import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coordinacionApi } from "../../api/coordinacion";
import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import CharlaMaterialUploader from "../../components/coordinacion/CharlaMaterialUploader";
import {
  ArrowLeft, Presentation, Clock, MapPin, User, Tag, CheckCircle,
  XCircle, FileText, Image, Film, Link2, Trash2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  programada: "bg-blue-100 text-blue-800",
  en_curso: "bg-amber-100 text-amber-800",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-600",
};
const STATUS_LABELS = { programada: "Programada", en_curso: "En curso", realizada: "Realizada", cancelada: "Cancelada" };

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
      <div className="p-6 text-center text-slate-400">Cargando...</div>
    </CoordinacionLayout>
  );
  if (!charla) return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="charlas">
      <div className="p-6 text-center text-red-500">Charla no encontrada</div>
    </CoordinacionLayout>
  );

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <CoordinacionLayout user={currentUser} token={token} onLogout={onLogout} activeSection="charlas">
    <div className="p-4 md:p-6" data-testid="charla-detail-page">
      <button onClick={() => navigate(`${base}/coordinacion/charlas`)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a charlas
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[charla.status]}`}>
            {STATUS_LABELS[charla.status]}
          </span>
          {charla.topics?.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 flex items-center gap-1">
              <Tag className="w-3 h-3" /> {t}
            </span>
          ))}
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2" data-testid="charla-title">
          <Presentation className="w-5 h-5 text-teal-600" /> {charla.title}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Fecha:</span>
            {charla.scheduled_at ? new Date(charla.scheduled_at).toLocaleString("es-PE") : ""}
            <span className="text-slate-400">({charla.duration_minutes}min)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Lugar:</span> {charla.location}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Creado por:</span> {charla.created_by_name}
          </div>
        </div>

        {/* Target grades/sections */}
        {(charla.target_grade_names || charla.target_section_names) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Dirigido a</p>
            <div className="flex flex-wrap gap-1.5">
              {charla.target_grade_names && Object.values(charla.target_grade_names).map(n => (
                <span key={n} className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700 font-medium">{n}</span>
              ))}
              {charla.target_section_names && Object.values(charla.target_section_names).map(n => (
                <span key={n} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">{n}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Descripción</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{charla.description}</p>
        </div>

        {charla.notes && (
          <div className="mt-3">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">Notas</p>
            <p className="text-sm text-slate-700">{charla.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {canWrite && charla.status !== "cancelada" && (
        <div className="flex flex-wrap gap-2 mb-4">
          {charla.status === "programada" && (
            <button onClick={() => handleStatusChange("en_curso")}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
              data-testid="start-charla-btn">
              Iniciar charla
            </button>
          )}
          {(charla.status === "programada" || charla.status === "en_curso") && (
            <button onClick={() => handleStatusChange("realizada")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              data-testid="finish-charla-btn">
              Marcar como realizada
            </button>
          )}
          <button onClick={toggleAttendance}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            data-testid="toggle-attendance-btn">
            Registrar asistencia
          </button>
          {charla.status !== "realizada" && (
            <button onClick={() => handleStatusChange("cancelada")}
              className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              data-testid="cancel-charla-btn">
              Cancelar charla
            </button>
          )}
        </div>
      )}

      {/* Attendance Panel */}
      {showAttendance && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4" data-testid="attendance-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">Asistencia ({presentCount}/{students.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)} className="text-xs text-green-600 hover:underline" data-testid="mark-all-present">Todos presentes</button>
              <button onClick={() => toggleAll(false)} className="text-xs text-red-600 hover:underline" data-testid="mark-all-absent">Todos ausentes</button>
            </div>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-slate-400">No se encontraron estudiantes para los grados/secciones seleccionados.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {students.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{s.name} {s.last_name}</span>
                  <button
                    onClick={() => setAttendance(p => ({ ...p, [s.id]: !p[s.id] }))}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      attendance[s.id]
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                    data-testid={`attendance-toggle-${s.id}`}
                  >
                    {attendance[s.id] ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {attendance[s.id] ? "Presente" : "Ausente"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
            <button onClick={saveAttendance} disabled={savingAttendance || students.length === 0}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-teal-700 transition-colors"
              data-testid="save-attendance-btn">
              {savingAttendance ? "Guardando..." : "Guardar asistencia"}
            </button>
            <button onClick={() => setShowAttendance(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Materials */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">Materiales ({charla.materials?.length || 0})</h3>
        </div>

        {charla.materials?.length > 0 && (
          <div className="space-y-2 mb-4">
            {charla.materials.map(m => {
              const Icon = MATERIAL_ICONS[m.type] || FileText;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 group" data-testid={`material-${m.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <a href={m.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-700 hover:text-indigo-600 flex items-center gap-1">
                        {m.name} <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-xs text-slate-400">
                        {m.type === "link" ? "Enlace externo" : formatBytes(m.size_bytes)}
                        {m.uploaded_at && ` - ${new Date(m.uploaded_at).toLocaleDateString("es-PE")}`}
                      </p>
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => handleDeleteMaterial(m.id)}
                      disabled={deletingMaterial === m.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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

      {/* Saved attendance summary */}
      {charla.attendance?.length > 0 && !showAttendance && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">
            Asistencia registrada ({charla.attendance.filter(a => a.present).length}/{charla.attendance.length})
          </h3>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {charla.attendance.map(a => (
              <div key={a.student_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-700">{a.student_name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  a.present ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
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
