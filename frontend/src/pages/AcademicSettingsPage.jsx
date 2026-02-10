import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { 
  BookMarked, GraduationCap, Calendar, Clock, Building2,
  Plus, Pencil, Trash2, MoreVertical, Loader2, Check, X,
  BookOpen, Users, ChevronRight
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Academic settings categories
const ACADEMIC_CATEGORIES = [
  {
    id: "niveles",
    label: "Niveles Educativos",
    description: "Inicial, Primaria, Secundaria",
    icon: GraduationCap,
    color: "from-blue-500 to-indigo-600",
    lightColor: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  {
    id: "grados",
    label: "Grados",
    description: "1°, 2°, 3°, 4°, 5°, 6°",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-600",
    lightColor: "from-emerald-50 to-teal-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-100"
  },
  {
    id: "secciones",
    label: "Secciones",
    description: "A, B, C, D",
    icon: Users,
    color: "from-purple-500 to-pink-600",
    lightColor: "from-purple-50 to-pink-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  {
    id: "turnos",
    label: "Turnos",
    description: "Mañana, Tarde, Noche",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
    lightColor: "from-amber-50 to-orange-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-600",
    bgColor: "bg-amber-100"
  },
  {
    id: "periodos",
    label: "Períodos Académicos",
    description: "Bimestres, Trimestres, Semestres",
    icon: Calendar,
    color: "from-rose-500 to-red-600",
    lightColor: "from-rose-50 to-red-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-600",
    bgColor: "bg-rose-100"
  }
];

export default function AcademicSettingsPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        setSettings(res.data);
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const schoolName = settings?.system_name || user?.name || "Mi Colegio";
  const logoUrl = settings?.logo_url;

  const handleCategoryClick = (categoryId) => {
    // Future: navigate to specific category page
    console.log("Category clicked:", categoryId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="academic-settings-page">
      <Sidebar
        active="ajustes-academicos"
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

        <main className="flex-1 overflow-y-auto custom-scroll p-6 lg:p-8">
          {/* Page Header Banner */}
          <div className="relative overflow-hidden rounded-3xl mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full"></div>
            </div>

            <div className="relative px-8 py-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <BookMarked className="w-10 h-10 text-indigo-600" />
                </div>

                <div className="text-white flex-1">
                  <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Ajustes Académicos
                  </h1>
                  <p className="text-indigo-200 text-lg">
                    Configura la estructura académica de tu institución
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {ACADEMIC_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 ${category.borderColor} bg-gradient-to-br ${category.lightColor}`}
                  data-testid={`category-${category.id}`}
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  
                  {/* Decorative circles */}
                  <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${category.color} opacity-10`} />
                  <div className={`absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-gradient-to-br ${category.color} opacity-10`} />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon container */}
                    <div className="flex justify-center mb-4">
                      <div className={`w-20 h-20 rounded-2xl bg-white shadow-lg p-4 group-hover:shadow-xl transition-all duration-300 border-2 ${category.borderColor}`}>
                        <Icon className={`w-full h-full ${category.textColor}`} />
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`text-xl font-bold text-center mb-2 ${category.textColor}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {category.label}
                    </h3>

                    {/* Description badge */}
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border ${category.borderColor} ${category.textColor} font-medium text-sm`}>
                        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${category.color}`}></span>
                        {category.description}
                      </span>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex justify-center mt-4">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0`}>
                        <ChevronRight className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <BookMarked className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Configura tu estructura académica
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Los ajustes académicos te permiten definir los niveles educativos, grados, secciones, turnos y períodos 
                  académicos de tu institución. Esta configuración es fundamental para organizar estudiantes, docentes y 
                  el calendario escolar de manera eficiente.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
