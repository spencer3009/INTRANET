import { useState, useEffect } from "react";
import axios from "axios";
import {
  X, Camera, Keyboard, Volume2, VolumeX, Smartphone,
  Bus, Clock, Lock, LogOut, Zap, Hand
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STORAGE_KEY = "movilidad_scan_preferences";

export function getMovilidadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export default function MovilidadSettingsModal({ open, onClose, token, onLogout }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [turnos, setTurnos] = useState([]);

  const defaults = {
    modo_escaneo: "camara",
    modo_lectura: "continuo",
    sonidos: true,
    vibracion: true,
  };

  const [prefs, setPrefs] = useState(() => ({ ...defaults, ...getMovilidadPreferences() }));

  useEffect(() => {
    if (open) {
      axios.get(`${API}/movilidad/registro/dashboard`, { headers })
        .then(res => setTurnos(res.data?.conteo_por_turno || []))
        .catch(() => {});
    }
  }, [open]);

  const update = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePreferences(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-md shadow-2xl overflow-y-auto animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
        data-testid="movilidad-settings-modal"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-800">Configuracion</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" data-testid="movilidad-settings-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Scan Preferences */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Preferencias de Escaneo</h3>

            {/* Scan mode */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Modo de escaneo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => update("modo_escaneo", "camara")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    prefs.modo_escaneo === "camara"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  data-testid="pref-mode-camara"
                >
                  <Camera className="w-4 h-4" />
                  Camara
                </button>
                <button
                  onClick={() => update("modo_escaneo", "usb")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    prefs.modo_escaneo === "usb"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  data-testid="pref-mode-usb"
                >
                  <Keyboard className="w-4 h-4" />
                  Lector USB
                </button>
              </div>
            </div>

            {/* Reading mode */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Modo de lectura</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => update("modo_lectura", "continuo")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    prefs.modo_lectura === "continuo"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  data-testid="pref-read-continuo"
                >
                  <Zap className="w-4 h-4" />
                  Flujo continuo
                </button>
                <button
                  onClick={() => update("modo_lectura", "manual")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    prefs.modo_lectura === "manual"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  data-testid="pref-read-manual"
                >
                  <Hand className="w-4 h-4" />
                  Con boton
                </button>
              </div>
            </div>

            {/* Sounds toggle */}
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                {prefs.sonidos ? <Volume2 className="w-5 h-5 text-violet-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-700">Sonidos de feedback</p>
                  <p className="text-xs text-slate-400">Beeps de exito y error</p>
                </div>
              </div>
              <button
                onClick={() => update("sonidos", !prefs.sonidos)}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs.sonidos ? 'bg-violet-500' : 'bg-slate-300'}`}
                data-testid="pref-sonidos"
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.sonidos ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Vibration toggle */}
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <Smartphone className={`w-5 h-5 ${prefs.vibracion ? 'text-violet-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Vibracion en movil</p>
                  <p className="text-xs text-slate-400">Vibracion al escanear</p>
                </div>
              </div>
              <button
                onClick={() => update("vibracion", !prefs.vibracion)}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs.vibracion ? 'bg-violet-500' : 'bg-slate-300'}`}
                data-testid="pref-vibracion"
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.vibracion ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Turnos (read-only) */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Turnos Configurados</h3>
            {turnos.length === 0 ? (
              <p className="text-sm text-slate-400">No hay turnos configurados.</p>
            ) : (
              <div className="space-y-2">
                {turnos.map(t => (
                  <div key={t.turno_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Bus className="w-4 h-4 text-violet-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{t.turno_nombre}</p>
                      <p className="text-xs text-slate-400">{t.hora_inicio} - {t.hora_fin}</p>
                    </div>
                    <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">Activo</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3 italic">
              Para modificar turnos, contacte al propietario o administrador.
            </p>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Cuenta</h3>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-sm font-medium"
              data-testid="movilidad-settings-logout"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
