import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  Users, UserPlus, ArrowLeft, Loader2, X, 
  Check, AlertCircle, Search, Filter,
  MoreVertical, Pencil, Trash2, Eye, Shield,
  GraduationCap, UserCog, UserCheck, Building2, Clock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Role configurations
const ROLE_CONFIG = {
  owner: { label: "Director", color: "bg-blue-100 text-blue-700", icon: Building2 },
  admin: { label: "Administrador", color: "bg-purple-100 text-purple-700", icon: Shield },
  teacher: { label: "Profesor", color: "bg-emerald-100 text-emerald-700", icon: UserCog },
  student: { label: "Estudiante", color: "bg-amber-100 text-amber-700", icon: GraduationCap },
  parent: { label: "Padre", color: "bg-rose-100 text-rose-700", icon: UserCheck },
  coordinator: { label: "Coordinador", color: "bg-indigo-100 text-indigo-700", icon: Users },
  auxiliar: { label: "Auxiliar", color: "bg-teal-100 text-teal-700", icon: Users },
};

// Role Badge Component
function RoleBadge({ role }) {
  const config = ROLE_CONFIG[role] || { label: role, color: "bg-slate-100 text-slate-700" };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// User Row Component
function UserRow({ userItem, onEdit, onDelete, onChangeRole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <tr className="hover:bg-slate-50 transition-colors" data-testid={`user-row-${userItem.id}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
            {userItem.photo_url ? (
              <img src={userItem.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-800">{userItem.name} {userItem.last_name}</p>
            <p className="text-xs text-slate-500">@{userItem.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={userItem.role} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {userItem.email || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {userItem.phone || "-"}
      </td>
      <td className="px-4 py-3">
        {userItem.email_verified ? (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
            Verificado
          </span>
        ) : (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            Pendiente
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </button>
          
          {menuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                <button
                  onClick={() => {
                    onEdit(userItem);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    onChangeRole(userItem);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Cambiar rol
                </button>
                <button
                  onClick={() => {
                    onDelete(userItem);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// Change Role Modal
function ChangeRoleModal({ isOpen, onClose, user, token, onSave }) {
  const [selectedRole, setSelectedRole] = useState(user?.role || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (isOpen && user) {
      setSelectedRole(user.role);
      setError("");
    }
  }, [isOpen, user]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole || selectedRole === user.role) {
      onClose();
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await axios.put(`${API}/users/${user.id}`, { role: selectedRole }, { headers });
      onSave(res.data.user || { ...user, role: selectedRole });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cambiar el rol");
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Cambiar Rol de Usuario</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-4">
              Cambiando rol de <strong>{user?.name} {user?.last_name}</strong>
            </p>
            
            <div className="space-y-2">
              {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => setSelectedRole(roleKey)}
                  className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    selectedRole === roleKey
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                    <config.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-slate-800">{config.label}</span>
                  {selectedRole === roleKey && (
                    <Check className="w-5 h-5 text-blue-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || selectedRole === user?.role}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminUsersPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get('filter') === 'pending' ? 'pending' : "");
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, settingsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        setUsers(usersRes.data || []);
        if (settingsRes.data) setSettings(settingsRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.detail || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token]);

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch = !search || 
      `${u.name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    const matchesStatus = !filterStatus || 
      (filterStatus === 'pending' && !u.email_verified) ||
      (filterStatus === 'verified' && u.email_verified);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handlers
  const handleEdit = (userItem) => {
    // Navigate to specific page based on role
    if (userItem.role === 'student') {
      navigateTo(`/admin/students?edit=${userItem.id}`);
    } else if (userItem.role === 'teacher') {
      navigateTo(`/admin/teachers?edit=${userItem.id}`);
    } else {
      // For now, show role modal for other users
      setUserToChangeRole(userItem);
      setShowRoleModal(true);
    }
  };

  const handleDelete = (userItem) => {
    setUserToDelete(userItem);
    setShowDeleteModal(true);
  };

  const handleChangeRole = (userItem) => {
    setUserToChangeRole(userItem);
    setShowRoleModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/users/${userToDelete.id}`, { headers });
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar usuario");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRoleSave = (updatedUser) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  // Stats
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    pending: users.filter(u => !u.email_verified).length,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-users-page">
      {/* Sidebar */}
      <AdminSidebar
        active="usuarios"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
        />

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
                <p className="text-sm text-slate-500">Gestión de todos los usuarios del sistema</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Estudiantes</p>
              <p className="text-2xl font-bold text-amber-600">{stats.students}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Profesores</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.teachers}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Pendientes</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Buscar por nombre, usuario o correo..."
                />
              </div>
              
              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Todos los roles</option>
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="verified">Verificados</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">
                  {search || filterRole || filterStatus 
                    ? "No se encontraron usuarios con los filtros aplicados"
                    : "No hay usuarios registrados"
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Usuario</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rol</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Correo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(userItem => (
                      <UserRow
                        key={userItem.id}
                        userItem={userItem}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onChangeRole={handleChangeRole}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Change Role Modal */}
      <ChangeRoleModal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setUserToChangeRole(null);
        }}
        user={userToChangeRole}
        token={token}
        onSave={handleRoleSave}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Usuario"
        message={`¿Estás seguro de eliminar a ${userToDelete?.name} ${userToDelete?.last_name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
