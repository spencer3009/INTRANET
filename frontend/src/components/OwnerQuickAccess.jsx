import { useNavigate } from "react-router-dom";
import { Users, UserCheck, BarChart3, Building2, ChevronRight } from "lucide-react";

const items = [
  {
    id: "alumnos",
    label: "Alumnos",
    desc: "Gestion de estudiantes",
    icon: Users,
    path: "users?role=student",
    variant: "primary",
  },
  {
    id: "docentes",
    label: "Docentes",
    desc: "Equipo academico",
    icon: UserCheck,
    path: "users?role=teacher",
    variant: "outline",
  },
  {
    id: "reportes",
    label: "Reportes",
    desc: "Metricas institucionales",
    icon: BarChart3,
    path: "contabilidad",
    variant: "primary",
  },
  {
    id: "colegio",
    label: "Colegio",
    desc: "Configuracion general",
    icon: Building2,
    path: "settings",
    variant: "outline",
  },
];

export default function OwnerQuickAccess({ subdomain }) {
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}/${path}`);
    } else {
      navigate(`/${path}`);
    }
  };

  return (
    <div data-testid="owner-quick-access">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Acceso Ejecutivo
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isPrimary = item.variant === "primary";
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`quick-btn group flex flex-col items-center gap-3 relative overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 ${
                isPrimary
                  ? "bg-[#001f4b] text-white hover:shadow-xl hover:shadow-[#001f4b]/20"
                  : "bg-white text-slate-700 border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300"
              }`}
              data-testid={`quick-${item.id}`}
            >
              {/* Decoracion sutil */}
              {isPrimary && (
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              )}

              <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${
                isPrimary ? "bg-white/10" : "bg-[#001f4b]/5"
              }`}>
                <Icon className={`w-6 h-6 ${isPrimary ? "text-[#e1b82c]" : "text-[#001f4b]"}`} />
              </div>
              <div className="relative text-center">
                <span className="text-xs font-bold uppercase tracking-wide block">{item.label}</span>
                <span className={`text-[10px] mt-0.5 block ${isPrimary ? "text-white/50" : "text-slate-400"}`}>{item.desc}</span>
              </div>
              <ChevronRight className={`absolute top-3 right-3 w-3.5 h-3.5 ${
                isPrimary ? "text-white/20 group-hover:text-white/50" : "text-slate-200 group-hover:text-slate-400"
              } group-hover:translate-x-0.5 transition-all`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
