import { useState, useEffect } from "react";
import { Smartphone, Download } from "lucide-react";

export default function PwaInstallPrompt({ mode = "inline" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setInstalling(true);
    setProgress(0);

    const steps = [
      { target: 25, delay: 300 },
      { target: 45, delay: 600 },
      { target: 65, delay: 400 },
      { target: 80, delay: 500 },
      { target: 95, delay: 400 },
      { target: 100, delay: 300 },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.target);
    }

    await new Promise((r) => setTimeout(r, 200));
    setInstalling(false);

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Only hide in inline mode when no prompt available
  if (mode !== "hero" && (!deferredPrompt || installed)) return null;
  
  // In hero mode, always render (even without deferredPrompt)
  if (installed) return null;

  // Hero mode: large prominent install screen
  if (mode === "hero") {
    return (
      <>
        <div className="text-center" data-testid="pwa-install-hero">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Descarga la App
          </h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Instale EduNet en su celular para acceder más rápido desde su pantalla principal.
          </p>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full py-4 bg-[#001f4b] text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-[#0a3068] active:scale-[0.98] transition-all disabled:opacity-70 shadow-lg"
            style={{ boxShadow: '0 10px 30px -10px rgba(0,31,75,0.5)' }}
            data-testid="pwa-install-button"
          >
            <Download className="w-5 h-5" />
            Instalar EduNet
          </button>
        </div>

        {installing && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" data-testid="pwa-installing-overlay">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#001f4b] flex items-center justify-center">
                <Download className="w-8 h-8 text-[#e1b82c] animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-[#001f4b] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Instalando EduNet
              </h3>
              <p className="text-sm text-slate-500 mb-6">Preparando la aplicación...</p>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-[#001f4b] to-[#e1b82c] rounded-full"
                  style={{ width: `${progress}%`, transition: 'width 0.4s ease' }}
                />
              </div>
              <p className="text-xs font-medium text-slate-400">{progress}%</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline mode: small button below login form (original)
  return (
    <>
      <div className="mt-5 bg-gradient-to-r from-[#001f4b]/5 to-[#0a3068]/5 border border-[#001f4b]/10 rounded-2xl p-4" data-testid="pwa-install-section">
        <p className="text-xs text-slate-500 text-center mb-3">
          Instale EduNet en su celular para acceder más rápido desde su pantalla principal.
        </p>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-3 bg-[#001f4b] text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 hover:bg-[#0a3068] active:scale-[0.98] transition-all disabled:opacity-70"
          data-testid="pwa-install-button"
        >
          <Smartphone className="w-4.5 h-4.5" />
          Instalar EduNet
        </button>
      </div>

      {installing && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" data-testid="pwa-installing-overlay">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#001f4b] flex items-center justify-center">
              <Download className="w-8 h-8 text-[#e1b82c] animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-[#001f4b] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Instalando EduNet
            </h3>
            <p className="text-sm text-slate-500 mb-6">Preparando la aplicación...</p>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-[#001f4b] to-[#e1b82c] rounded-full"
                style={{ width: `${progress}%`, transition: 'width 0.4s ease' }}
              />
            </div>
            <p className="text-xs font-medium text-slate-400">{progress}%</p>
          </div>
        </div>
      )}
    </>
  );
}

// Hook to check if PWA install is available (for parent components)
export function usePwaInstallReady() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setReady(true);
    };
    const installedHandler = () => {
      setInstalled(true);
      setReady(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  return isMobile && ready && !installed;
}
