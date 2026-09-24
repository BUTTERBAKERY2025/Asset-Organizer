import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  new URL("../client/index.html", import.meta.url),
  "utf8",
);

describe("service worker bootstrap recovery", () => {
  it("reports registration failures and retries transient failures", () => {
    expect(html).toContain("console.error('Service worker registration failed:', error)");
    expect(html).toContain("attempts < 3");
    expect(html).toContain("setTimeout(registerServiceWorker, attempts * 3000)");
    expect(html).toContain("window.addEventListener('online', registerServiceWorker)");
  });

  it("checks an existing registration for updates without hiding failures", () => {
    expect(html).toContain("registration.update().catch");
    expect(html).toContain("console.warn('Service worker update check failed:', error)");
  });
});