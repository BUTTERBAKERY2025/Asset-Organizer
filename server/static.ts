import express, { type Express } from "express";
import fs from "fs";
import path from "path";

let preloadHeaders: string[] = [];

function buildPreloadHeaders(distPath: string) {
  const assetsPath = path.join(distPath, "assets");
  if (!fs.existsSync(assetsPath)) return;
  
  const files = fs.readdirSync(assetsPath);
  const mainJs = files.find(f => f.startsWith("index-") && f.endsWith(".js"));
  const mainCss = files.find(f => f.startsWith("index-") && f.endsWith(".css"));
  const layoutJs = files.find(f => f.startsWith("layout-") && f.endsWith(".js"));
  
  if (mainCss) preloadHeaders.push(`</assets/${mainCss}>; rel=preload; as=style`);
  if (mainJs) preloadHeaders.push(`</assets/${mainJs}>; rel=preload; as=script; crossorigin`);
  if (layoutJs) preloadHeaders.push(`</assets/${layoutJs}>; rel=preload; as=script; crossorigin`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  buildPreloadHeaders(distPath);

  const assetsPath = path.join(distPath, "assets");
  if (fs.existsSync(assetsPath)) {
    app.use("/assets", express.static(assetsPath, {
      maxAge: "1y",
      immutable: true,
      etag: false,
      lastModified: false,
    }));
  }

  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
  }));

  app.use("*", (_req, res) => {
    const requestedFile = path.basename(_req.originalUrl.split('?')[0].split('#')[0]);
    const publicFilePath = path.resolve(distPath, requestedFile);
    if (requestedFile.endsWith('.html') && fs.existsSync(publicFilePath)) {
      return res.sendFile(publicFilePath);
    }
    res.setHeader("Cache-Control", "no-cache");
    if (preloadHeaders.length > 0) {
      res.setHeader("Link", preloadHeaders.join(", "));
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
