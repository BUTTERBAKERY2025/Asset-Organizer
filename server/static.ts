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

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  // but skip public HTML pages like vote-resolution.html
  app.use("*", (_req, res) => {
    const requestedFile = path.basename(_req.originalUrl.split('?')[0].split('#')[0]);
    const publicFilePath = path.resolve(distPath, requestedFile);
    if (requestedFile.endsWith('.html') && fs.existsSync(publicFilePath)) {
      return res.sendFile(publicFilePath);
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
