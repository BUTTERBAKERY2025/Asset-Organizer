const CACHE_PREFIX = 'btr_qc_';
const MAX_ENTRIES = 60;
const CACHE_VERSION = 1;

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
    const raw = sessionStorage.getItem(getCacheKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.v === CACHE_VERSION) {
        memoryCache = parsed;
        return memoryCache!;
      }
    }
  } catch {}
  memoryCache = { v: CACHE_VERSION, e: {} };
  return memoryCache;
}

function persist() {
  try {
    sessionStorage.setItem(getCacheKey(), JSON.stringify(memoryCache));
  } catch {
    const store = getStore();
    const entries = Object.entries(store.e);
    entries.sort((a, b) => a[1].t - b[1].t);
    const half = Math.floor(entries.length / 2);
    for (let i = 0; i < half; i++) {
      delete store.e[entries[i][0]];
    }
    try {
      sessionStorage.setItem(getCacheKey(), JSON.stringify(memoryCache));
    } catch {}
  }
}

export function getCachedData(queryKey: string): any | undefined {
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
  '/api/branches',
  '/api/products',
  '/api/product-categories',
  '/api/departments',
  '/api/roles',
  '/api/operations/products',
  '/api/contractors',
  '/api/branch-cashiers',
  '/api/chart-of-accounts',
  '/api/dashboard/stats',
  '/api/command-center',
  '/api/warehouse/items',
  '/api/targets',
  '/api/construction-projects',
]);

export function shouldPersist(url: string): boolean {
  const basePath = url.split('?')[0];
  return PERSIST_ENDPOINTS.has(basePath);
}
