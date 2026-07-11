// Kindred Guild — Service Worker
// IMPORTANT: bump CACHE_NAME on every deploy that changes any file in
// STATIC_ASSETS (especially site-nav.js). Changing this string is what makes
// the browser detect the service worker file as "updated", install a fresh
// cache, and purge the old one in activate() below. Forgetting to bump this
// means returning users can be stuck on stale cached JS/CSS indefinitely,
// even after a hard refresh, because cache-first below never re-checks the
// network once something is cached.
const CACHE_NAME = 'kindred-guild-v2';
const STATIC_ASSETS = [
  '/',
  '/css/globals.css',
  '/css/layout-fix.css',
  '/js/supabase-client.js',
  '/manifest.json',
  '/logo-192.png',
  '/logo.png',
  '/site-nav.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for API calls
  if (event.request.url.includes('supabase.co') || event.request.url.includes('api.')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first, cache-fallback for everything else (including site-nav.js).
  // This means a logic fix deployed to the server reaches users on their very
  // next load while online, instead of being silently masked by an old cache.
  // The cache is only used as an offline fallback, and is refreshed on every
  // successful network fetch.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
