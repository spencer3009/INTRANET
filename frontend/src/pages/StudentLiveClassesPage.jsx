import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MobileBottomNav from "../components/MobileBottomNav";
import {
  Video, Calendar, Clock, ExternalLink, Users, Loader2,
  CheckCircle, AlertCircle, Monitor
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLATFORMS = {
  meet: { label: "Google Meet", cls: "bg-green-50 text-green-700" },
  zoom: { label: "Zoom", cls: "bg-blue-50 text-blue-700" },
  otro: { label: "Enlace externo", cls: "bg-slate-50 text-slate-600" },
};

function StatusBadge({ status }) {
  const map = {
    scheduled: { label: "Programada", cls: "bg-blue-100 text-blue-700" },
    active: { label: "En vivo", cls: "bg-emerald-100 text-emerald-700 animate-pulse" },
    finished: { label: "Finalizada", cls: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] || map.scheduled;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

function canJoinClass(dateStr, startTime) {
  const now = new Date();
  const peruOffset = -5 * 60;
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const peruNow = new Date(utcNow + peruOffset * 60000);
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = startTime.split(":").map(Number);
  const classStart = new Date(y, m - 1, d, h, min);
  const earlyAccess = new Date(classStart.getTime() - 10 * 60000);
  return peruNow >= earlyAccess;
}

function isClassFinished(dateStr, endTime) {
  const now = new Date();
  const peruOffset = -5 * 60;
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const peruNow = new Date(utcNow + peruOffset * 60000);
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = endTime.split(":").map(Number);
  const classEnd = new Date(y, m - 1, d, h, min);
  return peruNow > classEnd;
}

export default function StudentLiveClassesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/live-classes`, { headers });
      setClasses(data.classes || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Refresh every 30 seconds to update statuses
  useEffect(() => {
    const interval = setInterval(fetchClasses, 30000);
    return () => clearInterval(interval);
  }, [fetchClasses]);

  const handleJoin = async (cls) => {
    setJoiningId(cls.id);
    try {
      const { data } = await axios.post(`${API}/live-classes/${cls.id}/join`, {}, { headers });
      window.open(data.meeting_link, "_blank");
      fetchClasses();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al unirse a la clase");
    }
    setJoiningId(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayClasses = classes.filter(c => c.date === today);
  const upcomingClasses = classes.filter(c => c.date > today);
  const pastClasses = classes.filter(c => c.date < today).slice(0, 10);

  return (
    <div className="flex min-h-screen bg-slate-50" data-testid="student-live-classes-page">
      <StudentSidebar active="clases-en-vivo" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={user?.school_name} subdomain={subdomain || user?.subdomain} user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader title="Clases en Vivo" onMenuToggle={() => setSidebarExpanded(!sidebarExpanded)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3" data-testid="page-title">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Video className="w-5 h-5 text-emerald-600" /></div>
              Clases en Vivo
            </h1>
            <p className="text-sm text-slate-500 mt-1">Accede a tus clases virtuales programadas</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando clases...</div>
          ) : classes.length === 0 ? (
            <div className="text-center py-20">
              <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">No hay clases programadas</h3>
              <p className="text-sm text-slate-400">Cuando tus profesores programen clases virtuales, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {todayClasses.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Hoy</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {todayClasses.map(c => <StudentClassCard key={c.id} cls={c} onJoin={handleJoin} joiningId={joiningId} />)}
                  </div>
                </div>
              )}
              {upcomingClasses.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Próximas clases</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingClasses.map(c => <StudentClassCard key={c.id} cls={c} onJoin={handleJoin} joiningId={joiningId} />)}
                  </div>
                </div>
              )}
              {pastClasses.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Clases anteriores</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastClasses.map(c => <StudentClassCard key={c.id} cls={c} onJoin={handleJoin} joiningId={joiningId} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        <MobileBottomNav role="student" active="clases-en-vivo" subdomain={subdomain || user?.subdomain} />
      </div>
    </div>
  );
}

function StudentClassCard({ cls, onJoin, joiningId }) {
  const platform = PLATFORMS[cls.platform] || PLATFORMS.otro;
  const finished = cls.status === "finished" || isClassFinished(cls.date, cls.end_time);
  const canJoin = !finished && canJoinClass(cls.date, cls.start_time);
  const isActive = cls.status === "active";
  const isJoining = joiningId === cls.id;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isActive ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-100"}`} data-testid={`student-class-${cls.id}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={finished ? "finished" : cls.status} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platform.cls}`}>{platform.label}</span>
          </div>
          <span className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" />{cls.attendance_count || 0}</span>
        </div>

        <h3 className="text-base font-bold text-slate-800 mb-1">{cls.title}</h3>
        <p className="text-sm text-slate-500 mb-0.5">{cls.subject_name}</p>
        <p className="text-sm text-slate-400">Prof. {cls.teacher_name} — {cls.section_name}</p>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
          <span className="text-sm text-slate-600 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{cls.date}</span>
          <span className="text-sm text-slate-600 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{cls.start_time} - {cls.end_time}</span>
        </div>

        {cls.description && <p className="text-sm text-slate-400 mt-2 line-clamp-2">{cls.description}</p>}

        <div className="mt-4">
          {finished ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4" /> Clase finalizada
            </div>
          ) : canJoin ? (
            <button onClick={() => onJoin(cls)} disabled={isJoining} data-testid={`join-class-${cls.id}`} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Entrar a la clase
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-2.5 rounded-xl">
              <Clock className="w-4 h-4" /> Disponible 10 min antes del inicio
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
