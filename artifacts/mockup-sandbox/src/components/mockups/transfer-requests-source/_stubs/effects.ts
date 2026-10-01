import { itemsFor, transfers, warehouseItems } from "./fixtures";
import { previewNotice } from "./actions";

const localAssets = ["logo.png", "Amiri-Regular.ttf", "Amiri-Bold.ttf"]
  .map(name => new URL(`../_source/public/assets/${name}`, import.meta.url));
/** Backend data is local response objects only. Only copied static assets may load. */
export async function sandboxFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, "https://synthetic.invalid");
  const method = init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");
  if (method.toUpperCase() !== "GET") throw new Error("Synthetic preview: backend mutations are disabled.");
  if (localAssets.some(asset => asset.origin === url.origin && asset.pathname === url.pathname)) {
    return globalThis.fetch(url.href, { method: "GET", credentials: "omit" });
  }
  let data: unknown;
  const itemMatch = url.pathname.match(/^\/api\/warehouse\/material-transfers\/(\d+)\/items$/);
  const transferMatch = url.pathname.match(/^\/api\/warehouse\/material-transfers\/(\d+)$/);
  if (itemMatch) data = itemsFor(Number(itemMatch[1]));
  else if (transferMatch) {
    const transfer = transfers.find(row => row.id === Number(transferMatch[1]));
    if (!transfer) throw new Error("No matching synthetic transfer fixture.");
    data = { transfer };
  } else if (url.pathname === "/api/warehouse/items") data = warehouseItems;
  else throw new Error(`Synthetic preview: no local response for ${url.pathname}; network disabled.`);
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}
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
    if (property === "open" || property === "print") return () => { previewNotice("معاينة فقط — المشاركة والتنقل الخارجي والطباعة معطلة."); return null; };
    if (property === "location") return locationProxy;
    if (property === "history") return historyProxy;
    if (property === "fetch") return sandboxFetch;
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
    if (property === "clipboard") return { writeText: async () => previewNotice("معاينة فقط — النسخ معطل.") };
    if (property === "share") return async () => previewNotice();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});