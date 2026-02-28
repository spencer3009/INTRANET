import { useState, useEffect, useRef } from "react";
import { Smartphone, Download } from "lucide-react";

export default function PwaInstallPrompt({ mode = "inline" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [swStatus, setSwStatus] = useState("checking"); // checking | controlling | failed
  const promptRef = useRef(null);

  useEffect(() => {
    console.log('[PWA] === INICIALIZANDO ===');
    console.log('[PWA] URL:', window.location.href);
    console.log('[PWA] standalone:', window.matchMedia('(display-mode: standalone)').matches);

    // Already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || window.__pwaInstalled) {
      console.log('[PWA] App ya instalada');
      setInstalled(true);
      return;
    }

    // Check if prompt was captured globally before React
    if (window.__pwaInstallPromptFired && window.__pwaInstallPrompt) {
      console.log('[PWA] Usando prompt capturado globalmente');
      promptRef.current = window.__pwaInstallPrompt;
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    // Check SW controller status
    const checkController = () => {
      const ctrl = navigator.serviceWorker?.controller;
      console.log('[PWA] SW controller:', ctrl ? ctrl.scriptURL : 'null');
      if (ctrl) {
        setSwStatus("controlling");
        return true;
      }
      return false;
    };

    // Check immediately
    if (!checkController()) {
      // Wait for SW to take control
      if (window.__swReady) {
        window.__swReady.then((success) => {
          if (success) {
            console.log('[PWA] SW ahora controla la pagina');
            setSwStatus("controlling");
          } else {
            console.warn('[PWA] SW no logro controlar la pagina');
            setSwStatus("failed");
          }
        });
      }

      // Also listen for controllerchange directly
      navigator.serviceWorker?.addEventListener('controllerchange', () => {
        console.log('[PWA] controllerchange detectado en componente');
        setSwStatus("controlling");
      });
    }

    // Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt DISPARADO');
      console.log('[PWA] platforms:', e.platforms);
      promptRef.current = e;
      setDeferredPrompt(e);
    };

    const installedHandler = () => {
      console.log('[PWA] APP INSTALADA - appinstalled event');
      setInstalled(true);
      setDeferredPrompt(null);
      promptRef.current = null;
      window.__pwaInstalled = true;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    // Diagnostic after 8 seconds
    const diagTimeout = setTimeout(() => {
      const ctrl = navigator.serviceWorker?.controller;
      console.log('[PWA] === DIAGNOSTICO 8s ===');
      console.log('[PWA] SW controller:', ctrl ? 'SI (' + ctrl.state + ')' : 'NO (null)');
      console.log('[PWA] beforeinstallprompt recibido:', !!promptRef.current);
      console.log('[PWA] window.__pwaInstallPromptFired:', window.__pwaInstallPromptFired);

      if (!ctrl) {
        console.error('[PWA] PROBLEMA: SW no controla la pagina. La PWA NO se puede instalar.');
        console.error('[PWA] Solucion: Recargar la pagina (el SW necesita claim() + reload)');
      }
      if (!promptRef.current) {
        console.warn('[PWA] beforeinstallprompt no se ha disparado.');
        if (!ctrl) {
          console.warn('[PWA] Causa probable: SW no controla la pagina');
        } else {
          console.warn('[PWA] Posibles causas: falta engagement (30s+click), manifest invalido, o app ya instalada');
        }
      }
    }, 8000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(diagTimeout);
    };
  }, []);

  const handleInstall = async () => {
    const activePrompt = deferredPrompt || promptRef.current || window.__pwaInstallPrompt;

    console.log('[PWA] === INSTALANDO ===');
    console.log('[PWA] prompt disponible:', !!activePrompt);
    console.log('[PWA] SW controller:', !!navigator.serviceWorker?.controller);

    if (!activePrompt) {
      console.error('[PWA] No hay prompt. beforeinstallprompt no se disparo.');
      return;
    }

    setInstalling(true);
    setProgress(0);

    // Quick animation
    const steps = [
      { target: 30, delay: 300 },
      { target: 60, delay: 400 },
      { target: 85, delay: 300 },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.target);
    }

    try {
      console.log('[PWA] Llamando prompt()...');
      activePrompt.prompt();
      console.log('[PWA] prompt() OK - esperando userChoice...');

      setProgress(90);
      const result = await activePrompt.userChoice;
      console.log('[PWA] userChoice:', result.outcome, '| platform:', result.platform);

      if (result.outcome === "accepted") {
        setProgress(100);
        await new Promise((r) => setTimeout(r, 600));
        setInstalled(true);
        console.log('[PWA] Instalacion ACEPTADA');
      } else {
        console.log('[PWA] Instalacion RECHAZADA por el usuario');
      }
    } catch (err) {
      console.error('[PWA] ERROR en prompt():', err.name, err.message);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  };

  // Inline mode: only show if prompt available
  if (mode !== "hero" && (!deferredPrompt || installed)) return null;
  if (installed) return null;

  const hasPrompt = !!(deferredPrompt || promptRef.current || window.__pwaInstallPrompt);

  // Hero mode
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
            Instale EduNet en su celular para acceder desde su pantalla principal.
          </p>

          {hasPrompt ? (
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
          ) : (
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
          )}
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
              <p className="text-sm text-slate-500 mb-6">Preparando la aplicacion...</p>
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

  // Inline mode
  return (
    <>
      <div className="mt-5 bg-gradient-to-r from-[#001f4b]/5 to-[#0a3068]/5 border border-[#001f4b]/10 rounded-2xl p-4" data-testid="pwa-install-section">
        <p className="text-xs text-slate-500 text-center mb-3">
          Instale EduNet en su celular para acceder desde su pantalla principal.
        </p>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-3 bg-[#001f4b] text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 hover:bg-[#0a3068] active:scale-[0.98] transition-all disabled:opacity-70"
          data-testid="pwa-install-button"
        >
          <Smartphone className="w-4 h-4" />
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
            <p className="text-sm text-slate-500 mb-6">Preparando la aplicacion...</p>
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

// Hook for parent components
export function usePwaInstallReady() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
      return;
    }
    const handler = (e) => { e.preventDefault(); setReady(true); };
    const installedHandler = () => { setInstalled(true); setReady(false); };
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
