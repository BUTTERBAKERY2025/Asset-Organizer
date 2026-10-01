import { fixture } from "./fixtures";
import { previewNotice } from "./actions";

/** Only byte-identical sandbox assets may use native fetch. APIs are local. */
export async function sandboxFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.href);
  const method = init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");
  if (method.toUpperCase() !== "GET") throw new Error("Synthetic preview: backend writes disabled.");
  const assetRoots = ["../_source/public/", "../_source/client/public/"].map(root => new URL(root, import.meta.url));
  if (assetRoots.some(root => url.origin === root.origin && url.pathname.startsWith(root.pathname))) {
    return globalThis.fetch(url.href, { method: "GET", credentials: "omit" });
  }
  if (url.origin !== window.location.origin && url.origin !== "https://synthetic.invalid") {
    throw new Error("Synthetic preview: external network disabled.");
  }
  return new Response(JSON.stringify(fixture([url.pathname + url.search])), { status: 200, headers: { "Content-Type": "application/json" } });
}
const values = new Map<string, string>();
export const previewStorage: Storage = {
  get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
  getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); },
  removeItem: key => { values.delete(key); }, clear: () => values.clear(),
};
export const previewNotification = { permission: "default", requestPermission: async () => { previewNotice(); return "denied"; } };
const nativeWindow = window;
const locationProxy = new Proxy(nativeWindow.location, {
  get(target, property) {
    if (["assign", "replace", "reload"].includes(String(property))) return () => previewNotice();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
  set() { previewNotice(); return true; },
});
const historyProxy = new Proxy(nativeWindow.history, {
  get(target, property) {
    if (["back", "forward", "go"].includes(String(property))) return () => previewNotice();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
export const previewWindow: Window & typeof globalThis = new Proxy(nativeWindow, {
  get(target, property) {
    if (property === "open" || property === "print") return () => { previewNotice("معاينة فقط — النوافذ الخارجية والطباعة معطلة."); return null; };
    if (property === "location") return locationProxy;
    if (property === "history") return historyProxy;
    if (property === "fetch") return sandboxFetch;
    if (property === "localStorage" || property === "sessionStorage") return previewStorage;
    if (property === "Notification") return previewNotification;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
  set(target, property, value) {
    if (property === "location") { previewNotice(); return true; }
    return Reflect.set(target, property, value);
  },
}) as Window & typeof globalThis;
export const previewNavigator = new Proxy(navigator, {
  get(target, property) {
    if (property === "onLine") return true;
    if (property === "serviceWorker") return undefined;
    if (property === "clipboard") return { writeText: async () => previewNotice("معاينة فقط — النسخ معطل.") };
    if (property === "share") return async () => previewNotice();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});