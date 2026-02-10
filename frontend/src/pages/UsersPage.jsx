import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Users, UserPlus, ArrowLeft, Loader2, 
  GraduationCap, Briefcase, BookOpen, UserCheck,
  Shield, Clock, Building2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Role configurations with colors and icons
const ROLE_CARDS = [
  { 
    id: "owner", 
    label: "Directores", 
    labelSingular: "Director",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    iconBg: "bg-blue-100",
    textColor: "text-blue-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
  },
  { 
    id: "admin", 
    label: "Administradores", 
    labelSingular: "Administrador",
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    iconBg: "bg-purple-100",
    textColor: "text-purple-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135768.png"
  },
  { 
    id: "teacher", 
    label: "Profesores", 
    labelSingular: "Profesor",
    color: "from-emerald-500 to-emerald-600",
    bgColor: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    textColor: "text-emerald-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135789.png"
  },
  { 
    id: "student", 
    label: "Estudiantes", 
    labelSingular: "Estudiante",
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-50",
    iconBg: "bg-amber-100",
    textColor: "text-amber-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135810.png"
  },
  { 
    id: "parent", 
    label: "Padres", 
    labelSingular: "Padre/Apoderado",
    color: "from-rose-500 to-rose-600",
    bgColor: "bg-rose-50",
    iconBg: "bg-rose-100",
    textColor: "text-rose-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135725.png"
  },
  { 
    id: "pending", 
    label: "Pendientes", 
    labelSingular: "Pendiente",
    color: "from-slate-400 to-slate-500",
    bgColor: "bg-slate-50",
    iconBg: "bg-slate-100",
    textColor: "text-slate-600",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135823.png",
    isPending: true
  },
];

export default function UsersPage({ user, token, subdomain }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch users and settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, settingsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        setUsers(usersRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Error al cargar usuarios");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token]);

  // Count users by role
  const getUserCount = (roleId) => {
    if (roleId === 'pending') {
      return users.filter(u => !u.email_verified).length;
    }
    return users.filter(u => u.role === roleId && u.email_verified).length;
  };

  const handleBack = () => {
    if (subdomain) {
      navigate(`/school/${subdomain}/dashboard`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleCardClick = (roleId) => {
    setSelectedRole(roleId);
  };

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
      </div>
    );
  }

  // Users list view when a role is selected
  if (selectedRole) {
    const roleConfig = ROLE_CARDS.find(r => r.id === selectedRole);
    const filteredUsers = selectedRole === 'pending' 
      ? users.filter(u => !u.email_verified)
      : users.filter(u => u.role === selectedRole && u.email_verified);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" data-testid="users-list-page">
        {/* Header */}
        <div className={`bg-gradient-to-r ${roleConfig.color} text-white`}>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <button
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver a categorías
            </button>
            <div className="flex items-center gap-4">
              <img src={roleConfig.image} alt={roleConfig.label} className="w-16 h-16 object-contain" />
              <div>
                <h1 className="text-3xl font-bold">{roleConfig.label}</h1>
                <p className="text-white/80">{filteredUsers.length} {filteredUsers.length === 1 ? roleConfig.labelSingular : roleConfig.label.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <img src={roleConfig.image} alt="" className="w-24 h-24 mx-auto mb-4 opacity-30" />
              <p className="text-slate-500">No hay {roleConfig.label.toLowerCase()} registrados</p>
              <button
                onClick={() => setShowAddModal(true)}
                className={`mt-4 px-6 py-3 bg-gradient-to-r ${roleConfig.color} text-white rounded-xl font-semibold hover:shadow-lg transition-all`}
              >
                <UserPlus className="w-4 h-4 inline mr-2" />
                Agregar {roleConfig.labelSingular}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.map((u) => (
                <div 
                  key={u.id}
                  className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-slate-100"
                  data-testid={`user-card-${u.id}`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-full ${roleConfig.iconBg} flex items-center justify-center`}>
                      <span className={`text-xl font-bold ${roleConfig.textColor}`}>
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{u.name || "Sin nombre"}</h3>
                      <p className="text-sm text-slate-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${roleConfig.bgColor} ${roleConfig.textColor}`}>
                      {roleConfig.labelSingular}
                    </span>
                    <span className="text-xs text-slate-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main view with role cards
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" data-testid="users-page">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500">
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <pattern id="buildings" x="0" y="0" width="20" height="100" patternUnits="userSpaceOnUse">
                <rect x="2" y="30" width="6" height="70" fill="currentColor" />
                <rect x="4" y="25" width="2" height="5" fill="currentColor" />
                <rect x="10" y="40" width="8" height="60" fill="currentColor" />
                <rect x="12" y="35" width="4" height="5" fill="currentColor" />
              </pattern>
              <rect width="100" height="100" fill="url(#buildings)" />
            </svg>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-6">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
              data-testid="users-back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* Logo */}
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="w-20 h-20 object-contain" />
              ) : (
                <Building2 className="w-10 h-10 text-amber-500" />
              )}
            </div>

            {/* Title */}
            <div className="text-white">
              <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Usuarios
              </h1>
              <p className="text-amber-100 text-lg">{schoolName}</p>
            </div>

            {/* Add button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="ml-auto flex items-center gap-2 bg-white text-amber-600 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              data-testid="users-add-btn"
            >
              <UserPlus className="w-5 h-5" />
              Nuevo Usuario
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        </div>
      )}

      {/* Role Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {ROLE_CARDS.map((role) => {
            const count = getUserCount(role.id);
            return (
              <button
                key={role.id}
                onClick={() => handleCardClick(role.id)}
                className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-slate-200 text-left relative overflow-hidden"
                data-testid={`role-card-${role.id}`}
              >
                {/* Decorative gradient on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                {/* Three dots menu */}
                <div className="absolute top-4 right-4 text-slate-300 group-hover:text-slate-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </div>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <img 
                    src={role.image} 
                    alt={role.label}
                    className="w-24 h-24 object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                </div>

                {/* Label */}
                <h3 className="text-lg font-bold text-slate-800 text-center mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {role.label}
                </h3>

                {/* Count */}
                <p className="text-sm text-slate-500 text-center">
                  {count} {count === 1 ? role.labelSingular : role.label}
                </p>

                {/* Badge for pending */}
                {role.isPending && count > 0 && (
                  <div className="absolute top-4 left-4">
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                      {count}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-10 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Resumen General
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{users.length}</p>
              <p className="text-sm text-blue-600/70">Total Usuarios</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{users.filter(u => u.email_verified).length}</p>
              <p className="text-sm text-emerald-600/70">Verificados</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{users.filter(u => !u.email_verified).length}</p>
              <p className="text-sm text-amber-600/70">Pendientes</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{new Set(users.map(u => u.role)).size}</p>
              <p className="text-sm text-purple-600/70">Roles Activos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal (placeholder) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Nuevo Usuario</h2>
                <p className="text-sm text-slate-500">Invitar usuario al sistema</p>
              </div>
            </div>
            <p className="text-slate-500 mb-6 bg-amber-50 p-4 rounded-xl">
              La funcionalidad de invitar usuarios estará disponible próximamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
