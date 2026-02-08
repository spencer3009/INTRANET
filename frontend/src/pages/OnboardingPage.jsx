import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GraduationCap, Globe, Check, X, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export default function OnboardingPage({ token, user }) {
  const navigate = useNavigate();
  const [schoolName, setSchoolName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainEdited, setSubdomainEdited] = useState(false);
  const [available, setAvailable] = useState(null);
  const [availMessage, setAvailMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  // Auto-generate subdomain from school name
  useEffect(() => {
    if (!subdomainEdited && schoolName) {
      setSubdomain(slugify(schoolName));
    }
  }, [schoolName, subdomainEdited]);

  // Check availability with debounce
  const checkAvailability = useCallback(async (sub) => {
    if (sub.length < 3) {
      setAvailable(null);
      setAvailMessage("");
      return;
    }
    setChecking(true);
    try {
      const res = await axios.get(`${API}/schools/check-subdomain/${sub}`);
      setAvailable(res.data.available);
      setAvailMessage(res.data.available ? "Disponible" : res.data.reason);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (subdomain.length >= 3) checkAvailability(subdomain);
    }, 500);
    return () => clearTimeout(timer);
  }, [subdomain, checkAvailability]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!available) return;
    setError("");
    setCreating(true);

    try {
      await axios.post(
        `${API}/schools/onboarding`,
        { subdomain, school_name: schoolName },
        { headers }
      );
      setCreated(true);
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear la intranet");
      setCreating(false);
    }
  };

  // ─── Creating / Success Screen ───
  if (creating || created) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafbfc] px-6" data-testid="creating-screen">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
              EduNet
            </span>
          </div>

          {created ? (
            <div className="animate-fade-in-up">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>
                ¡Tu intranet está lista!
              </h2>
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-bold text-[#001f4b]">{subdomain}.edunet.pe</span>
              </p>
              <p className="text-xs text-slate-400">Redirigiendo al dashboard...</p>
            </div>
          ) : (
            <div>
              <div className="w-20 h-20 rounded-full bg-[#001f4b]/5 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-[#001f4b] animate-spin" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>
                Estamos preparando tu intranet educativa...
              </h2>
              <p className="text-sm text-slate-400">Esto tomará solo un momento</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Onboarding Form ───
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafbfc] px-6" data-testid="onboarding-page">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
          </div>
          <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
            EduNet
          </span>
        </div>

        <div className="text-center mb-10">
          <h1
            className="text-3xl font-extrabold text-[#001f4b] mb-2"
            style={{ fontFamily: "Manrope" }}
            data-testid="onboarding-title"
          >
            Configura tu intranet
          </h1>
          <p className="text-sm text-slate-500">
            Elige el nombre y subdominio para la intranet de tu colegio.
          </p>
        </div>

        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl" data-testid="onboarding-error">
              {error}
            </div>
          )}

          {/* School Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre del colegio
            </label>
            <input
              data-testid="onboarding-school-name"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
              placeholder="Ej: Colegio El Roble"
              required
            />
          </div>

          {/* Subdomain */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Subdominio de tu intranet
            </label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#001f4b]/20 focus-within:border-[#001f4b] transition-all">
              <div className="pl-4 flex items-center gap-2 flex-shrink-0">
                <Globe className="w-4 h-4 text-slate-400" />
              </div>
              <input
                data-testid="onboarding-subdomain"
                type="text"
                value={subdomain}
                onChange={(e) => {
                  setSubdomain(slugify(e.target.value));
                  setSubdomainEdited(true);
                }}
                className="flex-1 px-2 py-3 bg-transparent text-sm font-medium focus:outline-none"
                placeholder="micolegio"
              />
              <span className="pr-4 text-sm text-slate-400 flex-shrink-0">.edunet.pe</span>
            </div>

            {/* Availability indicator */}
            {subdomain.length >= 3 && (
              <div className="flex items-center gap-1.5 mt-2">
                {checking ? (
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                ) : available === true ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : available === false ? (
                  <X className="w-3.5 h-3.5 text-red-500" />
                ) : null}
                <span className={`text-xs font-medium ${available === true ? "text-emerald-600" : available === false ? "text-red-600" : "text-slate-400"}`}>
                  {checking ? "Verificando..." : availMessage}
                </span>
              </div>
            )}
          </div>

          {/* Preview */}
          {subdomain.length >= 3 && available && (
            <div className="bg-[#001f4b]/5 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Tu intranet será accesible en:</p>
              <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
                {subdomain}.edunet.pe
              </p>
            </div>
          )}

          <button
            data-testid="onboarding-create-btn"
            type="submit"
            disabled={!available || !schoolName}
            className="w-full py-3.5 bg-[#001f4b] text-white font-semibold rounded-xl hover:bg-[#001f4b]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Crear intranet
          </button>
        </form>
      </div>
    </div>
  );
}
