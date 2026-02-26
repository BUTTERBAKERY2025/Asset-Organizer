import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { hydrateFromPersistentCache, queryClient } from "./lib/queryClient";
import { setCachedData } from "./lib/persistentCache";

hydrateFromPersistentCache();

const FIVE_MINUTES = 1000 * 60 * 5;
const initPromise = fetch("/api/auth/init", { credentials: "include", priority: "high" } as RequestInit)
  .then(res => {
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

const loader = document.getElementById("initial-loader");
if (loader) {
  requestAnimationFrame(() => {
    loader.style.transition = "opacity 300ms ease-out";
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 300);
  });
}
