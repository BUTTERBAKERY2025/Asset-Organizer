import type { Request, Response, NextFunction } from "express";

interface CacheEntry {
  data: Buffer;
  headers: Record<string, string>;
  statusCode: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;
const DEFAULT_TTL = 45_000;

const ROUTE_TTL: Record<string, number> = {
  "/api/branches": 300_000,
  "/api/products": 120_000,
  "/api/product-categories": 300_000,
  "/api/departments": 300_000,
  "/api/roles": 300_000,
  "/api/users": 120_000,
  "/api/permissions": 120_000,
  "/api/user-permissions": 120_000,
  "/api/my-permissions": 120_000,
  "/api/chart-of-accounts": 300_000,
  "/api/checklist-templates": 120_000,
  "/api/point-settings": 120_000,
  "/api/product-commissions": 120_000,
  "/api/waste-risk-rules": 120_000,
  "/api/inventory-items": 45_000,
  "/api/cashier-journals": 45_000,
  "/api/waste-reports": 45_000,
  "/api/daily-production-batches": 45_000,
  "/api/advanced-production-orders": 45_000,
  "/api/production-hub": 45_000,
  "/api/display-bar-receipts": 45_000,
  "/api/branch-employees": 60_000,
  "/api/attendance-records": 45_000,
  "/api/shifts": 60_000,
  "/api/branch-shifts": 60_000,
  "/api/construction-projects": 60_000,
  "/api/contractors": 120_000,
  "/api/maintenance-records": 60_000,
  "/api/marketing": 60_000,
  "/api/executive": 60_000,
  "/api/governance": 120_000,
  "/api/warehouse": 45_000,
  "/api/transfer-requests": 45_000,
  "/api/documents": 60_000,
  "/api/daily-sales-data": 45_000,
  "/api/targets": 60_000,
  "/api/cashier-daily-challenges": 60_000,
  "/api/branch-achievement-bonus": 60_000,
  "/api/cashier-points-ledger": 60_000,
  "/api/smart-incentives": 60_000,
  "/api/production-comparisons": 60_000,
  "/api/finished-goods": 45_000,
  "/api/command-center": 45_000,
  "/api/daily-production-stats": 45_000,
  "/api/advanced-production-order-stats": 45_000,
  "/api/production-ai-plans": 60_000,
  "/api/accounting": 60_000,
  "/api/salary": 60_000,
  "/api/pnl": 60_000,
  "/api/security": 120_000,
  "/api/social-responsibility": 60_000,
  "/api/system-notifications": 60_000,
  "/api/active-notifications": 60_000,
  "/api/biometric-settings": 120_000,
  "/api/operations/reports": 60_000,
  "/api/operations/reports-bundle": 60_000,
  "/api/operations/stats": 60_000,
  "/api/reports/branch-overview": 60_000,
  "/api/reports/executive-summary": 60_000,
  "/api/reports/payment-mismatch": 60_000,
  "/api/cashier-payment-breakdowns": 60_000,
  "/api/branch-cashiers": 120_000,
  "/api/pos/report": 60_000,
  "/api/pos/sales": 45_000,
  "/api/targets/progress-summary": 60_000,
  "/api/targets/leaderboard": 60_000,
};

function getTTL(path: string): number {
  for (const [pattern, ttl] of Object.entries(ROUTE_TTL)) {
    if (path === pattern || path.startsWith(pattern + "/") || path.startsWith(pattern + "?")) {
      return ttl;
    }
  }
  return DEFAULT_TTL;
}

function buildCacheKey(req: Request): string {
  const userId = (req as any).session?.userId;
  if (!userId) return ""; // Don't cache unauthenticated requests
  const activeBranchId = (req as any).session?.activeBranchId || "none";
  const queryStr = JSON.stringify(req.query);
  return `${userId}:${activeBranchId}:${req.method}:${req.path}:${queryStr}`;
}

export function invalidateCacheForUser(userId: string) {
  const keysToDelete: string[] = [];
  for (const [key] of Array.from(cache.entries())) {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

function evictOldest() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
  for (const [key] of toRemove) {
    cache.delete(key);
  }
}

export function apiCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET") {
    return next();
  }

  if (!req.path.startsWith("/api/")) {
    return next();
  }

  if (req.path.includes("/export") || req.path.includes("/download") || req.path.includes("/file/") || req.path.includes("/pdf")) {
    return next();
  }

  const key = buildCacheKey(req);
  if (!key) {
    return next();
  }
  
  const entry = cache.get(key);
  const ttl = getTTL(req.path);

  if (entry && (Date.now() - entry.timestamp) < ttl) {
    const etag = `"${entry.timestamp}"`;
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      res.set("X-Cache", "HIT-304");
      return res.status(304).end();
    }
    res.set("X-Cache", "HIT");
    res.set("ETag", etag);
    res.set("Cache-Control", `private, max-age=${Math.floor(ttl / 1000)}`);
    res.set("Content-Type", entry.headers["content-type"] || "application/json");
    if (entry.headers["content-encoding"]) {
      res.set("Content-Encoding", entry.headers["content-encoding"]);
    }
    return res.status(entry.statusCode).send(entry.data);
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let captured = false;

  res.json = function(body: any) {
    if (!captured && res.statusCode >= 200 && res.statusCode < 300) {
      captured = true;
      const data = Buffer.from(JSON.stringify(body));
      cache.set(key, {
        data,
        headers: { "content-type": "application/json; charset=utf-8" },
        statusCode: res.statusCode,
        timestamp: Date.now(),
      });
      evictOldest();
    }
    res.set("X-Cache", "MISS");
    return originalJson(body);
  };

  res.send = function(body: any) {
    if (!captured && res.statusCode >= 200 && res.statusCode < 300 && body) {
      captured = true;
      const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
      const contentType = res.getHeader("content-type") as string || "application/octet-stream";
      cache.set(key, {
        data,
        headers: { "content-type": contentType },
        statusCode: res.statusCode,
        timestamp: Date.now(),
      });
      evictOldest();
    }
    res.set("X-Cache", "MISS");
    return originalSend(body);
  };

  next();
}

const INVALIDATION_MAP: Record<string, string[]> = {
  "branches": ["/api/branches"],
  "products": ["/api/products", "/api/product-categories"],
  "users": ["/api/users", "/api/permissions", "/api/user-permissions"],
  "inventory": ["/api/inventory-items", "/api/command-center"],
  "cashier": ["/api/cashier-journals", "/api/command-center", "/api/pnl", "/api/daily-sales-data"],
  "production": ["/api/daily-production", "/api/production-hub", "/api/advanced-production-orders", "/api/command-center", "/api/finished-goods", "/api/production-comparisons"],
  "waste": ["/api/waste-reports", "/api/display-bar-receipts", "/api/command-center"],
  "attendance": ["/api/attendance-records", "/api/shifts", "/api/branch-shifts"],
  "employees": ["/api/branch-employees", "/api/users"],
  "warehouse": ["/api/warehouse", "/api/transfer-requests"],
  "maintenance": ["/api/maintenance-records"],
  "construction": ["/api/construction-projects", "/api/contractors"],
  "marketing": ["/api/marketing"],
  "executive": ["/api/executive"],
  "governance": ["/api/governance"],
  "accounting": ["/api/accounting", "/api/chart-of-accounts"],
  "incentives": ["/api/smart-incentives", "/api/cashier-points-ledger", "/api/point-settings", "/api/cashier-daily-challenges", "/api/branch-achievement-bonus", "/api/product-commissions"],
  "targets": ["/api/targets"],
  "documents": ["/api/documents"],
  "security": ["/api/security"],
  "social": ["/api/social-responsibility"],
  "salary": ["/api/salary"],
};

export function invalidateCache(category?: string) {
  if (!category) {
    cache.clear();
    return;
  }
  
  const patterns = INVALIDATION_MAP[category];
  if (!patterns) {
    cache.clear();
    return;
  }

  const keysToDelete: string[] = [];
  for (const [key] of Array.from(cache.entries())) {
    for (const pattern of patterns) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
        break;
      }
    }
  }
  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

export function invalidateCacheForPath(path: string) {
  const keysToDelete: string[] = [];
  for (const [key] of Array.from(cache.entries())) {
    if (key.includes(path)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
