const CACHE_NAME = 'butter-v8';
const STATIC_CACHE = 'butter-static-v8';
const FONT_CACHE = 'butter-fonts-v4';
const API_CACHE = 'butter-api-v7';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

const API_CACHE_MAX_AGE = 60 * 1000;
const API_CACHE_MAX_ITEMS = 200;
const STATIC_CACHE_MAX_ITEMS = 500;

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
    event.respondWith(networkFirstJs(event.request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/export') || url.pathname.includes('/download') || url.pathname.includes('/pdf') || url.pathname.includes('/file/')) {
      return;
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return;
    }
    // Permissions are security-sensitive: NEVER serve them from cache. A stale/empty
    // cached response makes the client think the user has no modules and bounces them
    // to /my-portal ("account not linked to employee"). Always go straight to network.
    if (url.pathname === '/api/my-permissions') {
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
      '/api/users',
      '/api/governance', '/api/security',
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
    // نجدد نسخة "/" المخزنة مع كل تحميل ناجح حتى لا يعلق المستخدم على index.html
    // قديم يشير إلى ملفات جافاسكربت محذوفة من السيرفر بعد نشر جديد.
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          // ننسخ الاستجابة فوراً ونربط الكتابة بعمر الحدث حتى لا يُنهى الـ SW قبل اكتمالها
          const copy = response.clone();
          event.waitUntil(
            caches.open(STATIC_CACHE).then((c) => c.put('/', copy)).catch(() => {})
          );
        }
        return response;
      }).catch(async () => (await caches.match('/')) || new Response('Offline', { status: 503 }))
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirstJs(request) {
  // مهلة زمنية: لو علّقت الشبكة لا يبقى استيراد الصفحة معلقاً للأبد (هيكل رمادي دائم)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) return cached;
    // خطأ شبكة صريح بدل استجابة فارغة 503: استجابة فارغة تجعل import() يعلق/يفشل
    // بصمت والصفحة تبقى على الهيكل الرمادي؛ الخطأ الصريح يفعّل منطق إعادة التحميل.
    return Response.error();
  }
}

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
    return Response.error();
  }
}

async function networkFirstFast(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
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

// ===== إشعارات الجوال (Web Push) =====
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'إشعار جديد';
  const options = {
    body: data.body || '',
    dir: 'rtl',
    lang: 'ar',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});
