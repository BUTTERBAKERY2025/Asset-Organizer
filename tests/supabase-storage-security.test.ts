import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, listBuckets, upload, download, remove, createBucket } = vi.hoisted(() => ({
  createClient: vi.fn(),
  listBuckets: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  createBucket: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

const saved = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co/rest/v1";
  process.env.SUPABASE_ANON_KEY = "anon-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";
  createClient.mockReturnValue({
    storage: {
      listBuckets, createBucket,
      from: vi.fn(() => ({ upload, download, remove })),
    },
  });
  listBuckets.mockResolvedValue({ data: [{ id: "documents", name: "documents", public: false }], error: null });
  upload.mockResolvedValue({ data: { path: "stored.pdf" }, error: null });
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("shared Supabase attachment storage", () => {
  it("uses only the server service key and normalized URL; never creates a bucket on startup", async () => {
    const storage = await import("../server/supabase-storage");
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(await storage.ensureBucketExists()).toBe(true);
    expect(createBucket).not.toHaveBeenCalled();
  });

  it("fails closed when only the anon key is present", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const storage = await import("../server/supabase-storage");
    expect(storage.isSupabaseAvailable()).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(await storage.uploadToSupabase(Buffer.from("a"), "a.pdf", "application/pdf")).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    { label: "public", data: [{ id: "documents", name: "documents", public: true }], error: null },
    { label: "missing", data: [], error: null },
    { label: "unverifiable", data: null, error: { message: "forbidden" } },
    { label: "wrong id", data: [{ id: "other", name: "documents", public: false }], error: null },
  ])("rejects $label bucket metadata before writing or reading", async ({ data, error }) => {
    listBuckets.mockResolvedValue({ data, error });
    const storage = await import("../server/supabase-storage");
    expect(await storage.isDocumentsBucketPrivate()).toBe(false);
    expect(await storage.uploadToSupabase(Buffer.from("a"), "a.pdf", "application/pdf")).toBeNull();
    expect(await storage.downloadFromSupabase("existing.pdf")).toBeNull();
    expect(await storage.deleteFromSupabase("existing.pdf")).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("reports a rejected upload explicitly without leaking the storage error or changing path shape", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    upload.mockResolvedValueOnce({ data: null, error: { message: "secret service-test-key" } });
    const storage = await import("../server/supabase-storage");
    expect(await storage.uploadToSupabase(Buffer.from("a"), "path/report.pdf", "application/pdf")).toBeNull();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Supabase upload failed: storage rejected"));
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("secret service-test-key");
    const result = await storage.uploadToSupabase(Buffer.from("a"), "path/report.pdf", "application/pdf");
    expect(result?.path).toMatch(/^path_report_\d{13}_[a-f0-9]{8}\.pdf$/);
    expect(result?.storedPath).toBe("stored.pdf");
    expect(upload).toHaveBeenCalledWith(result?.path, Buffer.from("a"), { contentType: "application/pdf", upsert: false });
  });
});