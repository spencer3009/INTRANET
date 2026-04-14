import { BusFront, UtensilsCrossed, ClipboardCheck, Briefcase } from "lucide-react";

const PORTAL_CONFIG = {
  teacher: { label: "Portal Docente", icon: Briefcase, color: "from-blue-500 to-blue-600" },
  admin: { label: "Portal Administrador", icon: Briefcase, color: "from-slate-600 to-slate-700" },
  coordinator: { label: "Portal Coordinador", icon: Briefcase, color: "from-emerald-500 to-emerald-600" },
  psicologo: { label: "Portal Psicologia", icon: Briefcase, color: "from-pink-500 to-pink-600" },
  director: { label: "Portal Director", icon: Briefcase, color: "from-indigo-500 to-indigo-600" },
  auxiliar_alimentacion: { label: "Portal Alimentacion", icon: UtensilsCrossed, color: "from-orange-500 to-orange-600" },
  auxiliar_movilidad: { label: "Portal Movilidad", icon: BusFront, color: "from-purple-500 to-purple-600" },
  auxiliar_asistencia: { label: "Portal Asistencia", icon: ClipboardCheck, color: "from-cyan-500 to-cyan-600" },
};

export default function PortalSelector({ user, onSelect }) {
  const primaryRole = user?.role;
  const additionalRoles = user?.additional_roles || [];
  const allPortals = [primaryRole, ...additionalRoles].filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4" data-testid="portal-selector">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Selecciona tu portal</h1>
          <p className="text-sm text-slate-500">Hola {user?.name}, elige a que portal deseas ingresar</p>
        </div>
        <div className="space-y-3">
          {allPortals.map(portalRole => {
            const config = PORTAL_CONFIG[portalRole] || { label: portalRole, icon: Briefcase, color: "from-slate-500 to-slate-600" };
            const Icon = config.icon;
            const isPrimary = portalRole === primaryRole;
            return (
              <button
                key={portalRole}
                onClick={() => onSelect(portalRole)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group text-left"
                data-testid={`portal-${portalRole}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${config.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{config.label}</p>
                  {isPrimary && <p className="text-[10px] text-slate-400">Rol principal</p>}
                  {!isPrimary && <p className="text-[10px] text-indigo-500">Rol auxiliar</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
