import { Link, useParams, useLocation } from "react-router-dom";
import { Home, ClipboardList, MessageSquare, BookOpen, ScanLine, QrCode } from "lucide-react";

const parentItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/parent" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/parent/tasks" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/parent/courses" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/parent/messages" },
];

const studentItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/student" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/student/tasks" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/student/courses" },
  { id: "mensajes", label: "Mensajes", icon: MessageSquare, route: "/student/messages" },
];

const teacherItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/teacher" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/teacher/tasks" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/teacher/courses" },
  { id: "qr", label: "Escanear QR", icon: ScanLine, route: "/teacher/attendance?tab=qr-scanner" },
];

const ownerItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/dashboard" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/asignacion-docente" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/asignaturas" },
  { id: "qr", label: "Escanear QR", icon: ScanLine, route: "/asistencias?tab=qr-scanner" },
];

const adminItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/dashboard" },
  { id: "tareas", label: "Tareas", icon: ClipboardList, route: "/asignacion-docente" },
  { id: "cursos", label: "Cursos", icon: BookOpen, route: "/asignaturas" },
  { id: "qr", label: "Escanear QR", icon: ScanLine, route: "/asistencias?tab=qr-scanner" },
];

const auxiliarAlimentacionItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/pae" },
  { id: "escaneo", label: "Escaneo", icon: QrCode, route: "/pae/scanner" },
];

const auxiliarMovilidadItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/movilidad" },
  { id: "escaneo", label: "Escaneo", icon: QrCode, route: "/movilidad/scanner" },
];

const coordinatorItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/coordinacion" },
  { id: "incidencias", label: "Incidencias", icon: ScanLine, route: "/coordinacion/incidencias" },
  { id: "estudiantes", label: "Estudiantes", icon: BookOpen, route: "/coordinacion/estudiantes" },
];

const auxiliarAsistenciaItems = [
  { id: "inicio", label: "Inicio", icon: Home, route: "/aux-asistencia" },
  { id: "escanear", label: "Escanear", icon: QrCode, route: "/aux-asistencia/escanear" },
  { id: "asistencias", label: "Asistencias", icon: ClipboardList, route: "/aux-asistencia/asistencias" },
];

const itemsMap = {
  parent: parentItems,
  teacher: teacherItems,
  owner: ownerItems,
  admin: adminItems,
  student: studentItems,
  auxiliar_alimentacion: auxiliarAlimentacionItems,
  coordinator: coordinatorItems,
  auxiliar_asistencia: auxiliarAsistenciaItems,
};

export default function MobileBottomNav({ role = "parent" }) {
  const { subdomain } = useParams();
  const location = useLocation();
  const items = itemsMap[role] || parentItems;

  const isActive = (route) => {
    const base = route.split("?")[0];
    const fullRoute = subdomain ? `/${subdomain}${base}` : base;
    const exactRoutes = ["/parent", "/teacher", "/student", "/dashboard", "/admin", "/aux-asistencia"];
    if (exactRoutes.some(r => base === r)) {
      return location.pathname === fullRoute;
    }
    return location.pathname.startsWith(fullRoute);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 lg:hidden safe-bottom" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around h-[76px] px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.route);
          const href = subdomain ? `/${subdomain}${item.route}` : item.route;
          return (
            <Link
              key={item.id}
              to={href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors no-underline touch-manipulation ${
                active ? "text-emerald-600" : "text-slate-500"
              }`}
              data-testid={`mobile-nav-${item.id}`}
            >
              <Icon className={`w-7 h-7 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[13px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
