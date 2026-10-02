import type { RequestHandler, Response } from "express";
import { realpath } from "node:fs/promises";
import path from "node:path";

export const noStoreProtectedUpload: RequestHandler = (_req, res, next) => {
  res.set({
    "Cache-Control": "private, no-store",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
  });
  next();
};

// Only this diskStorage producer writes this dedicated media directory.
// This is a marketing-module asset policy, NOT uploader provenance and NOT
// a way to authorize a filename copied into a private/HR attachment record.
export function isDedicatedSocialMediaKey(key: string): boolean {
  const extensionStart = key.lastIndexOf(".");
  const normalizedExtension = key.slice(0, extensionStart) + key.slice(extensionStart).toLowerCase();
  return /^social-media\/social-\d{13}-\d{1,10}\.(?:jpe?g|png|gif|webp|mp4|mov|webm)$/.test(normalizedExtension);
}

// Called only AFTER exact binding + authenticated uploader authorization.
// realpath also prevents a symlink inside uploads from escaping the directory.
export async function sendLocalProtectedUpload(relativeKey: string, res: Response): Promise<void> {
  try {
    const root = await realpath(path.resolve("uploads"));
    const file = await realpath(path.resolve(root, relativeKey));
    if (!file.startsWith(root + path.sep) || file !== path.resolve(root, relativeKey) ||
        relativeKey.split("/").some(part => part.startsWith("."))) {
      res.status(400).json({ error: "مسار ملف غير صالح" });
      return;
    }
    res.sendFile(file, {
      cacheControl: false, lastModified: false, etag: false, dotfiles: "deny",
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": "inline" },
    }, (error: any) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).json({ error: "فشل في جلب الملف" });
      }
    });
  } catch (error: any) {
    res.status(error?.code === "ENOENT" ? 404 : 500).json({ error: "الملف غير موجود أو تعذر الوصول إليه" });
  }
}