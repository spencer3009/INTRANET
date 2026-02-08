import { CalendarCheck, Briefcase, Users, Mail } from "lucide-react";

const cards = [
  {
    id: "exams",
    label: "Exámenes Proyectados",
    key: "exams_projected",
    icon: CalendarCheck,
    bg: "bg-[#001f4b]",
  },
  {
    id: "tasks",
    label: "Tareas Entregadas",
    key: "tasks_delivered",
    icon: Briefcase,
    bg: "bg-[#5c85d6]",
  },
  {
    id: "students",
    label: "Promedio Alumnos",
    key: "avg_students",
    icon: Users,
    bg: "bg-[#10b981]",
  },
  {
    id: "messages",
    label: "Mensajes Sin Leer",
    key: "unread_messages",
    icon: Mail,
    bg: "bg-[#e1b82c]",
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
            className={`metric-card ${card.bg} text-white animate-fade-in-up stagger-${i + 1}`}
            data-testid={`metric-card-${card.id}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-white/80">{card.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {typeof value === "number" ? value.toLocaleString("es-ES") : value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
