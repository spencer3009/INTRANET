import { useState, useEffect, useRef } from "react";
import { Download, Copy, Check, ChevronRight, Smartphone } from "lucide-react";

// === DETECTION ===
function detectWebView() {
  const ua = navigator.userAgent || "";
  return /wv|FBAN|FBAV|Instagram|Line\/|Messenger|WhatsApp|MicroMessenger|Snapchat|TikTok|Twitter/i.test(ua);
}

function isStandalone() {
  return typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone ||
    window.__pwaInstalled
  );
}

// === INSTALL GATEWAY ===
export default function InstallGateway({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(isStandalone);
  const [copied, setCopied] = useState(false);
  const [skipInstall, setSkipInstall] = useState(false);
  const promptRef = useRef(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const webView = typeof window !== "undefined" && detectWebView();

  useEffect(() => {
    if (installed || !isMobile) return;
    if (webView) return;

    if (window.__pwaInstallPromptFired && window.__pwaInstallPrompt) {
      promptRef.current = window.__pwaInstallPrompt;
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handler = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      promptRef.current = null;
      window.__pwaInstalled = true;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed, isMobile, webView]);

  // Already installed or desktop → render children directly
  if (installed || !isMobile || skipInstall) return children;

  const handleInstall = async () => {
    const p = deferredPrompt || promptRef.current || window.__pwaInstallPrompt;
    if (!p) return;
    setInstalling(true);
    setProgress(0);
    for (const s of [{ t: 30, d: 300 }, { t: 60, d: 400 }, { t: 85, d: 300 }]) {
      await new Promise(r => setTimeout(r, s.d));
      setProgress(s.t);
    }
    try {
      p.prompt();
      setProgress(90);
      const result = await p.userChoice;
      if (result.outcome === "accepted") {
        setProgress(100);
        await new Promise(r => setTimeout(r, 600));
        setInstalled(true);
      }
    } catch (err) {
      console.error("[PWA]", err);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  };

  const handleOpenChrome = () => {
    const url = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
    setTimeout(() => { window.open(window.location.href, "_system"); }, 800);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // === WEBVIEW SCREEN ===
  if (webView) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "linear-gradient(160deg, #001636 0%, #001f4b 40%, #0a3068 100%)" }}
        data-testid="install-gateway-webview"
      >
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            {/* App Icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-[28px] overflow-hidden shadow-xl ring-4 ring-white/20">
              <img src="/icons/icon-192.png" alt="EduNet" className="w-full h-full object-cover" />
            </div>

            <h1
              className="text-2xl font-extrabold text-[#001f4b] mb-2"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Instale EduNet en su celular
            </h1>

            <p className="text-sm text-slate-500 leading-relaxed mb-2">
              Para instalar la aplicacion EduNet necesita abrir esta pagina en{" "}
              <strong className="text-slate-700">Google Chrome</strong>.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed mb-8">
              WhatsApp y otras aplicaciones no permiten instalar la App directamente.
            </p>

            {/* Primary Button */}
            <button
              onClick={handleOpenChrome}
              className="w-full py-4 bg-[#001f4b] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all shadow-xl"
              style={{ boxShadow: "0 12px 32px -8px rgba(0,31,75,0.5)" }}
              data-testid="open-chrome-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
              </svg>
              Abrir en Google Chrome
            </button>

            {/* Secondary Button */}
            <button
              onClick={handleCopy}
              className="w-full mt-3 py-3.5 bg-slate-100 text-slate-600 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.97] transition-all hover:bg-slate-200"
              data-testid="copy-link-btn"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600">Enlace copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar enlace
                </>
              )}
            </button>

            {copied && (
              <p className="text-xs text-emerald-600 mt-2 font-medium animate-in fade-in">
                Abra Google Chrome y pegue el enlace
              </p>
            )}

            {/* Instructions */}
            <div className="mt-8 bg-slate-50 rounded-2xl p-5 text-left">
              <p className="text-xs font-bold text-slate-600 mb-4 uppercase tracking-wider">
                Como abrir en Chrome
              </p>
              <div className="space-y-4">
                {[
                  { n: "1", text: <>Toque el menu <strong className="text-slate-700">&#8942;</strong> arriba a la derecha</> },
                  { n: "2", text: <>Seleccione <strong className="text-slate-700">"Abrir en Chrome"</strong></> },
                  { n: "3", text: <>Toque <strong className="text-slate-700">"Instalar EduNet"</strong></> },
                ].map(s => (
                  <div key={s.n} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center">
                      {s.n}
                    </span>
                    <p className="text-sm text-slate-500">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-white/30">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-[11px]">EduNet — Intranet escolar</span>
          </div>
        </div>
      </div>
    );
  }

  // === CHROME INSTALL SCREEN ===
  if (deferredPrompt || promptRef.current || window.__pwaInstallPrompt) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "linear-gradient(160deg, #001636 0%, #001f4b 40%, #0a3068 100%)" }}
        data-testid="install-gateway-chrome"
      >
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            {/* App Icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-[28px] overflow-hidden shadow-xl ring-4 ring-white/20">
              <img src="/icons/icon-192.png" alt="EduNet" className="w-full h-full object-cover" />
            </div>

            <h1
              className="text-2xl font-extrabold text-[#001f4b] mb-2"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Descarga la App EduNet
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              Instale EduNet en su celular para acceder facilmente desde su pantalla principal.
            </p>

            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-4 bg-[#001f4b] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all disabled:opacity-70 shadow-xl"
              style={{ boxShadow: "0 12px 32px -8px rgba(0,31,75,0.5)" }}
              data-testid="install-app-btn"
            >
              <Download className="w-5 h-5" />
              Instalar EduNet
            </button>

            <button
              onClick={() => setSkipInstall(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              data-testid="skip-install-btn"
            >
              Continuar sin instalar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-white/30">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-[11px]">EduNet — Intranet escolar</span>
          </div>
        </div>

        {/* Installing overlay */}
        {installing && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-[24px] overflow-hidden shadow-lg">
                <img src="/icons/icon-192.png" alt="EduNet" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold text-[#001f4b] mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                Instalando EduNet
              </h3>
              <p className="text-sm text-slate-500 mb-6">Preparando la aplicacion...</p>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-[#001f4b] to-[#e1b82c] rounded-full"
                  style={{ width: `${progress}%`, transition: "width 0.4s ease" }}
                />
              </div>
              <p className="text-xs font-medium text-slate-400">{progress}%</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // No prompt available yet on mobile → show login directly
  return children;
}
