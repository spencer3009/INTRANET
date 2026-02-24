import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import { 
  Users, UserPlus, ArrowLeft, Loader2, X, Camera, Upload,
  GraduationCap, Building2, Check, AlertCircle, Plus, Eye, EyeOff,
  MoreVertical, Pencil, Trash2, BookOpen, Sparkles, Search, UserCheck,
  Heart, Phone, FileText, Stethoscope, ShieldCheck, Key, RefreshCw, 
  ToggleLeft, ToggleRight, UserCog, Link2, AlertTriangle, QrCode,
  ChevronDown, ChevronRight, LayoutGrid, List, Filter, Mail
} from "lucide-react";
import StudentQRCard from "@/components/StudentQRCard";
import { QRCodeSVG } from "qrcode.react";
import { processProfilePhoto, validateImageFile } from "@/utils/imageUtils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// LocalStorage keys for student filter persistence
const STUDENT_FILTER_KEYS = {
  LEVEL: 'edunet_students_filter_level',
  GRADE: 'edunet_students_filter_grade',
  SECTION: 'edunet_students_filter_section',
  VIEW_MODE: 'edunet_students_view_mode',
  EXPANDED_LEVELS: 'edunet_students_expanded_levels'
};

// Level color configuration for grouped view
const LEVEL_COLORS = {
  'INICIAL': { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-600' },
  'PRIMARIA': { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', gradient: 'from-blue-500 to-indigo-600' },
  'SECUNDARIA': { bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', gradient: 'from-violet-500 to-purple-600' },
  'default': { bg: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', gradient: 'from-slate-500 to-gray-600' }
};

const getLevelColor = (levelName) => {
  const upperName = levelName?.toUpperCase() || '';
  return LEVEL_COLORS[upperName] || LEVEL_COLORS.default;
};

// Role configurations with colors and icons
const ROLE_CARDS = [
  { 
    id: "owner", 
    label: "Propietarios", 
    labelSingular: "Propietario",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    iconBg: "bg-blue-100",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    gradientBg: "from-blue-500 to-indigo-600",
    lightGradient: "from-blue-50 to-indigo-50",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
  },
  { 
    id: "system_admin", 
    label: "Admin Sistema", 
    labelSingular: "Admin Sistema",
    color: "from-cyan-500 to-teal-600",
    bgColor: "bg-cyan-50",
    iconBg: "bg-cyan-100",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    gradientBg: "from-cyan-500 to-teal-600",
    lightGradient: "from-cyan-50 to-teal-50",
    image: "https://cdn-icons-png.flaticon.com/512/3953/3953226.png",
    isSystemRole: true,  // Flag to identify system roles
    hideAddButton: true  // Don't show "Agregar" button - only 1 per school
  },
  { 
    id: "admin", 
    label: "Administradores", 
    labelSingular: "Administrador",
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    iconBg: "bg-purple-100",
    textColor: "text-purple-600",
    borderColor: "border-purple-200",
    gradientBg: "from-purple-500 to-pink-600",
    lightGradient: "from-purple-50 to-pink-50",
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
    borderColor: "border-emerald-200",
    gradientBg: "from-emerald-500 to-teal-600",
    lightGradient: "from-emerald-50 to-teal-50",
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
    borderColor: "border-amber-200",
    gradientBg: "from-amber-500 to-orange-600",
    lightGradient: "from-amber-50 to-orange-50",
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
    borderColor: "border-rose-200",
    gradientBg: "from-rose-500 to-red-600",
    lightGradient: "from-rose-50 to-red-50",
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
    borderColor: "border-slate-200",
    gradientBg: "from-slate-400 to-gray-500",
    lightGradient: "from-slate-50 to-gray-50",
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135823.png",
    isPending: true
  },
];

// Add User Modal Component
function AddUserModal({ isOpen, onClose, token, roleId, onUserCreated, currentUser }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDemoBlockedModal, setShowDemoBlockedModal] = useState(false);
  
  // Check if current user is the real owner (can create demo users)
  const isRealOwner = currentUser?.is_owner === true || currentUser?.role === 'owner';
  const isDemoUser = currentUser?.is_demo_user === true;
  
  // Academic data for students
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  
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
    role: roleId || "",
    is_demo_user: false, // Demo user flag - only owner can create
    // Student-specific fields
    nivel_id: "",
    grado_id: "",
    seccion_id: "",
    turno_id: "",
    padre_id: "", // Parent linked to student
    // Student complementary info
    condiciones_medicas: "",
    alergias: "",
    doctor_nombre: "",
    doctor_telefono: "",
    persona_autorizada: "",
    persona_autorizada_telefono: "",
    notas: "",
    // Parent-specific fields
    dni: "",
    ocupacion: "",
    lugar_trabajo: "",
    telefono_trabajo: ""
  });

  // Parent search state for students
  const [parents, setParents] = useState([]);
  const [parentSearch, setParentSearch] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loadingParents, setLoadingParents] = useState(false);
  
  // Toggle states for optional sections
  const [showParentSection, setShowParentSection] = useState(false);
  const [showComplementaryInfo, setShowComplementaryInfo] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Password strength calculator
  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: "", color: "bg-slate-200" };
    
    let score = 0;
    
    // Length checks
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character type checks
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
  const passwordsMismatch = form.password && confirmPassword && form.password !== confirmPassword;

  // Generate strong password
  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    
    let password = '';
    // Ensure at least one of each type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill remaining with random characters
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    // Set both password fields and show them
    setForm(prev => ({ ...prev, password }));
    setConfirmPassword(password);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  // Load academic data when modal opens for students
  useEffect(() => {
    if (isOpen && (roleId === 'student' || form.role === 'student')) {
      loadAcademicData();
      loadParents();
    }
  }, [isOpen, roleId]);

  const loadAcademicData = async () => {
    setLoadingAcademic(true);
    try {
      const [levelsRes, gradesRes, sectionsRes, shiftsRes] = await Promise.all([
        axios.get(`${API}/academic/levels`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/academic/shifts`, { headers })
      ]);
      setLevels(levelsRes.data.filter(l => l.activo));
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
      setShifts(shiftsRes.data.filter(s => s.activo));
    } catch (err) {
      console.error("Error loading academic data:", err);
    } finally {
      setLoadingAcademic(false);
    }
  };

  const loadParents = async () => {
    setLoadingParents(true);
    try {
      const res = await axios.get(`${API}/users`, { headers });
      // Filter only parents
      const parentUsers = res.data.filter(u => u.role === 'parent');
      setParents(parentUsers);
    } catch (err) {
      console.error("Error loading parents:", err);
    } finally {
      setLoadingParents(false);
    }
  };

  // Filtered parents based on search
  const filteredParents = parentSearch.trim() 
    ? parents.filter(p => {
        const searchLower = parentSearch.toLowerCase();
        const fullName = `${p.name || ''} ${p.last_name || ''}`.toLowerCase();
        const dni = (p.dni || '').toLowerCase();
        return fullName.includes(searchLower) || dni.includes(searchLower);
      })
    : parents;

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
        role: roleId || "",
        is_demo_user: false,
        nivel_id: "",
        grado_id: "",
        seccion_id: "",
        turno_id: "",
        padre_id: "",
        condiciones_medicas: "",
        alergias: "",
        doctor_nombre: "",
        doctor_telefono: "",
        persona_autorizada: "",
        persona_autorizada_telefono: "",
        notas: "",
        dni: "",
        ocupacion: "",
        lugar_trabajo: "",
        telefono_trabajo: ""
      });
      setConfirmPassword("");
      setError("");
      setUsernameError("");
      setParentSearch("");
      setSelectedParent(null);
      setShowParentDropdown(false);
      setShowParentSection(false);
      setShowComplementaryInfo(false);
    }
  }, [isOpen, roleId]);

  // Filtered grades based on selected level
  const filteredGrades = form.nivel_id 
    ? grades.filter(g => g.nivel_id === form.nivel_id) 
    : [];

  // Filtered sections based on selected grade
  const filteredSections = form.grado_id 
    ? sections.filter(s => s.grado_id === form.grado_id) 
    : [];

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
    
    // Validate file
    const validation = validateImageFile(file, { maxSizeMB: 5 });
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setUploading(true);
    setError("");
    
    try {
      // Process image: compress to 200px width and convert to WebP
      const processedFile = await processProfilePhoto(file, { maxWidth: 200, quality: 0.8 });
      
      const sigRes = await axios.get(
        `${API}/cloudinary/signature?resource_type=image&folder=edunet/users`,
        { headers }
      );
      const sig = sigRes.data;
      
      const formData = new FormData();
      formData.append("file", processedFile);
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

    // Validate password strength
    if (passwordStrength.level <= 1) {
      setError("La contraseña es muy débil. Usa al menos 6 caracteres con mayúsculas, minúsculas y números.");
      return;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      setError("Debes confirmar la contraseña");
      return;
    }

    if (form.password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (!form.role) {
      setError("Debes seleccionar un tipo de cuenta");
      return;
    }

    // Validate academic fields for students
    if (form.role === 'student' || roleId === 'student') {
      if (!form.nivel_id || !form.grado_id || !form.seccion_id || !form.turno_id) {
        setError("Para estudiantes, debes seleccionar nivel, grado, sección y turno");
        return;
      }
    }

    // Validate parent fields
    if (form.role === 'parent' || roleId === 'parent') {
      if (!form.dni || form.dni.length !== 8) {
        setError("El DNI es obligatorio y debe tener 8 dígitos");
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
      // Prepare data with phone prefix
      const submitData = {
        ...form,
        phone: form.phone ? `+51${form.phone}` : "",
        telefono_trabajo: form.telefono_trabajo ? `+51${form.telefono_trabajo}` : ""
      };
      
      // Remove empty academic fields for non-students
      if (form.role !== 'student' && roleId !== 'student') {
        delete submitData.nivel_id;
        delete submitData.grado_id;
        delete submitData.seccion_id;
        delete submitData.turno_id;
      }

      // Remove parent fields for non-parents
      if (form.role !== 'parent' && roleId !== 'parent') {
        delete submitData.dni;
        delete submitData.ocupacion;
        delete submitData.lugar_trabajo;
        delete submitData.telefono_trabajo;
      }
      
      const res = await axios.post(`${API}/users`, submitData, { headers });
      onUserCreated(res.data.user);
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "";
      // Check if this is a demo user blocked message
      if (errorMessage.includes("Modo visitante") || errorMessage.includes("demo") || err.response?.status === 403 && isDemoUser) {
        setShowDemoBlockedModal(true);
      } else {
        setError(errorMessage || "Error al crear usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Cascade reset for academic fields
      if (field === 'nivel_id') {
        updated.grado_id = "";
        updated.seccion_id = "";
      } else if (field === 'grado_id') {
        updated.seccion_id = "";
      } else if (field === 'role' && value === 'student' && levels.length === 0) {
        // Load academic data when student role is selected
        loadAcademicData();
      }
      
      return updated;
    });
    
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

            {/* Demo User Switch - Only visible for real owner - POSITIONED AT TOP */}
            {isRealOwner && (
              <div className="md:col-span-2">
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-700">Crear como Usuario Demo</span>
                      <p className="text-xs text-slate-500 mt-0.5">El usuario podrá explorar pero no modificar datos</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, is_demo_user: !prev.is_demo_user }))}
                    className={`relative w-12 h-7 rounded-full transition-colors ${form.is_demo_user ? 'bg-blue-500' : 'bg-slate-300'}`}
                    data-testid="demo-user-toggle"
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_demo_user ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {form.is_demo_user && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Este usuario tendrá acceso visual completo pero no podrá crear, editar ni eliminar datos.
                  </p>
                )}
              </div>
            )}

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
            <div className="md:col-span-2">
              {/* Generate password button */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Contraseña <span className="text-red-500">*</span></span>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold rounded-lg hover:shadow-md hover:shadow-purple-500/25 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generar contraseña
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Password field */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Nueva contraseña</label>
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
                  
                  {/* Password strength indicator */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              level <= passwordStrength.level ? passwordStrength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${passwordStrength.textColor}`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password field */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                        passwordsMismatch
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : passwordsMatch
                          ? 'border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Match indicator */}
                  {confirmPassword && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {passwordsMatch ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-600">Las contraseñas coinciden</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-medium text-red-600">Las contraseñas no coinciden</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
              {roleId ? (
                // Fixed role - not editable
                <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium">
                  {roleId === 'owner' ? 'Propietario' : 
                   roleId === 'admin' ? 'Administrador' : 
                   roleId === 'teacher' ? 'Profesor' : 
                   roleId === 'student' ? 'Estudiante' : 
                   roleId === 'parent' ? 'Padre/Apoderado' : roleId}
                </div>
              ) : (
                // Selectable role
                <select
                  value={form.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Seleccionar</option>
                  <option value="owner">Propietario</option>
                  <option value="admin">Administrador</option>
                  <option value="teacher">Profesor</option>
                  <option value="student">Estudiante</option>
                  <option value="parent">Padre/Apoderado</option>
                </select>
              )}
            </div>

            {/* Academic fields for students */}
            {(roleId === 'student' || form.role === 'student') && (
              <>
                {/* Section header */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    Información Académica
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Selecciona el nivel, grado, sección y turno del estudiante</p>
                </div>

                {/* Nivel */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nivel <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.nivel_id}
                    onChange={(e) => handleChange('nivel_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    required={roleId === 'student' || form.role === 'student'}
                    disabled={loadingAcademic}
                  >
                    <option value="">Seleccionar nivel...</option>
                    {levels.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                  {levels.length === 0 && !loadingAcademic && (
                    <p className="text-xs text-amber-600 mt-1">No hay niveles configurados. Configura en Ajustes Académicos.</p>
                  )}
                </div>

                {/* Grado */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Grado <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.grado_id}
                    onChange={(e) => handleChange('grado_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                    required={roleId === 'student' || form.role === 'student'}
                    disabled={!form.nivel_id || loadingAcademic}
                  >
                    <option value="">{form.nivel_id ? "Seleccionar grado..." : "Primero selecciona un nivel"}</option>
                    {filteredGrades.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                  {form.nivel_id && filteredGrades.length === 0 && !loadingAcademic && (
                    <p className="text-xs text-amber-600 mt-1">No hay grados para este nivel.</p>
                  )}
                </div>

                {/* Sección */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Sección <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.seccion_id}
                    onChange={(e) => handleChange('seccion_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                    required={roleId === 'student' || form.role === 'student'}
                    disabled={!form.grado_id || loadingAcademic}
                  >
                    <option value="">{form.grado_id ? "Seleccionar sección..." : "Primero selecciona un grado"}</option>
                    {filteredSections.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                  {form.grado_id && filteredSections.length === 0 && !loadingAcademic && (
                    <p className="text-xs text-amber-600 mt-1">No hay secciones para este grado.</p>
                  )}
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Turno <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.turno_id}
                    onChange={(e) => handleChange('turno_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    required={roleId === 'student' || form.role === 'student'}
                    disabled={loadingAcademic}
                  >
                    <option value="">Seleccionar turno...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre} ({s.hora_inicio} - {s.hora_fin})</option>
                    ))}
                  </select>
                  {shifts.length === 0 && !loadingAcademic && (
                    <p className="text-xs text-amber-600 mt-1">No hay turnos configurados.</p>
                  )}
                </div>

                {/* Vincular Padre/Apoderado - Switch + Collapsible */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Vincular Padre/Apoderado</h3>
                        <p className="text-xs text-slate-500">Asociar este estudiante con un padre registrado</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowParentSection(!showParentSection)} 
                      className={`relative w-12 h-7 rounded-full transition-colors ${showParentSection ? "bg-teal-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${showParentSection ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                  
                  {/* Collapsible content */}
                  {showParentSection && (
                    <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl">
                      {/* Selected parent display */}
                      {selectedParent ? (
                        <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                              {selectedParent.photo_url ? (
                                <img src={selectedParent.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <Users className="w-5 h-5 text-teal-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{selectedParent.name} {selectedParent.last_name}</p>
                              <p className="text-xs text-slate-500">DNI: {selectedParent.dni || 'No registrado'}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParent(null);
                              setForm(prev => ({ ...prev, padre_id: "" }));
                              setParentSearch("");
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                              type="text"
                              value={parentSearch}
                              onChange={(e) => {
                                setParentSearch(e.target.value);
                                setShowParentDropdown(true);
                              }}
                              onFocus={() => setShowParentDropdown(true)}
                              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                              placeholder="Buscar padre por nombre o DNI..."
                            />
                            {loadingParents && (
                              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
                            )}
                          </div>
                          
                          {/* Dropdown */}
                          {showParentDropdown && !loadingParents && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                              {filteredParents.length === 0 ? (
                                <div className="p-4 text-center text-slate-500">
                                  {parents.length === 0 ? (
                                    <div>
                                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                      <p className="text-sm">No hay padres registrados</p>
                                      <p className="text-xs text-slate-400 mt-1">Primero registra un padre/apoderado</p>
                                    </div>
                                  ) : (
                                    <div>
                                      <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                      <p className="text-sm">No se encontraron resultados</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                filteredParents.slice(0, 10).map(parent => (
                                  <button
                                    key={parent.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedParent(parent);
                                      setForm(prev => ({ ...prev, padre_id: parent.id }));
                                      setShowParentDropdown(false);
                                      setParentSearch("");
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                      {parent.photo_url ? (
                                        <img src={parent.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                      ) : (
                                        <Users className="w-5 h-5 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800 truncate">{parent.name} {parent.last_name}</p>
                                      <p className="text-xs text-slate-500">
                                        {parent.dni ? `DNI: ${parent.dni}` : 'Sin DNI'}
                                        {parent.ocupacion && ` • ${parent.ocupacion}`}
                                      </p>
                                    </div>
                                    <Check className="w-5 h-5 text-teal-500 opacity-0 group-hover:opacity-100" />
                                  </button>
                                ))
                              )}
                              {filteredParents.length > 10 && (
                                <div className="px-4 py-2 text-xs text-center text-slate-400 bg-slate-50">
                                  Mostrando 10 de {filteredParents.length} resultados. Refina tu búsqueda.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Información complementaria - Switch + Collapsible */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Información Complementaria</h3>
                        <p className="text-xs text-slate-500">Datos médicos y contactos de emergencia</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowComplementaryInfo(!showComplementaryInfo)} 
                      className={`relative w-12 h-7 rounded-full transition-colors ${showComplementaryInfo ? "bg-rose-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${showComplementaryInfo ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                  
                  {/* Collapsible content */}
                  {showComplementaryInfo && (
                    <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Condiciones médicas */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-rose-500" />
                            Condiciones o enfermedades
                          </label>
                          <textarea
                            value={form.condiciones_medicas}
                            onChange={(e) => handleChange('condiciones_medicas', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                            placeholder="Ej: Asma, diabetes, epilepsia, etc."
                            rows={2}
                          />
                        </div>

                        {/* Alergias */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Alergias
                          </label>
                          <textarea
                            value={form.alergias}
                            onChange={(e) => handleChange('alergias', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                            placeholder="Ej: Penicilina, maní, mariscos, etc."
                            rows={2}
                          />
                        </div>

                        {/* Doctor nombre */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Doctor personal
                          </label>
                          <input
                            type="text"
                            value={form.doctor_nombre}
                            onChange={(e) => handleChange('doctor_nombre', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                            placeholder="Nombre del médico"
                          />
                        </div>

                        {/* Doctor teléfono */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Teléfono del doctor
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-4 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-600 font-medium">
                              +51
                            </span>
                            <input
                              type="tel"
                              value={form.doctor_telefono}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                                handleChange('doctor_telefono', value);
                              }}
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                              placeholder="999 999 999"
                              maxLength={9}
                            />
                          </div>
                        </div>

                        {/* Persona autorizada */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Persona autorizada
                          </label>
                          <input
                            type="text"
                            value={form.persona_autorizada}
                            onChange={(e) => handleChange('persona_autorizada', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                            placeholder="Nombre completo"
                          />
                        </div>

                        {/* Teléfono persona autorizada */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Teléfono persona autorizada
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-4 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-600 font-medium">
                              +51
                            </span>
                            <input
                              type="tel"
                              value={form.persona_autorizada_telefono}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                                handleChange('persona_autorizada_telefono', value);
                              }}
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                              placeholder="999 999 999"
                              maxLength={9}
                            />
                          </div>
                        </div>

                        {/* Notas */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            Notas adicionales
                          </label>
                          <textarea
                            value={form.notas}
                            onChange={(e) => handleChange('notas', e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                            placeholder="Cualquier información adicional relevante..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Parent-specific fields */}
            {(roleId === 'parent' || form.role === 'parent') && (
              <>
                {/* Section header */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-500" />
                    Información del Apoderado
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Datos adicionales del padre o apoderado</p>
                </div>

                {/* DNI */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    DNI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                      handleChange('dni', value);
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="12345678"
                    maxLength={8}
                    required={roleId === 'parent' || form.role === 'parent'}
                  />
                </div>

                {/* Ocupación */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Ocupación / Profesión
                  </label>
                  <input
                    type="text"
                    value={form.ocupacion}
                    onChange={(e) => handleChange('ocupacion', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Ej: Ingeniero, Docente, Comerciante"
                  />
                </div>

                {/* Lugar de trabajo */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Lugar de trabajo
                  </label>
                  <input
                    type="text"
                    value={form.lugar_trabajo}
                    onChange={(e) => handleChange('lugar_trabajo', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Ej: Ministerio de Educación"
                  />
                </div>

                {/* Teléfono de trabajo */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Teléfono de trabajo
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-4 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-600 font-medium">
                      +51
                    </span>
                    <input
                      type="tel"
                      value={form.telefono_trabajo}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        handleChange('telefono_trabajo', value);
                      }}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="999 999 999"
                      maxLength={9}
                    />
                  </div>
                </div>
              </>
            )}
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
      
      {/* Demo User Blocked Modal - Friendly message instead of error */}
      {showDemoBlockedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" data-testid="demo-blocked-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <Eye className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Modo Visitante</h2>
                  <p className="text-blue-100 text-sm">Versión demostrativa</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-slate-700 text-base leading-relaxed">
                Estás explorando <span className="font-semibold text-blue-600">EduNet</span> en modo demostración.
              </p>
              <p className="text-slate-600 mt-3">
                Las funciones de creación y edición están deshabilitadas.
              </p>
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">✨ Cuando contrates el servicio</span> tendrás acceso completo a todas las funcionalidades del sistema.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowDemoBlockedModal(false)}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
                data-testid="demo-modal-confirm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
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
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({ title: "", message: "", type: "info" });
  // Edit user states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  
  // Edit student extended states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showParentSection, setShowParentSection] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [showExtraInfoSection, setShowExtraInfoSection] = useState(false);
  
  // QR Modal states
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrStudent, setQRStudent] = useState(null);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // STUDENT FILTERS & GROUPED VIEW STATES (Premium Feature)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilterLevel, setStudentFilterLevel] = useState(() => 
    localStorage.getItem(STUDENT_FILTER_KEYS.LEVEL) || ""
  );
  const [studentFilterGrade, setStudentFilterGrade] = useState(() => 
    localStorage.getItem(STUDENT_FILTER_KEYS.GRADE) || ""
  );
  const [studentFilterSection, setStudentFilterSection] = useState(() => 
    localStorage.getItem(STUDENT_FILTER_KEYS.SECTION) || ""
  );
  const [studentViewMode, setStudentViewMode] = useState(() => 
    localStorage.getItem(STUDENT_FILTER_KEYS.VIEW_MODE) || 'grouped'
  );
  const [expandedLevels, setExpandedLevels] = useState(() => {
    try {
      const saved = localStorage.getItem(STUDENT_FILTER_KEYS.EXPANDED_LEVELS);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [expandedGrades, setExpandedGrades] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [generatingQR, setGeneratingQR] = useState(false);
  
  // Academic data for QR card (grade/section/level names)
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [levels, setLevels] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  // Filter parents based on search query
  const filteredParents = users.filter(u => 
    u.role === 'parent' && 
    (`${u.name} ${u.last_name}`.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
     (u.email && u.email.toLowerCase().includes(parentSearchQuery.toLowerCase())))
  );
  
  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    if (!password) return { strength: 0, label: "", color: "" };
    
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    strength = Object.values(checks).filter(Boolean).length;
    
    if (strength <= 2) return { strength: 33, label: "Débil", color: "bg-red-500", textColor: "text-red-500" };
    if (strength <= 3) return { strength: 66, label: "Media", color: "bg-amber-500", textColor: "text-amber-500" };
    return { strength: 100, label: "Fuerte", color: "bg-emerald-500", textColor: "text-emerald-500" };
  };
  
  // Generate secure password
  const generateSecurePassword = () => {
    const length = 12;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + special;
    
    let password = "";
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setEditPassword(password);
    setConfirmPassword(password); // Auto-fill confirm when generating
  };
  
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch users and settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, settingsRes, gradesRes, sectionsRes, levelsRes, shiftsRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/academic/grades`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/sections`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/levels`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/shifts`, { headers }).catch(() => ({ data: [] }))
        ]);
        setUsers(usersRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);
        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setLevels(levelsRes.data || []);
        setShifts(shiftsRes.data || []);
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // STUDENT FILTER PERSISTENCE & COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Persist student filters to localStorage
  useEffect(() => {
    localStorage.setItem(STUDENT_FILTER_KEYS.LEVEL, studentFilterLevel);
  }, [studentFilterLevel]);
  
  useEffect(() => {
    localStorage.setItem(STUDENT_FILTER_KEYS.GRADE, studentFilterGrade);
  }, [studentFilterGrade]);
  
  useEffect(() => {
    localStorage.setItem(STUDENT_FILTER_KEYS.SECTION, studentFilterSection);
  }, [studentFilterSection]);
  
  useEffect(() => {
    localStorage.setItem(STUDENT_FILTER_KEYS.VIEW_MODE, studentViewMode);
  }, [studentViewMode]);
  
  useEffect(() => {
    localStorage.setItem(STUDENT_FILTER_KEYS.EXPANDED_LEVELS, JSON.stringify(expandedLevels));
  }, [expandedLevels]);

  // Filtered grades based on level (dependent dropdown)
  const filteredGradesForStudentFilter = useMemo(() => {
    return studentFilterLevel ? grades.filter(g => g.nivel_id === studentFilterLevel) : grades;
  }, [studentFilterLevel, grades]);
  
  // Filtered sections based on grade (dependent dropdown)
  const filteredSectionsForStudentFilter = useMemo(() => {
    return studentFilterGrade ? sections.filter(s => s.grado_id === studentFilterGrade) : sections;
  }, [studentFilterGrade, sections]);
  
  // Get all students with applied filters
  const filteredStudents = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'student' || !u.email_verified) return false;
      
      const matchesSearch = !studentSearch || 
        `${u.name} ${u.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
        u.username?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        u.phone?.includes(studentSearch);
      const matchesLevel = !studentFilterLevel || u.nivel_id === studentFilterLevel;
      const matchesGrade = !studentFilterGrade || u.grado_id === studentFilterGrade;
      const matchesSection = !studentFilterSection || u.seccion_id === studentFilterSection;
      
      return matchesSearch && matchesLevel && matchesGrade && matchesSection;
    });
  }, [users, studentSearch, studentFilterLevel, studentFilterGrade, studentFilterSection]);
  
  // Group students by level for hierarchical view
  const studentsByLevel = useMemo(() => {
    const grouped = {};
    filteredStudents.forEach(s => {
      const levelId = s.nivel_id || 'sin_nivel';
      if (!grouped[levelId]) grouped[levelId] = [];
      grouped[levelId].push(s);
    });
    return grouped;
  }, [filteredStudents]);
  
  // Generate filter description text
  const studentFilterDescription = useMemo(() => {
    const parts = [];
    if (studentFilterLevel) {
      const level = levels.find(l => l.id === studentFilterLevel);
      if (level) parts.push(level.nombre);
    }
    if (studentFilterGrade) {
      const grade = grades.find(g => g.id === studentFilterGrade);
      if (grade) parts.push(grade.nombre);
    }
    if (studentFilterSection) {
      const section = sections.find(s => s.id === studentFilterSection);
      if (section) parts.push(`Sección ${section.nombre}`);
    }
    if (studentSearch) {
      parts.push(`"${studentSearch}"`);
    }
    return parts.length > 0 ? parts.join(' – ') : null;
  }, [studentFilterLevel, studentFilterGrade, studentFilterSection, studentSearch, levels, grades, sections]);
  
  // Toggle accordion functions
  const toggleLevelAccordion = useCallback((levelId) => {
    setExpandedLevels(prev => ({ ...prev, [levelId]: !prev[levelId] }));
  }, []);
  
  const toggleGradeAccordion = useCallback((levelId, gradeId) => {
    const key = `${levelId}_${gradeId}`;
    setExpandedGrades(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);
  
  const toggleSectionAccordion = useCallback((levelId, gradeId, sectionId) => {
    const key = `${levelId}_${gradeId}_${sectionId}`;
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);
  
  // Clear all student filters
  const clearStudentFilters = useCallback(() => {
    setStudentFilterLevel("");
    setStudentFilterGrade("");
    setStudentFilterSection("");
    setStudentSearch("");
  }, []);

  // Generate QR codes for students without one
  const handleGenerateQRCodes = async () => {
    setGeneratingQR(true);
    try {
      const res = await axios.post(`${API}/attendance/qr/generate`, {}, { headers });
      
      if (res.data.updated_count > 0) {
        // Reload users to get updated QR tokens
        const usersRes = await axios.get(`${API}/users`, { headers });
        setUsers(usersRes.data || []);
        
        setInfoModalContent({
          title: "QR Generados",
          message: `Se generaron códigos QR para ${res.data.updated_count} estudiante(s) que no tenían.`,
          type: "success"
        });
      } else {
        setInfoModalContent({
          title: "Sin cambios",
          message: "Todos los estudiantes ya tienen su código QR generado.",
          type: "info"
        });
      }
      setShowInfoModal(true);
    } catch (err) {
      setInfoModalContent({
        title: "Error",
        message: err.response?.data?.detail || "No se pudieron generar los códigos QR.",
        type: "danger"
      });
      setShowInfoModal(true);
    } finally {
      setGeneratingQR(false);
    }
  };

  // Count students without QR
  const studentsWithoutQR = useMemo(() => {
    return users.filter(u => u.role === 'student' && u.email_verified && !u.qr_token).length;
  }, [users]);

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

  // Open delete confirmation modal
  const handleDeleteClick = (userObj) => {
    setUserToDelete(userObj);
    setShowDeleteModal(true);
    setOpenMenuId(null);
  };

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/users/${userToDelete.id}`, { headers });
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      setShowDeleteModal(false);
      setInfoModalContent({
        title: "Error al eliminar",
        message: err.response?.data?.detail || "No se pudo eliminar el usuario. Intenta nuevamente.",
        type: "danger"
      });
      setShowInfoModal(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Edit user handler
  const handleEditUser = (userId) => {
    setOpenMenuId(null);
    const userToEdit = users.find(u => u.id === userId);
    if (userToEdit) {
      setEditingUser(userToEdit);
      // Normalize gender value (old values used M/F, new uses male/female)
      const normalizeGender = (g) => {
        if (!g) return "";
        if (g === "M" || g === "male") return "male";
        if (g === "F" || g === "female") return "female";
        return g;
      };
      
      setEditForm({
        name: userToEdit.name || "",
        last_name: userToEdit.last_name || "",
        email: userToEdit.email || "",
        phone: userToEdit.phone || "",
        birthday: userToEdit.birthday || "",
        gender: normalizeGender(userToEdit.gender),
        address: userToEdit.address || "",
        photo_url: userToEdit.photo_url || "",
        // Student fields
        nivel_id: userToEdit.nivel_id || "",
        grado_id: userToEdit.grado_id || "",
        seccion_id: userToEdit.seccion_id || "",
        turno_id: userToEdit.turno_id || "",
        condiciones_medicas: userToEdit.condiciones_medicas || "",
        alergias: userToEdit.alergias || "",
        doctor_nombre: userToEdit.doctor_nombre || "",
        doctor_telefono: userToEdit.doctor_telefono || "",
        persona_autorizada: userToEdit.persona_autorizada || "",
        persona_autorizada_telefono: userToEdit.persona_autorizada_telefono || "",
        notas: userToEdit.notas || "",
        // Parent fields
        dni: userToEdit.dni || "",
        ocupacion: userToEdit.ocupacion || "",
      });
      // Reset extended states for students
      setShowPasswordSection(false);
      setEditPassword("");
      setConfirmPassword("");
      setShowEditPassword(false);
      setShowConfirmPassword(false);
      setShowParentSection(userToEdit.parent_id ? true : false);
      setSelectedParentId(userToEdit.parent_id || "");
      // Set parent search query to show selected parent name
      if (userToEdit.parent_id) {
        const parent = users.find(u => u.id === userToEdit.parent_id);
        setParentSearchQuery(parent ? `${parent.name} ${parent.last_name}` : "");
      } else {
        setParentSearchQuery("");
      }
      setShowParentDropdown(false);
      setShowExtraInfoSection(
        userToEdit.condiciones_medicas || userToEdit.alergias || 
        userToEdit.doctor_nombre || userToEdit.persona_autorizada || 
        userToEdit.notas ? true : false
      );
      setShowEditModal(true);
    }
  };

  // Save edited user
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    // Validate password if provided
    if (showPasswordSection && editPassword) {
      const strength = calculatePasswordStrength(editPassword);
      if (strength.label === "Débil") {
        setInfoModalContent({
          title: "Contraseña Débil",
          message: "La contraseña debe ser al menos 'Media' para poder guardar. Incluye mayúsculas, minúsculas, números y caracteres especiales.",
          type: "error"
        });
        setShowInfoModal(true);
        return;
      }
      
      // Validate password confirmation
      if (editPassword !== confirmPassword) {
        setInfoModalContent({
          title: "Las contraseñas no coinciden",
          message: "Por favor verifica que ambas contraseñas sean iguales.",
          type: "error"
        });
        setShowInfoModal(true);
        return;
      }
    }
    
    setEditLoading(true);
    try {
      // Build payload with optional password and parent_id
      const payload = { ...editForm };
      
      // Add password if provided
      if (showPasswordSection && editPassword) {
        payload.password = editPassword;
      }
      
      // Add/remove parent_id for students
      if (editingUser.role === 'student') {
        if (showParentSection && selectedParentId) {
          payload.parent_id = selectedParentId;
        } else {
          payload.parent_id = null; // Explicitly remove parent link
        }
      }
      
      const res = await axios.put(`${API}/users/${editingUser.id}`, payload, { headers });
      // Update local state
      setUsers(prev => prev.map(u => u.id === editingUser.id ? res.data.user : u));
      setShowEditModal(false);
      setEditingUser(null);
      setInfoModalContent({
        title: "Usuario Actualizado",
        message: "Los datos del usuario han sido actualizados correctamente.",
        type: "success"
      });
      setShowInfoModal(true);
    } catch (err) {
      setInfoModalContent({
        title: "Error",
        message: err.response?.data?.detail || "Error al actualizar el usuario",
        type: "error"
      });
      setShowInfoModal(true);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddUser = (roleId) => {
    setAddModalRole(roleId === 'pending' ? 'teacher' : roleId);
    setShowAddModal(true);
  };

  const handleUserCreated = (newUser) => {
    setUsers(prev => [...prev, newUser]);
    
    // Si es un estudiante, aplicar automáticamente los filtros para mostrarlo
    if (newUser.role === 'student' && newUser.nivel_id) {
      // Aplicar filtros automáticamente basados en el estudiante creado
      setStudentFilterLevel(newUser.nivel_id);
      
      if (newUser.grado_id) {
        setStudentFilterGrade(newUser.grado_id);
      }
      
      if (newUser.seccion_id) {
        setStudentFilterSection(newUser.seccion_id);
      }
      
      // Asegurar que los acordeones estén expandidos para ver al nuevo estudiante
      setExpandedLevels(prev => ({ ...prev, [newUser.nivel_id]: true }));
      if (newUser.grado_id) {
        setExpandedGrades(prev => ({ ...prev, [`${newUser.nivel_id}_${newUser.grado_id}`]: true }));
      }
      if (newUser.seccion_id) {
        setExpandedSections(prev => ({ 
          ...prev, 
          [`${newUser.nivel_id}_${newUser.grado_id}_${newUser.seccion_id}`]: true 
        }));
      }
    }
  };

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  // Content for when a role is selected
  const renderUsersList = () => {
    const roleConfig = ROLE_CARDS.find(r => r.id === selectedRole);
    
    // Check if any student filter is active
    const hasActiveStudentFilters = studentFilterLevel || studentFilterGrade || studentFilterSection || studentSearch;
    
    // For students, use the filtered list; for others, use normal filter
    const usersToDisplay = selectedRole === 'student'
      ? filteredStudents
      : selectedRole === 'pending' 
        ? users.filter(u => !u.email_verified)
        : users.filter(u => u.role === selectedRole && u.email_verified);
    
    // Get total students count (unfiltered)
    const totalStudents = users.filter(u => u.role === 'student' && u.email_verified).length;

    return (
      <div className="p-6 lg:p-8" data-testid="users-list-content">
        {/* Enhanced Header */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${roleConfig.gradientBg} text-white rounded-3xl p-8 mb-8 shadow-xl`}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full"></div>
          
          <div className="relative z-10">
            {/* Back button */}
            <button
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium">Volver a categorías</span>
            </button>
            
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                {/* Icon container */}
                <div className="w-24 h-24 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center">
                  <img src={roleConfig.image} alt={roleConfig.label} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>{roleConfig.label}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                      {usersToDisplay.length} {usersToDisplay.length === 1 ? roleConfig.labelSingular : roleConfig.label.toLowerCase()}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-white/50"></span>
                    <span className="text-white/80 text-sm">Gestión de personal</span>
                  </div>
                </div>
              </div>
              
              {/* Add button - Hidden for system roles */}
              {!roleConfig.hideAddButton && (
                <button
                  onClick={() => handleAddUser(selectedRole)}
                  className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5"
                  data-testid="add-user-circle-btn"
                >
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${roleConfig.gradientBg} flex items-center justify-center`}>
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <span>Agregar {roleConfig.labelSingular}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════
            STUDENT FILTERS BAR - Only for student role
            ═══════════════════════════════════════════════════════════════════════════════ */}
        {selectedRole === 'student' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm" data-testid="student-filters-bar">
            {/* Top row: Search + View toggle */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm"
                  placeholder="Buscar por nombre, usuario, correo o teléfono..."
                  data-testid="student-search-input"
                />
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1.5 bg-slate-100 rounded-xl self-start lg:self-auto">
                <button
                  onClick={() => setStudentViewMode('grouped')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    studentViewMode === 'grouped' 
                      ? 'bg-white text-amber-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  data-testid="view-mode-grouped"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Agrupado</span>
                </button>
                <button
                  onClick={() => setStudentViewMode('cards')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    studentViewMode === 'cards' 
                      ? 'bg-white text-amber-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  data-testid="view-mode-cards"
                >
                  <List className="w-4 h-4" />
                  <span>Tarjetas</span>
                </button>
              </div>
            </div>
            
            {/* Filters row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Level filter */}
              <select
                value={studentFilterLevel}
                onChange={(e) => {
                  setStudentFilterLevel(e.target.value);
                  setStudentFilterGrade("");
                  setStudentFilterSection("");
                }}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm font-medium"
                data-testid="filter-level"
              >
                <option value="">📚 Todos los niveles</option>
                {levels.filter(l => l.activo).map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
              
              {/* Grade filter */}
              <select
                value={studentFilterGrade}
                onChange={(e) => {
                  setStudentFilterGrade(e.target.value);
                  setStudentFilterSection("");
                }}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm font-medium disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!studentFilterLevel}
                data-testid="filter-grade"
              >
                <option value="">{studentFilterLevel ? "📖 Todos los grados" : "Primero selecciona nivel"}</option>
                {filteredGradesForStudentFilter.filter(g => g.activo).map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              
              {/* Section filter */}
              <select
                value={studentFilterSection}
                onChange={(e) => setStudentFilterSection(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm font-medium disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!studentFilterGrade}
                data-testid="filter-section"
              >
                <option value="">{studentFilterGrade ? "🏷️ Todas las secciones" : "Primero selecciona grado"}</option>
                {filteredSectionsForStudentFilter.filter(s => s.activo).map(s => (
                  <option key={s.id} value={s.id}>Sección {s.nombre}</option>
                ))}
              </select>
            </div>
            
            {/* Results indicator + Clear filters */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">
                  Mostrando <span className="font-bold text-amber-600">{filteredStudents.length}</span> de <span className="font-bold">{totalStudents}</span> estudiantes
                </span>
                {studentFilterDescription && (
                  <span className="text-sm text-slate-500 hidden sm:inline">
                    — {studentFilterDescription}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Generate QR Button - Shows only if there are students without QR */}
                {studentsWithoutQR > 0 && (
                  <button
                    onClick={handleGenerateQRCodes}
                    disabled={generatingQR}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors border border-emerald-200 disabled:opacity-50"
                    data-testid="generate-qr-btn"
                    title={`${studentsWithoutQR} estudiante(s) sin QR`}
                  >
                    {generatingQR ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    Generar QR ({studentsWithoutQR})
                  </button>
                )}
                {(studentFilterLevel || studentFilterGrade || studentFilterSection || studentSearch) && (
                  <button
                    onClick={clearStudentFilters}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    data-testid="clear-filters"
                  >
                    <X className="w-4 h-4" />
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            CONTENT AREA - Initial state, Empty state, Grouped view or Cards grid
            ═══════════════════════════════════════════════════════════════════════════════ */}
        {selectedRole === 'student' && !hasActiveStudentFilters ? (
          /* Initial state - No filters applied yet */
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-12 text-center border-2 border-amber-200">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 opacity-10"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 opacity-10"></div>
            
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg p-5 border-2 border-amber-200">
                <Filter className="w-full h-full text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-amber-700 mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Selecciona filtros para ver estudiantes
              </h3>
              <p className="text-slate-600 mb-6 max-w-lg mx-auto">
                Tienes <span className="font-bold text-amber-600">{totalStudents} estudiantes</span> registrados. 
                Para optimizar la carga, selecciona al menos un <span className="font-semibold">nivel</span>, <span className="font-semibold">grado</span> o usa el <span className="font-semibold">buscador</span> para mostrar los resultados.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-amber-200 text-sm text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  INICIAL
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-amber-200 text-sm text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  PRIMARIA
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-amber-200 text-sm text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  SECUNDARIA
                </div>
              </div>
            </div>
          </div>
        ) : usersToDisplay.length === 0 ? (
          <div className={`relative overflow-hidden bg-gradient-to-br ${roleConfig.lightGradient} rounded-3xl p-16 text-center border-2 ${roleConfig.borderColor}`}>
            {/* Decorative circles */}
            <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${roleConfig.gradientBg} opacity-10`}></div>
            <div className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gradient-to-br ${roleConfig.gradientBg} opacity-10`}></div>
            
            <div className="relative z-10">
              <div className={`w-32 h-32 mx-auto mb-6 bg-white rounded-3xl shadow-lg p-6 border-2 ${roleConfig.borderColor}`}>
                <img src={roleConfig.image} alt="" className="w-full h-full object-contain opacity-50" />
              </div>
              <h3 className={`text-2xl font-bold ${roleConfig.textColor} mb-2`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                {selectedRole === 'student' && (studentFilterLevel || studentFilterGrade || studentFilterSection || studentSearch)
                  ? "Sin resultados"
                  : `Sin ${roleConfig.label.toLowerCase()}`
                }
              </h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                {selectedRole === 'student' && (studentFilterLevel || studentFilterGrade || studentFilterSection || studentSearch)
                  ? "No se encontraron estudiantes con los filtros aplicados. Intenta ajustar los filtros."
                  : `Aún no tienes ${roleConfig.label.toLowerCase()} registrados en el sistema. ¡Agrega el primero ahora!`
                }
              </p>
              {!(selectedRole === 'student' && (studentFilterLevel || studentFilterGrade || studentFilterSection || studentSearch)) && (
                <button
                  onClick={() => handleAddUser(selectedRole)}
                  className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${roleConfig.gradientBg} text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:-translate-y-0.5`}
                >
                  <UserPlus className="w-5 h-5" />
                  Agregar {roleConfig.labelSingular}
                </button>
              )}
            </div>
          </div>
        ) : selectedRole === 'student' && studentViewMode === 'grouped' ? (
          <div className="space-y-4" data-testid="grouped-view">
            {Object.entries(studentsByLevel)
              .sort(([a], [b]) => {
                const levelA = levels.find(l => l.id === a);
                const levelB = levels.find(l => l.id === b);
                return (levelA?.orden || 0) - (levelB?.orden || 0);
              })
              .map(([levelId, levelStudents]) => {
                const level = levels.find(l => l.id === levelId);
                const levelName = level?.nombre || 'Sin Nivel';
                const levelColor = getLevelColor(levelName);
                const isLevelOpen = expandedLevels[levelId] ?? true;
                
                // Group by grade within level
                const studentsByGrade = {};
                levelStudents.forEach(s => {
                  const gradeId = s.grado_id || 'sin_grado';
                  if (!studentsByGrade[gradeId]) studentsByGrade[gradeId] = [];
                  studentsByGrade[gradeId].push(s);
                });
                
                return (
                  <div key={levelId} className="overflow-hidden" data-testid={`level-accordion-${levelId}`}>
                    {/* Level Header */}
                    <button
                      onClick={() => toggleLevelAccordion(levelId)}
                      className={`w-full flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r ${levelColor.gradient} text-white hover:opacity-95 transition-all shadow-lg`}
                    >
                      <div className="flex items-center gap-4">
                        {isLevelOpen ? (
                          <ChevronDown className="w-6 h-6" />
                        ) : (
                          <ChevronRight className="w-6 h-6" />
                        )}
                        <GraduationCap className="w-7 h-7" />
                        <span className="font-bold text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>{levelName}</span>
                      </div>
                      <span className="px-5 py-2 rounded-full text-sm font-bold bg-white/20 backdrop-blur-sm">
                        {levelStudents.length} {levelStudents.length === 1 ? 'estudiante' : 'estudiantes'}
                      </span>
                    </button>
                    
                    {/* Level Content - Grades */}
                    {isLevelOpen && (
                      <div className="mt-3 space-y-3 pl-4">
                        {Object.entries(studentsByGrade)
                          .sort(([a], [b]) => {
                            const gradeA = grades.find(g => g.id === a);
                            const gradeB = grades.find(g => g.id === b);
                            return (gradeA?.orden || 0) - (gradeB?.orden || 0);
                          })
                          .map(([gradeId, gradeStudents]) => {
                            const grade = grades.find(g => g.id === gradeId);
                            const gradeName = grade?.nombre || 'Sin Grado';
                            const gradeKey = `${levelId}_${gradeId}`;
                            const isGradeOpen = expandedGrades[gradeKey] ?? true;
                            
                            // Group by section within grade
                            const studentsBySection = {};
                            gradeStudents.forEach(s => {
                              const sectionId = s.seccion_id || 'sin_seccion';
                              if (!studentsBySection[sectionId]) studentsBySection[sectionId] = [];
                              studentsBySection[sectionId].push(s);
                            });
                            
                            return (
                              <div key={gradeId} className="overflow-hidden" data-testid={`grade-accordion-${gradeId}`}>
                                {/* Grade Header */}
                                <button
                                  onClick={() => toggleGradeAccordion(levelId, gradeId)}
                                  className={`w-full flex items-center justify-between p-4 rounded-xl ${levelColor.light} border-2 ${levelColor.border} hover:shadow-sm transition-all`}
                                >
                                  <div className="flex items-center gap-3">
                                    {isGradeOpen ? (
                                      <ChevronDown className={`w-5 h-5 ${levelColor.text}`} />
                                    ) : (
                                      <ChevronRight className={`w-5 h-5 ${levelColor.text}`} />
                                    )}
                                    <span className={`font-semibold ${levelColor.text}`}>{gradeName}</span>
                                  </div>
                                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${levelColor.bg} text-white`}>
                                    {gradeStudents.length} {gradeStudents.length === 1 ? 'estudiante' : 'estudiantes'}
                                  </span>
                                </button>
                                
                                {/* Grade Content - Sections */}
                                {isGradeOpen && (
                                  <div className="mt-2 space-y-2 pl-4">
                                    {Object.entries(studentsBySection)
                                      .sort(([a], [b]) => {
                                        const sectionA = sections.find(s => s.id === a);
                                        const sectionB = sections.find(s => s.id === b);
                                        return (sectionA?.nombre || '').localeCompare(sectionB?.nombre || '');
                                      })
                                      .map(([sectionId, sectionStudents]) => {
                                        const section = sections.find(s => s.id === sectionId);
                                        const sectionName = section?.nombre || 'Sin Sección';
                                        const sectionKey = `${levelId}_${gradeId}_${sectionId}`;
                                        const isSectionOpen = expandedSections[sectionKey] ?? true;
                                        
                                        return (
                                          <div key={sectionId} data-testid={`section-accordion-${sectionId}`}>
                                            {/* Section Header */}
                                            <button
                                              onClick={() => toggleSectionAccordion(levelId, gradeId, sectionId)}
                                              className={`w-full flex items-center justify-between p-3 rounded-lg ${levelColor.light} hover:opacity-90 transition-all`}
                                            >
                                              <div className="flex items-center gap-2">
                                                {isSectionOpen ? (
                                                  <ChevronDown className={`w-4 h-4 ${levelColor.text}`} />
                                                ) : (
                                                  <ChevronRight className={`w-4 h-4 ${levelColor.text}`} />
                                                )}
                                                <span className={`font-medium text-sm ${levelColor.text}`}>
                                                  Sección {sectionName}
                                                </span>
                                              </div>
                                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${levelColor.bg} text-white`}>
                                                {sectionStudents.length}
                                              </span>
                                            </button>
                                            
                                            {/* Section Content - Student Cards */}
                                            {isSectionOpen && (
                                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-6 pb-2">
                                                {sectionStudents.map(student => renderStudentCard(student, roleConfig, levelColor, gradeName, sectionName))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="cards-view">
            {usersToDisplay.map((u) => renderUserCard(u, roleConfig))}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render student card for grouped view
  const renderStudentCard = (student, roleConfig, levelColor, gradeName, sectionName) => (
    <div 
      key={student.id}
      className={`group relative overflow-hidden bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-2 ${levelColor?.border || roleConfig.borderColor}`}
      data-testid={`student-card-${student.id}`}
    >
      <div className={`h-1.5 bg-gradient-to-r ${levelColor?.gradient || roleConfig.gradientBg}`}></div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-100">
                {student.photo_url ? (
                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${levelColor?.light || 'bg-amber-50'} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${levelColor?.text || 'text-amber-600'}`}>
                      {student.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${levelColor?.bg || 'bg-emerald-500'} rounded-full border-2 border-white flex items-center justify-center`}>
                <Check className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-1.5">
                {student.name} {student.last_name}
                {student.is_demo_user && (
                  <span className="px-1.5 py-0.5 text-[8px] font-bold bg-blue-100 text-blue-700 rounded-full">DEMO</span>
                )}
              </p>
              <p className="text-xs text-slate-400">@{student.username}</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === student.id ? null : student.id);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
            {openMenuId === student.id && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30">
                <button
                  onClick={() => {
                    setQRStudent({ 
                      ...student, 
                      grade_name: gradeName, 
                      section_name: sectionName,
                      level_name: levelColor?.text?.includes('emerald') ? 'INICIAL' : levelColor?.text?.includes('blue') ? 'PRIMARIA' : 'SECUNDARIA'
                    });
                    setShowQRModal(true);
                    setOpenMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-violet-50 text-violet-600 flex items-center gap-2"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Ver QR
                </button>
                <button
                  onClick={() => {
                    handleEditUser(student.id);
                    setOpenMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    handleDeleteClick(student);
                    setOpenMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          {student.email && (
            <div className="flex items-center gap-2 text-slate-500">
              <Mail className="w-3 h-3 text-slate-400" />
              <span className="truncate">{student.email}</span>
            </div>
          )}
          {student.phone && (
            <div className="flex items-center gap-2 text-slate-500">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{student.phone}</span>
            </div>
          )}
        </div>
        {student.qr_token && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => {
                setQRStudent({ 
                  ...student, 
                  grade_name: gradeName, 
                  section_name: sectionName 
                });
                setShowQRModal(true);
              }}
              className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="bg-white p-1 rounded border border-slate-200">
                <QRCodeSVG value={student.qr_token} size={40} level="L" />
              </div>
              <span className="text-[9px] font-medium text-slate-400 uppercase">QR Code</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Helper function to render user card for cards view
  const renderUserCard = (u, roleConfig) => (
    <div 
      key={u.id}
      className={`group relative overflow-hidden bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-2 ${roleConfig.borderColor} hover:-translate-y-1`}
      data-testid={`user-card-${u.id}`}
    >
      <div className={`h-2 bg-gradient-to-r ${roleConfig.gradientBg}`}></div>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${roleConfig.gradientBg} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2`}></div>
      <div className="p-6 relative">
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === u.id ? null : u.id);
            }}
            className={`w-10 h-10 rounded-full hover:bg-gradient-to-r hover:${roleConfig.gradientBg} hover:text-white flex items-center justify-center text-slate-400 transition-all`}
            data-testid={`user-menu-btn-${u.id}`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {openMenuId === u.id && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 min-w-[160px] z-10">
              {/* Edit button - disabled for system users */}
              <button
                onClick={() => !u.is_system_user && handleEditUser(u.id)}
                disabled={u.is_system_user}
                className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors ${
                  u.is_system_user 
                    ? 'text-slate-300 cursor-not-allowed' 
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                data-testid={`edit-user-${u.id}`}
                title={u.is_system_user ? "Usuario protegido del sistema. No se puede editar." : "Editar usuario"}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  u.is_system_user ? 'bg-slate-100' : 'bg-blue-100'
                }`}>
                  <Pencil className={`w-4 h-4 ${u.is_system_user ? 'text-slate-300' : 'text-blue-600'}`} />
                </div>
                Editar
                {u.is_system_user && <span className="ml-auto text-slate-300">🔒</span>}
              </button>
              {selectedRole === 'student' && (
                <button
                  onClick={() => {
                    const grade = grades.find(g => g.id === u.grado_id);
                    const sectionName = sections.find(s => s.id === u.seccion_id)?.nombre || "";
                    const levelName = grade ? levels.find(l => l.id === grade.nivel_id)?.nombre || "" : "";
                    setQRStudent({ 
                      ...u, 
                      grade_name: grade?.nombre || "", 
                      section_name: sectionName,
                      level_name: levelName
                    });
                    setShowQRModal(true);
                    setOpenMenuId(null);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-violet-600 hover:bg-violet-50 flex items-center gap-3 transition-colors"
                  data-testid={`show-qr-${u.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-violet-600" />
                  </div>
                  Ver QR
                </button>
              )}
              {/* Delete button - disabled for system users and protected users */}
              <button
                onClick={() => !(u.is_system_user || u.is_protected || u.is_owner) && handleDeleteClick(u)}
                disabled={u.is_system_user || u.is_protected || u.is_owner}
                className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors ${
                  (u.is_system_user || u.is_protected || u.is_owner)
                    ? 'text-slate-300 cursor-not-allowed' 
                    : 'text-red-600 hover:bg-red-50'
                }`}
                data-testid={`delete-user-${u.id}`}
                title={
                  u.is_system_user 
                    ? "Usuario protegido del sistema. No se puede eliminar." 
                    : (u.is_protected || u.is_owner) 
                      ? "Este usuario es el propietario y no se puede eliminar."
                      : "Eliminar usuario"
                }
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (u.is_system_user || u.is_protected || u.is_owner) ? 'bg-slate-100' : 'bg-red-100'
                }`}>
                  <Trash2 className={`w-4 h-4 ${(u.is_system_user || u.is_protected || u.is_owner) ? 'text-slate-300' : 'text-red-600'}`} />
                </div>
                Eliminar
                {(u.is_system_user || u.is_protected || u.is_owner) && <span className="ml-auto text-slate-300">🔒</span>}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center text-center mb-4">
          <div className={`relative mb-4`}>
            <div className={`w-20 h-20 rounded-2xl overflow-hidden border-3 ${roleConfig.borderColor} shadow-lg`}>
              {u.photo_url ? (
                <img 
                  src={u.photo_url} 
                  alt={u.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${roleConfig.lightGradient} flex items-center justify-center`}>
                  <span className={`text-2xl font-bold ${roleConfig.textColor}`}>
                    {u.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r ${roleConfig.gradientBg} rounded-full border-3 border-white flex items-center justify-center`}>
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2 justify-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {u.name} {u.last_name || ""}
            {u.is_system_user && (
              <span 
                className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-white rounded-full flex items-center gap-1"
                title="Usuario protegido del sistema. Se utiliza para soporte técnico."
              >
                🔒 SISTEMA
              </span>
            )}
            {u.is_demo_user && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                DEMO
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 mb-3">{u.email || `@${u.username}`}</p>
          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r ${roleConfig.gradientBg} text-white text-xs font-semibold shadow-sm`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            {roleConfig.labelSingular}
          </span>
        </div>
        <div className={`pt-3 border-t ${roleConfig.borderColor}`}>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              {u.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className={`w-5 h-5 rounded-full ${roleConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Phone className={`w-3 h-3 ${roleConfig.textColor}`} />
                  </div>
                  <span className="truncate">{u.phone}</span>
                </div>
              )}
              {selectedRole === 'student' && (u.grado_id || u.seccion_id) && (() => {
                const grade = grades.find(g => g.id === u.grado_id);
                const section = sections.find(s => s.id === u.seccion_id);
                const level = grade ? levels.find(l => l.id === grade.nivel_id) : null;
                return (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className={`w-5 h-5 rounded-full ${roleConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <GraduationCap className={`w-3 h-3 ${roleConfig.textColor}`} />
                    </div>
                    <span className="truncate">
                      {level?.nombre || ""}{level ? " - " : ""}
                      {grade?.nombre || "Sin grado"}{" - "}
                      {section?.nombre || "Sin sección"}
                    </span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className={`w-5 h-5 rounded-full ${roleConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <FileText className={`w-3 h-3 ${roleConfig.textColor}`} />
                </div>
                <span>Registrado: {u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : '-'}</span>
              </div>
            </div>
            {selectedRole === 'student' && u.qr_token && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const grade = grades.find(g => g.id === u.grado_id);
                  const sectionName = sections.find(s => s.id === u.seccion_id)?.nombre || "";
                  const levelName = grade ? levels.find(l => l.id === grade.nivel_id)?.nombre || "" : "";
                  setQRStudent({ 
                    ...u, 
                    grade_name: grade?.nombre || "", 
                    section_name: sectionName,
                    level_name: levelName
                  });
                  setShowQRModal(true);
                }}
                className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-slate-50 transition-colors group flex-shrink-0"
                title="Ver código QR completo"
                data-testid={`mini-qr-${u.id}`}
              >
                <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200 group-hover:shadow-md transition-shadow">
                  <QRCodeSVG 
                    value={u.qr_token} 
                    size={50}
                    level="L"
                  />
                </div>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">QR</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {ROLE_CARDS.map((role) => {
          const count = getUserCount(role.id);
          return (
            <button
              key={role.id}
              onClick={() => handleCardClick(role.id)}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${role.borderColor} bg-gradient-to-br ${role.lightGradient}`}
              data-testid={`role-card-${role.id}`}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${role.gradientBg} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              {/* Decorative circles */}
              <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${role.gradientBg} opacity-10`} />
              <div className={`absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-gradient-to-br ${role.gradientBg} opacity-10`} />

              {/* Pending badge */}
              {role.isPending && count > 0 && (
                <div className="absolute top-4 left-4 z-10">
                  <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                    {count} nuevos
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="relative z-10">
                {/* Icon container with gradient border */}
                <div className="flex justify-center mb-4">
                  <div className={`w-24 h-24 rounded-2xl bg-white shadow-lg p-3 group-hover:shadow-xl transition-all duration-300 border-2 ${role.borderColor}`}>
                    <img 
                      src={role.image} 
                      alt={role.label}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </div>

                {/* Title with gradient text on hover */}
                <h3 className={`text-xl font-bold text-center mb-2 ${role.textColor}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {role.label}
                </h3>

                {/* Count badge */}
                <div className="flex justify-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border ${role.borderColor} ${role.textColor} font-semibold text-sm`}>
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${role.gradientBg}`}></span>
                    {count} {count === 1 ? role.labelSingular : role.label.toLowerCase()}
                  </span>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center mt-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${role.gradientBg} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Resumen General
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-center text-white shadow-lg">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10"></div>
            <p className="text-4xl font-bold mb-1">{users.length}</p>
            <p className="text-sm text-blue-100">Total Usuarios</p>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-center text-white shadow-lg">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10"></div>
            <p className="text-4xl font-bold mb-1">{users.filter(u => u.email_verified).length}</p>
            <p className="text-sm text-emerald-100">Verificados</p>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-center text-white shadow-lg">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10"></div>
            <p className="text-4xl font-bold mb-1">{users.filter(u => !u.email_verified).length}</p>
            <p className="text-sm text-amber-100">Pendientes</p>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-center text-white shadow-lg">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10"></div>
            <p className="text-4xl font-bold mb-1">{new Set(users.map(u => u.role)).size}</p>
            <p className="text-sm text-purple-100">Roles Activos</p>
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
        user={user}
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
          subdomain={subdomain}
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
        currentUser={user}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title=""
        message={userToDelete ? (
          <div className="text-center">
            {/* Trash Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-white" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              ¿Eliminar usuario?
            </h3>
            
            {/* Subtitle */}
            <p className="text-slate-500 text-sm mb-5">
              Estás a punto de eliminar a <span className="font-bold text-slate-700">{userToDelete.name} {userToDelete.last_name || ''}</span>
            </p>
            
            {/* Data to delete box */}
            <div className="rounded-xl p-4 text-left">
              <p className="text-sm text-slate-600 mb-3 font-medium">Se eliminarán los siguientes datos:</p>
              
              {userToDelete.role === 'student' ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Cuenta y foto de perfil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Registros de asistencia</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Calificaciones</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Tareas entregadas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Exámenes realizados</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Reportes de disciplina</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Encuestas respondidas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Matrículas en cursos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Correos y mensajes</span>
                  </div>
                </div>
              ) : userToDelete.role === 'teacher' ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Cuenta y foto de perfil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Asignación de materias</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Correos y mensajes</span>
                  </div>
                </div>
              ) : userToDelete.role === 'parent' ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Cuenta y foto de perfil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Vinculación con hijos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Correos y mensajes</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Cuenta y foto de perfil</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Correos y mensajes</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Warning text */}
            <p className="text-sm text-slate-400 mt-4">
              Esta acción es permanente y no se puede deshacer
            </p>
          </div>
        ) : ""}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
        loading={deleteLoading}
      />

      {/* Info/Error Modal */}
      <ConfirmModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onConfirm={() => setShowInfoModal(false)}
        title={infoModalContent.title}
        message={infoModalContent.message}
        confirmText="Entendido"
        type={infoModalContent.type}
        showCancel={false}
      />

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#001f4b] to-[#003366] px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/30">
                    {editingUser.photo_url ? (
                      <img src={editingUser.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
                        {editingUser.name?.[0] || "U"}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Editar Usuario</h2>
                    <p className="text-sm text-white/60">{editingUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>
                {/* Apellido */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Apellido</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Correo electrónico</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>
                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>
                {/* Fecha de nacimiento */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={editForm.birthday}
                    onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>
                {/* Género */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Género</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                  </select>
                </div>
                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Dirección</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                  />
                </div>

                {/* Campos específicos para estudiantes */}
                {editingUser.role === 'student' && (
                  <>
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECCIÓN: INFORMACIÓN ACADÉMICA */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="md:col-span-2 mt-6 pt-4 border-t border-slate-200">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <GraduationCap className="w-4 h-4 text-violet-500" /> Información Académica
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Nivel */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Nivel</label>
                          <select
                            value={editForm.nivel_id}
                            onChange={(e) => {
                              setEditForm({ 
                                ...editForm, 
                                nivel_id: e.target.value,
                                grado_id: "",
                                seccion_id: ""
                              });
                            }}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white"
                          >
                            <option value="">Seleccionar nivel...</option>
                            {levels.filter(l => l.activo !== false).map(l => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                        </div>
                        {/* Grado */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Grado</label>
                          <select
                            value={editForm.grado_id}
                            onChange={(e) => {
                              setEditForm({ 
                                ...editForm, 
                                grado_id: e.target.value,
                                seccion_id: ""
                              });
                            }}
                            disabled={!editForm.nivel_id}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            <option value="">{editForm.nivel_id ? "Seleccionar grado..." : "Primero selecciona nivel"}</option>
                            {grades.filter(g => g.nivel_id === editForm.nivel_id && g.activo !== false).map(g => (
                              <option key={g.id} value={g.id}>{g.nombre}</option>
                            ))}
                          </select>
                        </div>
                        {/* Sección */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Sección</label>
                          <select
                            value={editForm.seccion_id}
                            onChange={(e) => setEditForm({ ...editForm, seccion_id: e.target.value })}
                            disabled={!editForm.grado_id}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            <option value="">{editForm.grado_id ? "Seleccionar sección..." : "Primero selecciona grado"}</option>
                            {sections.filter(s => s.grado_id === editForm.grado_id && s.activo !== false).map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                        {/* Turno */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Turno</label>
                          <select
                            value={editForm.turno_id}
                            onChange={(e) => setEditForm({ ...editForm, turno_id: e.target.value })}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white"
                          >
                            <option value="">Seleccionar turno...</option>
                            {shifts.filter(s => s.activo !== false).map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECCIÓN: GESTIÓN DE CREDENCIALES */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="md:col-span-2 mt-6 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Key className="w-4 h-4 text-amber-500" /> Gestión de Credenciales
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordSection(!showPasswordSection);
                            if (showPasswordSection) {
                              setEditPassword("");
                              setConfirmPassword("");
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          {/* Large iOS-style toggle */}
                          <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${showPasswordSection ? 'bg-[#001f4b]' : 'bg-slate-300'}`}>
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${showPasswordSection ? 'translate-x-7' : 'translate-x-1'}`} />
                          </div>
                          <span className="text-sm text-slate-600">{showPasswordSection ? 'Activado' : 'Desactivado'}</span>
                        </button>
                      </div>
                      
                      {showPasswordSection && (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                          {/* Nueva contraseña */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Nueva contraseña</label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={showEditPassword ? "text" : "password"}
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="Ingresa la nueva contraseña"
                                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEditPassword(!showEditPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={generateSecurePassword}
                                className="px-4 py-2.5 bg-[#001f4b] hover:bg-[#002a5c] text-white rounded-xl flex items-center gap-2 transition-colors"
                                title="Generar contraseña segura"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Generar</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Confirmar contraseña */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Confirmar contraseña</label>
                            <div className="relative">
                              <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repite la contraseña"
                                className={`w-full px-4 py-2.5 pr-10 border rounded-xl focus:ring-2 outline-none transition-colors ${
                                  confirmPassword && editPassword !== confirmPassword 
                                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400' 
                                    : confirmPassword && editPassword === confirmPassword
                                    ? 'border-emerald-300 focus:ring-emerald-200 focus:border-emerald-400'
                                    : 'border-slate-200 focus:ring-[#001f4b]/20 focus:border-[#001f4b]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {confirmPassword && editPassword !== confirmPassword && (
                              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Las contraseñas no coinciden
                              </p>
                            )}
                            {confirmPassword && editPassword === confirmPassword && editPassword && (
                              <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                Las contraseñas coinciden
                              </p>
                            )}
                          </div>
                          
                          {/* Password strength indicator */}
                          {editPassword && (
                            <div className="space-y-2">
                              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${calculatePasswordStrength(editPassword).color}`}
                                  style={{ width: `${calculatePasswordStrength(editPassword).strength}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className={`font-medium ${calculatePasswordStrength(editPassword).textColor}`}>
                                  Fortaleza: {calculatePasswordStrength(editPassword).label}
                                </span>
                                {calculatePasswordStrength(editPassword).label === "Débil" && (
                                  <span className="flex items-center gap-1 text-red-500">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    No permitido guardar
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                Mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos (!@#$%^&*)
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECCIÓN 2: VINCULACIÓN PADRE / APODERADO */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="md:col-span-2 mt-6 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-blue-500" /> Vincular Padre / Apoderado
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setShowParentSection(!showParentSection);
                            if (showParentSection) {
                              setSelectedParentId("");
                              setParentSearchQuery("");
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          {/* Large iOS-style toggle */}
                          <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${showParentSection ? 'bg-[#001f4b]' : 'bg-slate-300'}`}>
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${showParentSection ? 'translate-x-7' : 'translate-x-1'}`} />
                          </div>
                          <span className="text-sm text-slate-600">{showParentSection ? 'Activado' : 'Desactivado'}</span>
                        </button>
                      </div>
                      
                      {showParentSection && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Buscar Apoderado
                          </label>
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={parentSearchQuery}
                                onChange={(e) => {
                                  setParentSearchQuery(e.target.value);
                                  setShowParentDropdown(true);
                                  if (!e.target.value) setSelectedParentId("");
                                }}
                                onFocus={() => setShowParentDropdown(true)}
                                placeholder="Escribe el nombre del apoderado..."
                                className="w-full pl-10 pr-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none bg-white"
                              />
                              {selectedParentId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedParentId("");
                                    setParentSearchQuery("");
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            
                            {/* Dropdown de resultados */}
                            {showParentDropdown && parentSearchQuery && filteredParents.length > 0 && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {filteredParents.map(parent => (
                                  <button
                                    key={parent.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedParentId(parent.id);
                                      setParentSearchQuery(`${parent.name} ${parent.last_name}`);
                                      setShowParentDropdown(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors ${
                                      selectedParentId === parent.id ? 'bg-blue-100' : ''
                                    }`}
                                  >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      {parent.photo_url ? (
                                        <img src={parent.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                      ) : (
                                        <span className="text-blue-600 font-semibold text-sm">
                                          {parent.name?.[0]}{parent.last_name?.[0]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800 truncate">{parent.name} {parent.last_name}</p>
                                      <p className="text-xs text-slate-500 truncate">{parent.email || parent.phone || 'Sin contacto'}</p>
                                    </div>
                                    {selectedParentId === parent.id && (
                                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* No results message */}
                            {showParentDropdown && parentSearchQuery && filteredParents.length === 0 && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4">
                                <p className="text-sm text-slate-500 text-center">
                                  No se encontraron apoderados con "{parentSearchQuery}"
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Selected parent indicator */}
                          {selectedParentId && (
                            <div className="mt-3 p-3 bg-blue-100 rounded-lg flex items-center gap-2">
                              <Check className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-blue-800 font-medium">Apoderado seleccionado</span>
                            </div>
                          )}
                          
                          {users.filter(u => u.role === 'parent').length === 0 && (
                            <p className="text-sm text-blue-600 mt-3 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              No hay apoderados registrados en el sistema.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECCIÓN 3: INFORMACIÓN COMPLEMENTARIA */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="md:col-span-2 mt-6 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-purple-500" /> Información Complementaria
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowExtraInfoSection(!showExtraInfoSection)}
                          className="flex items-center gap-2"
                        >
                          {/* Large iOS-style toggle */}
                          <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${showExtraInfoSection ? 'bg-[#001f4b]' : 'bg-slate-300'}`}>
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${showExtraInfoSection ? 'translate-x-7' : 'translate-x-1'}`} />
                          </div>
                          <span className="text-sm text-slate-600">{showExtraInfoSection ? 'Activado' : 'Desactivado'}</span>
                        </button>
                      </div>
                      
                      {showExtraInfoSection && (
                        <div className="bg-purple-50 rounded-xl p-4 space-y-4">
                          {/* Condiciones o enfermedades */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <Stethoscope className="w-4 h-4 inline mr-1" /> Condiciones o enfermedades
                            </label>
                            <textarea
                              value={editForm.condiciones_medicas}
                              onChange={(e) => setEditForm({ ...editForm, condiciones_medicas: e.target.value })}
                              placeholder="Ej: Asma, diabetes, epilepsia, etc."
                              className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-none bg-white"
                              rows={2}
                            />
                          </div>
                          
                          {/* Alergias */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <AlertCircle className="w-4 h-4 inline mr-1" /> Alergias
                            </label>
                            <textarea
                              value={editForm.alergias}
                              onChange={(e) => setEditForm({ ...editForm, alergias: e.target.value })}
                              placeholder="Ej: Penicilina, maní, mariscos, etc."
                              className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-none bg-white"
                              rows={2}
                            />
                          </div>
                          
                          {/* Doctor y teléfono - 2 columnas */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                <Stethoscope className="w-4 h-4 inline mr-1" /> Doctor personal
                              </label>
                              <input
                                type="text"
                                value={editForm.doctor_nombre}
                                onChange={(e) => setEditForm({ ...editForm, doctor_nombre: e.target.value })}
                                placeholder="Nombre del doctor"
                                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                <Phone className="w-4 h-4 inline mr-1" /> Teléfono del doctor
                              </label>
                              <input
                                type="tel"
                                value={editForm.doctor_telefono}
                                onChange={(e) => setEditForm({ ...editForm, doctor_telefono: e.target.value })}
                                placeholder="Ej: 999 888 777"
                                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none bg-white"
                              />
                            </div>
                          </div>
                          
                          {/* Persona autorizada y teléfono - 2 columnas */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                <UserCheck className="w-4 h-4 inline mr-1" /> Persona autorizada
                              </label>
                              <input
                                type="text"
                                value={editForm.persona_autorizada}
                                onChange={(e) => setEditForm({ ...editForm, persona_autorizada: e.target.value })}
                                placeholder="Nombre de persona autorizada a recoger"
                                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                <Phone className="w-4 h-4 inline mr-1" /> Teléfono persona autorizada
                              </label>
                              <input
                                type="tel"
                                value={editForm.persona_autorizada_telefono}
                                onChange={(e) => setEditForm({ ...editForm, persona_autorizada_telefono: e.target.value })}
                                placeholder="Ej: 999 888 777"
                                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none bg-white"
                              />
                            </div>
                          </div>
                          
                          {/* Notas adicionales */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <FileText className="w-4 h-4 inline mr-1" /> Notas adicionales
                            </label>
                            <textarea
                              value={editForm.notas}
                              onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                              placeholder="Información relevante adicional sobre el estudiante..."
                              className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-none bg-white"
                              rows={3}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Campos específicos para padres */}
                {editingUser.role === 'parent' && (
                  <>
                    <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-200">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Información Adicional
                      </h4>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">DNI</label>
                      <input
                        type="text"
                        value={editForm.dni}
                        onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Ocupación</label>
                      <input
                        type="text"
                        value={editForm.ocupacion}
                        onChange={(e) => setEditForm({ ...editForm, ocupacion: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="px-6 py-2.5 bg-[#001f4b] hover:bg-[#002a5c] disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
              >
                {editLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal for Students */}
      {showQRModal && qrStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-violet-600" />
                Código QR del Estudiante
              </h3>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQRStudent(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <StudentQRCard 
                student={qrStudent}
                schoolName={settings?.system_name || "EduNet"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
