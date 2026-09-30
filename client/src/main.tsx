import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { hydrateFromPersistentCache } from "./lib/queryClient";

hydrateFromPersistentCache();

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
