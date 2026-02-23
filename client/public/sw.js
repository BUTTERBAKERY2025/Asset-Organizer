const CACHE_NAME = 'butter-v5';
const STATIC_CACHE = 'butter-static-v5';
const FONT_CACHE = 'butter-fonts-v4';
const API_CACHE = 'butter-api-v4';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

const API_CACHE_MAX_AGE = 60 * 1000;
const API_CACHE_MAX_ITEMS = 150;
const STATIC_CACHE_MAX_ITEMS = 400;

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
    ).then(() => self.clients.claim())
  );
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

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/export') || url.pathname.includes('/download') || url.pathname.includes('/pdf') || url.pathname.includes('/file/')) {
      return;
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return;
    }
    const SAFE_STALE_ENDPOINTS = [
      '/api/branches', '/api/products', '/api/product-categories',
      '/api/departments', '/api/roles', '/api/operations/products',
      '/api/contractors', '/api/chart-of-accounts',
      '/api/targets', '/api/construction-projects',
      '/api/warehouse/items', '/api/branch-cashiers',
      '/api/biometric-settings', '/api/point-settings',
      '/api/product-commissions', '/api/checklist-templates',
    ];
    const basePath = url.pathname.split('?')[0];
    if (SAFE_STALE_ENDPOINTS.includes(basePath)) {
      event.respondWith(apiStaleWhileRevalidate(event.request));
    } else {
      event.respondWith(networkFirstFast(event.request));
    }
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
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('', { status: 503 });
  }
}

async function networkFirstFast(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      trimCacheAsync(API_CACHE, API_CACHE_MAX_ITEMS);
    }
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(STATIC_CACHE).then(c => {
        c.put(request, response.clone());
        trimCacheAsync(STATIC_CACHE, STATIC_CACHE_MAX_ITEMS);
      });
    }
    return response;
  }).catch(() => cached || new Response('', { status: 503 }));

  return cached || fetchPromise;
}

async function apiStaleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(API_CACHE).then(cache => {
        cache.put(request, response.clone());
        trimCacheAsync(API_CACHE, API_CACHE_MAX_ITEMS);
      });
    }
    return response;
  }).catch(() => {
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  return cached || fetchPromise;
}

let trimPending = new Set();
function trimCacheAsync(cacheName, maxItems) {
  if (trimPending.has(cacheName)) return;
  trimPending.add(cacheName);
  setTimeout(async () => {
    trimPending.delete(cacheName);
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map(k => cache.delete(k)));
    }
  }, 5000);
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
