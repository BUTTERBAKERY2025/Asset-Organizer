import { afterEach, describe, expect, it, vi } from "vitest";
import {
  newPrivateAttachmentPath, parsePrivateSupabasePath, privateAttachmentProvider,
  PrivateSupabaseStorage, PrivateAttachmentUnavailableError, PRIVATE_ATTACHMENT_BUCKET,
} from "../server/private-supabase-storage";
import { ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";

const original = {
  PRIVATE_ATTACHMENT_PROVIDER: process.env.PRIVATE_ATTACHMENT_PROVIDER,
  RENDER: process.env.RENDER,
  RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
  RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function client(bucket: { id: string; public: boolean } = { id: PRIVATE_ATTACHMENT_BUCKET, public: false }) {
  const files = new Map<string, { bytes: Buffer; mime: string }>();
  const listBuckets = vi.fn(async () => ({ data: [bucket], error: null }));
  const upload = vi.fn(async (name: string, bytes: Buffer, opts: { contentType: string; upsert: boolean }) => {
    if (files.has(name) || opts.upsert !== false) return { error: Error("duplicate") };
    files.set(name, { bytes: Buffer.from(bytes), mime: opts.contentType });
    return { error: null };
  });
  const download = vi.fn(async (name: string) => {
    const file = files.get(name);
    return file ? { data: new Blob([file.bytes], { type: file.mime }), error: null } : { data: null, error: Error("missing") };
  });
  const remove = vi.fn(async (names: string[]) => {
    names.forEach(name => files.delete(name));
    return { error: null };
  });
  const from = vi.fn((name: string) => {
    if (name !== PRIVATE_ATTACHMENT_BUCKET) throw Error("unexpected bucket");
    return { upload, download, remove };
  });
  return { storage: { listBuckets, from }, listBuckets, from, upload, download, remove };
}

describe("private Supabase attachment adapter", () => {
  it("selects Render deterministically and uses a marker for new paths", () => {
    delete process.env.PRIVATE_ATTACHMENT_PROVIDER;
    process.env.RENDER = "true";
    expect(privateAttachmentProvider()).toBe("supabase");
    const path = newPrivateAttachmentPath("delivery-carriers", "42/image.jpg");
    expect(path).toBe("/objects/delivery-carriers/__supabase__/42/image.jpg");
    expect(parsePrivateSupabasePath(path)).toBe("delivery-carriers/42/image.jpg");
    expect(parsePrivateSupabasePath("/objects/delivery-carriers/42/image.jpg")).toBeNull();
  });

  it("round trips exact bytes in a proven private bucket and deletes", async () => {
    const mock = client();
    const adapter = new PrivateSupabaseStorage(mock as any);
    const path = "/objects/branch-complaints/__supabase__/photo.png";
    const bytes = Buffer.from([0, 1, 255, 3]);
    expect(await adapter.isReady()).toBe(true);
    await adapter.uploadPrivateObject(path, bytes, "image/png");
    expect(mock.upload).toHaveBeenCalledWith("branch-complaints/photo.png", bytes, expect.objectContaining({ upsert: false }));
    expect(await adapter.downloadPrivateObject(path)).toEqual({ data: bytes, contentType: "image/png", size: 4 });
    await adapter.deletePrivateObject(path);
    await expect(adapter.downloadPrivateObject(path)).rejects.toThrow(PrivateAttachmentUnavailableError);
  });

  it("fails closed for public or missing bucket, rejected upload, malformed and legacy paths", async () => {
    const mock = client({ id: PRIVATE_ATTACHMENT_BUCKET, public: true });
    const adapter = new PrivateSupabaseStorage(mock as any);
    const path = "/objects/maintenance-tickets/__supabase__/photo.jpg";
    expect(await adapter.isReady()).toBe(false);
    await expect(adapter.uploadPrivateObject(path, Buffer.from([1]), "image/jpeg")).rejects.toThrow(PrivateAttachmentUnavailableError);
    expect(mock.from).not.toHaveBeenCalled();
    for (const invalid of [
      "/objects/maintenance-tickets/__supabase__/../secret.jpg",
      "/objects/maintenance-tickets/__supabase__/%2e%2e/secret.jpg",
      "/objects/other/__supabase__/photo.jpg",
    ]) expect(() => parsePrivateSupabasePath(invalid)).toThrow(PrivateAttachmentUnavailableError);
    await expect(adapter.downloadPrivateObject("/objects/maintenance-tickets/photo.jpg")).rejects.toThrow(/Legacy/);
    const privateMock = client();
    privateMock.upload.mockRejectedValueOnce(Error("offline"));
    await expect(new PrivateSupabaseStorage(privateMock as any).uploadPrivateObject(path, Buffer.from([1]), "image/jpeg")).rejects.toThrow("offline");
  });

  it("never routes legacy Replit paths to Supabase after a provider switch", async () => {
    process.env.PRIVATE_ATTACHMENT_PROVIDER = "supabase";
    process.env.RENDER = "true";
    const objects = new ObjectStorageService();
    await expect(objects.downloadPrivateObject("/objects/branch-complaints/old.png")).rejects.toThrow(/Legacy Replit/);
    await expect(objects.deletePrivateObject("/objects/delivery-carriers/1/old.jpg")).rejects.toThrow(/Legacy Replit/);
  });
});