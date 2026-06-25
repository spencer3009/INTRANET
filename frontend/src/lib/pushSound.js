// pushSound.js — utilidades para reproducir el sonido de notificación push en la PWA.
// El truco clave en móvil (Android/Chrome): el autoplay de audio está bloqueado
// hasta que el usuario interactúa. Por eso "cebamos" (prime) una instancia de Audio
// dentro de un gesto del usuario (click/tap) y luego la reutilizamos cuando llega la push.

const SOUND_URL = "/sounds/notify.mp3";

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!window.__pushAudio) {
    try {
      window.__pushAudio = new Audio(SOUND_URL);
      window.__pushAudio.preload = "auto";
    } catch {
      return null;
    }
  }
  return window.__pushAudio;
}

// Debe llamarse DENTRO de un gesto del usuario (onClick/onTap).
// Reproduce y pausa inmediatamente para desbloquear el autoplay.
// Devuelve una promesa que resuelve true si el audio quedó desbloqueado.
export function primePushAudio() {
  const a = getAudio();
  if (!a) return Promise.resolve(false);
  return a
    .play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      window.__pushAudioUnlocked = true;
      return true;
    })
    .catch(() => {
      window.__pushAudioUnlocked = false;
      return false;
    });
}

// Reproduce el sonido reutilizando la instancia ya desbloqueada.
export function playPushSound() {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

// Solicita permiso de notificación (solo si está en 'default').
// Devuelve 'granted' | 'denied' | 'unsupported'.
export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = Notification.permission;
    }
  }
  return perm;
}
