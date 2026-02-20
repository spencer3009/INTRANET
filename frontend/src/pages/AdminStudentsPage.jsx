import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import StudentQRCard from "@/components/StudentQRCard";
import { 
  GraduationCap, UserPlus, ArrowLeft, Loader2, X, Camera,
  Check, AlertCircle, Plus, Eye, EyeOff, Search, UserCheck,
  MoreVertical, Pencil, Trash2, BookOpen, Sparkles,
  Heart, Phone, FileText, Stethoscope, ShieldCheck, Users,
  Filter, Download, Mail, ChevronDown, QrCode
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Student Status Badge
function StatusBadge({ status }) {
  const config = {
    activo: { label: "Activo", color: "bg-emerald-100 text-emerald-700" },
    inactivo: { label: "Inactivo", color: "bg-slate-100 text-slate-600" },
    suspendido: { label: "Suspendido", color: "bg-red-100 text-red-700" },
    egresado: { label: "Egresado", color: "bg-blue-100 text-blue-700" },
    retirado: { label: "Retirado", color: "bg-amber-100 text-amber-700" },
  };
  
  const cfg = config[status] || config.activo;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// Student Row Component
function StudentRow({ student, levels, grades, sections, onEdit, onDelete, onViewDetails, onShowQR }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Get academic info names
  const levelName = levels.find(l => l.id === student.nivel_id)?.nombre || "-";
  const gradeName = grades.find(g => g.id === student.grado_id)?.nombre || "-";
  const sectionName = sections.find(s => s.id === student.seccion_id)?.nombre || "-";
  
  return (
    <tr className="hover:bg-slate-50 transition-colors" data-testid={`student-row-${student.id}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
            {student.photo_url ? (
              <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-800">{student.name} {student.last_name}</p>
            <p className="text-xs text-slate-500">@{student.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">
          <p className="text-slate-800">{levelName}</p>
          <p className="text-xs text-slate-500">{gradeName} - {sectionName}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={student.status || 'activo'} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {student.email || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {student.phone || "-"}
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
                    onViewDetails(student);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver detalles
                </button>
                <button
                  onClick={() => {
                    onShowQR(student);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-violet-50 text-violet-600 flex items-center gap-2"
                  data-testid={`show-qr-btn-${student.id}`}
                >
                  <QrCode className="w-4 h-4" />
                  Ver QR
                </button>
                <button
                  onClick={() => {
                    onEdit(student);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    onDelete(student);
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

// Add/Edit Student Modal
function StudentModal({ isOpen, onClose, token, student, onSave, levels, grades, sections, shifts, parents }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const isEditing = !!student?.id;
  
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
    role: "student",
    nivel_id: "",
    grado_id: "",
    seccion_id: "",
    turno_id: "",
    padre_id: "",
    status: "activo",
    condiciones_medicas: "",
    alergias: "",
    doctor_nombre: "",
    doctor_telefono: "",
    persona_autorizada: "",
    persona_autorizada_telefono: "",
    notas: ""
  });

  const [parentSearch, setParentSearch] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [showParentSection, setShowParentSection] = useState(false);
  const [showComplementaryInfo, setShowComplementaryInfo] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Reset form when modal opens or student changes
  useEffect(() => {
    if (isOpen) {
      if (student) {
        setForm({
          photo_url: student.photo_url || "",
          name: student.name || "",
          last_name: student.last_name || "",
          username: student.username || "",
          password: "",
          email: student.email || "",
          phone: student.phone?.replace('+51', '') || "",
          birthday: student.birthday || "",
          gender: student.gender || "",
          address: student.address || "",
          role: "student",
          nivel_id: student.nivel_id || "",
          grado_id: student.grado_id || "",
          seccion_id: student.seccion_id || "",
          turno_id: student.turno_id || "",
          padre_id: student.padre_id || "",
          status: student.status || "activo",
          condiciones_medicas: student.condiciones_medicas || "",
          alergias: student.alergias || "",
          doctor_nombre: student.doctor_nombre || "",
          doctor_telefono: student.doctor_telefono?.replace('+51', '') || "",
          persona_autorizada: student.persona_autorizada || "",
          persona_autorizada_telefono: student.persona_autorizada_telefono?.replace('+51', '') || "",
          notas: student.notas || ""
        });
        
        // Set selected parent if exists
        if (student.padre_id) {
          const parent = parents.find(p => p.id === student.padre_id);
          if (parent) {
            setSelectedParent(parent);
            setShowParentSection(true);
          }
        }
        
        // Show complementary info if any exists
        if (student.condiciones_medicas || student.alergias || student.doctor_nombre) {
          setShowComplementaryInfo(true);
        }
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
          role: "student",
          nivel_id: "",
          grado_id: "",
          seccion_id: "",
          turno_id: "",
          padre_id: "",
          status: "activo",
          condiciones_medicas: "",
          alergias: "",
          doctor_nombre: "",
          doctor_telefono: "",
          persona_autorizada: "",
          persona_autorizada_telefono: "",
          notas: ""
        });
        setSelectedParent(null);
        setShowParentSection(false);
        setShowComplementaryInfo(false);
      }
      setConfirmPassword("");
      setError("");
      setUsernameError("");
      setParentSearch("");
      setShowParentDropdown(false);
    }
  }, [isOpen, student, parents]);

  // Filtered data based on selections
  const filteredGrades = form.nivel_id 
    ? grades.filter(g => g.nivel_id === form.nivel_id) 
    : [];
    
  const filteredSections = form.grado_id 
    ? sections.filter(s => s.grado_id === form.grado_id) 
    : [];

  const filteredParents = parentSearch.trim() 
    ? parents.filter(p => {
        const searchLower = parentSearch.toLowerCase();
        const fullName = `${p.name || ''} ${p.last_name || ''}`.toLowerCase();
        const dni = (p.dni || '').toLowerCase();
        return fullName.includes(searchLower) || dni.includes(searchLower);
      })
    : parents;

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
  const passwordsMatch = form.password && confirmPassword && form.password === confirmPassword;

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
    if (isEditing && username === student.username) {
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
    
    if (!form.nivel_id || !form.grado_id || !form.seccion_id || !form.turno_id) {
      setError("Debes seleccionar nivel, grado, sección y turno");
      return;
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
        phone: form.phone ? `+51${form.phone}` : "",
        doctor_telefono: form.doctor_telefono ? `+51${form.doctor_telefono}` : "",
        persona_autorizada_telefono: form.persona_autorizada_telefono ? `+51${form.persona_autorizada_telefono}` : ""
      };
      
      // Remove password if editing and not changed
      if (isEditing && !form.password) {
        delete submitData.password;
      }
      
      let res;
      if (isEditing) {
        res = await axios.put(`${API}/users/${student.id}`, submitData, { headers });
      } else {
        res = await axios.post(`${API}/users`, submitData, { headers });
      }
      
      onSave(res.data.user || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar estudiante");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'nivel_id') {
        updated.grado_id = "";
        updated.seccion_id = "";
      } else if (field === 'grado_id') {
        updated.seccion_id = "";
      }
      return updated;
    });
    
    if (field === 'username') {
      clearTimeout(window.usernameTimeout);
      window.usernameTimeout = setTimeout(() => checkUsername(value), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" data-testid="student-modal">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {isEditing ? "Editar Estudiante" : "Nuevo Estudiante"}
                </h2>
                <p className="text-white/70 text-sm">
                  {isEditing ? "Modifica los datos del alumno" : "Registra un nuevo alumno"}
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
                  <div className="w-24 h-24 rounded-full border-3 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden transition-all group-hover:border-amber-400">
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Juan"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Pérez"
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
                        : 'border-slate-200 focus:ring-amber-500/20 focus:border-amber-500'
                    }`}
                    placeholder="juanperez"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="egresado">Egresado</option>
                  <option value="retirado">Retirado</option>
                </select>
              </div>

              {/* Password - Only for new students */}
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
                        className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                        } focus:ring-amber-500/20 focus:border-amber-500`}
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

              {/* Academic Section Header */}
              <div className="md:col-span-2 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  Información Académica
                </h3>
              </div>

              {/* Nivel */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nivel <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.nivel_id}
                  onChange={(e) => handleChange('nivel_id', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {levels.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Grado */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Grado <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.grado_id}
                  onChange={(e) => handleChange('grado_id', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-slate-100"
                  required
                  disabled={!form.nivel_id}
                >
                  <option value="">{form.nivel_id ? "Seleccionar..." : "Primero selecciona nivel"}</option>
                  {filteredGrades.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Sección */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Sección <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.seccion_id}
                  onChange={(e) => handleChange('seccion_id', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-slate-100"
                  required
                  disabled={!form.grado_id}
                >
                  <option value="">{form.grado_id ? "Seleccionar..." : "Primero selecciona grado"}</option>
                  {filteredSections.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Turno */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Turno <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.turno_id}
                  onChange={(e) => handleChange('turno_id', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Contact Info */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>

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
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="999 999 999"
                  />
                </div>
              </div>

              {/* Birthday & Gender */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha Nacimiento</label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => handleChange('birthday', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Género</label>
                <select
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Av. Principal 123"
                />
              </div>

              {/* Parent Section Toggle */}
              <div className="md:col-span-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowParentSection(!showParentSection)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-800">Vincular Padre/Apoderado</p>
                      <p className="text-xs text-slate-500">Opcional</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showParentSection ? 'rotate-180' : ''}`} />
                </button>

                {showParentSection && (
                  <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl">
                    {selectedParent ? (
                      <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{selectedParent.name} {selectedParent.last_name}</p>
                            <p className="text-xs text-slate-500">DNI: {selectedParent.dni || 'N/A'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedParent(null);
                            setForm(prev => ({ ...prev, padre_id: "" }));
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={parentSearch}
                          onChange={(e) => {
                            setParentSearch(e.target.value);
                            setShowParentDropdown(true);
                          }}
                          onFocus={() => setShowParentDropdown(true)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          placeholder="Buscar padre por nombre o DNI..."
                        />
                        {showParentDropdown && filteredParents.length > 0 && (
                          <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {filteredParents.slice(0, 8).map(parent => (
                              <button
                                key={parent.id}
                                type="button"
                                onClick={() => {
                                  setSelectedParent(parent);
                                  setForm(prev => ({ ...prev, padre_id: parent.id }));
                                  setShowParentDropdown(false);
                                  setParentSearch("");
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3"
                              >
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-sm">{parent.name} {parent.last_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Complementary Info Toggle */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowComplementaryInfo(!showComplementaryInfo)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-800">Información Complementaria</p>
                      <p className="text-xs text-slate-500">Datos médicos y contactos de emergencia</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showComplementaryInfo ? 'rotate-180' : ''}`} />
                </button>

                {showComplementaryInfo && (
                  <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Condiciones médicas</label>
                      <textarea
                        value={form.condiciones_medicas}
                        onChange={(e) => handleChange('condiciones_medicas', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
                        rows={2}
                        placeholder="Asma, diabetes, etc."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Alergias</label>
                      <textarea
                        value={form.alergias}
                        onChange={(e) => handleChange('alergias', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
                        rows={2}
                        placeholder="Penicilina, maní, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Doctor personal</label>
                      <input
                        type="text"
                        value={form.doctor_nombre}
                        onChange={(e) => handleChange('doctor_nombre', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        placeholder="Nombre del médico"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tel. Doctor</label>
                      <input
                        type="tel"
                        value={form.doctor_telefono}
                        onChange={(e) => handleChange('doctor_telefono', e.target.value.replace(/\D/g, '').slice(0, 9))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        placeholder="999 999 999"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Persona autorizada</label>
                      <input
                        type="text"
                        value={form.persona_autorizada}
                        onChange={(e) => handleChange('persona_autorizada', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tel. Autorizado</label>
                      <input
                        type="tel"
                        value={form.persona_autorizada_telefono}
                        onChange={(e) => handleChange('persona_autorizada_telefono', e.target.value.replace(/\D/g, '').slice(0, 9))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        placeholder="999 999 999"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notas adicionales</label>
                      <textarea
                        value={form.notas}
                        onChange={(e) => handleChange('notas', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
                        rows={2}
                        placeholder="Información adicional..."
                      />
                    </div>
                  </div>
                )}
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
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isEditing ? "Guardar Cambios" : "Crear Estudiante"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminStudentsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  // Academic data
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [parents, setParents] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrStudent, setQRStudent] = useState(null);
  
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
        const [usersRes, levelsRes, gradesRes, sectionsRes, shiftsRes, settingsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/academic/levels`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/academic/shifts`, { headers }),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        
        const allUsers = usersRes.data || [];
        setStudents(allUsers.filter(u => u.role === 'student'));
        setParents(allUsers.filter(u => u.role === 'parent'));
        setLevels(levelsRes.data.filter(l => l.activo));
        setGrades(gradesRes.data.filter(g => g.activo));
        setSections(sectionsRes.data.filter(s => s.activo));
        setShifts(shiftsRes.data.filter(s => s.activo));
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

  // Filtered students
  const filteredStudents = students.filter(s => {
    const matchesSearch = !search || 
      `${s.name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = !filterLevel || s.nivel_id === filterLevel;
    const matchesGrade = !filterGrade || s.grado_id === filterGrade;
    const matchesStatus = !filterStatus || s.status === filterStatus;
    return matchesSearch && matchesLevel && matchesGrade && matchesStatus;
  });

  // Filtered grades based on level filter
  const filteredGradesForFilter = filterLevel 
    ? grades.filter(g => g.nivel_id === filterLevel)
    : grades;

  // Handlers
  const handleEdit = (student) => {
    setEditingStudent(student);
    setShowModal(true);
  };

  const handleDelete = (student) => {
    setStudentToDelete(student);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/users/${studentToDelete.id}`, { headers });
      setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      setShowDeleteModal(false);
      setStudentToDelete(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar estudiante");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSave = (savedStudent) => {
    if (editingStudent) {
      setStudents(prev => prev.map(s => s.id === savedStudent.id ? savedStudent : s));
    } else {
      setStudents(prev => [...prev, savedStudent]);
    }
    setEditingStudent(null);
  };

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/school/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-students-page">
      {/* Sidebar */}
      <AdminSidebar
        active="alumnos"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
                <h1 className="text-2xl font-bold text-slate-800">Estudiantes</h1>
                <p className="text-sm text-slate-500">{students.length} alumnos registrados</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingStudent(null);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              data-testid="add-student-btn"
            >
              <UserPlus className="w-5 h-5" />
              Nuevo Estudiante
            </button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Buscar por nombre, usuario o correo..."
                />
              </div>
              
              {/* Level filter */}
              <select
                value={filterLevel}
                onChange={(e) => {
                  setFilterLevel(e.target.value);
                  setFilterGrade("");
                }}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Todos los niveles</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
              
              {/* Grade filter */}
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-100"
                disabled={!filterLevel}
              >
                <option value="">Todos los grados</option>
                {filteredGradesForFilter.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
                <option value="egresado">Egresado</option>
                <option value="retirado">Retirado</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-20">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">
                  {search || filterLevel || filterGrade || filterStatus 
                    ? "No se encontraron estudiantes con los filtros aplicados"
                    : "No hay estudiantes registrados"
                  }
                </p>
                {!search && !filterLevel && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-4 text-amber-600 font-medium hover:text-amber-700"
                  >
                    + Agregar primer estudiante
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estudiante</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nivel / Grado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Correo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map(student => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        levels={levels}
                        grades={grades}
                        sections={sections}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onViewDetails={(s) => console.log('View details:', s)}
                        onShowQR={(s) => {
                          // Add grade and section names for QR card
                          const gradeName = grades.find(g => g.id === s.grado_id)?.nombre || "";
                          const sectionName = sections.find(sec => sec.id === s.seccion_id)?.nombre || "";
                          setQRStudent({ ...s, grade_name: gradeName, section_name: sectionName });
                          setShowQRModal(true);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Student Modal */}
      <StudentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingStudent(null);
        }}
        token={token}
        student={editingStudent}
        onSave={handleSave}
        levels={levels}
        grades={grades}
        sections={sections}
        shifts={shifts}
        parents={parents}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setStudentToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Estudiante"
        message={`¿Estás seguro de eliminar a ${studentToDelete?.name} ${studentToDelete?.last_name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
