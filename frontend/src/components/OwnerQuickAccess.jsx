import { useNavigate } from "react-router-dom";
import { Users, UserCheck, BarChart3, Settings } from "lucide-react";

const items = [
  { id: "alumnos", label: "Alumnos", icon: Users, variant: "primary", path: "students" },
  { id: "docentes", label: "Docentes", icon: UserCheck, variant: "outline", path: "teachers" },
  { id: "reportes", label: "Reportes", icon: BarChart3, variant: "primary", path: "reports" },
  { id: "colegio", label: "Colegio", icon: Settings, variant: "outline", path: "settings" },
];

export default function OwnerQuickAccess() {
  const navigate = useNavigate();

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
              onClick={() => navigate(item.path)}
              className={`quick-btn flex flex-col items-center gap-3 ${
                isPrimary
                  ? "bg-[#001f4b] text-white"
                  : "bg-white text-slate-700 border border-slate-200 shadow-sm"
              }`}
              data-testid={`quick-${item.id}`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isPrimary ? "bg-white/10" : "bg-[#001f4b]/5"
                }`}
              >
                <Icon className={`w-6 h-6 ${isPrimary ? "text-[#e1b82c]" : "text-[#001f4b]"}`} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
