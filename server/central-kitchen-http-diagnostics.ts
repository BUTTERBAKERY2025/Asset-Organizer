import { randomUUID } from "crypto";
import { performance } from "perf_hooks";
import type { NextFunction, Request, Response } from "express";

export const CENTRAL_KITCHEN_PROCESS_BOOT_ID = randomUUID();

type DiagnosticRecord = {
  component: "central-kitchen-http";
  event: "boot" | "start" | "stalled" | "finished" | "aborted";
  bootId: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  elapsedMs?: number;
  uptimeSec: number;
  rssMiB: number;
};

type DiagnosticOptions = {
  bootId?: string;
  logger?: (record: DiagnosticRecord) => void;
  monotonicNow?: () => number;
  uptime?: () => number;
  rssBytes?: () => number;
  stallMs?: number;
};

const defaultLogger = (record: DiagnosticRecord) => {
  console.log(`[central-kitchen-http] ${JSON.stringify(record)}`);
};

function routeLabel(method: string, path: string): string | null {
  if (method === "POST" && /^\/api\/central-kitchen-orders\/\d+\/request-change$/.test(path)) {
    return "request-change";
  }
  if (method !== "GET") return null;
  if (path === "/api/central-kitchen-orders") return "list";
  if (path === "/api/central-kitchen-orders/operations") return "operations";
  if (path === "/api/central-kitchen-orders/routing") return "routing";
  if (/^\/api\/central-kitchen-orders\/\d+$/.test(path)) return "detail";
  return null;
}

function metric(
  options: Required<Pick<DiagnosticOptions, "uptime" | "rssBytes">>,
): Pick<DiagnosticRecord, "uptimeSec" | "rssMiB"> {
  return {
    uptimeSec: Math.round(options.uptime()),
    rssMiB: Math.round(options.rssBytes() / 1_048_576),
  };
}

export function logCentralKitchenDiagnosticBoot(options: DiagnosticOptions = {}): void {
  const logger = options.logger || defaultLogger;
  const sources = {
    uptime: options.uptime || (() => process.uptime()),
    rssBytes: options.rssBytes || (() => process.memoryUsage().rss),
  };
  logger({
    component: "central-kitchen-http",
    event: "boot",
    bootId: options.bootId || CENTRAL_KITCHEN_PROCESS_BOOT_ID,
    ...metric(sources),
  });
}

export function createCentralKitchenHttpDiagnostics(options: DiagnosticOptions = {}) {
  const logger = options.logger || defaultLogger;
  const bootId = options.bootId || CENTRAL_KITCHEN_PROCESS_BOOT_ID;
  const monotonicNow = options.monotonicNow || (() => performance.now());
  const sources = {
    uptime: options.uptime || (() => process.uptime()),
    rssBytes: options.rssBytes || (() => process.memoryUsage().rss),
  };
  const stallMs = options.stallMs ?? 15_000;

  return (req: Request, res: Response, next: NextFunction): void => {
    const route = routeLabel(req.method, req.path);
    if (!route) {
      next();
      return;
    }

    const requestId = randomUUID();
    const startedAt = monotonicNow();
    const base = {
      component: "central-kitchen-http" as const,
      bootId,
      requestId,
      route,
      method: req.method,
    };
    logger({ ...base, event: "start", ...metric(sources) });

    let terminalRecorded = false;
    let stalledRecorded = false;
    const elapsedMs = () => Math.max(0, Math.round(monotonicNow() - startedAt));
    const timer = setTimeout(() => {
      if (terminalRecorded || stalledRecorded) return;
      stalledRecorded = true;
      logger({ ...base, event: "stalled", elapsedMs: elapsedMs(), ...metric(sources) });
    }, stallMs);
    timer.unref?.();

    const terminal = (event: "finished" | "aborted") => {
      if (terminalRecorded) return;
      terminalRecorded = true;
      clearTimeout(timer);
      logger({
        ...base,
        event,
        status: res.statusCode,
        elapsedMs: elapsedMs(),
        ...metric(sources),
      });
    };
    res.once("finish", () => terminal("finished"));
    res.once("close", () => terminal("aborted"));
    next();
  };
}