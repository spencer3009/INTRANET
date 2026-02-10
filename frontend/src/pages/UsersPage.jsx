import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { 
  Users, UserPlus, ArrowLeft, Loader2, X, Camera, Upload,
  GraduationCap, Building2, Check, AlertCircle, Plus, Eye, EyeOff,
  MoreVertical, Pencil, Trash2
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

// Add User Modal Component
function AddUserModal({ isOpen, onClose, token, roleId, onUserCreated }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [form, setForm] = useState({
    photo_url: "",
    name: "",
    last_name: "",
    username: "",
    password: "",
    email: "",
    phone: "",
    birthday: "",
    gender: "",
    address: "",
    role: roleId || ""
  });

  const headers = { Authorization: `Bearer ${token}` };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        photo_url: "",
        name: "",
        last_name: "",
        username: "",
        password: "",
        email: "",
        phone: "",
        birthday: "",
        gender: "",
        address: "",
        role: roleId || ""
      });
      setError("");
      setUsernameError("");
    }
  }, [isOpen, roleId]);

  // Check username availability
  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setUsernameError("");
      return;
    }
    
    setCheckingUsername(true);
    try {
      const res = await axios.get(`${API}/users/check-username/${username}`, { headers });
      if (!res.data.available) {
        setUsernameError("El usuario ya existe");
      } else {
        setUsernameError("");
      }
    } catch (err) {
      console.error("Error checking username:", err);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError("Solo se permiten archivos de imagen");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar 5MB");
      return;
    }
    
    setUploading(true);
    setError("");
    
    try {
      const sigRes = await axios.get(
        `${API}/cloudinary/signature?resource_type=image&folder=edunet/users`,
        { headers }
      );
      const sig = sigRes.data;
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.api_key);
      formData.append("timestamp", sig.timestamp);
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);
      
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: formData }
      );
      
      const uploadData = await uploadRes.json();
      
      if (uploadData.secure_url) {
        setForm(prev => ({ ...prev, photo_url: uploadData.secure_url }));
      } else {
        throw new Error("Error al subir imagen");
      }
    } catch (err) {
      setError(err.message || "Error al subir la foto");
    } finally {
      setUploading(false);
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.username || !form.password) {
      setError("Nombre, usuario y contraseña son obligatorios");
      return;
    }

    if (!form.role) {
      setError("Debes seleccionar un tipo de cuenta");
      return;
    }
    
    if (usernameError) {
      setError("El nombre de usuario no está disponible");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Prepare data with phone prefix
      const submitData = {
        ...form,
        phone: form.phone ? `+51${form.phone}` : ""
      };
      const res = await axios.post(`${API}/users`, submitData, { headers });
      onUserCreated(res.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'username') {
      // Debounce username check
      clearTimeout(window.usernameTimeout);
      window.usernameTimeout = setTimeout(() => checkUsername(value), 500);
    }
  };

  if (!isOpen) return null;

  const roleConfig = ROLE_CARDS.find(r => r.id === roleId) || ROLE_CARDS[2];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" data-testid="add-user-modal">
          {/* Header */}
          <div className={`bg-gradient-to-r ${roleConfig.color} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <img src={roleConfig.image} alt="" className="w-10 h-10" />
              <div className="text-white">
                <h2 className="text-xl font-bold">Nuevo {roleConfig.labelSingular}</h2>
                <p className="text-white/70 text-sm">Completa los datos del usuario</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Photo Upload - Full width */}
            <div className="md:col-span-2 flex flex-col items-center">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Fotografía</label>
              <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-28 h-28 rounded-full border-3 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden transition-all group-hover:border-blue-400">
                  {form.photo_url ? (
                    <img src={form.photo_url} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-slate-300 mx-auto" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <p className="text-xs text-slate-400 mt-2">Click para subir foto</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Juan"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Apellido</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Pérez"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Usuario <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    usernameError 
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder="juanperez"
                  required
                />
                {checkingUsername && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
                )}
                {!checkingUsername && form.username && !usernameError && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                )}
              </div>
              {usernameError && (
                <p className="text-xs text-red-500 mt-1">{usernameError}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="juan@correo.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Celular / WhatsApp</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-600 font-medium">
                  +51
                </span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    // Only allow numbers and limit to 9 digits
                    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                    handleChange('phone', value);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="999 999 999"
                  maxLength={9}
                />
              </div>
            </div>

            {/* Birthday */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cumpleaños</label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => handleChange('birthday', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Género</label>
              <select
                value={form.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleccionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dirección</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Av. Principal 123"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de cuenta</label>
              <select
                value={form.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleccionar</option>
                <option value="owner">Propietario</option>
                <option value="admin">Director</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || usernameError}
              className={`flex-1 px-6 py-3 bg-gradient-to-r ${roleConfig.color} text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalRole, setAddModalRole] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  
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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Count users by role
  const getUserCount = (roleId) => {
    if (roleId === 'pending') {
      return users.filter(u => !u.email_verified).length;
    }
    return users.filter(u => u.role === roleId && u.email_verified).length;
  };

  const handleCardClick = (roleId) => {
    setSelectedRole(roleId);
  };

  // Delete user handler
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setDeletingUser(userId);
    try {
      await axios.delete(`${API}/users/${userId}`, { headers });
      setUsers(prev => prev.filter(u => u.id !== userId));
      setOpenMenuId(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar usuario");
    } finally {
      setDeletingUser(null);
    }
  };

  // Edit user handler (placeholder for future implementation)
  const handleEditUser = (userId) => {
    // TODO: Implement edit modal
    alert('Funcionalidad de edición próximamente');
    setOpenMenuId(null);
  };

  const handleAddUser = (roleId) => {
    setAddModalRole(roleId === 'pending' ? 'teacher' : roleId);
    setShowAddModal(true);
  };

  const handleUserCreated = (newUser) => {
    setUsers(prev => [...prev, newUser]);
  };

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  // Content for when a role is selected
  const renderUsersList = () => {
    const roleConfig = ROLE_CARDS.find(r => r.id === selectedRole);
    const filteredUsers = selectedRole === 'pending' 
      ? users.filter(u => !u.email_verified)
      : users.filter(u => u.role === selectedRole && u.email_verified);

    return (
      <div className="p-6 lg:p-8" data-testid="users-list-content">
        {/* Header */}
        <div className={`bg-gradient-to-r ${roleConfig.color} text-white rounded-2xl p-6 mb-6`}>
          <button
            onClick={() => setSelectedRole(null)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a categorías
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={roleConfig.image} alt={roleConfig.label} className="w-16 h-16 object-contain" />
              <div>
                <h1 className="text-3xl font-bold">{roleConfig.label}</h1>
                <p className="text-white/80">{filteredUsers.length} {filteredUsers.length === 1 ? roleConfig.labelSingular : roleConfig.label.toLowerCase()}</p>
              </div>
            </div>
            
            {/* Add button */}
            <button
              onClick={() => handleAddUser(selectedRole)}
              className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
              data-testid="add-user-circle-btn"
            >
              <Plus className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>

        {/* Users Grid */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <img src={roleConfig.image} alt="" className="w-24 h-24 mx-auto mb-4 opacity-30" />
            <p className="text-slate-500">No hay {roleConfig.label.toLowerCase()} registrados</p>
            <button
              onClick={() => handleAddUser(selectedRole)}
              className={`mt-4 px-6 py-3 bg-gradient-to-r ${roleConfig.color} text-white rounded-xl font-semibold hover:shadow-lg transition-all`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Agregar {roleConfig.labelSingular}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((u) => (
              <div 
                key={u.id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-slate-100 relative"
                data-testid={`user-card-${u.id}`}
              >
                {/* 3 dots menu */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === u.id ? null : u.id);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    data-testid={`user-menu-btn-${u.id}`}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {/* Dropdown menu */}
                  {openMenuId === u.id && (
                    <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-slate-100 py-2 min-w-[140px] z-10">
                      <button
                        onClick={() => handleEditUser(u.id)}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        data-testid={`edit-user-${u.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={deletingUser === u.id}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                        data-testid={`delete-user-${u.id}`}
                      >
                        {deletingUser === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-4">
                  {u.photo_url ? (
                    <img 
                      src={u.photo_url} 
                      alt={u.name} 
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-14 h-14 rounded-full ${roleConfig.iconBg} flex items-center justify-center`}>
                      <span className={`text-xl font-bold ${roleConfig.textColor}`}>
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-8">
                    <h3 className="font-semibold text-slate-800 truncate">
                      {u.name} {u.last_name || ""}
                    </h3>
                    <p className="text-sm text-slate-500 truncate">{u.email || u.username}</p>
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
    );
  };

  // Main content with role cards
  const renderRoleCards = () => (
    <div className="p-6 lg:p-8" data-testid="users-cards-content">
      {/* Page Header Banner */}
      <div className="relative overflow-hidden rounded-2xl mb-8">
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

        <div className="relative px-8 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="w-16 h-16 object-contain" />
              ) : (
                <Building2 className="w-8 h-8 text-amber-500" />
              )}
            </div>

            <div className="text-white flex-1">
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Usuarios
              </h1>
              <p className="text-amber-100">{schoolName}</p>
            </div>

            <button
              onClick={() => handleAddUser('teacher')}
              className="flex items-center gap-2 bg-white text-amber-600 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
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
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {ROLE_CARDS.map((role) => {
          const count = getUserCount(role.id);
          return (
            <button
              key={role.id}
              onClick={() => handleCardClick(role.id)}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-slate-200 text-left relative overflow-hidden"
              data-testid={`role-card-${role.id}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="absolute top-4 right-4 text-slate-300 group-hover:text-slate-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </div>

              <div className="flex justify-center mb-4">
                <img 
                  src={role.image} 
                  alt={role.label}
                  className="w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>

              <h3 className="text-lg font-bold text-slate-800 text-center mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {role.label}
              </h3>

              <p className="text-sm text-slate-500 text-center">
                {count} {count === 1 ? role.labelSingular : role.label}
              </p>

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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
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
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="users-page">
      <Sidebar
        active="usuarios"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
        />

        <main className="flex-1 overflow-y-auto custom-scroll">
          {selectedRole ? renderUsersList() : renderRoleCards()}
        </main>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        token={token}
        roleId={addModalRole}
        onUserCreated={handleUserCreated}
      />
    </div>
  );
}
