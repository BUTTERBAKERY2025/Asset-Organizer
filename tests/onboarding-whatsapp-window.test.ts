import { afterEach, describe, expect, it, vi } from "vitest";
import { reserveWhatsAppWindow, navigateWhatsAppWindow, onboardingWhatsAppUrl } from "../client/src/lib/onboarding-whatsapp-window";

afterEach(() => vi.unstubAllGlobals());
describe("WhatsApp user-initiated opening", () => {
  it("reserves a tab synchronously and detaches its opener before navigation", () => {
    const tab = { opener: {}, document: { title: "", body: { textContent: "" } }, location: { replace: vi.fn() }, closed: false };
    const open = vi.fn(() => tab);
    vi.stubGlobal("window", { open });
    const reserved = reserveWhatsAppWindow();
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.opener).toBeNull();
    const url = onboardingWhatsAppUrl("966500000000", "https://example.com/onboarding/test");
    expect(navigateWhatsAppWindow(reserved, url)).toBe(true);
    expect(tab.location.replace).toHaveBeenCalledWith(url);
    expect(new URL(url).searchParams.get("text")).toContain("https://example.com/onboarding/test");
  });
  it("offers the explicit link when popups are blocked or closed", () => {
    vi.stubGlobal("window", { open: () => null });
    expect(reserveWhatsAppWindow()).toBeNull();
    expect(navigateWhatsAppWindow(null, "https://wa.me/")).toBe(false);
    expect(navigateWhatsAppWindow({ closed: true } as Window, "https://wa.me/")).toBe(false);
  });
});