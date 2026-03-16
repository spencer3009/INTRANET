import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  School, Users, GraduationCap, BookOpen, LogIn, 
  Plus, Search, X, Check, AlertCircle, Building2,
  ArrowLeft, Loader2, Calendar, CalendarClock, Pencil, DollarSign, Tag, RefreshCw, Trash2,
  Eye, EyeOff, UserCircle, Save, Phone, Mail
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SupportSchoolsPage({ token, onLogin }) {
  const navigate = useNavigate();
  const [mySchools, setMySchools] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [editingExpiration, setEditingExpiration] = useState(null);
  const [newExpDate, setNewExpDate] = useState("");
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingForm, setPricingForm] = useState({ base_monthly_fee: "", per_student_fee: "", per_student_from_month: "", discount_notes: "" });
  const [pricingInfo, setPricingInfo] = useState({});
  const [renewModal, setRenewModal] = useState(null); // { schoolId, schoolName, price }
  const [renewCode, setRenewCode] = useState("");
  const [renewing, setRenewing] = useState(false);
  const [showCreateSchool, setShowCreateSchool] = useState(false);
  const [createForm, setCreateForm] = useState({ school_name: "", subdomain: "", owner_name: "", owner_email: "", owner_password: "", owner_ruc: "", owner_whatsapp: "" });
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [globalPrice, setGlobalPrice] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paying, setPaying] = useState(false);
  const [ownerModal, setOwnerModal] = useState(null); // { schoolId, schoolName }
  const [ownerData, setOwnerData] = useState(null);
  const [ownerForm, setOwnerForm] = useState({ name: "", school_display_name: "", email: "", ruc: "", whatsapp: "", password: "" });
  const [ownerEditing, setOwnerEditing] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerShowPwd, setOwnerShowPwd] = useState(false);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { label: "Debil", color: "bg-red-500", text: "text-red-600", pct: 33 };
    if (score <= 3) return { label: "Media", color: "bg-yellow-500", text: "text-yellow-600", pct: 66 };
    return { label: "Fuerte", color: "bg-emerald-500", text: "text-emerald-600", pct: 100 };
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setOwnerForm(f => ({ ...f, password: pwd }));
    setOwnerShowPwd(true);
  };

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        axios.get(`${API}/support/schools`, { headers }),
        axios.get(`${API}/support/all-schools`, { headers })
      ]);
      setMySchools(myRes.data);
      setAllSchools(allRes.data);
    } catch (err) {
      console.error("Error fetching schools:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleSwitch = async (schoolId) => {
    setSwitching(schoolId);
    try {
      const res = await axios.post(`${API}/support/switch-school`, 
        { school_id: schoolId }, { headers }
      );
      const { token: newToken, user, school } = res.data;
      
      // Guardar credenciales de soporte antes de cambiar contexto
      localStorage.setItem("support_token", token);
      localStorage.setItem("support_user", JSON.stringify({ 
        role: "system_admin_global", 
        is_support_global: true,
        email: "spencer3009@gmail.com",
        name: "Soporte",
        last_name: "EduNet",
        email_verified: true
      }));
      
      // Marcar usuario como sesión de soporte
      const supportUser = { ...user, is_support_session: true, original_role: "system_admin_global" };
      onLogin(newToken, supportUser);
      
      toast.success(`Acceso activado: ${school.name}`);
      
      // Navigate to school dashboard
      const subdomain = school.subdomain;
      navigate(`/${subdomain}/dashboard`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cambiar de colegio");
    } finally {
      setSwitching(null);
    }
  };

  const handleAssign = async (schoolId) => {
    setAssigning(schoolId);
    try {
      await axios.post(`${API}/support/assign-school`, 
        { school_id: schoolId }, { headers }
      );
      toast.success("Colegio asignado correctamente");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al asignar colegio");
    } finally {
      setAssigning(null);
    }
  };

  const handleUnassign = async (schoolId) => {
    try {
      await axios.delete(`${API}/support/unassign-school/${schoolId}`, { headers });
      toast.success("Acceso removido");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al remover acceso");
    }
  };

  const handleDeleteSchool = async (schoolId, schoolName) => {
    const confirmed = window.prompt(`Para eliminar "${schoolName}" permanentemente, escribe ELIMINAR:`);
    if (confirmed !== "ELIMINAR") {
      if (confirmed !== null) toast.error("Debes escribir ELIMINAR exactamente");
      return;
    }
    try {
      const res = await axios.delete(`${API}/support/delete-school/${schoolId}`, { headers });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar colegio");
    }
  };

  const handleRegisterPayment = async () => {
    if (!payModal || !payDate) return;
    setPaying(true);
    try {
      const res = await axios.post(`${API}/support/register-payment`, {
        school_id: payModal.schoolId,
        amount: payModal.amount,
        payment_date: payDate,
      }, { headers });
      toast.success(res.data.message || "Pago registrado");
      setPayModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al registrar pago");
    } finally { setPaying(false); }
  };

  const handleOpenOwner = async (school) => {
    setOwnerModal({ schoolId: school.id, schoolName: school.name || school.subdomain });
    setOwnerEditing(false);
    setOwnerData(null);
    setOwnerLoading(true);
    setOwnerShowPwd(false);
    try {
      const res = await axios.get(`${API}/support/school-owner/${school.id}`, { headers });
      setOwnerData(res.data);
      setOwnerForm({
        name: res.data.name || "",
        school_display_name: res.data.school_display_name || "",
        email: res.data.email || "",
        ruc: res.data.ruc || "",
        whatsapp: (res.data.whatsapp || "").replace("+51", ""),
        password: res.data.plain_password || "",
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cargar datos del titular");
      setOwnerModal(null);
    } finally {
      setOwnerLoading(false);
    }
  };

  const handleSaveOwner = async () => {
    if (!ownerModal) return;
    setOwnerSaving(true);
    try {
      const res = await axios.put(`${API}/support/school-owner/${ownerModal.schoolId}`, ownerForm, { headers });
      toast.success(res.data.message || "Datos actualizados");
      setOwnerData(res.data.owner);
      setOwnerEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setOwnerSaving(false);
    }
  };


  const handleSaveExpiration = async (schoolId) => {
    if (!newExpDate) return;
    try {
      // Send as noon UTC to avoid timezone shifting the date
      await axios.put(`${API}/support/school-expiration`, {
        school_id: schoolId,
        expiration_date: `${newExpDate}T12:00:00.000Z`
      }, { headers });
      toast.success("Fecha de vencimiento actualizada");
      setEditingExpiration(null);
      setNewExpDate("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    }
  };

  const handleOpenPricing = async (school) => {
    if (editingPricing === school.id) { setEditingPricing(null); return; }
    setEditingPricing(school.id);
    const ov = school.pricing_override || {};
    setPricingForm({
      billing_mode: ov.billing_mode ?? "",
      base_monthly_fee: ov.base_monthly_fee ?? "",
      per_student_fee: ov.per_student_fee ?? "",
      per_student_from_month: ov.per_student_from_month ?? "",
      flat_fee: ov.flat_fee ?? "",
      discount_notes: ov.discount_notes ?? ""
    });
    try {
      const res = await axios.get(`${API}/support/school-pricing/${school.id}`, { headers });
      setPricingInfo(prev => ({ ...prev, [school.id]: res.data }));
    } catch {}
  };

  const handleSavePricing = async (schoolId) => {
    try {
      const payload = { school_id: schoolId };
      if (pricingForm.billing_mode) payload.billing_mode = pricingForm.billing_mode;
      if (pricingForm.base_monthly_fee !== "") payload.base_monthly_fee = parseFloat(pricingForm.base_monthly_fee);
      if (pricingForm.per_student_fee !== "") payload.per_student_fee = parseFloat(pricingForm.per_student_fee);
      if (pricingForm.per_student_from_month !== "") payload.per_student_from_month = parseInt(pricingForm.per_student_from_month);
      if (pricingForm.flat_fee !== "") payload.flat_fee = parseFloat(pricingForm.flat_fee);
      if (pricingForm.discount_notes) payload.discount_notes = pricingForm.discount_notes;
      await axios.put(`${API}/support/school-pricing`, payload, { headers });
      toast.success("Precio personalizado guardado");
      setEditingPricing(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    }
  };

  const handleDeletePricing = async (schoolId) => {
    try {
      await axios.delete(`${API}/support/school-pricing/${schoolId}`, { headers });
      toast.success("Precio personalizado eliminado");
      setEditingPricing(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    }
  };

  const handleRenewMembership = async (schoolId, schoolName) => {
    const school = mySchools.find(s => s.id === schoolId);
    let pendingPayment = null;
    try {
      const res = await axios.get(`${API}/support/payment-requests`, { headers });
      pendingPayment = res.data.find(p => p.school_id === schoolId && p.status === "processing");
    } catch {}
    setRenewModal({
      schoolId,
      schoolName,
      price: school?.calculated_price || 0,
      clientCode: pendingPayment?.operation_code || "",
      paymentMethod: pendingPayment?.payment_method || "",
      paymentDate: pendingPayment?.created_at || "",
    });
    setRenewCode(pendingPayment?.operation_code || "");
  };

  const handleConfirmRenewal = async () => {
    if (!renewModal) return;
    if (renewCode.length !== 8 || !/^\d{8}$/.test(renewCode)) {
      toast.error("El codigo debe tener exactamente 8 digitos");
      return;
    }
    setRenewing(true);
    try {
      const res = await axios.post(`${API}/support/renew-membership`, {
        school_id: renewModal.schoolId,
        operation_code: renewCode
      }, { headers });
      toast.success(res.data.message || "Membresia renovada");
      setRenewModal(null);
      setRenewCode("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al renovar");
    } finally {
      setRenewing(false);
    }
  };

  const openCreateModal = async () => {
    setShowCreateSchool(true);
    try {
      const res = await axios.get(`${API}/support/pricing`, { headers });
      setGlobalPrice(res.data.base_monthly_fee ?? 0);
    } catch { setGlobalPrice(0); }
  };

  const handleCreateSchool = async () => {
    const { school_name, subdomain, owner_name, owner_email, owner_password, owner_ruc, owner_whatsapp } = createForm;
    if (!school_name || !subdomain || !owner_name || !owner_email || !owner_password || !owner_ruc || !owner_whatsapp) {
      toast.error("Todos los campos son obligatorios");
      return;
    }
    if (owner_password.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres");
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/support/create-school`, createForm, { headers });
      toast.success(res.data.message || "Colegio creado");
      setShowCreateSchool(false);
      setCreateForm({ school_name: "", subdomain: "", owner_name: "", owner_email: "", owner_password: "", owner_ruc: "", owner_whatsapp: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear colegio");
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-PE", { 
      day: "numeric", month: "short", year: "numeric" 
    });
  };

  const getExpirationInfo = (expDate) => {
    if (!expDate) return { text: "Sin fecha", color: "text-slate-400", isExpired: false };
    const now = new Date();
    const exp = new Date(expDate);
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: `Vencido hace ${Math.abs(diffDays)} dias`, color: "text-red-500", isExpired: true };
    if (diffDays <= 7) return { text: `Vence en ${diffDays} dias`, color: "text-amber-500", isExpired: false };
    return { text: formatDate(expDate), color: "text-slate-500", isExpired: false };
  };

  const unassignedSchools = allSchools.filter(s => 
    !s.is_assigned && 
    (s.name || s.subdomain || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="support-schools-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Mis Colegios</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mySchools.length} colegio{mySchools.length !== 1 ? "s" : ""} asignado{mySchools.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openCreateModal()}
            data-testid="create-school-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Building2 className="w-4 h-4" />
            Crear Colegio
          </button>
        </div>
      </div>

      {/* School cards */}
      {mySchools.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-600 mb-1">Sin colegios asignados</h3>
          <p className="text-sm text-slate-400">Usa el boton "Crear Colegio" para registrar un nuevo colegio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mySchools.map(school => (
            <div 
              key={school.id} 
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
              data-testid={`school-card-${school.subdomain}`}
            >
              {/* Card header */}
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    {school.logo_url ? (
                      <img src={school.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <School className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-800 truncate">{school.name || school.subdomain}</h3>
                    <p className="text-xs text-slate-400">{school.subdomain}.edunet.pe</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenOwner(school); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex-shrink-0"
                    title="Ver datos del titular"
                    data-testid={`owner-btn-${school.subdomain}`}
                  >
                    <UserCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-lg font-bold text-slate-700">{school.total_users || 0}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Usuarios</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{school.student_count || 0}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Alumnos</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-600">{school.teacher_count || 0}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Docentes</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">Creado: {formatDate(school.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className={`w-3 h-3 ${getExpirationInfo(school.expiration_date).color}`} />
                    <span className={`text-xs font-medium ${getExpirationInfo(school.expiration_date).color}`}>
                      Vence: {getExpirationInfo(school.expiration_date).text}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingExpiration(editingExpiration === school.id ? null : school.id);
                        setNewExpDate(school.expiration_date ? school.expiration_date.split("T")[0] : "");
                      }}
                      className="ml-auto p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      data-testid={`edit-expiration-${school.subdomain}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  {getExpirationInfo(school.expiration_date).isExpired && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <p className="text-[10px] text-red-600 font-semibold">Plan vencido</p>
                    </div>
                  )}
                  {editingExpiration === school.id && (
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={newExpDate}
                        onChange={(e) => setNewExpDate(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                        data-testid={`expiration-input-${school.subdomain}`}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveExpiration(school.id); }}
                        className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
                        data-testid={`save-expiration-${school.subdomain}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingExpiration(null); }}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Subscription Status */}
                <div className={`rounded-xl p-2.5 flex items-center justify-between ${
                  school.plan_estado === "ACTIVO" ? "bg-emerald-50 border border-emerald-200" :
                  school.plan_estado === "AVISO_VENCIMIENTO" ? "bg-amber-50 border border-amber-200" :
                  school.plan_estado === "RESTRICCION_PARCIAL" ? "bg-orange-50 border border-orange-200" :
                  school.plan_estado === "PAGO_OBLIGATORIO" ? "bg-red-50 border border-red-200" :
                  school.plan_estado === "PAGO_EN_VERIFICACION" ? "bg-blue-50 border border-blue-200" :
                  school.plan_estado === "SUSPENDIDO" ? "bg-slate-100 border border-slate-300" :
                  "bg-emerald-50 border border-emerald-200"
                }`} data-testid={`sub-status-${school.subdomain}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      school.plan_estado === "ACTIVO" ? "bg-emerald-500" :
                      school.plan_estado === "AVISO_VENCIMIENTO" ? "bg-amber-500" :
                      school.plan_estado === "RESTRICCION_PARCIAL" ? "bg-orange-500" :
                      school.plan_estado === "PAGO_OBLIGATORIO" ? "bg-red-500" :
                      school.plan_estado === "PAGO_EN_VERIFICACION" ? "bg-blue-500 animate-pulse" :
                      school.plan_estado === "SUSPENDIDO" ? "bg-slate-500" :
                      "bg-emerald-500"
                    }`} />
                    <span className="text-xs font-bold text-slate-700">
                      {school.plan_estado === "ACTIVO" ? "Activo" :
                       school.plan_estado === "AVISO_VENCIMIENTO" ? "Vencido" :
                       school.plan_estado === "RESTRICCION_PARCIAL" ? "Restringido" :
                       school.plan_estado === "PAGO_OBLIGATORIO" ? "Pago obligatorio" :
                       school.plan_estado === "PAGO_EN_VERIFICACION" ? "Pago en verificacion" :
                       school.plan_estado === "SUSPENDIDO" ? "Suspendido" :
                       "Activo"}
                    </span>
                    {school.dias_vencido > 0 && (
                      <span className="text-[10px] text-red-600 font-semibold">({school.dias_vencido}d vencido)</span>
                    )}
                  </div>
                  {school.has_pending_payment && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">Pago pendiente</span>
                  )}
                </div>

                {/* Pricing Summary */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-800">Pago Mensual</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {school.pricing_override ? (
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Personalizado</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Global</span>
                      )}
                      <span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded">
                        {school.billing_mode === "flat_fee" ? "Fijo" : school.billing_mode === "student_only" ? "x Alumno" : "Base+Alumno"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenPricing(school); }}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded transition-colors"
                        data-testid={`edit-pricing-${school.subdomain}`}
                      >
                        <Tag className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-extrabold text-slate-800" data-testid={`price-${school.subdomain}`}>
                        S/ {(school.calculated_price ?? 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {school.billing_mode === "flat_fee" ? (
                          <>Tarifa fija mensual</>
                        ) : school.billing_mode === "student_only" ? (
                          school.per_student_applies ? (
                            <>{school.student_count || 0} alumnos x S/ {(school.per_student_fee ?? 0).toFixed(2)}</>
                          ) : (
                            <>Sin cobro por alumno aun</>
                          )
                        ) : (
                          school.per_student_applies ? (
                            <>S/ {(school.base_charge ?? 0).toFixed(2)} base + {school.student_count || 0} alumnos x S/ {(school.per_student_fee ?? 0).toFixed(2)}</>
                          ) : (
                            <>S/ {(school.base_charge ?? 0).toFixed(2)} base (sin cobro por alumno aun)</>
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Mes {school.months_active || 1}</p>
                      {school.billing_mode !== "flat_fee" && !school.per_student_applies && school.per_student_from_month && (
                        <p className="text-[10px] text-amber-600 font-medium">
                          Cobro/alumno desde mes {school.per_student_from_month}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Projection for non-flat modes */}
                  {school.billing_mode !== "flat_fee" && !school.per_student_applies && school.student_count > 0 && (
                    <div className="border-t border-emerald-200 pt-2 mt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-500 font-medium">Desde mes {school.per_student_from_month}:</p>
                        <p className="text-sm font-extrabold text-amber-700" data-testid={`projected-price-${school.subdomain}`}>
                          S/ {((school.billing_mode === "student_only" ? 0 : (school.base_charge ?? 0)) + (school.student_count ?? 0) * (school.per_student_fee ?? 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {editingPricing === school.id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Precio personalizado</p>
                    {pricingInfo[school.id] && (
                      <div className="bg-white rounded-lg px-2.5 py-1.5 text-[10px] text-slate-500">
                        Global: {pricingInfo[school.id].global?.billing_mode === "flat_fee" ? `Fijo S/${pricingInfo[school.id].global?.flat_fee}` : pricingInfo[school.id].global?.billing_mode === "student_only" ? `S/${pricingInfo[school.id].global?.per_student_fee}/alumno` : `S/${pricingInfo[school.id].global?.base_monthly_fee} base + S/${pricingInfo[school.id].global?.per_student_fee}/alumno`}
                        {pricingInfo[school.id].student_count > 0 && ` | ${pricingInfo[school.id].student_count} alumnos | Mes ${pricingInfo[school.id].months_active}`}
                      </div>
                    )}

                    {/* Billing Mode Selector */}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Modo de facturacion</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "base_plus_student", label: "Base+Alumno" },
                          { id: "student_only", label: "Solo Alumno" },
                          { id: "flat_fee", label: "Tarifa Fija" }
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={(e) => { e.stopPropagation(); setPricingForm({...pricingForm, billing_mode: m.id}); }}
                            data-testid={`school-mode-${m.id}`}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${
                              pricingForm.billing_mode === m.id
                                ? "border-blue-500 bg-blue-100 text-blue-700"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {!pricingForm.billing_mode && <p className="text-[9px] text-slate-400 mt-0.5">Vacio = usar modo global</p>}
                    </div>

                    {/* Flat Fee Input */}
                    {pricingForm.billing_mode === "flat_fee" && (
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Tarifa fija mensual</label>
                        <div className="relative">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">S/</span>
                          <input type="number" step="0.01" value={pricingForm.flat_fee} onChange={(e) => setPricingForm({...pricingForm, flat_fee: e.target.value})} placeholder="Global" className="w-full pl-6 pr-1.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" data-testid="school-flat-fee-input" />
                        </div>
                      </div>
                    )}

                    {/* Base + Student Fields */}
                    {pricingForm.billing_mode !== "flat_fee" && (
                      <div className="grid grid-cols-3 gap-2">
                        {pricingForm.billing_mode !== "student_only" && (
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Base mensual</label>
                            <div className="relative">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">S/</span>
                              <input type="number" step="0.01" value={pricingForm.base_monthly_fee} onChange={(e) => setPricingForm({...pricingForm, base_monthly_fee: e.target.value})} placeholder="Global" className="w-full pl-6 pr-1.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Por alumno</label>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">S/</span>
                            <input type="number" step="0.01" value={pricingForm.per_student_fee} onChange={(e) => setPricingForm({...pricingForm, per_student_fee: e.target.value})} placeholder="Global" className="w-full pl-6 pr-1.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Desde mes</label>
                          <input type="number" min="1" value={pricingForm.per_student_from_month} onChange={(e) => setPricingForm({...pricingForm, per_student_from_month: e.target.value})} placeholder="Global" className="w-full px-1.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" />
                        </div>
                      </div>
                    )}

                    <input type="text" value={pricingForm.discount_notes} onChange={(e) => setPricingForm({...pricingForm, discount_notes: e.target.value})} placeholder="Nota (ej: Descuento promocional)" className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" />
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); handleSavePricing(school.id); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1" data-testid="save-school-pricing-btn">
                        <Check className="w-3 h-3" /> Guardar
                      </button>
                      {school.pricing_override && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePricing(school.id); }} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                          Usar global
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setEditingPricing(null); }} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs hover:bg-slate-200 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRenewMembership(school.id, school.name || school.subdomain); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-700 transition-colors whitespace-nowrap"
                    data-testid={`renew-membership-${school.subdomain}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Renovar
                  </button>
                  <button
                    onClick={() => handleSwitch(school.id)}
                    disabled={switching === school.id}
                    data-testid={`enter-school-${school.subdomain}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0a1628] text-white rounded-xl text-sm font-semibold hover:bg-[#162544] transition-colors disabled:opacity-60"
                  >
                    {switching === school.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Entrar
                  </button>
                  {school.missing_payment && (
                    <button
                      onClick={() => { setPayModal({ schoolId: school.id, schoolName: school.name || school.subdomain, amount: school.calculated_price, baseCharge: school.base_charge, studentCharge: school.student_charge, studentCount: school.student_count }); setPayDate(new Date().toISOString().slice(0, 10)); }}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
                      data-testid={`pay-school-${school.subdomain}`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Pagar
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSchool(school.id, school.name || school.subdomain)}
                    className="px-3 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                    data-testid={`delete-school-${school.subdomain}`}
                    title="Eliminar colegio permanentemente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create School Modal */}
      {showCreateSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="create-school-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden" data-testid="create-school-modal">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Crear Nuevo Colegio</h3>
                <p className="text-white/70 text-xs mt-0.5">Crea la cuenta del colegio y su propietario</p>
              </div>
              <button onClick={() => setShowCreateSchool(false)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* School info section */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos del Colegio</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Colegio <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createForm.school_name}
                      onChange={e => setCreateForm(f => ({ ...f, school_name: e.target.value }))}
                      placeholder="Ej: I.E.P. Los Andes"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      data-testid="create-school-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Subdominio <span className="text-red-500">*</span></label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={createForm.subdomain}
                        onChange={e => setCreateForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))}
                        placeholder="losandes"
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                        data-testid="create-school-subdomain"
                      />
                      <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-xs text-slate-500 whitespace-nowrap">.edunet.pe</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">RUC <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createForm.owner_ruc}
                      onChange={e => setCreateForm(f => ({ ...f, owner_ruc: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                      placeholder="Ej: 20123456789"
                      maxLength={11}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      data-testid="create-owner-ruc"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp <span className="text-red-500">*</span></label>
                    <div className="flex items-center">
                      <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-500 whitespace-nowrap">+51</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={createForm.owner_whatsapp}
                        onChange={e => setCreateForm(f => ({ ...f, owner_whatsapp: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                        maxLength={9}
                        placeholder="999 999 999"
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                        data-testid="create-owner-whatsapp"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pago mensual</label>
                    <div className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-semibold" data-testid="create-school-amount">
                      S/ {globalPrice !== null ? globalPrice.toFixed(2) : "..."}
                      <span className="text-xs font-normal text-slate-400 ml-2">(segun configuracion de Precios)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner info section */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos del Propietario</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createForm.owner_name}
                      onChange={e => setCreateForm(f => ({ ...f, owner_name: e.target.value }))}
                      placeholder="Ej: Juan Perez"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      data-testid="create-owner-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Email del propietario <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={createForm.owner_email}
                      onChange={e => setCreateForm(f => ({ ...f, owner_email: e.target.value }))}
                      placeholder="director@colegio.pe"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      data-testid="create-owner-email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Contrasena temporal <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={createForm.owner_password}
                        onChange={e => setCreateForm(f => ({ ...f, owner_password: e.target.value }))}
                        placeholder="Minimo 6 caracteres"
                        className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                        data-testid="create-owner-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateSchool(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                  data-testid="create-school-cancel"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSchool}
                  disabled={creating || !createForm.school_name || !createForm.subdomain || !createForm.owner_name || !createForm.owner_email || !createForm.owner_password || !createForm.owner_ruc || !createForm.owner_whatsapp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="create-school-submit"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  Crear Colegio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal (restoration) */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="pay-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" data-testid="pay-modal">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Registrar Pago</h3>
                <p className="text-white/70 text-xs mt-0.5">Restauracion de pago eliminado</p>
              </div>
              <button onClick={() => setPayModal(null)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* School info */}
              <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <School className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{payModal.schoolName}</p>
                  <p className="text-lg font-bold text-emerald-600">S/ {payModal.amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between"><span>Cargo base</span><span className="font-medium text-slate-700">S/ {payModal.baseCharge?.toFixed(2) ?? "0.00"}</span></div>
                {payModal.studentCharge > 0 && (
                  <div className="flex justify-between"><span>Cargo por alumnos ({payModal.studentCount})</span><span className="font-medium text-slate-700">S/ {payModal.studentCharge.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-emerald-600">S/ {payModal.amount.toFixed(2)}</span></div>
              </div>

              {/* Date selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Fecha del pago</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  data-testid="pay-date-input"
                />
                <p className="text-[10px] text-slate-400 mt-1">Selecciona la fecha correspondiente al pago. Puede ser de un mes anterior.</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setPayModal(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  disabled={paying || !payDate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="pay-modal-confirm"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  Registrar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {renewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="renew-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" data-testid="renew-modal">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Renovar Membresia</h3>
                <p className="text-white/70 text-xs mt-0.5">Verificacion de pago Yape/Plin</p>
              </div>
              <button
                onClick={() => setRenewModal(null)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                data-testid="renew-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <School className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{renewModal.schoolName}</p>
                  <p className="text-xs text-slate-500">Monto: <span className="font-bold text-emerald-600">S/ {renewModal.price.toFixed(2)}</span></p>
                </div>
              </div>
              {renewModal.clientCode ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Codigo enviado por el cliente</label>
                  <div className="w-full px-4 py-3 bg-violet-50 border-2 border-violet-300 rounded-xl text-center text-2xl font-bold tracking-[0.3em] text-violet-700">
                    {renewModal.clientCode}
                  </div>
                  <p className="text-xs mt-1.5 text-slate-400">Verifica que este codigo coincida con tu registro de Yape</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Numero de operacion <span className="text-red-500">*</span></label>
                  <p className="text-xs text-slate-400 mb-2">No hay pago pendiente. Ingresa el codigo manualmente.</p>
                  <input
                    type="text" inputMode="numeric" maxLength={8} value={renewCode}
                    onChange={(e) => setRenewCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="Ej: 12345678"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-2xl font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                    data-testid="renew-operation-code-input" autoFocus
                  />
                  <p className={`text-xs mt-1.5 text-right font-medium ${renewCode.length === 8 ? "text-emerald-500" : "text-slate-400"}`}>{renewCode.length}/8 digitos</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setRenewModal(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors" data-testid="renew-modal-cancel">Cancelar</button>
                <button onClick={handleConfirmRenewal} disabled={renewCode.length !== 8 || renewing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-testid="renew-modal-confirm">
                  {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar Renovacion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owner/Titular Modal */}
      {ownerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="owner-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col overflow-hidden" data-testid="owner-modal">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">Titular de la Cuenta</h3>
                <p className="text-white/70 text-xs mt-0.5">{ownerModal.schoolName}</p>
              </div>
              <button
                onClick={() => { setOwnerModal(null); setOwnerEditing(false); }}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                data-testid="owner-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {ownerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : ownerData ? (
                <>
                  {!ownerEditing ? (
                    /* View mode */
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <UserCircle className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800" data-testid="owner-display-name">
                            {ownerData.name}
                          </p>
                          <p className="text-xs text-slate-400">Propietario</p>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                          <School className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-medium">Nombre del Colegio</p>
                            <p className="text-sm text-slate-700 truncate" data-testid="owner-display-school">{ownerData.school_display_name || "No registrado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-medium">Email</p>
                            <p className="text-sm text-slate-700 truncate" data-testid="owner-display-email">{ownerData.email || "No registrado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                          <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-medium">RUC</p>
                            <p className="text-sm text-slate-700" data-testid="owner-display-ruc">{ownerData.ruc || "No registrado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 font-medium">WhatsApp</p>
                            <p className="text-sm text-slate-700" data-testid="owner-display-whatsapp">{ownerData.whatsapp || "No registrado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                          <button
                            onClick={() => setOwnerShowPwd(!ownerShowPwd)}
                            className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0"
                            data-testid="owner-view-toggle-pwd"
                          >
                            {ownerShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-amber-500 font-medium">Contrasena actual</p>
                            {ownerData.plain_password ? (
                              <p className="text-sm text-slate-700 font-mono" data-testid="owner-display-password">
                                {ownerShowPwd ? ownerData.plain_password : "••••••••"}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-400 italic" data-testid="owner-display-password">No disponible (asigne una nueva)</p>
                            )}
                          </div>
                        </div>
                        {ownerData.created_at && (
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Registrado</p>
                              <p className="text-sm text-slate-700">{formatDate(ownerData.created_at)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setOwnerEditing(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors mt-2"
                        data-testid="owner-edit-btn"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar datos
                      </button>
                    </div>
                  ) : (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={ownerForm.name}
                          onChange={(e) => setOwnerForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          data-testid="owner-edit-name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Colegio</label>
                        <input
                          type="text"
                          value={ownerForm.school_display_name}
                          onChange={(e) => setOwnerForm(f => ({ ...f, school_display_name: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          data-testid="owner-edit-school"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={ownerForm.email}
                          onChange={(e) => setOwnerForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          data-testid="owner-edit-email"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">RUC</label>
                        <input
                          type="text"
                          value={ownerForm.ruc}
                          onChange={(e) => setOwnerForm(f => ({ ...f, ruc: e.target.value }))}
                          placeholder="Ej: 20123456789"
                          maxLength={11}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          data-testid="owner-edit-ruc"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp</label>
                        <div className="flex items-center">
                          <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-500 whitespace-nowrap">+51</span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={ownerForm.whatsapp}
                            onChange={(e) => setOwnerForm(f => ({ ...f, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                            maxLength={9}
                            placeholder="999 999 999"
                            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            data-testid="owner-edit-whatsapp"
                          />
                        </div>
                      </div>

                      {/* Password field with strength indicator */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Contrasena</label>
                        <div className="relative">
                          <input
                            type={ownerShowPwd ? "text" : "password"}
                            value={ownerForm.password}
                            onChange={(e) => setOwnerForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Ingrese nueva contrasena"
                            className="w-full px-3 py-2.5 pr-20 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            data-testid="owner-edit-password"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOwnerShowPwd(!ownerShowPwd)}
                              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                              title={ownerShowPwd ? "Ocultar" : "Mostrar"}
                            >
                              {ownerShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={generatePassword}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Generar clave segura"
                              data-testid="owner-generate-pwd"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {ownerForm.password && (() => {
                          const s = getPasswordStrength(ownerForm.password);
                          return s ? (
                            <div className="mt-1.5 space-y-1">
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${s.color} rounded-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />
                              </div>
                              <p className={`text-[10px] font-semibold ${s.text}`}>{s.label}</p>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => {
                            setOwnerEditing(false);
                            setOwnerForm({
                              name: ownerData.name || "",
                              school_display_name: ownerData.school_display_name || "",
                              email: ownerData.email || "",
                              ruc: ownerData.ruc || "",
                              whatsapp: (ownerData.whatsapp || "").replace("+51", ""),
                              password: ownerData.plain_password || "",
                            });
                          }}
                          className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                          data-testid="owner-edit-cancel"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveOwner}
                          disabled={ownerSaving}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                          data-testid="owner-edit-save"
                        >
                          {ownerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
