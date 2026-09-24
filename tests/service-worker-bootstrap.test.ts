import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";

const html = readFileSync(
  new URL("../client/index.html", import.meta.url),
  "utf8",
);
const bootstrap = readFileSync(
  new URL("../client/public/sw-register.js", import.meta.url),
  "utf8",
);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function loadBootstrap(register: ReturnType<typeof vi.fn>) {
  const listeners = new Map<string, () => void>();
  vm.runInNewContext(bootstrap, {
    navigator: { serviceWorker: { register } },
    window: { addEventListener: (event: string, callback: () => void) => listeners.set(event, callback) },
    console,
    setTimeout,
    clearTimeout,
  });
  return listeners;
}

describe("service worker bootstrap recovery", () => {
  it("continues retrying beyond three failures with capped backoff then resets after recovery", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const update = vi.fn(async () => {});
    const register = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ update });
    loadBootstrap(register);
    await vi.advanceTimersByTimeAsync(0);
    for (const delay of [3000, 6000, 12000, 24000, 48000, 60000]) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(register).toHaveBeenCalledTimes(1 + [3000, 6000, 12000, 24000, 48000, 60000].indexOf(delay));
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(register).toHaveBeenCalledTimes(7);
    expect(update).toHaveBeenCalledOnce();
  });

  it("keeps one attempt and one timer when online fires during an in-flight registration", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let reject!: (reason: Error) => void;
    const register = vi.fn().mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }))
      .mockResolvedValue({ update: vi.fn(async () => {}) });
    const listeners = loadBootstrap(register);
    listeners.get("online")!();
    listeners.get("online")!();
    expect(register).toHaveBeenCalledOnce();
    reject(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);
    expect(register).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("online event cancels an existing delayed retry and triggers one immediate attempt", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const register = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ update: vi.fn(async () => {}) });
    const listeners = loadBootstrap(register);
    await vi.advanceTimersByTimeAsync(0);
    listeners.get("online")!();
    await vi.advanceTimersByTimeAsync(0);
    expect(register).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("checks an existing registration for updates without hiding failures", () => {
    expect(bootstrap).toContain("registration.update().catch");
    expect(bootstrap).toContain('console.warn("Service worker update check failed:", error)');
  });

  it("loads registration from a same-origin external script rather than inline code", () => {
    expect(html).toMatch(/<script\s+defer\s+src="\/sw-register\.js"><\/script>/);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?serviceWorker\.register/);
  });

  it("preserves the CSP-safe bootstrap in production output", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "butter-sw-build-"));
    const publicDir = join(rootDir, "public");
    const outDir = join(rootDir, "dist");
    try {
      mkdirSync(publicDir);
      writeFileSync(
        join(rootDir, "index.html"),
        html
          .replace(/<link rel="modulepreload" href="\/src\/main\.tsx" fetchpriority="high">/, "")
          .replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, ""),
      );
      writeFileSync(join(publicDir, "sw-register.js"), bootstrap);
      await build({
        configFile: false,
        root: rootDir,
        publicDir,
        logLevel: "silent",
        css: { postcss: { plugins: [] } },
        build: { outDir, emptyOutDir: true },
      });

      const emittedHtml = readFileSync(join(outDir, "index.html"), "utf8");
      const emittedBootstrap = readFileSync(join(outDir, "sw-register.js"), "utf8");
      expect(emittedHtml).toMatch(/<script\s+defer\s+src="\/sw-register\.js"><\/script>/);
      expect(emittedHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?serviceWorker\.register/);
      expect(emittedBootstrap).toContain('navigator.serviceWorker.register("/sw.js")');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});