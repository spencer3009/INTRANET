import { createContext, useContext, useState, useCallback } from 'react';
import DemoBlockedModal from '@/components/DemoBlockedModal';

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
  
  /**
   * Handle API errors - shows demo modal if it's a demo blocked error
   * Returns true if it was a demo error (handled), false otherwise
   * Usage: if (handleDemoError(err)) return; else setError(err.message);
   */
  const handleDemoError = useCallback((err) => {
    const errorMessage = err?.response?.data?.detail || "";
    const statusCode = err?.response?.status;
    
    if (
      errorMessage.toLowerCase().includes("modo visitante") ||
      errorMessage.toLowerCase().includes("demo") ||
      (statusCode === 403 && isDemoUser)
    ) {
      setShowDemoModal(true);
      return true;
    }
    return false;
  }, [isDemoUser]);
  
  const closeDemoModal = useCallback(() => {
    setShowDemoModal(false);
  }, []);
  
  return (
    <DemoModeContext.Provider value={{ 
      isDemoUser, 
      checkDemoAccess, 
      wrapDemoCheck,
      handleDemoError,
      showDemoModal,
      closeDemoModal 
    }}>
      {children}
      
      {/* Global Demo Mode Modal */}
      <DemoBlockedModal isOpen={showDemoModal} onClose={closeDemoModal} />
    </DemoModeContext.Provider>
  );
}

/**
 * Hook to access demo mode functionality
 * @returns {{ isDemoUser: boolean, checkDemoAccess: () => boolean, wrapDemoCheck: (fn) => fn, handleDemoError: (err) => boolean }}
 */
export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      isDemoUser: false,
      checkDemoAccess: () => true,
      wrapDemoCheck: (fn) => fn,
      handleDemoError: () => false,
      showDemoModal: false,
      closeDemoModal: () => {}
    };
  }
  return context;
}

export default DemoModeContext;
