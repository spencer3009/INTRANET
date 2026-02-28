import { useState, useEffect, useRef } from "react";
import { Smartphone, Download, CheckCircle2, AlertTriangle } from "lucide-react";

export default function PwaInstallPrompt({ mode = "inline" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const promptRef = useRef(null);

  useEffect(() => {
    console.log('[PWA] === INICIALIZANDO PWA ===');
    console.log('[PWA] User Agent:', navigator.userAgent);
    console.log('[PWA] Protocol:', window.location.protocol);
    console.log('[PWA] Host:', window.location.host);
    console.log('[PWA] display-mode standalone:', window.matchMedia('(display-mode: standalone)').matches);
    console.log('[PWA] navigator.standalone:', window.navigator.standalone);

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      console.log('[PWA] Ya esta instalada (modo standalone). Ocultando boton.');
      setInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      console.log('[PWA] *** beforeinstallprompt DISPARADO ***');
      console.log('[PWA] Plataformas:', e.platforms);
      console.log('[PWA] Tipo de evento:', e.type);
      promptRef.current = e;
      setDeferredPrompt(e);
      setDebugInfo(prev => ({ ...prev, promptFired: true, platforms: e.platforms }));
    };

    const installedHandler = () => {
      console.log('[PWA] *** APP INSTALADA *** evento appinstalled disparado');
      setInstalled(true);
      setDeferredPrompt(null);
      promptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    console.log('[PWA] Listeners registrados. Esperando beforeinstallprompt...');

    // Validate manifest
    fetch('/manifest.json')
      .then(r => {
        console.log('[PWA] Manifest HTTP status:', r.status);
        console.log('[PWA] Manifest Content-Type:', r.headers.get('content-type'));
        return r.json();
      })
      .then(m => {
        console.log('[PWA] Manifest cargado correctamente:');
        console.log('[PWA]   name:', m.name);
        console.log('[PWA]   short_name:', m.short_name);
        console.log('[PWA]   start_url:', m.start_url);
        console.log('[PWA]   scope:', m.scope);
        console.log('[PWA]   display:', m.display);
        console.log('[PWA]   id:', m.id);
        console.log('[PWA]   prefer_related_applications:', m.prefer_related_applications);
        console.log('[PWA]   icons:', JSON.stringify(m.icons));
        setDebugInfo(prev => ({ ...prev, manifestValid: true, manifest: m }));
      })
      .catch(err => {
        console.error('[PWA] ERROR cargando manifest:', err);
        setDebugInfo(prev => ({ ...prev, manifestValid: false, manifestError: err.message }));
      });

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration()
        .then(reg => {
          if (reg) {
            console.log('[PWA] Service Worker registrado. Scope:', reg.scope);
            console.log('[PWA] SW estado activo:', reg.active?.state);
            console.log('[PWA] SW estado instalando:', reg.installing?.state);
            console.log('[PWA] SW estado esperando:', reg.waiting?.state);
            setDebugInfo(prev => ({ ...prev, swRegistered: true, swScope: reg.scope, swState: reg.active?.state }));
          } else {
            console.warn('[PWA] ADVERTENCIA: Service Worker NO registrado');
            setDebugInfo(prev => ({ ...prev, swRegistered: false }));
          }
        });
    } else {
      console.warn('[PWA] ADVERTENCIA: Service Worker NO soportado');
    }

    // Verify icons are loadable
    const img = new Image();
    img.onload = () => {
      console.log('[PWA] Icono 192x192 carga OK:', img.naturalWidth, 'x', img.naturalHeight);
      setDebugInfo(prev => ({ ...prev, iconLoaded: true }));
    };
    img.onerror = () => {
      console.error('[PWA] ERROR: Icono 192x192 NO carga');
      setDebugInfo(prev => ({ ...prev, iconLoaded: false }));
    };
    img.src = '/icons/icon-192.png';

    // Timeout check - if prompt hasn't fired after 10s, log diagnostic
    const timeout = setTimeout(() => {
      if (!promptRef.current) {
        console.warn('[PWA] === DIAGNOSTICO (10s sin beforeinstallprompt) ===');
        console.warn('[PWA] El evento beforeinstallprompt NO se ha disparado.');
        console.warn('[PWA] Posibles causas:');
        console.warn('[PWA]   1. La app ya esta instalada');
        console.warn('[PWA]   2. Chrome no detecta un manifest valido');
        console.warn('[PWA]   3. No se cumple el criterio de engagement (30s en pagina + click)');
        console.warn('[PWA]   4. El navegador no soporta PWA install');
        console.warn('[PWA] Verificar en Chrome DevTools > Application > Manifest');
      }
    }, 10000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    console.log('[PWA] === BOTON INSTALAR PRESIONADO ===');
    console.log('[PWA] deferredPrompt disponible:', !!deferredPrompt);
    console.log('[PWA] promptRef disponible:', !!promptRef.current);

    const activePrompt = deferredPrompt || promptRef.current;

    if (!activePrompt) {
      console.error('[PWA] ERROR: No hay prompt disponible para instalar');
      console.error('[PWA] El evento beforeinstallprompt nunca se disparo');
      console.error('[PWA] Verificar:');
      console.error('[PWA]   - manifest.json es valido');
      console.error('[PWA]   - Service Worker esta registrado');
      console.error('[PWA]   - Sitio en HTTPS');
      console.error('[PWA]   - App no esta ya instalada');
      return;
    }

    setInstalling(true);
    setProgress(0);

    // Animated progress bar
    const steps = [
      { target: 25, delay: 300 },
      { target: 50, delay: 500 },
      { target: 75, delay: 400 },
      { target: 90, delay: 400 },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, step.delay));
      setProgress(step.target);
    }

    // Now trigger the real install prompt
    try {
      console.log('[PWA] Llamando prompt()...');
      activePrompt.prompt();
      console.log('[PWA] prompt() ejecutado correctamente');

      setProgress(95);

      const result = await activePrompt.userChoice;
      console.log('[PWA] Resultado userChoice:', JSON.stringify(result));
      console.log('[PWA] outcome:', result.outcome);
      console.log('[PWA] platform:', result.platform);

      if (result.outcome === "accepted") {
        console.log('[PWA] Usuario ACEPTO la instalacion');
        setProgress(100);
        await new Promise((r) => setTimeout(r, 500));
        setInstalled(true);
      } else {
        console.log('[PWA] Usuario RECHAZO la instalacion');
      }
    } catch (err) {
      console.error('[PWA] ERROR durante prompt():', err);
      console.error('[PWA] Error name:', err.name);
      console.error('[PWA] Error message:', err.message);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  };

  // For inline mode: only show if prompt is available
  if (mode !== "hero" && (!deferredPrompt || installed)) return null;
  if (installed) return null;

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

          {deferredPrompt ? (
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
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-xl py-3 px-4">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">Navegue la pagina unos segundos para activar la instalacion</span>
              </div>
              <button
                onClick={() => {
                  console.log('[PWA] Boton presionado sin prompt. Estado actual:', { deferredPrompt: !!deferredPrompt, promptRef: !!promptRef.current });
                  if (promptRef.current) {
                    setDeferredPrompt(promptRef.current);
                    handleInstall();
                  }
                }}
                className="w-full py-4 bg-slate-200 text-slate-500 font-bold rounded-xl flex items-center justify-center gap-3 cursor-wait"
                data-testid="pwa-install-button-waiting"
              >
                <Download className="w-5 h-5" />
                Preparando instalacion...
              </button>
            </div>
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

// Hook for parent components to check PWA install availability
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
