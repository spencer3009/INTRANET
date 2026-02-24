import { useNavigate } from "react-router-dom";
import { Users, UserCheck, BarChart3, Building2, ChevronRight } from "lucide-react";

const items = [
  {
    id: "alumnos",
    label: "Alumnos",
    desc: "Gestion de estudiantes",
    icon: Users,
    path: "admin/students",
    gradient: "from-blue-600 to-blue-700",
    iconBg: "bg-blue-500/30",
    hoverGlow: "group-hover:shadow-blue-500/20",
  },
  {
    id: "docentes",
    label: "Docentes",
    desc: "Equipo academico",
    icon: UserCheck,
    path: "admin/teachers",
    gradient: "from-emerald-600 to-emerald-700",
    iconBg: "bg-emerald-500/30",
    hoverGlow: "group-hover:shadow-emerald-500/20",
  },
  {
    id: "reportes",
    label: "Reportes",
    desc: "Metricas institucionales",
    icon: BarChart3,
    path: "contabilidad",
    gradient: "from-violet-600 to-violet-700",
    iconBg: "bg-violet-500/30",
    hoverGlow: "group-hover:shadow-violet-500/20",
  },
  {
    id: "colegio",
    label: "Colegio",
    desc: "Configuracion general",
    icon: Building2,
    path: "admin/settings",
    gradient: "from-amber-600 to-amber-700",
    iconBg: "bg-amber-500/30",
    hoverGlow: "group-hover:shadow-amber-500/20",
  },
];

export default function OwnerQuickAccess({ subdomain }) {
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}/${path}`);
    } else {
      navigate(`/${path}`);
    }
  };

  return (
    <div data-testid="owner-quick-access">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Acceso Ejecutivo
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.gradient} p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-xl ${item.hoverGlow}`}
              data-testid={`quick-${item.id}`}
            >
              {/* Orbe decorativo */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-white/0 via-white/30 to-white/0" />

              <div className="relative flex flex-col gap-3">
                <div className={`w-11 h-11 rounded-xl ${item.iconBg} backdrop-blur-sm flex items-center justify-center border border-white/10`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block tracking-wide">{item.label}</span>
                  <span className="text-[11px] text-white/60 mt-0.5 block">{item.desc}</span>
                </div>
                <ChevronRight className="absolute top-1 right-0 w-4 h-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
