import type { Express, Request, Response } from "express";
import { inArray } from "drizzle-orm";
import { branches } from "@shared/schema";
import { db } from "./db";
import { getAllowedBranchIds, isAuthenticated, requirePermission } from "./auth";
import { storage } from "./storage";

// Process-local hints. There is deliberately no replay buffer, event ID, or row data.
const streams = new Set<{
  res: Response;
  userId: string;
  selected: string[];
  queueHint: () => void;
  close: () => void;
}>();
const MAX_STREAMS = 200;
const MAX_USER_STREAMS = 4;
const HEARTBEAT_MS = 15_000;
const STREAM_LIFETIME_MS = 5 * 60_000;
const HINT_COALESCE_MS = 1_000;
// Audited against the actual workspace/queue source write registrations in
// routes.ts, hr-routes.ts, maintenance-tickets.ts, delivery-routes.ts,
// reverse-logistics-routes.ts and kitchen-warehouse-shipping-routes.ts.
// A prefix matches only itself or a slash-delimited child, never a sibling.
const WRITE_ROUTES = [
  /^\/api\/branch-complaints(?:\/|$)/,
  /^\/api\/maintenance-tickets(?:\/|$)/,
  /^\/api\/branch-daily-closures(?:\/|$)/,
  /^\/api\/cashier-journals(?:\/|$)/,
  /^\/api\/production-orders(?:\/|$)/,
  /^\/api\/advanced-production-orders(?:\/|$)/,
  /^\/api\/production-order-items(?:\/|$)/,
  /^\/api\/quality-checks(?:\/|$)/,
  /^\/api\/attendance(?:\/|$)/,
  /^\/api\/attendance-summary(?:\/|$)/,
  /^\/api\/shifts(?:\/|$)/,
  /^\/api\/shift-employees(?:\/|$)/,
  /^\/api\/shift-profiles(?:\/|$)/,
  /^\/api\/employee-schedules(?:\/|$)/,
  /^\/api\/branch-shifts(?:\/|$)/,
  /^\/api\/time-entries(?:\/|$)/,
  /^\/api\/timesheet-reports(?:\/|$)/,
  /^\/api\/hr\/leaves(?:\/|$)/,
  /^\/api\/hr\/advances(?:\/|$)/,
  /^\/api\/hr\/documents(?:\/|$)/,
  /^\/api\/reverse-logistics(?:\/|$)/,
  /^\/api\/deliveries(?:\/|$)/,
  /^\/api\/central-kitchen-orders(?:\/|$)/,
  /^\/api\/central-kitchen-demand(?:\/|$)/,
  /^\/api\/kitchen-warehouse-shipping(?:\/|$)/,
  /^\/api\/warehouse\/material-transfers(?:\/|$)/,
  /^\/api\/warehouse\/kitchen-raw-requests(?:\/|$)/,
  /^\/api\/purchasing\/requests(?:\/|$)/,
  /^\/api\/waste-reports(?:\/|$)/,
  /^\/api\/waste-items(?:\/|$)/,
  /^\/api\/display-bar(?:\/|$)/,
  /^\/api\/branch-employees(?:\/|$)/,
  /^\/api\/targets(?:\/|$)/,
  /^\/api\/analytics\/compute-daily-sales$/,
];

export function isOperationsCenterWrite(method: string, path: string): boolean {
  // These POSTs render a PDF without changing the timesheet business state.
  if (path === "/api/timesheet-reports/generate-branch-pdf" ||
      /^\/api\/timesheet-reports\/[^/]+\/generate-pdf$/.test(path)) return false;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    && WRITE_ROUTES.some(pattern => pattern.test(path));
}

export function parseOperationsCenterScope(input: unknown): string[] | null {
  const values = typeof input === "string" ? input.split(",") : input;
  if (!Array.isArray(values) || !values.length || values.length > 25 ||
      values.some(value => typeof value !== "string" || value.toLowerCase() === "all" || !/^[\w-]{1,80}$/.test(value))) return null;
  const unique = [...new Set(values as string[])];
  return unique.length ? unique : null;
}

// null means the *authoritative* actor scope is all branches; never derive this
// from a URL, request body, or stale request-local grants.
export function scopesOverlap(actorScope: string[] | null, selected: string[]): boolean {
  return actorScope === null || selected.some(id => actorScope.includes(id));
}

// Run the SAME request authorization chain on fresh session, user, grants and permissions.
// A streaming request's req.currentUser and req.userBranchAccess are snapshots, not credentials.
async function reauthorize(req: Request): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => req.session.reload(error => error ? reject(error) : resolve()));
    const lastActivity = req.session.lastActivity;
    const check = (middleware: ReturnType<typeof requirePermission>) => new Promise<boolean>((resolve, reject) => {
      const response = {
        status() { return this; },
        json() { resolve(false); return this; },
        send() { resolve(false); return this; },
        end() { resolve(false); return this; },
      } as unknown as Response;
      try {
        Promise.resolve(middleware(req, response, error => error ? reject(error) : resolve(true))).catch(reject);
      } catch (error) { reject(error); }
    });
    try {
      return await check(isAuthenticated) && await check(requirePermission("operations", "view"));
    } finally {
      // A passive heartbeat must not itself renew the session's inactivity timer.
      if (req.session) req.session.lastActivity = lastActivity;
    }
  } catch {
    return false;
  }
}

async function scopeValid(req: Request, selected: string[]): Promise<boolean> {
  const allowed = getAllowedBranchIds(req);
  if (allowed !== null && selected.some(id => !allowed.includes(id))) return false;
  const existing = await db.select({ id: branches.id }).from(branches)
    .where(inArray(branches.id, selected));
  return existing.length === selected.length;
}

export function registerOperationsCenterLive(app: Express): void {
  // Register before operational routes. Finish is after successful response/commit
  // for synchronous write handlers. No body/query branch ID is accepted as evidence
  // for routing: actor scope comes from freshly loaded user and branch grants.
  app.use((req, res, next) => {
    if (isOperationsCenterWrite(req.method, req.path)) {
      res.once("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const actorId = req.currentUser?.id;
        if (!actorId) return;
        void (async () => {
          const [actor, grants] = await Promise.all([
            storage.getUser(actorId),
            storage.getUserBranchAccess(actorId),
          ]);
          if (!actor || actor.isActive === "inactive") return;
          const actorScope = getAllowedBranchIds({ currentUser: actor, userBranchAccess: grants });
          for (const stream of streams) {
            if (scopesOverlap(actorScope, stream.selected)) stream.queueHint();
          }
        })().catch(() => {
          // Never send a hint when the actor's authoritative scope is unavailable.
        });
      });
    }
    next();
  });

  app.get("/api/operations-center/events", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    const selected = parseOperationsCenterScope(req.query.branchIds);
    if (!selected) return res.status(400).json({ message: "branchIds must list 1-25 branch IDs" });
    try {
      if (!(await scopeValid(req, selected))) return res.status(403).json({ message: "Branch scope unavailable" });
      const userStreams = [...streams].filter(stream => stream.userId === req.currentUser?.id).length;
      if (streams.size >= MAX_STREAMS || userStreams >= MAX_USER_STREAMS) {
        return res.status(429).set("Retry-After", "15").json({ message: "Too many live streams" });
      }
      res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      const entry = { res, userId: req.currentUser!.id, selected, queueHint: () => {}, close: () => {} };
      let closed = false;
      let queued = false;
      let lastHintAt = 0;
      let hintTimer: ReturnType<typeof setTimeout> | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let lifetime: ReturnType<typeof setTimeout> | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        clearTimeout(hintTimer);
        streams.delete(entry);
        res.end();
      };
      let validation: Promise<boolean> | undefined;
      const validate = (): Promise<boolean> => {
        if (closed) return Promise.resolve(false);
        if (!validation) {
          validation = (async () => {
            try {
              if (!(await reauthorize(req)) || !(await scopeValid(req, selected))) {
                if (!closed) res.write(`event: scope-invalidated\ndata: {}\n\n`);
                close();
                return false;
              }
              return !closed;
            } catch {
              close(); // DB/session failure: fail closed, not a successful hint
              return false;
            } finally {
              validation = undefined;
            }
          })();
        }
        return validation;
      };
      entry.queueHint = () => {
        if (closed || queued) return;
        queued = true;
        hintTimer = setTimeout(() => {
          hintTimer = undefined;
          void (async () => {
            try {
              if (await validate() && !closed) {
                lastHintAt = Date.now();
                // Only a query-invalidation hint for this subscriber's scope;
                // do not include actor, branch, route, IDs, or counts.
                if (!res.write(`event: invalidate\ndata: {"scope":"selected"}\n\n`)) close();
              }
            } finally {
              queued = false;
            }
          })().catch(close);
        }, Math.max(250, HINT_COALESCE_MS - (Date.now() - lastHintAt)));
      };
      entry.close = close;
      streams.add(entry);
      res.on("close", close);
      heartbeat = setInterval(async () => {
        if (await validate()) {
          // A comment is transport keepalive, NOT a business-data update.
          if (!res.write(": keepalive\n\n")) close();
        }
      }, HEARTBEAT_MS);
      lifetime = setTimeout(close, STREAM_LIFETIME_MS);
      if (!res.write(`event: ready\ndata: {"scope":"selected"}\n\n`)) close();
    } catch {
      if (!res.headersSent) res.status(503).json({ message: "Live authorization unavailable" });
      else res.end();
    }
  });
}