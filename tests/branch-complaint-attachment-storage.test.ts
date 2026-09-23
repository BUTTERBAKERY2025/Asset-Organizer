import { describe, expect, it, vi } from "vitest";
import { ComplaintAttachmentStorage } from "../server/branch-complaint-attachment-storage";

describe("ComplaintAttachmentStorage", () => {
  it("uses only server-generated complaint paths and preserves Buffer bytes", async () => {
    const objects = {
      isPrivateObjectStorageReady: vi.fn(async () => true),
      uploadPrivateObject: vi.fn(async () => undefined),
      downloadPrivateObject: vi.fn(async () => ({
        data: Buffer.from([0, 1, 2, 255]),
        contentType: "image/png",
        size: 4,
      })),
      deletePrivateObject: vi.fn(async () => undefined),
    };
    const storage = new ComplaintAttachmentStorage(objects as any);

    const bytes = Buffer.from([0, 1, 2, 255]);
    const uploaded = await storage.upload(bytes, "PNG", "image/png");

    expect(uploaded.storagePath).toMatch(/^\/objects\/branch-complaints\/[0-9a-f-]+\.png$/);
    expect(objects.uploadPrivateObject).toHaveBeenCalledWith(uploaded.storagePath, bytes, "image/png");
    const downloaded = await storage.download(uploaded.storagePath);
    expect(Buffer.isBuffer(downloaded.data)).toBe(true);
    expect(downloaded.data).toEqual(bytes);
  });

  it("rejects paths outside the complaint-private namespace", async () => {
    const objects = {
      isPrivateObjectStorageReady: vi.fn(async () => true),
      downloadPrivateObject: vi.fn(),
      deletePrivateObject: vi.fn(),
    };
    const storage = new ComplaintAttachmentStorage(objects as any);

    await expect(storage.download("/objects/uploads/untrusted.pdf")).rejects.toThrow(
      "Invalid complaint attachment storage path",
    );
    expect(objects.downloadPrivateObject).not.toHaveBeenCalled();
  });
});