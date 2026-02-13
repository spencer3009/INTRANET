import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Shield, Users, Plus, Search, Pencil, Trash2, Check, X,
  Loader2, ArrowLeft, Key, Eye, Lock, Unlock, AlertCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default roles with permissions
const DEFAULT_ROLES = [
  {
    id: "owner",
    name: "Owner",
    description: "Propietario del colegio con acceso total",
    permissions: ["all"],
    isSystem: true,
    color: "purple"
  },
  {
    id: "admin",
    name: "Administrador",
    description: "Gestión administrativa del colegio",
    permissions: ["admin_portal", "users", "students", "teachers", "academic", "reports"],
    isSystem: true,
    color: "blue"
  },
  {
    id: "director",
    name: "Director",
    description: "Dirección académica y administrativa",
    permissions: ["dashboard", "users", "students", "teachers", "academic", "reports"],
    isSystem: true,
    color: "emerald"
  },
  {
    id: "coordinator",
    name: "Coordinador",
    description: "Coordinación de nivel o área",
    permissions: ["dashboard", "students", "teachers", "academic"],
    isSystem: true,
    color: "amber"
  },
  {
    id: "teacher",
    name: "Profesor",
    description: "Docente con acceso a sus cursos",
    permissions: ["teacher_portal", "courses", "grades", "attendance"],
    isSystem: true,
    color: "cyan"
  },
  {
    id: "student",
    name: "Estudiante",
    description: "Alumno con acceso de solo lectura",
    permissions: ["student_portal", "courses", "grades"],
    isSystem: true,
    color: "slate"
  }
];

// Permission modules
const PERMISSION_MODULES = [
  { id: "all", name: "Acceso Total", description: "Todos los permisos del sistema" },
  { id: "admin_portal", name: "Portal Admin", description: "Acceso al portal de administración" },
  { id: "teacher_portal", name: "Portal Profesor", description: "Acceso al portal docente" },
  { id: "student_portal", name: "Portal Alumno", description: "Acceso al portal estudiantil" },
  { id: "users", name: "Usuarios", description: "Gestión de usuarios" },
  { id: "students", name: "Estudiantes", description: "Gestión de estudiantes" },
  { id: "teachers", name: "Profesores", description: "Gestión de docentes" },
  { id: "academic", name: "Académico", description: "Estructura académica" },
  { id: "courses", name: "Cursos", description: "Gestión de cursos" },
  { id: "grades", name: "Notas", description: "Calificaciones" },
  { id: "attendance", name: "Asistencia", description: "Control de asistencia" },
  { id: "reports", name: "Reportes", description: "Generación de reportes" },
  { id: "settings", name: "Configuración", description: "Ajustes del sistema" }
];

// Role Card Component
function RoleCard({ role, onEdit, usersCount }) {
  const colorClasses = {
    purple: "border-purple-200 bg-purple-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    cyan: "border-cyan-200 bg-cyan-50",
    slate: "border-slate-200 bg-slate-50"
  };
  
  const iconColors = {
    purple: "text-purple-600 bg-purple-100",
    blue: "text-blue-600 bg-blue-100",
    emerald: "text-emerald-600 bg-emerald-100",
    amber: "text-amber-600 bg-amber-100",
    cyan: "text-cyan-600 bg-cyan-100",
    slate: "text-slate-600 bg-slate-100"
  };
  
  return (
    <div className={`rounded-2xl border-2 ${colorClasses[role.color] || colorClasses.slate} p-5 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${iconColors[role.color] || iconColors.slate} flex items-center justify-center`}>
          <Shield className="w-6 h-6" />
        </div>
        {role.isSystem && (
          <span className="px-2 py-1 bg-white/80 rounded-lg text-xs font-medium text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Sistema
          </span>
        )}
      </div>
      
      <h3 className="font-bold text-slate-800 mb-1">{role.name}</h3>
      <p className="text-sm text-slate-600 mb-3">{role.description}</p>
      
      <div className="flex flex-wrap gap-1 mb-4">
        {role.permissions.slice(0, 4).map((perm) => (
          <span key={perm} className="px-2 py-0.5 bg-white/80 rounded text-xs text-slate-600">
            {PERMISSION_MODULES.find(m => m.id === perm)?.name || perm}
          </span>
        ))}
        {role.permissions.length > 4 && (
          <span className="px-2 py-0.5 bg-white/80 rounded text-xs text-slate-500">
            +{role.permissions.length - 4} más
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-white/50">
        <span className="text-sm text-slate-500">
          <Users className="w-4 h-4 inline mr-1" />
          {usersCount || 0} usuarios
        </span>
        {!role.isSystem && (
          <button
            onClick={() => onEdit(role)}
            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminRolesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [userCounts, setUserCounts] = useState({});
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/users`, { headers }).catch(() => ({ data: { users: [] } }))
      ]);
      
      if (settingsRes.data) setSettings(settingsRes.data);
      
      // Count users by role
      const users = usersRes.data?.users || [];
      const counts = {};
      users.forEach(u => {
        counts[u.role] = (counts[u.role] || 0) + 1;
      });
      setUserCounts(counts);
      
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-roles-page">
      <AdminSidebar
        active="roles"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Roles y Permisos</h1>
                <p className="text-sm text-slate-500">Gestión de roles del sistema</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                <strong>Versión básica:</strong> Los roles del sistema están predefinidos y no pueden modificarse.
                En futuras versiones podrás crear roles personalizados con permisos específicos.
              </p>
            </div>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <RoleCard 
                key={role.id} 
                role={role} 
                usersCount={userCounts[role.id]}
                onEdit={() => {}}
              />
            ))}
          </div>

          {/* Permissions Reference */}
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Key className="w-5 h-5 text-slate-400" />
                Referencia de Permisos
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PERMISSION_MODULES.map((perm) => (
                  <div key={perm.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{perm.name}</p>
                      <p className="text-xs text-slate-500">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
