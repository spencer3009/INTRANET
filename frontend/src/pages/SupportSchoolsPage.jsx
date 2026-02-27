import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  School, Users, GraduationCap, BookOpen, LogIn, 
  Plus, Search, X, Check, AlertCircle, Building2,
  ArrowLeft, Loader2
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

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-PE", { 
      day: "numeric", month: "short", year: "numeric" 
    });
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

                {/* Date */}
                <p className="text-xs text-slate-400">
                  Creado: {formatDate(school.created_at)}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
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
                  >
                    <X className="w-4 h-4" />
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
