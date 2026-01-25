import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isAuthenticated } from "../../auth";

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Register object storage routes for file uploads.
 *
 * This provides secure routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading (authenticated)
 * 2. The client then uploads directly to the presigned URL
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   * Protected endpoint - requires authentication.
   */
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Validate file size
      if (size && size > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: `حجم الملف كبير جداً. الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      }

      // Validate content type
      if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
        return res.status(400).json({
          error: "نوع الملف غير مدعوم. الأنواع المسموحة: PDF, JPEG, PNG, DOC, DOCX",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects - protected endpoint for sensitive files.
   * Requires authentication for access control.
   */
  app.get("/api/protected-files/*", isAuthenticated, async (req, res) => {
    try {
      // Extract the object path from the URL (everything after /api/protected-files)
      const objectPath = req.path.replace('/api/protected-files', '');
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving protected object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  /**
   * Serve public uploaded objects.
   * Use this only for truly public files (e.g., public images).
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

