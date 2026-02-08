import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { GraduationCap, Mail, CheckCircle } from "lucide-react";

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
      const res = await axios.post(`${API}/schools/verify-email`, { email, code });
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
      <div className="min-h-screen flex items-center justify-center bg-[#fafbfc] px-6">
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
    <div className="min-h-screen flex items-center justify-center bg-[#fafbfc] px-6" data-testid="verify-email-page">
      <div className="w-full max-w-md text-center">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-10">
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
              Email verificado
            </h2>
            <p className="text-sm text-slate-500">Redirigiendo...</p>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-[#001f4b]/5 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-[#001f4b]" />
            </div>

            <h2
              className="text-2xl font-extrabold text-[#001f4b] mb-2"
              style={{ fontFamily: "Manrope" }}
              data-testid="verify-title"
            >
              Verifica tu correo
            </h2>
            <p className="text-sm text-slate-500 mb-2">
              Tu cuenta está casi lista. Ingresa el código de verificación.
            </p>
            <p className="text-sm text-slate-500 mb-1">
              Enviado a: <span className="font-semibold text-slate-700">{email}</span>
            </p>

            {/* Show code hint for demo */}
            <div className="bg-[#e1b82c]/10 border border-[#e1b82c]/20 rounded-xl p-3 mb-6 mt-4">
              <p className="text-xs text-[#001f4b] font-medium">
                Demo: Tu código de verificación es <span className="font-bold text-[#e1b82c]">{realCode}</span>
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
                className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-center text-lg font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="CÓDIGO"
                maxLength={6}
                required
              />

              <button
                data-testid="verify-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#001f4b] text-white font-semibold rounded-xl hover:bg-[#001f4b]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Verificar email"
                )}
              </button>
            </form>

            <p className="text-xs text-slate-400 mt-6">
              En el siguiente paso configuraremos tu intranet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
