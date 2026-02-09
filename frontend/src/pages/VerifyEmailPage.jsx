import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { GraduationCap, Mail, CheckCircle, ArrowLeft } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyEmailPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, code: realCode, school_name } = location.state || {};

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/verify-email`, { email, code });
      if (res.data.verified) {
        setVerified(true);
        if (res.data.token) {
          onLogin(res.data.token, res.data.user);
          setTimeout(() => navigate("/welcome"), 1500);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al verificar");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 px-6">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No se encontró información de registro.</p>
          <Link to="/register" className="text-[#001f4b] font-semibold hover:underline">
            Volver al registro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 px-6" data-testid="verify-email-page">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Link 
          to="/register" 
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-[#001f4b] transition-colors group mb-8"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Volver al registro
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 xl:p-10 border border-slate-100 text-center">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
              EduNet
            </span>
          </div>

          {verified ? (
            <div className="animate-fade-in-up">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>
                ¡Email verificado!
              </h2>
              <p className="text-sm text-slate-500">Redirigiendo...</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-[#001f4b]/5 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-[#001f4b]" />
              </div>

              {/* Step indicator */}
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mb-4">
                <span className="text-xs font-semibold text-slate-500">Paso 2 de 3</span>
              </div>

              <h2
                className="text-2xl font-extrabold text-[#001f4b] mb-2"
                style={{ fontFamily: "Manrope" }}
                data-testid="verify-title"
              >
                Verifica tu correo
              </h2>
              <p className="text-sm text-slate-500 mb-1">
                Ingresa el código de verificación enviado a:
              </p>
              <p className="text-sm font-semibold text-slate-700 mb-4">
                {email}
              </p>

              {/* Show code hint for demo */}
              <div className="bg-[#e1b82c]/10 border border-[#e1b82c]/20 rounded-xl p-3 mb-6">
                <p className="text-xs text-[#001f4b]">
                  <span className="font-medium">Demo:</span> Tu código es{" "}
                  <span className="font-bold text-[#e1b82c] text-sm">{realCode}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl" data-testid="verify-error">
                    {error}
                  </div>
                )}

                <input
                  data-testid="verify-code-input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all placeholder:text-slate-300 placeholder:tracking-widest"
                  placeholder="CÓDIGO"
                  maxLength={6}
                  required
                />

                <button
                  data-testid="verify-submit-btn"
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full py-4 bg-gradient-to-r from-[#001f4b] to-[#0a3068] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-900/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Verificar"
                  )}
                </button>
              </form>

              <p className="text-xs text-slate-400 mt-6">
                En el siguiente paso crearás el subdominio de tu intranet.
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
