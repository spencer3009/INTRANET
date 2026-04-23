import { useState, useEffect, useCallback } from "react";
import { coordinacionApi } from "../../api/coordinacion";
import { AlertTriangle, Users, MessageSquare, Calendar, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const SEVERITY_COLORS = {
  baja: "bg-slate-100 text-slate-600",
  media: "bg-yellow-100 text-yellow-700",
  alta: "bg-orange-100 text-orange-700",
  critica: "bg-red-100 text-red-700",
};

const REUNION_STATUS_COLORS = {
  programada: "bg-blue-100 text-blue-700",
  confirmada: "bg-green-100 text-green-700",
  realizada: "bg-slate-200 text-slate-600",
  cancelada: "bg-red-100 text-red-600",
  no_asistio: "bg-orange-100 text-orange-600",
};

export default function ParentCoordinacionView({ token, user }) {
  const [students, setStudents] = useState([]);
  const [incidencias, setIncidencias] = useState([]);
  const [reuniones, setReuniones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [activeTab, setActiveTab] = useState("incidencias");
  const [expandedInc, setExpandedInc] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [studRes, incRes, reuRes] = await Promise.all([
        coordinacionApi.parentGetStudents(token),
        coordinacionApi.parentGetIncidencias(token),
        coordinacionApi.parentGetReuniones(token),
      ]);
      setStudents(studRes.students || []);
      setIncidencias(incRes.items || []);
      setReuniones(reuRes.items || []);
    } catch (err) {
      console.error("Error loading parent view:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (reunionId) => {
    try {
      await coordinacionApi.parentConfirmReunion(token, reunionId);
      toast.success("Asistencia confirmada");
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al confirmar");
    }
  };

  const filteredInc = selectedStudent
    ? incidencias.filter(i => i.student_id === selectedStudent)
    : incidencias;

  const filteredReu = selectedStudent
    ? reuniones.filter(r => r.student_id === selectedStudent)
    : reuniones;

  if (loading) return <div className="p-6 text-center text-slate-400">Cargando...</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="parent-coordinacion-view">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Coordinación escolar</h1>

      {students.length === 0 ? (
        <p className="text-sm text-slate-400">No hay estudiantes vinculados a tu cuenta.</p>
      ) : (
        <>
          {/* Student filter */}
          {students.length > 1 && (
            <div className="mb-4">
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="parent-student-filter">
                <option value="">Todos mis hijos</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1" data-testid="parent-tabs">
            <button
              onClick={() => setActiveTab("incidencias")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === "incidencias" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              data-testid="parent-tab-incidencias"
            >
              Incidencias ({filteredInc.length})
            </button>
            <button
              onClick={() => setActiveTab("reuniones")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === "reuniones" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              data-testid="parent-tab-reuniones"
            >
              Reuniones ({filteredReu.length})
            </button>
          </div>

          {/* Incidencias */}
          {activeTab === "incidencias" && (
            <div className="space-y-3" data-testid="parent-incidencias-list">
              {filteredInc.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No hay incidencias para mostrar.</p>
              ) : filteredInc.map(inc => (
                <div key={inc.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedInc(expandedInc === inc.id ? null : inc.id)}>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[inc.severity] || ""}`}>
                          {inc.severity}
                        </span>
                        <span className="text-xs text-slate-400">{inc.created_at ? new Date(inc.created_at).toLocaleDateString() : ""}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{inc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{inc.student_name}</p>
                    </div>
                    {expandedInc === inc.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                  {expandedInc === inc.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-700">{inc.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reuniones */}
          {activeTab === "reuniones" && (
            <div className="space-y-3" data-testid="parent-reuniones-list">
              {filteredReu.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No hay reuniones programadas.</p>
              ) : filteredReu.map(reu => (
                <div key={reu.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REUNION_STATUS_COLORS[reu.status] || ""}`}>
                      {reu.status?.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {reu.scheduled_at ? new Date(reu.scheduled_at).toLocaleString("es-PE") : ""}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">{reu.agenda}</p>
                  <p className="text-xs text-slate-500">{reu.location} - {reu.student_name}</p>

                  {!reu.is_confirmed && (reu.status === "programada" || reu.status === "confirmada") && (
                    <button
                      onClick={() => handleConfirm(reu.id)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                      data-testid={`parent-confirm-${reu.id}`}
                    >
                      <CheckCircle className="w-4 h-4" /> Confirmar asistencia
                    </button>
                  )}
                  {reu.is_confirmed && (
                    <span className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Asistencia confirmada
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
