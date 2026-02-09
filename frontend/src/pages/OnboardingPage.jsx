import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GraduationCap, Globe, Check, X, Loader2, ArrowRight, Sparkles } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

function sanitizeSubdomain(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, "") // Only letters and numbers
    .slice(0, 30);
}

export default function OnboardingPage({ token, user, onLogin }) {
  const navigate = useNavigate();
  const [subdomain, setSubdomain] = useState("");
  const [available, setAvailable] = useState(null);
  const [availMessage, setAvailMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdDomain, setCreatedDomain] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [error, setError] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  // Check availability with debounce
  const checkAvailability = useCallback(async (sub) => {
    if (sub.length < 3) {
      setAvailable(null);
      setAvailMessage("Mínimo 3 caracteres");
      return;
    }
    setChecking(true);
    try {
      const res = await axios.get(`${API}/subdomain/check?subdomain=${sub}`);
      setAvailable(res.data.available);
      setAvailMessage(res.data.reason || (res.data.available ? "¡Disponible!" : "No disponible"));
    } catch {
      setAvailable(null);
      setAvailMessage("Error al verificar");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (subdomain.length >= 1) checkAvailability(subdomain);
    }, 400);
    return () => clearTimeout(timer);
  }, [subdomain, checkAvailability]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!available) return;
    setError("");
    setCreating(true);

    try {
      // Call the schools/create endpoint
      const res = await axios.post(
        `${API}/schools/create`,
        { subdomain },
        { headers }
      );
      
      // Update user state with new token and user info
      if (res.data.token && res.data.user) {
        onLogin(res.data.token, res.data.user);
      }
      
      setCreatedDomain(res.data.full_domain);
      setRedirectUrl(res.data.redirect_url);
      setCreated(true);
      
      // Determine redirect based on environment
      const hostname = window.location.hostname.toLowerCase();
      const supportsWildcard = hostname.endsWith(`.${BASE_DOMAIN}`) || hostname === BASE_DOMAIN;
      
      setTimeout(() => {
        if (supportsWildcard && !hostname.includes('preview.emergentagent.com')) {
          // Production with wildcard - redirect to actual subdomain
          window.location.href = res.data.redirect_url;
        } else {
          // Preview/development - use route-based approach
          navigate(`/school/${subdomain}/dashboard`);
        }
      }, 3000);
      
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear el subdominio");
      setCreating(false);
    }
  };

  // ─── Creating / Success Screen ───
  if (creating || created) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] px-6" data-testid="creating-screen">
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />
        
        <div className="w-full max-w-md text-center relative z-10">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-xl bg-[#e1b82c] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#001f4b]" />
            </div>
            <span className="text-xl font-extrabold text-white" style={{ fontFamily: "Manrope" }}>
              EduNet
            </span>
          </div>

          {created ? (
            <div className="animate-fade-in-up">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8 border-2 border-emerald-400/30">
                <Check className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-4" style={{ fontFamily: "Manrope" }}>
                ¡Tu intranet está lista!
              </h2>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 mb-6">
                <p className="text-sm text-blue-200/60 mb-2">Tu intranet:</p>
                <p className="text-2xl font-bold text-[#e1b82c]" style={{ fontFamily: "Manrope" }}>
                  {createdDomain}
                </p>
              </div>
              <p className="text-sm text-blue-200/60 mb-2">Redirigiendo al dashboard...</p>
              <p className="text-xs text-blue-200/40">
                En producción serías redirigido a: {redirectUrl}
              </p>
              <div className="mt-4">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <div>
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-8 border-2 border-white/10">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3" style={{ fontFamily: "Manrope" }}>
                Creando tu intranet...
              </h2>
              <p className="text-sm text-blue-200/60">Esto tomará solo un momento</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Onboarding Form ───
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] px-6" data-testid="onboarding-page">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
      
      <div className="w-full max-w-lg relative z-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#e1b82c] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#001f4b]" />
          </div>
          <span className="text-xl font-extrabold text-white" style={{ fontFamily: "Manrope" }}>
            EduNet
          </span>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-[#e1b82c]" />
            <span className="text-xs font-semibold text-white/70">Paso 3 de 3 · Obligatorio</span>
          </div>
          
          <h1
            className="text-3xl xl:text-4xl font-extrabold text-white mb-3"
            style={{ fontFamily: "Manrope" }}
            data-testid="onboarding-title"
          >
            Crea el nombre de tu intranet
          </h1>
          <p className="text-base text-blue-200/60">
            Este será el acceso exclusivo de tu colegio
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleCreate} className="bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-4 rounded-xl" data-testid="onboarding-error">
              {error}
            </div>
          )}

          {/* Subdomain Input */}
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-3">
              Nombre de tu intranet
            </label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-[#e1b82c]/50 transition-all">
              <div className="pl-4 flex items-center gap-2 flex-shrink-0">
                <Globe className="w-5 h-5 text-white/40" />
              </div>
              <input
                data-testid="onboarding-subdomain"
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(sanitizeSubdomain(e.target.value))}
                className="flex-1 px-3 py-4 bg-transparent text-lg font-semibold text-white focus:outline-none placeholder:text-white/30"
                placeholder="tucolegio"
                autoFocus
              />
              <div className="pr-4 flex items-center flex-shrink-0">
                <span className="text-base font-medium text-white/40">.{BASE_DOMAIN}</span>
              </div>
            </div>

            {/* Availability indicator */}
            <div className="flex items-center gap-2 mt-3 min-h-[24px]">
              {subdomain.length > 0 && (
                <>
                  {checking ? (
                    <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                  ) : available === true ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : available === false ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : null}
                  <span className={`text-sm font-medium ${
                    available === true ? "text-emerald-400" : 
                    available === false ? "text-red-400" : 
                    "text-white/40"
                  }`}>
                    {checking ? "Verificando..." : availMessage}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Preview */}
          {subdomain.length >= 3 && available && (
            <div className="bg-[#e1b82c]/10 border border-[#e1b82c]/20 rounded-2xl p-5 text-center animate-fade-in">
              <p className="text-xs text-[#e1b82c]/60 mb-2 uppercase tracking-wide font-semibold">Tu intranet será:</p>
              <p className="text-xl font-bold text-[#e1b82c]" style={{ fontFamily: "Manrope" }}>
                https://{subdomain}.{BASE_DOMAIN}
              </p>
            </div>
          )}

          {/* Rules */}
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-2 font-semibold">Reglas del subdominio:</p>
            <ul className="text-xs text-white/30 space-y-1">
              <li>• Solo letras minúsculas y números</li>
              <li>• Sin espacios ni caracteres especiales</li>
              <li>• Mínimo 3 caracteres</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            data-testid="onboarding-create-btn"
            type="submit"
            disabled={!available || subdomain.length < 3}
            className="w-full py-4 bg-gradient-to-r from-[#e1b82c] to-amber-500 text-[#001f4b] font-bold rounded-xl hover:shadow-lg hover:shadow-[#e1b82c]/30 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            Crear mi intranet
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-6">
          <p className="text-center text-xs text-amber-300/80">
            ⚠️ Este paso es obligatorio. No podrás acceder al dashboard hasta crear tu subdominio.
          </p>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-white/30 mt-4">
          No podrás cambiar el subdominio después de crearlo
        </p>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
