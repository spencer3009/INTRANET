import { Link, useParams, useLocation } from "react-router-dom";
import {
  Home, Clock, ClipboardList, Wallet, MessageSquare,
  BookOpen, Users, BarChart3, CalendarCheck, ScanLine
} from "lucide-react";

const parentItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/parent" },
  { id: "pagos", label: "Pagos", icon: Wallet, route: "/parent/payments" },
  { id: "asistencia", label: "Asistencia", icon: Clock, route: "/parent/attendance" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/parent/tasks" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/parent/messages" },
];

const teacherItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/teacher" },
  { id: "asistencia", label: "Asistencia", icon: CalendarCheck, route: "/teacher/attendance" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/teacher/tasks" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/teacher/courses" },
  { id: "qr", label: "Escanear QR", icon: ScanLine, route: "/teacher/attendance?tab=qr-scanner" },
];

export default function MobileBottomNav({ role = "parent" }) {
  const { subdomain } = useParams();
  const location = useLocation();
  const items = role === "teacher" ? teacherItems : parentItems;

  const isActive = (route) => {
    const fullRoute = subdomain ? `/${subdomain}${route}` : route;
    if (route.endsWith("/parent") || route.endsWith("/teacher")) {
      return location.pathname === fullRoute;
    }
    return location.pathname.startsWith(fullRoute);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden safe-bottom" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around h-[72px] px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.route);
          const href = subdomain ? `/${subdomain}${item.route}` : item.route;
          return (
            <Link
              key={item.id}
              to={href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors no-underline touch-manipulation ${
                active ? "text-emerald-600" : "text-slate-400"
              }`}
              data-testid={`mobile-nav-${item.id}`}
            >
              <Icon className={`w-6 h-6 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
