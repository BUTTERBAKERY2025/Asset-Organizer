import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { hydrateFromPersistentCache, queryClient } from "./lib/queryClient";
import { setCachedData } from "./lib/persistentCache";

hydrateFromPersistentCache();

const FIVE_MINUTES = 1000 * 60 * 5;
const initController = new AbortController();
const initTimeout = setTimeout(() => initController.abort(), 7000);
const initPromise = fetch("/api/auth/init", { credentials: "include", priority: "high", signal: initController.signal } as RequestInit)
  .then(res => {
    clearTimeout(initTimeout);
    if (!res.ok) return { user: null, branches: [], permissions: [] };
    return res.json();
  })
  .then(data => {
    if (data.user) {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      setCachedData("/api/auth/me", data.user, FIVE_MINUTES);
    }
    if (data.branches) {
      queryClient.setQueryData(["/api/branches"], data.branches);
      setCachedData("/api/branches", data.branches, FIVE_MINUTES);
    }
    if (data.permissions) {
      queryClient.setQueryData(["/api/my-permissions"], data.permissions);
      setCachedData("/api/my-permissions", data.permissions, FIVE_MINUTES);
    }
    queryClient.setQueryData(["/api/auth/init"], data);
    return data;
  })
  .catch(() => {
    const fallback = { user: null, branches: [], permissions: [] };
    queryClient.setQueryData(["/api/auth/init"], fallback);
    return fallback;
  });

(window as any).__initPromise = initPromise;

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Keep the static #initial-loader visible until AuthGate signals readiness.
// This eliminates any blank/skeleton flash between React's first commit and
// when the authenticated app shell is ready to paint.
let loaderRemoved = false;
function dismissInitialLoader() {
  if (loaderRemoved) return;
  loaderRemoved = true;
  const loader = document.getElementById("initial-loader");
  if (!loader) return;
  loader.style.opacity = "0";
  setTimeout(() => loader.remove(), 250);
}
window.addEventListener("app-ready", dismissInitialLoader, { once: true });
// Hard safety net: if the ready event never fires (e.g. catastrophic boot
// failure), drop the loader after 8s so user is not stuck on the spinner.
setTimeout(dismissInitialLoader, 8000);
