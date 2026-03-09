import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "../components/AdminSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import StudentHeader from "../components/StudentHeader";
import {
  Video, Plus, Calendar, Clock, ExternalLink, Users, Trash2, Edit3,
  Loader2, AlertCircle, CheckCircle, X, Link as LinkIcon
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLATFORMS = [
  { id: "meet", label: "Google Meet", color: "text-green-600 bg-green-50" },
  { id: "zoom", label: "Zoom", color: "text-blue-600 bg-blue-50" },
  { id: "otro", label: "Otro enlace", color: "text-slate-600 bg-slate-50" },
];

function StatusBadge({ status }) {
  const map = {
    scheduled: { label: "Programada", cls: "bg-blue-100 text-blue-700" },
    active: { label: "En vivo", cls: "bg-emerald-100 text-emerald-700 animate-pulse" },
    finished: { label: "Finalizada", cls: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] || map.scheduled;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

function AttendancePanel({ classId, token }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/live-classes/${classId}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
        setRecords(data.attendance || []);
      } catch { setRecords([]); }
      setLoading(false);
    })();
  }, [classId, token]);

  if (loading) return <div className="flex items-center gap-2 py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Cargando asistencia...</div>;
  if (!records.length) return <p className="text-sm text-slate-400 py-4">Aún no hay alumnos conectados.</p>;

  return (
    <div data-testid="admin-attendance-panel">
      <p className="text-sm font-semibold text-slate-600 mb-2">Asistencia en vivo ({records.length})</p>
      {records.map(r => (
        <div key={r.id} className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl mb-1.5">
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-xs font-bold">{(r.student_name || "A")[0]}</div>
          <span className="text-sm font-medium text-slate-700 flex-1">{r.student_name}</span>
          <span className="text-xs text-slate-400">{r.join_time}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminLiveClassesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/live-classes`, { headers });
      setClasses(data.classes || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta clase?")) return;
    try {
      await axios.delete(`${API}/live-classes/${id}`, { headers });
      fetchClasses();
    } catch (err) {
      alert(err.response?.data?.detail || "Solo el profesor puede eliminar esta clase");
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayClasses = classes.filter(c => c.date === today);
  const upcomingClasses = classes.filter(c => c.date > today);
  const pastClasses = classes.filter(c => c.date < today);

  return (
    <div className="flex min-h-screen bg-slate-50" data-testid="admin-live-classes-page">
      <AdminSidebar active="clases-en-vivo" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={user?.school_name} subdomain={subdomain || user?.subdomain} user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader title="Clases en Vivo" onMenuToggle={() => setSidebarExpanded(!sidebarExpanded)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3" data-testid="admin-page-title">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center"><Video className="w-5 h-5 text-sky-600" /></div>
                Clases en Vivo
              </h1>
              <p className="text-sm text-slate-500 mt-1">Gestiona y supervisa todas las clases virtuales del colegio</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando clases...</div>
          ) : classes.length === 0 ? (
            <div className="text-center py-20">
              <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">No hay clases programadas</h3>
              <p className="text-sm text-slate-400">Los profesores pueden programar clases virtuales desde sus asignaturas.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {todayClasses.length > 0 && <Section title="Hoy" classes={todayClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onDelete={handleDelete} token={token} />}
              {upcomingClasses.length > 0 && <Section title="Próximas" classes={upcomingClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onDelete={handleDelete} token={token} />}
              {pastClasses.length > 0 && <Section title="Anteriores" classes={pastClasses} expandedClass={expandedClass} setExpandedClass={setExpandedClass} onDelete={handleDelete} token={token} />}
            </div>
          )}
        </main>
        <MobileBottomNav role="admin" active="clases-en-vivo" subdomain={subdomain || user?.subdomain} />
      </div>
    </div>
  );
}

function Section({ title, classes, expandedClass, setExpandedClass, onDelete, token }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">
        {classes.map(c => {
          const platform = PLATFORMS.find(p => p.id === c.platform) || PLATFORMS[2];
          const isExpanded = expandedClass === c.id;
          return (
            <div key={c.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${c.status === "active" ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-100"}`} data-testid={`admin-class-${c.id}`}>
              <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedClass(isExpanded ? null : c.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <StatusBadge status={c.status} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platform.color}`}>{platform.label}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{c.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{c.subject_name} — {c.section_name}</p>
                    <p className="text-sm text-slate-400">Prof. {c.teacher_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{c.date}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{c.start_time} - {c.end_time}</p>
                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-1 justify-end"><Users className="w-3 h-3" />{c.attendance_count || 0}</span>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50">
                  {c.description && <p className="text-sm text-slate-600 mb-3">{c.description}</p>}
                  <div className="flex items-center gap-3 mb-4">
                    <a href={c.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium"><ExternalLink className="w-4 h-4" />Abrir enlace</a>
                  </div>
                  <AttendancePanel classId={c.id} token={token} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
