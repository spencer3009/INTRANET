import { Users, UserCheck, DollarSign, Mail, ChevronRight } from "lucide-react";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const currentMonth = MONTHS_ES[new Date().getMonth()];

const ownerCards = [
  {
    id: "students",
    label: "Alumnos Activos",
    key: "students",
    subtitle: "Alumnos registrados",
    icon: Users,
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
    shadow: "0 10px 40px -10px rgba(37, 99, 235, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-sky-300 via-blue-200 to-indigo-300",
    iconBg: "from-white/30 to-white/10",
    iconColor: "text-white",
    textColor: "text-blue-100",
    arrowColor: "text-blue-200 group-hover:text-white",
    hasCorner: true,
  },
  {
    id: "teachers",
    label: "Docentes Activos",
    key: "teachers",
    subtitle: "Docentes registrados",
    icon: UserCheck,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    shadow: "0 10px 40px -10px rgba(5, 150, 105, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-emerald-300 via-green-200 to-teal-300",
    iconBg: "from-white/30 to-white/10",
    iconColor: "text-white",
    textColor: "text-emerald-100",
    arrowColor: "text-emerald-200 group-hover:text-white",
    hasCircle: true,
  },
  {
    id: "income",
    label: `Ingresos de ${currentMonth}`,
    key: "monthly_income",
    subtitle: `Cobrado en ${currentMonth}`,
    icon: DollarSign,
    prefix: "S/ ",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
    shadow: "0 10px 40px -10px rgba(109, 40, 217, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/15 to-white/5",
    lineGradient: "from-violet-300 via-purple-200 to-fuchsia-300",
    iconBg: "from-white/30 to-white/10",
    iconColor: "text-white",
    textColor: "text-violet-100",
    arrowColor: "text-violet-200 group-hover:text-white",
  },
  {
    id: "messages",
    label: "Mensajes Sin Leer",
    key: "unread_messages",
    subtitle: "Conversaciones pendientes",
    icon: Mail,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    shadow: "0 10px 40px -10px rgba(217, 119, 6, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
    orbColor: "from-white/20 to-white/5",
    lineGradient: "from-amber-300 via-yellow-200 to-orange-300",
    iconBg: "from-white/30 to-white/10",
    iconColor: "text-white",
    textColor: "text-amber-100",
    arrowColor: "text-amber-200 group-hover:text-white",
    hasPulse: true,
  },
];

export default function OwnerMetricCards({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="owner-metric-cards">
      {ownerCards.map((card, i) => {
        const Icon = card.icon;
        const rawValue = stats ? stats[card.key] : null;
        const isLoading = rawValue === null || rawValue === undefined;
        const displayValue = isLoading ? "—" : `${card.prefix || ""}${typeof rawValue === "number" ? rawValue.toLocaleString("es-PE") : rawValue}`;

        return (
          <div
            key={card.id}
            className={`relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 animate-fade-in-up stagger-${i + 1}`}
            style={{
              background: card.gradient,
              boxShadow: card.shadow,
            }}
            data-testid={`owner-metric-${card.id}`}
          >
            {/* Orbe decorativo */}
            <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${card.orbColor} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
            
            {/* Decoración esquina */}
            {card.hasCorner && (
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />
            )}
            
            {/* Decoración círculo */}
            {card.hasCircle && (
              <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />
            )}
            
            {/* Punto pulsante */}
            {card.hasPulse && (
              <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />
            )}
            
            {/* Línea inferior */}
            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${card.lineGradient} opacity-70`} />
            
            <div className="relative flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.iconBg} backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <span className={`text-sm font-semibold ${card.textColor} tracking-wide`}>{card.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {displayValue}
                  </span>
                  <p className={`text-xs mt-1 ${card.textColor} opacity-80`}>{card.subtitle}</p>
                </div>
                <ChevronRight className={`w-5 h-5 ${card.arrowColor} group-hover:translate-x-1 transition-all`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
