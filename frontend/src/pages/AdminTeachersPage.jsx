import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  UserCog, UserPlus, ArrowLeft, Loader2, X, Camera,
  Check, AlertCircle, Plus, Eye, EyeOff, Search,
  MoreVertical, Pencil, Trash2, BookOpen, Sparkles,
  Mail, Phone, Calendar, Award, ChevronDown, ExternalLink
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Teacher Row Component
function TeacherRow({ teacher, assignments, subjects, onEdit, onDelete, onViewDetails, onManageAssignments }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Count assigned subjects (exclude tutor-role rows which have no subject_id)
  const teacherAssignments = assignments.filter(a => a.teacher_id === teacher.id && a.subject_id);
  const uniqueSubjects = [...new Set(teacherAssignments.map(a => a.subject_id))];

  // Count active tutor sections
  const tutorCount = assignments.filter(
    a => a.teacher_id === teacher.id && a.role === "tutor" && (a.status === "activo" || !a.status)
  ).length;
  
  return (
    <tr className="hover:bg-slate-50 transition-colors" data-testid={`teacher-row-${teacher.id}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden">
            {teacher.photo_url ? (
              <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCog className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-800">{teacher.name} {teacher.last_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-slate-500">@{teacher.username}</p>
              {tutorCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 inline-flex items-center gap-0.5"
                  title={`Tutor de ${tutorCount} sección${tutorCount === 1 ? "" : "es"}`}
                  data-testid={`teacher-tutor-badge-${teacher.id}`}
                >
                  Tutor · {tutorCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {teacher.email || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {teacher.phone || "-"}
      </td>
      <td className="px-4 py-3">
        {uniqueSubjects.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              {uniqueSubjects.length} curso{uniqueSubjects.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onManageAssignments(teacher)}
              className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Ver
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Sin asignar</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          teacher.status === 'activo' || !teacher.status
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {teacher.status === 'activo' || !teacher.status ? 'Activo' : teacher.status}
        </span>
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
                    onViewDetails(teacher);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver detalles
                </button>
                <button
                  onClick={() => {
                    onManageAssignments(teacher);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Asignar cursos
                </button>
                <button
                  onClick={() => {
                    onEdit(teacher);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    onDelete(teacher);
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

// Add/Edit Teacher Modal
function TeacherModal({ isOpen, onClose, token, teacher, onSave }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const isEditing = !!teacher?.id;
  
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
    role: "teacher",
    status: "activo",
    especialidad: "",
    titulo_profesional: "",
    fecha_ingreso: ""
  });

  const headers = { Authorization: `Bearer ${token}` };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (teacher) {
        setForm({
          photo_url: teacher.photo_url || "",
          name: teacher.name || "",
          last_name: teacher.last_name || "",
          username: teacher.username || "",
          password: "",
          email: teacher.email || "",
          phone: teacher.phone?.replace('+51', '') || "",
          birthday: teacher.birthday || "",
          gender: teacher.gender || "",
          address: teacher.address || "",
          role: "teacher",
          status: teacher.status || "activo",
          especialidad: teacher.especialidad || "",
          titulo_profesional: teacher.titulo_profesional || "",
          fecha_ingreso: teacher.fecha_ingreso || ""
        });
      } else {
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
          role: "teacher",
          status: "activo",
          especialidad: "",
          titulo_profesional: "",
          fecha_ingreso: ""
        });
      }
      setConfirmPassword("");
      setError("");
      setUsernameError("");
    }
  }, [isOpen, teacher]);

  // Password strength
  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: "", color: "bg-slate-200" };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return { level: 1, label: "Muy débil", color: "bg-red-500", textColor: "text-red-600" };
    if (score <= 3) return { level: 2, label: "Débil", color: "bg-orange-500", textColor: "text-orange-600" };
    if (score <= 5) return { level: 3, label: "Media", color: "bg-yellow-500", textColor: "text-yellow-600" };
    if (score <= 6) return { level: 4, label: "Fuerte", color: "bg-emerald-500", textColor: "text-emerald-600" };
    return { level: 5, label: "Muy fuerte", color: "bg-emerald-600", textColor: "text-emerald-700" };
  };

  const passwordStrength = getPasswordStrength(form.password);

  // Generate password
  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setForm(prev => ({ ...prev, password }));
    setConfirmPassword(password);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  // Check username
  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setUsernameError("");
      return;
    }
    if (isEditing && username === teacher.username) {
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

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.username) {
      setError("Nombre y usuario son obligatorios");
      return;
    }
    
    if (!isEditing) {
      if (!form.password) {
        setError("La contraseña es obligatoria");
        return;
      }
      if (passwordStrength.level <= 1) {
        setError("La contraseña es muy débil");
        return;
      }
      if (form.password !== confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
    }
    
    if (usernameError) {
      setError("El nombre de usuario no está disponible");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const submitData = {
        ...form,
        phone: form.phone ? `+51${form.phone}` : ""
      };
      
      // Remove password if editing and not changed
      if (isEditing && !form.password) {
        delete submitData.password;
      }
      
      let res;
      if (isEditing) {
        res = await axios.put(`${API}/users/${teacher.id}`, submitData, { headers });
      } else {
        res = await axios.post(`${API}/users`, submitData, { headers });
      }
      
      onSave(res.data.user || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar profesor");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'username') {
      clearTimeout(window.usernameTimeout);
      window.usernameTimeout = setTimeout(() => checkUsername(value), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" data-testid="teacher-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-white" />
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {isEditing ? "Editar Profesor" : "Nuevo Profesor"}
                </h2>
                <p className="text-white/70 text-sm">
                  {isEditing ? "Modifica los datos del docente" : "Registra un nuevo docente"}
                </p>
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
          <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Photo Upload */}
              <div className="md:col-span-2 flex flex-col items-center mb-4">
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-24 h-24 rounded-full border-3 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden transition-all group-hover:border-emerald-400">
                    {form.photo_url ? (
                      <img src={form.photo_url} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Carlos"
                  required
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Apellido</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="García"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Usuario <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 ${
                      usernameError 
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                        : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                    }`}
                    placeholder="carlos.garcia"
                    required
                  />
                  {checkingUsername && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                  )}
                  {!checkingUsername && form.username && !usernameError && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  )}
                </div>
                {usernameError && (
                  <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="licencia">En Licencia</option>
                </select>
              </div>

              {/* Password - Only for new teachers */}
              {!isEditing && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-700">Contraseña <span className="text-red-500">*</span></span>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold rounded-lg hover:shadow-md"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="Contraseña"
                        required={!isEditing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-4 py-2.5 pr-10 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 ${
                          form.password && confirmPassword && form.password !== confirmPassword
                            ? 'border-red-300' : 'border-slate-200'
                        } focus:ring-emerald-500/20 focus:border-emerald-500`}
                        placeholder="Confirmar"
                        required={!isEditing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {form.password && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full ${
                              level <= passwordStrength.level ? passwordStrength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.textColor}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Professional Info Section */}
              <div className="md:col-span-2 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-500" />
                  Información Profesional
                </h3>
              </div>

              {/* Especialidad */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Especialidad</label>
                <input
                  type="text"
                  value={form.especialidad}
                  onChange={(e) => handleChange('especialidad', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Matemáticas, Ciencias, etc."
                />
              </div>

              {/* Título profesional */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Título Profesional</label>
                <input
                  type="text"
                  value={form.titulo_profesional}
                  onChange={(e) => handleChange('titulo_profesional', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Lic. en Educación"
                />
              </div>

              {/* Fecha de ingreso */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha de Ingreso</label>
                <input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) => handleChange('fecha_ingreso', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Contact Info Section */}
              <div className="md:col-span-2 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  Información de Contacto
                </h3>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Celular</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-600 text-sm">
                    +51
                  </span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="999 999 999"
                  />
                </div>
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha Nacimiento</label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => handleChange('birthday', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Género</label>
                <select
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                </select>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dirección</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Av. Principal 123"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="mt-6 flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !!usernameError}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isEditing ? "Guardar Cambios" : "Crear Profesor"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminTeachersPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  // Check for action param on mount
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowModal(true);
    }
  }, [searchParams]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, assignmentsRes, subjectsRes, settingsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/academic/assignments`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/subjects`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        const allUsers = usersRes.data || [];
        setTeachers(allUsers.filter(u => u.role === 'teacher'));
        setAssignments(assignmentsRes.data || []);
        setSubjects(subjectsRes.data || []);
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

  // Filtered teachers
  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = !search || 
      `${t.name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      t.username?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.especialidad?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setShowModal(true);
  };

  const handleDelete = (teacher) => {
    setTeacherToDelete(teacher);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!teacherToDelete) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/users/${teacherToDelete.id}`, { headers });
      setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
      setShowDeleteModal(false);
      setTeacherToDelete(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar profesor");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSave = (savedTeacher) => {
    if (editingTeacher) {
      setTeachers(prev => prev.map(t => t.id === savedTeacher.id ? savedTeacher : t));
    } else {
      setTeachers(prev => [...prev, savedTeacher]);
    }
    setEditingTeacher(null);
  };

  const handleManageAssignments = (teacher) => {
    // Navigate to teacher assignments page with teacher filter
    navigateTo(`/asignacion-docente?teacher=${teacher.id}`);
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-teachers-page">
      {/* Sidebar */}
      <AdminSidebar
        active="profesores"
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
                <h1 className="text-2xl font-bold text-slate-800">Profesores</h1>
                <p className="text-sm text-slate-500">{teachers.length} docentes registrados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/asignacion-docente')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Asignación Docente
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                data-testid="add-teacher-btn"
              >
                <UserPlus className="w-5 h-5" />
                Nuevo Profesor
              </button>
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
              <div className="lg:col-span-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Buscar por nombre, usuario, correo o especialidad..."
                />
              </div>
              
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="licencia">En Licencia</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-20">
                <UserCog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">
                  {search || filterStatus 
                    ? "No se encontraron profesores con los filtros aplicados"
                    : "No hay profesores registrados"
                  }
                </p>
                {!search && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-4 text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    + Agregar primer profesor
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Profesor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Correo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cursos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map(teacher => (
                      <TeacherRow
                        key={teacher.id}
                        teacher={teacher}
                        assignments={assignments}
                        subjects={subjects}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onViewDetails={(t) => console.log('View details:', t)}
                        onManageAssignments={handleManageAssignments}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Teacher Modal */}
      <TeacherModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTeacher(null);
        }}
        token={token}
        teacher={editingTeacher}
        onSave={handleSave}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTeacherToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Profesor"
        message={`¿Estás seguro de eliminar a ${teacherToDelete?.name} ${teacherToDelete?.last_name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
