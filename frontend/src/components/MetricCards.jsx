import { CalendarCheck, Briefcase, Users, Mail, ChevronRight } from "lucide-react";

const cards = [
  {
    id: "exams",
    label: "Exámenes Proyectados",
    key: "exams_projected",
    icon: CalendarCheck,
    gradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)",
    shadow: "0 10px 40px -10px rgba(15, 23, 42, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    orbColor: "from-cyan-500/20 to-blue-600/10",
    lineGradient: "from-cyan-500 via-blue-500 to-indigo-500",
    iconBg: "from-cyan-500/30 to-blue-600/20",
    iconColor: "text-cyan-400",
    textColor: "text-slate-300",
    arrowColor: "text-slate-500 group-hover:text-cyan-400",
  },
  {
    id: "tasks",
    label: "Tareas Entregadas",
    key: "tasks_delivered",
    icon: Briefcase,
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
    id: "students",
    label: "Promedio Alumnos",
    key: "avg_students",
    icon: Users,
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
    id: "messages",
    label: "Mensajes Sin Leer",
    key: "unread_messages",
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

export default function MetricCards({ metrics }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metric-cards">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = metrics ? metrics[card.key] : "—";
        return (
          <div
            key={card.id}
            className={`relative overflow-hidden rounded-2xl p-5 cursor-pointer group transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 animate-fade-in-up stagger-${i + 1}`}
            style={{
              background: card.gradient,
              boxShadow: card.shadow,
            }}
            data-testid={`metric-card-${card.id}`}
          >
            {/* Decorative gradient orb */}
            <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${card.orbColor} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
            
            {/* Corner decoration for tasks card */}
            {card.hasCorner && (
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-[100px]" />
            )}
            
            {/* Circle decoration for students card */}
            {card.hasCircle && (
              <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/10 rounded-full" />
            )}
            
            {/* Pulse dot for messages card */}
            {card.hasPulse && (
              <div className="absolute top-4 right-4 w-3 h-3 bg-white/40 rounded-full animate-pulse" />
            )}
            
            {/* Bottom gradient line */}
            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${card.lineGradient} opacity-70`} />
            
            <div className="relative flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.iconBg} backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <span className={`text-sm font-semibold ${card.textColor} tracking-wide`}>{card.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-white tracking-tight drop-shadow-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {typeof value === "number" ? value.toLocaleString("es-ES") : value}
                </span>
                <ChevronRight className={`w-5 h-5 ${card.arrowColor} group-hover:translate-x-1 transition-all`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
