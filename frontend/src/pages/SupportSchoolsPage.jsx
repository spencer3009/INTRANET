import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  School, Users, GraduationCap, BookOpen, LogIn, 
  Plus, Search, X, Check, AlertCircle, Building2,
  ArrowLeft, Loader2, Calendar, CalendarClock, Pencil, DollarSign, Tag, RefreshCw, Trash2
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
    if (!window.confirm(`Renovar membresia de "${schoolName}" por 30 dias?`)) return;
    try {
      const res = await axios.post(`${API}/support/renew-membership`, { school_id: schoolId }, { headers });
      toast.success(res.data.message || "Membresia renovada");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al renovar");
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
        <button
          onClick={() => setShowAssign(!showAssign)}
          data-testid="assign-school-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Asignar Colegio
        </button>
      </div>

      {/* Assign modal */}
      {showAssign && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Asignar Nuevo Colegio</h3>
            <button onClick={() => setShowAssign(false)} className="p-1 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colegio..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              data-testid="search-schools-input"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {unassignedSchools.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {search ? "No se encontraron colegios" : "Todos los colegios ya estan asignados"}
              </p>
            ) : (
              unassignedSchools.map(school => (
                <div key={school.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <School className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{school.name || school.subdomain}</p>
                      <p className="text-xs text-slate-400">{school.subdomain}.edunet.pe</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(school.id)}
                    disabled={assigning === school.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {assigning === school.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Asignar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* School cards */}
      {mySchools.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-600 mb-1">Sin colegios asignados</h3>
          <p className="text-sm text-slate-400">Usa el boton "Asignar Colegio" para agregar acceso a un colegio.</p>
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
                  <button
                    onClick={() => handleUnassign(school.id)}
                    className="px-3 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                    data-testid={`unassign-school-${school.subdomain}`}
                    title="Quitar asignacion"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
    </div>
  );
}
