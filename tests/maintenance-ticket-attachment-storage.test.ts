import { describe, expect, it, vi } from "vitest";
import { MaintenanceTicketAttachmentStorage } from "../server/maintenance-ticket-attachment-storage";
import { ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";

describe("private maintenance evidence", () => {
  it("uses generated private paths, preserves bytes, and rejects alternate namespaces/traversal", async () => {
    const bytes = Buffer.from([255,216,255,1]);
    const objects = {
      uploadPrivateObject: vi.fn(async () => undefined),
      downloadPrivateObject: vi.fn(async () => ({ data: bytes })),
      deletePrivateObject: vi.fn(async () => undefined),
      isPrivateObjectStorageReady: vi.fn(async () => true),
    };
    const storage = new MaintenanceTicketAttachmentStorage(objects as any);
    const uploaded = await storage.upload(bytes, "jpg", "image/jpeg");
    expect(uploaded.storagePath).toMatch(/^\/objects\/maintenance-tickets\/[a-f0-9-]+\.jpg$/);
    expect(objects.uploadPrivateObject).toHaveBeenCalledWith(uploaded.storagePath, bytes, "image/jpeg");
    expect((await storage.download(uploaded.storagePath)).data).toEqual(bytes);
    expect(() => storage.download("/objects/uploads/photo.jpg")).toThrow();
    expect(() => storage.download("/objects/maintenance-tickets/../secret.jpg")).toThrow();
    await expect(storage.upload(bytes, "svg", "image/svg+xml")).rejects.toThrow();
  });
  it("blocks maintenance paths in generic object access before touching provider", async () => {
    const service = new ObjectStorageService();
    await expect(service.getObjectEntityFile("/objects/maintenance-tickets/known.jpg")).rejects.toThrow();
    await expect(service.getObjectEntityFile("/objects/%6daintenance-tickets/known.jpg")).rejects.toThrow();
  });
});