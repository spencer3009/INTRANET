import { useState, useEffect } from "react";
import axios from "axios";
import { Info, X, Sparkles, Trash2, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DemoBanner({ token, onDemoDeleted }) {
  const [demoStatus, setDemoStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    // Defer initial request 1.2s so we don't pile on during the login burst.
    const t = setTimeout(() => { checkDemoStatus(); }, 1200);
    return () => clearTimeout(t);
  }, []);

  const checkDemoStatus = async () => {
    try {
      const res = await axios.get(`${API}/demo-data/status`, { headers });
      setDemoStatus(res.data);
    } catch (err) {
      console.log("Could not check demo status");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDemo = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/demo-data`, { headers });
      setDemoStatus({ ...demoStatus, has_demo_data: false });
      setShowConfirm(false);
      if (onDemoDeleted) onDemoDeleted();
    } catch (err) {
      console.error("Error deleting demo data:", err);
    } finally {
      setDeleting(false);
    }
  };

  // Don't show if loading, dismissed, or no demo data
  if (loading || dismissed || !demoStatus?.has_demo_data) {
    return null;
  }

  return (
    <>
      {/* Main Banner */}
      <div 
        className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-5 mb-6 shadow-xl overflow-hidden"
        data-testid="demo-banner"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        
        <div className="relative flex items-start gap-4">
          {/* Icon */}
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-bold text-lg">
                ¡Bienvenido a tu nueva intranet!
              </h3>
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                DEMO
              </span>
            </div>
            <p className="text-white/90 text-sm leading-relaxed mb-3">
              Hemos agregado información de ejemplo para ayudarte a explorar todas las funcionalidades. 
              Puedes editar, eliminar o reemplazar estos datos cuando desees.
            </p>
            
            {/* Demo counts */}
            {demoStatus.demo_counts && (
              <div className="flex flex-wrap gap-2 mb-4">
                {demoStatus.demo_counts.users > 0 && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">
                    {demoStatus.demo_counts.users} usuarios demo
                  </span>
                )}
                {demoStatus.demo_counts.subjects > 0 && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">
                    {demoStatus.demo_counts.subjects} asignaturas
                  </span>
                )}
                {demoStatus.demo_counts.news > 0 && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">
                    {demoStatus.demo_counts.news} noticias
                  </span>
                )}
                {demoStatus.demo_counts.events > 0 && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">
                    {demoStatus.demo_counts.events} eventos
                  </span>
                )}
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar datos demo
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-sm font-semibold hover:bg-white/90 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  ¿Eliminar datos de demostración?
                </h3>
                <p className="text-sm text-gray-500">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Se eliminarán todos los usuarios, asignaturas, noticias, eventos y pagos marcados como demo. 
              Tus datos reales no serán afectados.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteDemo}
                disabled={deleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
