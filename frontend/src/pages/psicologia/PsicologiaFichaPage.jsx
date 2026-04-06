import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTenant } from "@/App";
import {
  ArrowLeft, User, FileText, Plus, Calendar, Clock, Tag,
  AlertTriangle, CheckCircle2, Edit2, Trash2, Brain, X,
  ChevronDown, Save, MessageSquare
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REASON_CATEGORIES = [
  "Conductual", "Emocional", "Academico", "Familiar",
  "Social", "Adaptacion", "Orientacion Vocacional", "Otro"
];

const SESSION_TYPES = [
  "Individual", "Grupal", "Familiar", "Seguimiento",
  "Evaluacion", "Intervencion", "Derivacion"
];

const STATUS_OPTIONS = [
  { value: "en_seguimiento", label: "En seguimiento", color: "bg-blue-100 text-blue-700" },
  { value: "cerrado", label: "Cerrado", color: "bg-green-100 text-green-700" },
  { value: "derivado", label: "Derivado", color: "bg-amber-100 text-amber-700" },
  { value: "nuevo", label: "Nuevo", color: "bg-violet-100 text-violet-700" },
];

export default function PsicologiaFichaPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [record, setRecord] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordRes, sessionsRes] = await Promise.all([
        fetch(`${API}/v1/psychology/records/${studentId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/v1/psychology/sessions?student_id=${studentId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (recordRes.ok) {
        const data = await recordRes.json();
        setRecord(data.record || null);
        setStudent(data.student || null);
      }
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateRecord = async (formData) => {
    try {
      const res = await fetch(`${API}/v1/psychology/records`, {
        method: "POST",
        headers,
        body: JSON.stringify({ student_id: studentId, ...formData })
      });
      if (res.ok) {
        setShowRecordModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleUpdateRecord = async (formData) => {
    try {
      const res = await fetch(`${API}/v1/psychology/records/${studentId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowRecordModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleSaveSession = async (formData) => {
    try {
      const url = editingSession
        ? `${API}/v1/psychology/sessions/${editingSession.id}`
        : `${API}/v1/psychology/sessions`;
      const res = await fetch(url, {
        method: editingSession ? "PUT" : "POST",
        headers,
        body: JSON.stringify({ student_id: studentId, ...formData })
      });
      if (res.ok) {
        setShowSessionModal(false);
        setEditingSession(null);
        fetchData();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Eliminar esta sesion?")) return;
    try {
      await fetch(`${API}/v1/psychology/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const statusObj = STATUS_OPTIONS.find(s => s.value === record?.status) || STATUS_OPTIONS[3];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50" data-testid="psicologia-ficha">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(getSchoolPath("/psicologia/estudiantes"))}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            data-testid="back-to-students"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 truncate">
              {student?.name} {student?.last_name}
            </h1>
            <p className="text-xs text-slate-500">Ficha Psicologica</p>
          </div>
          {record && (
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusObj.color}`}>
              {statusObj.label}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Student Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-violet-100 flex-shrink-0">
              {student?.photo_url ? (
                <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-violet-500" />
                </div>
              )}
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-500">Nombre completo</p>
                <p className="text-sm font-medium text-slate-800">{student?.name} {student?.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Grado / Seccion</p>
                <p className="text-sm font-medium text-slate-800">{student?.grade || "-"} {student?.section || ""}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-800 truncate">{student?.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Telefono</p>
                <p className="text-sm font-medium text-slate-800">{student?.phone || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Record Section */}
        {!record ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 border-dashed p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">Este estudiante no tiene ficha psicologica</p>
            <button
              onClick={() => setShowRecordModal(true)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors inline-flex items-center gap-2"
              data-testid="create-record-btn"
            >
              <Plus className="w-4 h-4" />
              Crear Ficha
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-slate-800">Ficha Psicologica</h3>
              </div>
              <button
                onClick={() => setShowRecordModal(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="edit-record-btn"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Motivo de consulta</p>
                <p className="text-sm text-slate-700">{record.reason || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Categoria</p>
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">
                  {record.reason_category || "-"}
                </span>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 mb-1">Observaciones</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.observations || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Diagnostico presuntivo</p>
                <p className="text-sm text-slate-700">{record.diagnosis || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Creado</p>
                <p className="text-sm text-slate-700">{record.created_at?.slice(0, 10) || "-"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Section */}
        <div className="bg-white rounded-2xl border border-slate-200/60">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-slate-800">Sesiones ({sessions.length})</h3>
            </div>
            {record && (
              <button
                onClick={() => { setEditingSession(null); setShowSessionModal(true); }}
                className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors inline-flex items-center gap-1.5"
                data-testid="add-session-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Sesion
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {record ? "No hay sesiones registradas" : "Crea una ficha primero para registrar sesiones"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <div key={session.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800">{session.session_type}</span>
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{session.reason_category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        {session.date?.slice(0, 10)} {session.duration_minutes ? `- ${session.duration_minutes} min` : ""}
                      </p>
                      {session.notes && (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">{session.notes}</p>
                      )}
                      {session.agreements && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-slate-500">Acuerdos:</p>
                          <p className="text-sm text-slate-600">{session.agreements}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingSession(session); setShowSessionModal(true); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg"
                        data-testid={`edit-session-${session.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg"
                        data-testid={`delete-session-${session.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Record Modal */}
      {showRecordModal && (
        <RecordModal
          record={record}
          onSave={record ? handleUpdateRecord : handleCreateRecord}
          onClose={() => setShowRecordModal(false)}
        />
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <SessionModal
          session={editingSession}
          onSave={handleSaveSession}
          onClose={() => { setShowSessionModal(false); setEditingSession(null); }}
        />
      )}
    </div>
  );
}

function RecordModal({ record, onSave, onClose }) {
  const [form, setForm] = useState({
    reason: record?.reason || "",
    reason_category: record?.reason_category || "Otro",
    observations: record?.observations || "",
    diagnosis: record?.diagnosis || "",
    status: record?.status || "nuevo",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-xl" data-testid="record-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-800">{record ? "Editar Ficha" : "Crear Ficha Psicologica"}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo de consulta</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={3}
              required
              data-testid="record-reason"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
            <select
              value={form.reason_category}
              onChange={(e) => setForm(f => ({ ...f, reason_category: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="record-category"
            >
              {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea
              value={form.observations}
              onChange={(e) => setForm(f => ({ ...f, observations: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={4}
              data-testid="record-observations"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Diagnostico presuntivo</label>
            <input
              type="text"
              value={form.diagnosis}
              onChange={(e) => setForm(f => ({ ...f, diagnosis: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="record-diagnosis"
            />
          </div>
          {record && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="record-status"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
            data-testid="save-record-btn"
          >
            {record ? "Guardar Cambios" : "Crear Ficha"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SessionModal({ session, onSave, onClose }) {
  const [form, setForm] = useState({
    session_type: session?.session_type || "Individual",
    reason_category: session?.reason_category || "Otro",
    date: session?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    duration_minutes: session?.duration_minutes || 45,
    notes: session?.notes || "",
    agreements: session?.agreements || "",
    next_session_date: session?.next_session_date || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      duration_minutes: parseInt(form.duration_minutes) || 45,
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-xl" data-testid="session-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-800">{session ? "Editar Sesion" : "Nueva Sesion"}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sesion</label>
              <select
                value={form.session_type}
                onChange={(e) => setForm(f => ({ ...f, session_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="session-type"
              >
                {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <select
                value={form.reason_category}
                onChange={(e) => setForm(f => ({ ...f, reason_category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                data-testid="session-category"
              >
                {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                required
                data-testid="session-date"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duracion (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                min="5"
                max="240"
                data-testid="session-duration"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas de la sesion</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={4}
              required
              data-testid="session-notes"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Acuerdos / Compromisos</label>
            <textarea
              value={form.agreements}
              onChange={(e) => setForm(f => ({ ...f, agreements: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              rows={2}
              data-testid="session-agreements"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha proxima sesion (opcional)</label>
            <input
              type="date"
              value={form.next_session_date}
              onChange={(e) => setForm(f => ({ ...f, next_session_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              data-testid="session-next-date"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
            data-testid="save-session-btn"
          >
            {session ? "Guardar Cambios" : "Registrar Sesion"}
          </button>
        </form>
      </div>
    </div>
  );
}
