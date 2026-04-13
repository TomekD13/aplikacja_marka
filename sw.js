// sw.js – Service Worker (Tematy Biblijne)
// Strategie: NetworkFirst dla index.html, StaleWhileRevalidate dla zasobów, NetworkOnly dla API

const CACHE_NAME   = 'tematy-biblijne-v1';
const STATIC_CACHE = 'tematy-biblijne-static-v1';

const PRECACHE = [
  'index.html',
  'styles.css',
  'app.js',
  'data.js',
  'manifest.json',
];

// ── Install: precache zasobów statycznych ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: usuń stare cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: strategie per zasób ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NetworkOnly dla API Anthropic
  if (url.hostname === 'api.anthropic.com') return;

  // NetworkOnly dla zewnętrznych zasobów
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.split('/').pop() || 'index.html';

  // NetworkFirst dla index.html
  if (path === '' || path === 'index.html') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // StaleWhileRevalidate dla CSS, JS, data.js, ikon
  event.respondWith(staleWhileRevalidate(event.request));
});

// NetworkFirst: próbuj sieć, fallback na cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline – brak dostępu do sieci.', { status: 503 });
  }
}

// StaleWhileRevalidate: odpowiedź z cache, odświeżenie w tle
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}
