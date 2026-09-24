import { describe, expect, it } from "vitest";
import { isKnownPushProviderEndpoint } from "../server/push-endpoint-security";

describe("test-push provider endpoint allowlist", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/device-token",
    "https://fcm.googleapis.com/wp/device-token",
    "https://android.googleapis.com/gcm/send/device-token",
    "https://updates.push.services.mozilla.com/wpush/v2/device-token",
    "https://web.push.apple.com/Q-device_token",
  ])("accepts a canonical provider endpoint: %s", (endpoint) => {
    expect(isKnownPushProviderEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "https://user:password@fcm.googleapis.com/fcm/send/device",
    "https://fcm.googleapis.com:8443/fcm/send/device",
    "https://fcm.googleapis.com/admin",
    "https://fcm.googleapis.com/fcm/send/device?next=http://127.0.0.1",
    "https://evilfcm.googleapis.com/fcm/send/device",
    "https://sub.push.services.mozilla.com/wpush/v2/device",
    "https://127.0.0.1/fcm/send/device",
  ])("rejects non-canonical or SSRF-shaped endpoint: %s", (endpoint) => {
    expect(isKnownPushProviderEndpoint(endpoint)).toBe(false);
  });
});