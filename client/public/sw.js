const CACHE_NAME = 'butter-v3';
const STATIC_CACHE = 'butter-static-v3';
const FONT_CACHE = 'butter-fonts-v2';
const API_CACHE = 'butter-api-v2';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

const API_CACHE_MAX_AGE = 30 * 1000;
const API_CACHE_MAX_ITEMS = 80;
const STATIC_CACHE_MAX_ITEMS = 200;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, STATIC_CACHE, FONT_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !keepCaches.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, FONT_CACHE));
    return;
  }

  if (url.pathname.startsWith('/assets/') && url.pathname.match(/\.[a-f0-9]{8,}\./)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/export') || url.pathname.includes('/download') || url.pathname.includes('/pdf')) {
      return;
    }
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response('', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      trimCache(API_CACHE, API_CACHE_MAX_ITEMS);
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) {
      const dateHeader = cached.headers.get('date');
      if (dateHeader && (Date.now() - new Date(dateHeader).getTime()) > API_CACHE_MAX_AGE) {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(STATIC_CACHE, STATIC_CACHE_MAX_ITEMS);
    }
    return response;
  }).catch(() => cached || new Response('', { status: 503 }));

  return cached || fetchPromise;
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    for (let i = 0; i < keys.length - maxItems; i++) {
      await cache.delete(keys[i]);
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PRECACHE') {
    const urls = event.data.urls || [];
    caches.open(STATIC_CACHE).then((cache) => {
      urls.forEach((url) => {
        cache.match(url).then((existing) => {
          if (!existing) fetch(url).then((res) => { if (res.ok) cache.put(url, res); });
        });
      });
    });
  }
});
