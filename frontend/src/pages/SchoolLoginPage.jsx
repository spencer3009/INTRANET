import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, GraduationCap, ArrowLeft, Building2, Loader2, AtSign } from "lucide-react";
import InstallGateway from "../components/InstallGateway";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

export default function SchoolLoginPage({ onLogin }) {
  const { subdomain } = useParams();
  const navigate = useNavigate();
  
  // School info state
  const [school, setSchool] = useState(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolError, setSchoolError] = useState("");
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch school info on mount
  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const res = await axios.get(`${API}/schools/public/${subdomain}`);
        setSchool(res.data);
      } catch (err) {
        setSchoolError(err.response?.data?.detail || "Colegio no encontrado");
      } finally {
        setLoadingSchool(false);
      }
    };
    
    if (subdomain) {
      fetchSchool();
    }
  }, [subdomain]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { token, user, redirect_to_support } = res.data;
      
      // Global support user -> redirect to /support
      if (redirect_to_support || user.role === "system_admin_global" || user.is_support_global) {
        onLogin(token, user);
        navigate("/support");
        return;
      }
      
      // Verify user belongs to this school
      if (user.subdomain && user.subdomain !== subdomain) {
        setError(`Esta cuenta pertenece a ${user.subdomain}.${BASE_DOMAIN}`);
        setLoading(false);
        return;
      }
      
      // Save to state
      onLogin(token, user);
      
      // Save last school for PWA auto-redirect
      if (subdomain) {
        localStorage.setItem('edunet_last_school', subdomain);
      }
      
      // Navigate to school's dashboard
      if (user.subdomain) {
        navigate(`/${user.subdomain}/dashboard`);
      } else if (user.email_verified) {
        navigate("/onboarding");
      } else {
        navigate("/verify-email");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loadingSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068]">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  // School not found
  if (schoolError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Colegio no encontrado</h1>
          <p className="text-blue-200/60 mb-8">
            El colegio "{subdomain}.{BASE_DOMAIN}" no existe o ha sido desactivado.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al login general
          </Link>
        </div>
      </div>
    );
  }

  // Get school colors (with fallbacks)
  const primaryColor = school?.primary_color || "#001f4b";
  const secondaryColor = school?.secondary_color || "#e1b82c";

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}dd 0%, ${primaryColor} 50%, ${primaryColor}ee 100%)`
      }}
      data-testid="school-login-page"
    >
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10 blur-3xl" 
           style={{ backgroundColor: secondaryColor }} />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10 blur-3xl"
           style={{ backgroundColor: secondaryColor }} />

      <div className="w-full max-w-md relative z-10">
        {/* Back to general login */}
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors group mb-8"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Login general
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8 xl:p-10" data-testid="school-login-card">
          {/* School Branding */}
          <div className="flex flex-col items-center mb-8">
            {school?.logo_url ? (
              <img 
                src={school.logo_url} 
                alt={school.school_name}
                className="w-24 h-24 object-contain mb-4"
                data-testid="school-logo"
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <Building2 className="w-10 h-10" style={{ color: secondaryColor }} />
              </div>
            )}
            
            <h1 
              className="text-2xl font-extrabold text-center tracking-tight"
              style={{ color: primaryColor, fontFamily: 'Manrope, sans-serif' }}
              data-testid="school-name"
            >
              {school?.school_name}
            </h1>
            
            <div 
              className="mt-2 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${secondaryColor}20`, color: primaryColor }}
            >
              {subdomain}.{BASE_DOMAIN}
            </div>
          </div>

          {/* Mobile: Show install screen first, with option to login */}
          {isMobile && !showLoginForm ? (
            <div data-testid="mobile-install-view">
              <PwaInstallPrompt mode="hero" />

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  onClick={() => setShowLoginForm(true)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  data-testid="show-login-btn"
                >
                  <LogIn className="w-4 h-4" />
                  Ya tengo la app, iniciar sesión
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 text-center mb-6">Accede a tu intranet escolar</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl" data-testid="login-error">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Email o nombre de usuario</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      data-testid="login-email-input"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
                      style={{ "--tw-ring-color": `${primaryColor}30` }}
                      placeholder="tu@email.com o tu_usuario"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      data-testid="login-password-input"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
                      placeholder="Tu contraseña"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  data-testid="login-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: primaryColor,
                    boxShadow: loading ? 'none' : `0 10px 30px -10px ${primaryColor}80`
                  }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Iniciar Sesión"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                ¿No tienes cuenta en este colegio?{" "}
                <Link 
                  to="/register" 
                  className="font-semibold hover:underline"
                  style={{ color: primaryColor }}
                >
                  Contacta al administrador
                </Link>
              </p>

              <PwaInstallPrompt />
            </>
          )}
        </div>

        {/* Powered by */}
        <div className="flex items-center justify-center gap-2 mt-6 text-white/40">
          <GraduationCap className="w-4 h-4" />
          <span className="text-xs">Powered by EduNet</span>
        </div>
      </div>
    </div>
  );
}
