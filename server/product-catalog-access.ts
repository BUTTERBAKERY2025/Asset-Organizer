import type { Request, RequestHandler, Response, NextFunction } from "express";
import { requirePermission } from "./auth";
import { PRODUCT_CATALOG_READ_MODULES } from "@shared/schema";

/**
 * Product catalog reads are shared by operations, products, and production
 * workflows.  Keep this list deliberately limited to modules that explicitly
 * grant catalog read access; in particular, do not infer access from a job
 * title or from any write action.
 */
export { PRODUCT_CATALOG_READ_MODULES };

type PermissionAttempt = {
  granted: boolean;
  statusCode?: number;
  body?: unknown;
  ended?: boolean;
};

/**
 * Run one of the existing permission middleware instances without allowing a
 * failed candidate to finish the real response.  This preserves all of
 * requirePermission's role auto-grants and explicit-action semantics while
 * allowing the next catalog module to be tried.
 */
async function tryCatalogPermission(
  req: Request,
  res: Response,
  permissionMiddleware: RequestHandler,
): Promise<PermissionAttempt> {
  return new Promise<PermissionAttempt>((resolve, reject) => {
    let settled = false;
    let nextCalled = false;
    const denial: PermissionAttempt = { granted: false };

    const probeResponse = {
      status(code: number) {
        denial.statusCode = code;
        return probeResponse;
      },
      json(body: unknown) {
        denial.body = body;
        return probeResponse;
      },
      send(body: unknown) {
        denial.body = body;
        return probeResponse;
      },
      end() {
        denial.ended = true;
        return probeResponse;
      },
      setHeader() {
        return probeResponse;
      },
      set() {
        return probeResponse;
      },
    } as unknown as Response;

    const next: NextFunction = (error?: any) => {
      if (error) {
        if (settled) return;
        settled = true;
        reject(error);
        return;
      }
      // Wait for the middleware's returned promise as well.  This prevents
      // an error thrown after next() from being swallowed by this probe.
      nextCalled = true;
    };

    try {
      const result = permissionMiddleware(req, probeResponse, next);
      Promise.resolve(result).then(() => {
        if (settled) return;

        if (nextCalled) {
          settled = true;
          resolve({ granted: true });
          return;
        }

        // A permission middleware should either call next or send a denial.
        // Treat an incomplete middleware as an error rather than accidentally
        // granting access.
        if (denial.statusCode === undefined) {
          settled = true;
          reject(new Error("Catalog permission middleware completed without a decision"));
          return;
        }
        settled = true;
        resolve(denial);
      }, (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      reject(error);
    }
  });
}

/**
 * Require an explicit `view` permission on at least one approved catalog
 * module.  Each candidate is checked through requirePermission so its existing
 * admin/role auto-grants, permission cache, and error behavior remain intact.
 */
export const requireProductCatalogRead: RequestHandler = async (req, res, next) => {
  let firstDenial: PermissionAttempt | undefined;

  try {
    for (const module of PRODUCT_CATALOG_READ_MODULES) {
      const result = await tryCatalogPermission(
        req,
        res,
        requirePermission(module, "view"),
      );
      if (result.granted) {
        return next();
      }
      firstDenial ??= result;
    }
  } catch (error) {
    return next(error);
  }

  // All candidates denied. Replay the first existing permission response so a
  // denied request is never silently converted into a successful route.
  if (firstDenial?.statusCode !== undefined) {
    const status = res.status(firstDenial.statusCode);
    if (firstDenial.ended && typeof status.end === "function") {
      return status.end();
    }
    if (typeof status.json === "function") {
      return status.json(firstDenial.body);
    }
    return status.send(firstDenial.body);
  }

  return next(new Error("Catalog permission checks completed without a decision"));
};

/**
 * Catalog responses must not be reused after a permission is revoked.
 * api-cache also bypasses these paths, but keep this route-level policy
 * explicit for every successful and denied catalog read.
 */
export const noStoreProductCatalogRead: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};