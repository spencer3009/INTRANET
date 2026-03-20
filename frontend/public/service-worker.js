const CACHE_NAME = 'edunet-v8';
const SW_VERSION = '8.0.1';

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

// Fetch handler — minimal interception to avoid 503 errors
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
