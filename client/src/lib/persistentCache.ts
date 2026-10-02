const CACHE_PREFIX = 'btr_qc_';
const MAX_ENTRIES = 60;
const CACHE_VERSION = 5;

interface CacheEntry {
  d: any;
  t: number;
  ttl: number;
}

interface CacheStore {
  v: number;
  e: Record<string, CacheEntry>;
}

let memoryCache: CacheStore | null = null;
let currentUserId: string | null = null;

function isEmployeeAccountSensitiveKey(queryKey: string) {
  const key = queryKey.toLowerCase();
  return key.startsWith("/api/operations/employee-accounts") || key.startsWith("/api/admin/employee-account-policy");
}

function isPrivatePortalKey(queryKey: string) {
  return queryKey.toLowerCase().startsWith("/api/my/");
}

function getCacheKey(): string {
  return CACHE_PREFIX + (currentUserId || 'anon');
}

export function setCurrentUser(userId: string | null) {
  if (currentUserId !== userId) {
    memoryCache = null;
    currentUserId = userId;
  }
}

export function clearPersistentCache() {
  memoryCache = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

function getStore(): CacheStore {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.v === CACHE_VERSION) {
        memoryCache = parsed;
        return memoryCache!;
      }
    }
  } catch {}
  try {
    const raw = sessionStorage.getItem(getCacheKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.v === CACHE_VERSION || parsed.v === 1) {
        parsed.v = CACHE_VERSION;
        memoryCache = parsed;
        persist();
        sessionStorage.removeItem(getCacheKey());
        return memoryCache!;
      }
    }
  } catch {}
  memoryCache = { v: CACHE_VERSION, e: {} };
  return memoryCache;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(memoryCache));
    } catch {
      const store = getStore();
      const entries = Object.entries(store.e);
      entries.sort((a, b) => a[1].t - b[1].t);
      const half = Math.floor(entries.length / 2);
      for (let i = 0; i < half; i++) {
        delete store.e[entries[i][0]];
      }
      try {
        localStorage.setItem(getCacheKey(), JSON.stringify(memoryCache));
      } catch {}
    }
  }, 100);
}

export function getCachedData(queryKey: string): any | undefined {
  if (isPrivatePortalKey(queryKey)) return undefined;
  if (isEmployeeAccountSensitiveKey(queryKey)) return undefined;
  if (queryKey.toLowerCase().startsWith('/api/owner/') || queryKey.toLowerCase().startsWith('/api/operations-hr/') || queryKey.toLowerCase().startsWith('/api/operations-center/')) return undefined;
  const store = getStore();
  const entry = store.e[queryKey];
  if (!entry) return undefined;
  if (Date.now() - entry.t > entry.ttl) {
    delete store.e[queryKey];
    return undefined;
  }
  return entry.d;
}

export function setCachedData(queryKey: string, data: any, ttlMs: number) {
  if (isPrivatePortalKey(queryKey)) return;
  if (isEmployeeAccountSensitiveKey(queryKey)) return;
  if (queryKey.toLowerCase().startsWith('/api/owner/') || queryKey.toLowerCase().startsWith('/api/operations-hr/') || queryKey.toLowerCase().startsWith('/api/operations-center/')) return;
  if (queryKey === '/api/auth/me' && data?.role === 'business_owner') return;
  const store = getStore();
  store.e[queryKey] = { d: data, t: Date.now(), ttl: ttlMs };
  const keys = Object.keys(store.e);
  if (keys.length > MAX_ENTRIES) {
    const entries = Object.entries(store.e);
    entries.sort((a, b) => a[1].t - b[1].t);
    const toRemove = entries.slice(0, keys.length - MAX_ENTRIES);
    for (const [k] of toRemove) {
      delete store.e[k];
    }
  }
  persist();
}

const PERSIST_ENDPOINTS = new Set([
  '/api/products',
  '/api/product-categories',
  '/api/departments',
  '/api/roles',
  '/api/operations/products',
  '/api/contractors',
  '/api/branch-cashiers',
  '/api/chart-of-accounts',
  '/api/dashboard/stats',
  '/api/warehouse/items',
  '/api/targets',
  '/api/construction-projects',
  '/api/auth/me',
]);

export function shouldPersist(url: string): boolean {
  const basePath = url.split('?')[0];
  return PERSIST_ENDPOINTS.has(basePath);
}

export function hasValidSession(): boolean {
  const store = getStore();
  const authEntry = store.e['/api/auth/me'];
  if (!authEntry) return false;
  if (Date.now() - authEntry.t > authEntry.ttl) return false;
  return !!authEntry.d;
}

export function getCachedUser(): any | null {
  const store = getStore();
  const entry = store.e['/api/auth/me'];
  if (!entry) return null;
  return entry.d || null;
}
