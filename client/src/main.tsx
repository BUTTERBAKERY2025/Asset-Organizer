import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { hydrateFromPersistentCache } from "./lib/queryClient";

hydrateFromPersistentCache();

fetch("/api/auth/init", { credentials: "include", priority: "high" } as RequestInit).catch(() => {});

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

const loader = document.getElementById("initial-loader");
if (loader) {
  requestAnimationFrame(() => {
    loader.style.transition = "opacity 150ms";
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 150);
  });
}
