import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

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
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
