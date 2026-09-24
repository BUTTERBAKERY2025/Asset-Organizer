import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "vite";

const html = readFileSync(
  new URL("../client/index.html", import.meta.url),
  "utf8",
);
const bootstrap = readFileSync(
  new URL("../client/public/sw-register.js", import.meta.url),
  "utf8",
);

describe("service worker bootstrap recovery", () => {
  it("reports registration failures and retries transient failures", () => {
    expect(bootstrap).toContain('console.error("Service worker registration failed:", error)');
    expect(bootstrap).toContain("attempts < 3");
    expect(bootstrap).toContain("setTimeout(registerServiceWorker, attempts * 3000)");
    expect(bootstrap).toContain('window.addEventListener("online", registerServiceWorker)');
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