import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";

let preloadHeaders: string[] = [];
let indexHtmlCache: Buffer | null = null;

function servePrecompressed(staticRoot: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const filePath = path.join(staticRoot, req.path);

    if (typeof acceptEncoding === "string" && acceptEncoding.includes("br")) {
      const brPath = filePath + ".br";
      if (fs.existsSync(brPath)) {
        res.set("Content-Encoding", "br");
        res.set("Vary", "Accept-Encoding");
        const ext = path.extname(filePath);
        if (ext === ".js") res.set("Content-Type", "application/javascript; charset=utf-8");
        else if (ext === ".css") res.set("Content-Type", "text/css; charset=utf-8");
        else if (ext === ".html") res.set("Content-Type", "text/html; charset=utf-8");
        return res.sendFile(brPath);
      }
    }

    if (typeof acceptEncoding === "string" && acceptEncoding.includes("gzip")) {
      const gzPath = filePath + ".gz";
      if (fs.existsSync(gzPath)) {
        res.set("Content-Encoding", "gzip");
        res.set("Vary", "Accept-Encoding");
        const ext = path.extname(filePath);
        if (ext === ".js") res.set("Content-Type", "application/javascript; charset=utf-8");
        else if (ext === ".css") res.set("Content-Type", "text/css; charset=utf-8");
        else if (ext === ".html") res.set("Content-Type", "text/html; charset=utf-8");
        return res.sendFile(gzPath);
      }
    }

    res.set("Vary", "Accept-Encoding");
    next();
  };
}

function buildPreloadHeaders(distPath: string) {
  const assetsPath = path.join(distPath, "assets");
  if (!fs.existsSync(assetsPath)) return;
  
  const files = fs.readdirSync(assetsPath);
  const mainJs = files.find(f => f.startsWith("index-") && f.endsWith(".js"));
  const mainCss = files.find(f => f.startsWith("index-") && f.endsWith(".css"));
  const layoutJs = files.find(f => f.startsWith("layout-") && f.endsWith(".js"));
  const reactDomJs = files.find(f => f.startsWith("react-dom-") && f.endsWith(".js"));
  const reactCoreJs = files.find(f => f.startsWith("react-core-") && f.endsWith(".js"));
  const routerJs = files.find(f => f.startsWith("router-") && f.endsWith(".js"));
  const vendorJs = files.find(f => f.startsWith("vendor-") && f.endsWith(".js"));
  const queryJs = files.find(f => f.startsWith("query-") && f.endsWith(".js"));
  const uiJs = files.find(f => f.startsWith("ui-") && f.endsWith(".js"));
  
  if (mainCss) preloadHeaders.push(`</assets/${mainCss}>; rel=preload; as=style`);
  if (reactCoreJs) preloadHeaders.push(`</assets/${reactCoreJs}>; rel=modulepreload`);
  if (reactDomJs) preloadHeaders.push(`</assets/${reactDomJs}>; rel=modulepreload`);
  if (mainJs) preloadHeaders.push(`</assets/${mainJs}>; rel=modulepreload`);
  if (layoutJs) preloadHeaders.push(`</assets/${layoutJs}>; rel=modulepreload`);
  if (routerJs) preloadHeaders.push(`</assets/${routerJs}>; rel=modulepreload`);
  if (vendorJs) preloadHeaders.push(`</assets/${vendorJs}>; rel=modulepreload`);
  if (queryJs) preloadHeaders.push(`</assets/${queryJs}>; rel=modulepreload`);
  if (uiJs) preloadHeaders.push(`</assets/${uiJs}>; rel=modulepreload`);
}

function cacheIndexHtml(distPath: string) {
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    indexHtmlCache = fs.readFileSync(indexPath);
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  buildPreloadHeaders(distPath);
  cacheIndexHtml(distPath);

  const assetsPath = path.join(distPath, "assets");
  if (fs.existsSync(assetsPath)) {
    app.use("/assets", servePrecompressed(assetsPath));
    app.use("/assets", express.static(assetsPath, {
      maxAge: "1y",
      immutable: true,
      etag: false,
      lastModified: false,
    }));
  }

  // صفحات التوقيع العامة يجب ألا تُخزَّن في كاش المتصفح: أي إصلاح فيها
  // يجب أن يصل للموقّع فوراً (متصفح واتساب لا يمكنه عمل hard refresh)
  const NO_CACHE_HTML = new Set([
    "/sign-financial.html",
    "/sign-resolution.html",
    "/vote-resolution.html",
  ]);

  app.use(servePrecompressed(distPath));
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
    index: false,
    setHeaders: (res, filePath) => {
      if (NO_CACHE_HTML.has("/" + path.basename(filePath))) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    },
  }));

  app.use("*", (_req, res) => {
    const requestedFile = path.basename(_req.originalUrl.split('?')[0].split('#')[0]);
    const publicFilePath = path.resolve(distPath, requestedFile);
    if (requestedFile.endsWith('.html') && fs.existsSync(publicFilePath)) {
      return res.sendFile(publicFilePath);
    }
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (preloadHeaders.length > 0) {
      res.setHeader("Link", preloadHeaders.join(", "));
    }
    if (indexHtmlCache) {
      res.send(indexHtmlCache);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
