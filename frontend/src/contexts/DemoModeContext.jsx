import { createContext, useContext, useState, useCallback } from 'react';
import { Eye, X } from 'lucide-react';

const DemoModeContext = createContext(null);

/**
 * Demo Mode Provider - Handles demo user restrictions and modals
 * Wrap your app with this provider to enable demo mode functionality
 */
export function DemoModeProvider({ children, user }) {
  const [showDemoModal, setShowDemoModal] = useState(false);
  
  const isDemoUser = user?.is_demo_user === true;
  
  /**
   * Check if action is allowed for demo user
   * If not, shows the demo modal and returns false
   * Usage: if (!checkDemoAccess()) return;
   */
  const checkDemoAccess = useCallback(() => {
    if (isDemoUser) {
      setShowDemoModal(true);
      return false;
    }
    return true;
  }, [isDemoUser]);
  
  /**
   * Wrapper for onClick handlers that checks demo access first
   * Usage: onClick={wrapDemoCheck(() => handleSave())}
   */
  const wrapDemoCheck = useCallback((callback) => {
    return (...args) => {
      if (isDemoUser) {
        setShowDemoModal(true);
        return;
      }
      callback?.(...args);
    };
  }, [isDemoUser]);
  
  const closeDemoModal = useCallback(() => {
    setShowDemoModal(false);
  }, []);
  
  return (
    <DemoModeContext.Provider value={{ 
      isDemoUser, 
      checkDemoAccess, 
      wrapDemoCheck,
      showDemoModal,
      closeDemoModal 
    }}>
      {children}
      
      {/* Demo Mode Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" data-testid="demo-mode-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Modo Visitante</h2>
                    <p className="text-blue-100 text-sm">Versión demostrativa</p>
                  </div>
                </div>
                <button 
                  onClick={closeDemoModal}
                  className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  data-testid="demo-modal-close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-slate-700 text-base leading-relaxed">
                Estás explorando <span className="font-semibold text-blue-600">EduNet</span> en modo demostración.
              </p>
              <p className="text-slate-600 mt-3">
                Las funciones de creación y edición están deshabilitadas en esta versión.
              </p>
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">💡 Cuando contrates el servicio</span> tendrás acceso completo a todas las funcionalidades del sistema.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={closeDemoModal}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
                data-testid="demo-modal-confirm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </DemoModeContext.Provider>
  );
}

/**
 * Hook to access demo mode functionality
 * @returns {{ isDemoUser: boolean, checkDemoAccess: () => boolean, wrapDemoCheck: (fn) => fn }}
 */
export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      isDemoUser: false,
      checkDemoAccess: () => true,
      wrapDemoCheck: (fn) => fn,
      showDemoModal: false,
      closeDemoModal: () => {}
    };
  }
  return context;
}

export default DemoModeContext;
