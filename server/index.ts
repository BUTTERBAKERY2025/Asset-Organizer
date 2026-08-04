import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
// import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import compression from "compression";
import { db, pool, runStartupMigrations, warmupPool } from "./db";
import { sql } from "drizzle-orm";
import { securityHeaders, csrfProtection, apiRateLimiter } from "./security";

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);
app.use(compression({
  threshold: 128,
  level: 6,
  memLevel: 9,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
app.use(securityHeaders);
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/public/') && req.method === 'GET') {
    return next();
  }
  return apiRateLimiter(req, res, next);
});
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/public/')) {
    return next();
  }
  return csrfProtection(req, res, next);
});


// Helmet disabled in development to allow Replit iframe embedding
if (process.env.NODE_ENV === "production") {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameAncestors: ["'self'", "https://*.replit.dev", "https://*.replit.app", "https://*.repl.co"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
  app.use((req, res, next) => {
    if (
      req.path === '/vote-resolution.html' ||
      req.path === '/sign-resolution.html' ||
      req.path === '/sign-financial.html' ||
      req.path === '/discount-standalone.html' ||
      req.path === '/print-document.html' ||
      req.path.startsWith('/api/public/')
    ) {
      return next();
    }
    return helmetMiddleware(req, res, next);
  });
}

// Serve attached_assets statically for inventory images
// Note: These are non-sensitive equipment photos, not confidential business data
app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

// Serve uploads directory - require session authentication and prevent path traversal
app.use('/uploads', (req, res, next) => {
  if (!(req as any).session?.userId) {
    return res.status(401).json({ error: "غير مصرح بالوصول" });
  }
  const requestedPath = decodeURIComponent(req.path);
  if (requestedPath.includes('..') || requestedPath.includes('\0')) {
    return res.status(400).json({ error: "مسار غير صالح" });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  return next();
}, express.static(path.join(process.cwd(), 'uploads'), {
  dotfiles: 'deny',
  index: false,
}));

// Serve public assets (logo, etc.) for PDF generation
app.use('/assets', express.static(path.join(process.cwd(), 'public/assets')));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  if (reqPath.startsWith("/api")) {
    req.setTimeout(30000);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      // Tiered logging: critical >2s, slow >500ms, watch >200ms
      if (duration > 2000) {
        log(`🔴 CRITICAL ${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
      } else if (duration > 500) {
        log(`🟠 SLOW ${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
      } else if (duration > 200) {
        log(`🟡 WATCH ${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
      }
    }
  });

  next();
});

app.set('json spaces', 0);

// Health check endpoint
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
    });
  }
});

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  log(`${signal} received, starting graceful shutdown...`, "shutdown");
  
  // Close HTTP server first (stop accepting new requests)
  httpServer.close(async (err) => {
    if (err) {
      log(`Error during server close: ${err.message}`, "shutdown");
    } else {
      log("HTTP server closed successfully", "shutdown");
    }
    
    // Close database pool
    try {
      await pool.end();
      log("Database pool closed successfully", "shutdown");
    } catch (dbErr) {
      log(`Error closing database pool: ${dbErr}`, "shutdown");
    }
    
    process.exit(err ? 1 : 0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    log("Forced shutdown after timeout", "shutdown");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  await warmupPool();
  await runStartupMigrations();
  await registerRoutes(httpServer, app);
  
  // Ensure Supabase Storage bucket exists on startup
  try {
    const { ensureBucketExists } = await import("./supabase-storage");
    await ensureBucketExists();
  } catch (e) {
    console.log("Supabase Storage bucket setup skipped:", e instanceof Error ? e.message : e);
  }
  
  // Phase 11: start scheduler (queue worker + monthly reports)
  try {
    const { startScheduler } = await import("./scheduler");
    startScheduler();
  } catch (e) {
    console.log("Scheduler start failed:", e instanceof Error ? e.message : e);
  }

  // Register object storage routes for file uploads (after session middleware)
  // registerObjectStorageRoutes(app); // Disabled - using Supabase Storage instead

  // Improved error handling - log but don't rethrow
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Error: ${message} (${status})`, "error");
    if (err.stack) {
      log(`Stack: ${err.stack}`, "error");
    }
    
    if (!res.headersSent) {
      const isProduction = process.env.NODE_ENV === "production";
      const clientMessage = isProduction && status >= 500
        ? "حدث خطأ داخلي في الخادم"
        : message;
      res.status(status).json({ message: clientMessage });
    }
  });

  if (process.env.NODE_ENV === "production") {
    try {
      const { execFileSync } = await import("child_process");
      execFileSync("node", ["scripts/precompress.js"], { timeout: 30000 });
      log("Static assets precompressed", "precompress");
    } catch (e) {
      log("Precompression skipped", "precompress");
    }
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
