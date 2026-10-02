// Avoid reusing downloads cached by older releases before no-store was enabled.
// This is a cache key only; the server still derives ownership from the session.
export function portalDocumentLink(url: string, userId?: string): string {
  if (!["/uploads/", "/api/uploads/file/", "/api/documents/file/"].some(prefix => url.startsWith(prefix))) return url;
  const fragmentAt = url.indexOf("#");
  const base = fragmentAt < 0 ? url : url.slice(0, fragmentAt);
  const fragment = fragmentAt < 0 ? "" : url.slice(fragmentAt);
  return `${base}${base.includes("?") ? "&" : "?"}portal_private_v2=${encodeURIComponent(userId ?? "")}${fragment}`;
}