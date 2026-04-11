const CACHE_NAME = 'edunet-v9';
const SW_VERSION = '9.0.0';

// ══════════════════════════════════════════════════════════════════════════════
// FIREBASE CLOUD MESSAGING — merged here to avoid a second SW at the same scope
// ══════════════════════════════════════════════════════════════════════════════
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyCGG2RZtz7PbdJw5QewBl15qKDyibHIAVc",
    authDomain: "edunet-b38ce.firebaseapp.com",
    projectId: "edunet-b38ce",
    storageBucket: "edunet-b38ce.firebasestorage.app",
    messagingSenderId: "608156581464",
    appId: "1:608156581464:web:9746b5e1761bdf6185942d",
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = notification.title || "EduNet";
    const body = notification.body || "Tienes una nueva notificacion";

    self.registration.showNotification(title, {
      body: body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.student_id
        ? `attendance-${data.student_id}-${data.type}`
        : `notif-${data.notification_id || Date.now()}`,
      data: {
        student_id: data.student_id,
        type: data.type,
        notification_id: data.notification_id,
        url: data.student_id
          ? `/parent/dashboard?student=${data.student_id}`
          : "/",
      },
    });

    // Update PWA icon badge with real unread count
    const unreadCount = parseInt(data.unread_count || "0", 10);
    if (unreadCount > 0 && "setAppBadge" in self.registration) {
      self.registration.setAppBadge(unreadCount).catch(() => {});
    } else if ("clearAppBadge" in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
  });
} catch (e) {
  console.warn("[SW] Firebase Messaging init failed (non-fatal):", e.message);
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — handle taps on push notifications
// ══════════════════════════════════════════════════════════════════════════════
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlPath = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(urlPath);
          return;
        }
      }
      return clients.openWindow(urlPath);
    })
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// PWA LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

// Install: skip waiting immediately
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing v${SW_VERSION}`);
  self.skipWaiting();
});

// Activate: claim all clients, clear old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating v${SW_VERSION}`);
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

// Listen for skipWaiting message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FETCH HANDLER — required for PWA installability
// ══════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // ONLY handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests entirely (POST/PUT/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // Skip API requests entirely (never cache, never intercept)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) return;

  // Skip webpack HMR, sockjs, and dev-related requests
  if (url.pathname.includes('sockjs') || url.pathname.includes('hot-update')) return;

  // Navigation requests: network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache index.html for offline fallback
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => {
            if (cached) return cached;
            // Return a minimal offline page with 200 (NOT 503)
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>EduNet - Sin conexion</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0f4f8;"><div style="text-align:center;"><h2 style="color:#334155;">Sin conexion a internet</h2><p style="color:#64748b;">Verifica tu conexion e intenta de nuevo.</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">Reintentar</button></div></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          })
        )
    );
    return;
  }

  // Static assets: ONLY cache opportunistically on successful fetch
  // Do NOT intercept failures — let the browser handle errors naturally
  // This prevents 503 errors from appearing in the console
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp|gif)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Start network fetch in background
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // Network failed — return cached version if available
            // If no cache exists, return a transparent 1x1 pixel for images
            // or empty content for other assets — with status 200 to avoid 503
            if (cached) return cached;
            // For images: return transparent pixel
            if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif)$/)) {
              return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
            }
            // For JS/CSS: return empty — the app should still function
            return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
          });

        // If we have a cached version, return it immediately
        // and update the cache in the background (stale-while-revalidate)
        return cached || networkFetch;
      })
    );
    return;
  }

  // All other requests: don't intercept, let browser handle naturally
});
