import { useState, useEffect, useCallback } from "react";
import { Smartphone, X, Download } from "lucide-react";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showButton, setShowButton] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  const isMobile = useCallback(() => {
    const ua = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const smallScreen = window.innerWidth <= 768;
    return ua || smallScreen;
  }, []);

  const isStandalone = useCallback(() => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  }, []);

  useEffect(() => {
    if (!isMobile() || isStandalone()) return;

    // Always show on mobile
    setShowButton(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isMobile, isStandalone]);

  const handleInstall = async () => {
    setInstalling(true);
    setProgress(0);

    // Animate progress over ~2.5 seconds
    const steps = [
      { target: 25, delay: 300 },
      { target: 45, delay: 600 },
      { target: 65, delay: 400 },
      { target: 80, delay: 500 },
      { target: 95, delay: 400 },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.target);
    }

    await new Promise((r) => setTimeout(r, 300));
    setProgress(100);

    if (deferredPrompt) {
      await new Promise((r) => setTimeout(r, 200));
      setInstalling(false);
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShowButton(false);
      }
      setDeferredPrompt(null);
    } else {
      // No native prompt available — show guide
      await new Promise((r) => setTimeout(r, 500));
      setInstalling(false);
      setShowIosGuide(true);
    }
  };

  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!showButton) return null;

  return (
    <>
      {/* Install button */}
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

      {/* Installing overlay */}
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

            {/* Progress bar */}
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

      {/* Guide modal (iOS/generic) */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="ios-guide-overlay">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowIosGuide(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#001f4b] flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-[#e1b82c]" />
              </div>
              <h3 className="text-lg font-bold text-[#001f4b]">Instalar EduNet</h3>
            </div>
            {/iPhone|iPad|iPod/.test(navigator.userAgent) ? (
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Toca el botón <strong>Compartir</strong> (cuadrado con flecha) en Safari</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Selecciona <strong>"Agregar a pantalla de inicio"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Toca <strong>"Agregar"</strong> para confirmar</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Abre el <strong>menú del navegador</strong> (tres puntos)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla de inicio"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Confirma tocando <strong>"Instalar"</strong></span>
                </li>
              </ol>
            )}
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full mt-5 py-3 bg-[#001f4b] text-white font-semibold rounded-xl"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
