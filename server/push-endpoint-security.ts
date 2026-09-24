export function isKnownPushProviderEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:"
      || (url.port && url.port !== "443")
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname.length < 2
    ) {
      return false;
    }
    const host = url.hostname.toLowerCase();
    if (host === "fcm.googleapis.com") {
      return url.pathname.startsWith("/fcm/send/") || url.pathname.startsWith("/wp/");
    }
    if (host === "android.googleapis.com") return url.pathname.startsWith("/gcm/send/");
    if (host === "push.services.mozilla.com" || host === "updates.push.services.mozilla.com") {
      return url.pathname.startsWith("/wpush/");
    }
    // Apple endpoints use an opaque per-subscription path.
    return host === "web.push.apple.com" && /^\/[A-Za-z0-9_-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}