import { describe, expect, it, vi } from "vitest";
import path from "node:path";

vi.mock("node:fs/promises", () => ({ realpath: vi.fn() }));
import { realpath } from "node:fs/promises";
import { sendLocalProtectedUpload } from "../server/protected-upload-response";

function response() {
  const res: any = {
    headersSent: false,
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    sendFile: vi.fn(),
  };
  return res;
}

describe("authorized local upload delivery", () => {
  it("does not re-enable caching via Express sendFile defaults", async () => {
    const root = path.resolve("uploads");
    vi.mocked(realpath).mockResolvedValueOnce(root).mockResolvedValueOnce(path.join(root, "documents", "file.pdf"));
    const res = response();
    await sendLocalProtectedUpload("documents/file.pdf", res);
    expect(res.sendFile).toHaveBeenCalledWith(path.join(root, "documents", "file.pdf"), expect.objectContaining({
      cacheControl: false, lastModified: false, etag: false,
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": "inline" },
    }), expect.any(Function));
  });
  it("rejects symlink escapes and dotfiles without delivering bytes", async () => {
    const root = path.resolve("uploads");
    for (const [key, resolved] of [
      ["documents/file.pdf", path.resolve("private/file.pdf")],
      ["social-media/social-1730000000000-123.jpg", path.join(root, "documents", "private.jpg")],
      [".hidden/file.pdf", path.join(root, ".hidden/file.pdf")],
    ]) {
      vi.mocked(realpath).mockResolvedValueOnce(root).mockResolvedValueOnce(resolved);
      const res = response();
      await sendLocalProtectedUpload(key, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.sendFile).not.toHaveBeenCalled();
    }
  });
  it("reports missing authorized local files explicitly", async () => {
    vi.mocked(realpath).mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const res = response();
    await sendLocalProtectedUpload("documents/missing.pdf", res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });
});