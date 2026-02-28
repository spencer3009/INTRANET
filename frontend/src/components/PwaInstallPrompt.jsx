import { useState, useEffect, useRef } from "react";
import { Smartphone, Download, ExternalLink, Chrome } from "lucide-react";

const APP_URL = "https://edunet.pe/login";

// Detect in-app browsers (WhatsApp, Facebook, Instagram, etc.)
function detectWebView() {
  const ua = navigator.userAgent || "";
  return /wv|WebView/i.test(ua) ||
    /FBAN|FBAV/i.test(ua) ||
    /Instagram/i.test(ua) ||
    /WhatsApp/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /Line\//i.test(ua) ||
    /MicroMessenger/i.test(ua) ||
    /Snapchat/i.test(ua) ||
    /TikTok/i.test(ua);
}

export default function PwaInstallPrompt({ mode = "inline" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const promptRef = useRef(null);
  const isWebView = detectWebView();

  useEffect(() => {
    console.log('[PWA] === INICIALIZANDO ===');
    console.log('[PWA] UserAgent:', navigator.userAgent);
    console.log('[PWA] WebView detectado:', isWebView);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || window.__pwaInstalled) {
      setInstalled(true);
      return;
    }

    // Don't bother with install logic in WebView
    if (isWebView) {
      console.log('[PWA] WebView detectado - mostrando instrucciones para abrir en Chrome');
      return;
    }

    // Check if prompt was captured globally before React
    if (window.__pwaInstallPromptFired && window.__pwaInstallPrompt) {
      promptRef.current = window.__pwaInstallPrompt;
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handler = (e) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt DISPARADO');
      promptRef.current = e;
      setDeferredPrompt(e);
    };

    const installedHandler = () => {
      console.log('[PWA] APP INSTALADA');
      setInstalled(true);
      setDeferredPrompt(null);
      promptRef.current = null;
      window.__pwaInstalled = true;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [isWebView]);

  const handleInstall = async () => {
    const activePrompt = deferredPrompt || promptRef.current || window.__pwaInstallPrompt;
    if (!activePrompt) return;

    setInstalling(true);
    setProgress(0);

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
      activePrompt.prompt();
      setProgress(90);
      const result = await activePrompt.userChoice;
      if (result.outcome === "accepted") {
        setProgress(100);
        await new Promise((r) => setTimeout(r, 600));
        setInstalled(true);
      }
    } catch (err) {
      console.error('[PWA] ERROR:', err);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  };

  const handleOpenInChrome = () => {
    // Try Android intent to open in Chrome
    const intentUrl = `intent://${APP_URL.replace('https://', '')}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
    // Fallback: just open the URL (will open in default browser on some devices)
    setTimeout(() => {
      window.location.href = APP_URL;
    }, 500);
  };

  // Inline mode: only show if prompt available and not WebView
  if (mode !== "hero" && (!deferredPrompt || installed || isWebView)) return null;
  if (installed) return null;

  // Hero mode
  if (mode === "hero") {
    // WebView detected - show "Open in Chrome" card
    if (isWebView) {
      return (
        <div className="text-center" data-testid="pwa-webview-warning">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shadow-lg">
            <ExternalLink className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Instalar EduNet correctamente
          </h2>
          <p className="text-sm text-slate-500 mb-5 leading-relaxed">
            Para instalar EduNet debe abrir este enlace en <strong className="text-slate-700">Chrome</strong>.
          </p>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Los navegadores internos como WhatsApp no permiten instalar la aplicacion.
          </p>

          <button
            onClick={handleOpenInChrome}
            className="w-full py-4 bg-[#001f4b] text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-[#0a3068] active:scale-[0.98] transition-all shadow-lg mb-5"
            style={{ boxShadow: '0 10px 30px -10px rgba(0,31,75,0.5)' }}
            data-testid="open-in-chrome-button"
          >
            <Chrome className="w-5 h-5" />
            Abrir en Chrome
          </button>

          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-slate-600 mb-2">Si no abre automaticamente:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center">1</span>
                <p className="text-xs text-slate-500">Toque <strong className="text-slate-700">&#8942;</strong> (tres puntos) arriba a la derecha</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#001f4b] text-white text-xs font-bold flex items-center justify-center">2</span>
                <p className="text-xs text-slate-500">Seleccione <strong className="text-slate-700">"Abrir en Chrome"</strong></p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Normal Chrome - show install button
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
