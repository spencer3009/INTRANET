const CACHE_NAME = 'edunet-v7';

const OFFLINE_RESPONSE = new Response(
  JSON.stringify({ error: "offline" }),
  { status: 503, headers: { "Content-Type": "application/json" } }
);

// Install: skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: claim all clients, clear old caches
self.addEventListener('activate', (event) => {
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

// Fetch handler
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip non-GET requests entirely (POST/PUT/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // Skip API requests entirely (never cache, never intercept)
  if (request.url.includes('/api/')) return;

  // Skip WebSocket and chrome-extension requests
  if (request.url.startsWith('ws') || request.url.startsWith('chrome-extension')) return;

  // Navigation requests: network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          caches.match('/index.html').then((cached) =>
            cached || new Response('<html><body><h1>Sin conexion</h1></body></html>', {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            })
          )
        )
    );
    return;
  }

  // Static assets: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && request.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response('', { status: 503 })
        )
      )
  );
});
