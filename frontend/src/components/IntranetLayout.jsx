import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Clock, 
  CalendarCheck, 
  MessageSquare, 
  Calendar, 
  User,
  Menu,
  X,
  GraduationCap,
  LogOut,
  Bell
} from "lucide-react";
import { studentInfo } from "@/data/studentData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/boleta", icon: FileText, label: "Boleta de Notas" },
  { path: "/horarios", icon: Clock, label: "Horarios" },
  { path: "/asistencia", icon: CalendarCheck, label: "Asistencia" },
  { path: "/comunicados", icon: MessageSquare, label: "Comunicados", badge: 2 },
  { path: "/calendario", icon: Calendar, label: "Calendario" },
  { path: "/perfil", icon: User, label: "Mi Perfil" },
];

export const IntranetLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden no-print"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        data-testid="mobile-menu-toggle"
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`sidebar ${sidebarOpen ? 'open' : ''} no-print`}
        data-testid="sidebar"
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-white">Intranet</h1>
              <p className="text-xs text-slate-400">Sistema Escolar</p>
            </div>
          </div>
        </div>

        {/* Student Mini Profile */}
        <div className="p-4 mx-3 mt-4 bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <img 
              src={studentInfo.foto} 
              alt="Foto del estudiante"
              className="w-12 h-12 rounded-lg object-cover border-2 border-blue-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {studentInfo.nombres}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {studentInfo.apellidos}
              </p>
              <p className="text-xs text-blue-400 mt-0.5">
                {studentInfo.grado} - {studentInfo.seccion}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-2" data-testid="sidebar-navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => 
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge variant="destructive" className="text-xs px-2">
                  {item.badge}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <div className="text-center">
            <p className="text-xs text-slate-500">
              {studentInfo.ie}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Año Escolar {studentInfo.anio}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content flex-1">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 no-print">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="lg:ml-0 ml-12">
              <h2 className="font-heading text-xl font-bold text-slate-900">
                {menuItems.find(item => 
                  item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
                )?.label || "Dashboard"}
              </h2>
              <p className="text-sm text-slate-500">
                Bienvenido, {studentInfo.nombres}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                    <Bell className="h-5 w-5 text-slate-600" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      2
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                    <span className="font-medium text-sm">Reunión de Padres</span>
                    <span className="text-xs text-slate-500">Viernes 15 de Noviembre - 6:00 PM</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                    <span className="font-medium text-sm">Entrega de Libretas</span>
                    <span className="text-xs text-slate-500">Disponibles desde el 18 de Noviembre</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="user-menu-btn">
                    <img 
                      src={studentInfo.foto}
                      alt="Foto del estudiante"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <span className="hidden md:block text-sm font-medium text-slate-700">
                      {studentInfo.nombres}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="w-4 h-4 mr-2" />
                    Mi Perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default IntranetLayout;
