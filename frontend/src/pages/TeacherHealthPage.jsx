import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import TeacherSidebar from "../components/TeacherSidebar";
import StudentHeader from "../components/StudentHeader";
import { ArrowLeft, Cross, Brain, HeartPulse, Loader2, ShieldAlert } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const modules = [
  {
    id: "topico", label: "Tópico",
    description: "Registro de atención médica, incidencias y seguimiento físico",
    icon: Cross, path: "topico", bgIcon: "bg-rose-100", hoverBorder: "hover:border-rose-300",
    hoverBg: "group-hover:bg-rose-500", textIcon: "text-rose-600", bar: "bg-rose-500",
  },
  {
    id: "psicologia", label: "Psicologia",
    description: "Seguimiento emocional, conductual y acompanamiento psicologico",
    icon: Brain, path: "psicologia", bgIcon: "bg-violet-100", hoverBorder: "hover:border-violet-300",
    hoverBg: "group-hover:bg-violet-500", textIcon: "text-violet-600", bar: "bg-violet-500",
  },
];

export default function TeacherHealthPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain: routeSubdomain } = useParams();
  const subdomain = routeSubdomain || user?.subdomain;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [schoolSettings, setSchoolSettings] = useState(null);

  useEffect(() => {
    setHasAccess(true);
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/api/settings/public/${subdomain || user?.subdomain}`);
        setSchoolSettings(res.data);
      } catch {}
    };
    loadSettings();
  }, [token]);

  const base = subdomain ? `/${subdomain}` : "";

  if (hasAccess === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="teacher-health-page">
      <TeacherSidebar
        active="salud-bienestar"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={user?.school_name || "Portal Docente"}
        subdomain={subdomain}
        user={user}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={schoolSettings?.logo_url}
          schoolName={schoolSettings?.system_name || user?.school_name || "Portal Docente"}
          subdomain={subdomain}
          token={token}
          roleLabel="Docente"
          profilePath="/teacher/profile"
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate(`${base}/teacher`)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              data-testid="back-to-teacher-dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Salud y Bienestar</h1>
                <p className="text-sm text-slate-400">Selecciona un módulo</p>
              </div>
            </div>
          </div>

          {!hasAccess ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto" data-testid="no-access-msg">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">Sin acceso</h3>
              <p className="text-sm text-slate-500 mb-6">
                No tienes permisos para acceder al módulo de Salud y Bienestar. Contacta al propietario del colegio para solicitar acceso.
              </p>
              <button
                onClick={() => navigate(`${base}/teacher`)}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Volver al Dashboard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    onClick={() => navigate(`${base}/teacher/salud-bienestar/${mod.path}`)}
                    className={`group relative bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 ${mod.hoverBorder} hover:shadow-lg transition-all text-left overflow-hidden`}
                    data-testid={`module-${mod.id}-btn`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1 ${mod.bar} scale-x-0 group-hover:scale-x-100 transition-transform origin-left`} />
                    <div className={`w-14 h-14 rounded-2xl ${mod.bgIcon} ${mod.hoverBg} flex items-center justify-center mb-4 transition-colors`}>
                      <Icon className={`w-7 h-7 ${mod.textIcon} group-hover:text-white transition-colors`} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 mb-1">{mod.label}</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">{mod.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
