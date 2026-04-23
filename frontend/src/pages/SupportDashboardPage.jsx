import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  School, Users, TrendingUp, ArrowRight, 
  Calendar, Building2, Headset, ChevronLeft, ChevronRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group ${onClick ? "hover:scale-[1.02]" : ""}`}
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {onClick && (
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value ?? "..."}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function SupportDashboardPage({ token }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schoolsPage, setSchoolsPage] = useState(1);
  const [schoolsPaginated, setSchoolsPaginated] = useState(null);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await axios.get(`${API}/support/overview`, { headers });
        setData(res.data);
      } catch (err) {
        console.error("Error fetching support overview:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [token]);

  const fetchSchoolsPage = useCallback(async (page) => {
    setSchoolsLoading(true);
    try {
      const res = await axios.get(`${API}/support/schools-paginated?page=${page}&per_page=5`, { headers });
      setSchoolsPaginated(res.data);
      setSchoolsPage(page);
    } catch (err) {
      console.error("Error fetching schools page:", err);
    } finally {
      setSchoolsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchSchoolsPage(1);
  }, [token]);

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-PE", { 
      day: "numeric", month: "short", year: "numeric" 
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="support-dashboard">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#0a1628] to-[#162544] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Headset className="w-6 h-6 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-semibold tracking-wide">PANEL DE SOPORTE</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">Bienvenido al Centro de Soporte</h1>
          <p className="text-slate-400 text-sm lg:text-base max-w-xl">
            Gestiona el acceso a los colegios, revisa metricas globales y proporciona soporte técnico desde aquí.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Building2}
          label="Colegios Totales"
          value={data?.total_schools}
          color="bg-blue-500"
        />
        <StatCard
          icon={School}
          label="Mis Colegios Asignados"
          value={data?.my_assigned_schools}
          color="bg-emerald-500"
          onClick={() => navigate("/support/schools")}
        />
        <StatCard
          icon={Users}
          label="Usuarios Globales"
          value={data?.total_users_global}
          color="bg-violet-500"
        />
      </div>

      {/* Recent Schools - Paginated */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Últimos Colegios Registrados</h2>
            {schoolsPaginated && (
              <span className="text-xs text-slate-400 ml-1">({schoolsPaginated.total} total)</span>
            )}
          </div>
          <button 
            onClick={() => navigate("/support/schools")}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            data-testid="go-to-schools-btn"
          >
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {loading || schoolsLoading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : schoolsPaginated?.schools?.length > 0 ? (
          <>
            <div className="divide-y divide-slate-50">
              {schoolsPaginated.schools.map((school, i) => (
                <div key={school.id || i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <School className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {school.name || school.subdomain}
                    </p>
                    <p className="text-xs text-slate-400">{school.subdomain}.edunet.pe</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(school.created_at)}
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            {schoolsPaginated.total_pages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Página {schoolsPaginated.page} de {schoolsPaginated.total_pages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchSchoolsPage(schoolsPage - 1)}
                    disabled={schoolsPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="schools-page-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchSchoolsPage(schoolsPage + 1)}
                    disabled={schoolsPage >= schoolsPaginated.total_pages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="schools-page-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">No hay colegios registrados</div>
        )}
      </div>
    </div>
  );
}
