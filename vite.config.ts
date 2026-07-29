import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep bundler helper/virtual modules (vite preload helper, commonjs
          // helpers) in the eagerly-loaded react chunk. Without this they can
          // land inside a huge lazy vendor chunk (e.g. vendor-print), forcing
          // the entry to statically import ~4MB before first paint.
          if (id.includes("vite/preload-helper") || id.includes("vite/modulepreload-polyfill") || id.includes("commonjsHelpers")) return "vendor-react";
          if (!id.includes("node_modules")) return;
          // Shared runtime helpers used by both eager and lazy code must live
          // in an eager chunk, otherwise they drag huge lazy chunks into the
          // initial load.
          if (id.includes("@babel/runtime") || id.includes("tslib") || id.includes("regenerator-runtime")) return "vendor-react";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("xlsx") || id.includes("exceljs")) return "vendor-xlsx";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-to-print") || id.includes("jspdf") || id.includes("html2canvas") || id.includes("pdfmake")) return "vendor-print";
          if (id.includes("@uppy")) return "vendor-upload";
          if (id.includes("@radix-ui") || id.includes("/vaul/") || id.includes("/cmdk/") || id.includes("/sonner/") || id.includes("embla-carousel") || id.includes("react-resizable-panels")) return "vendor-radix";
          if (id.includes("react-hook-form") || id.includes("@hookform")) return "vendor-forms";
          if (id.includes("date-fns") || id.includes("dayjs") || id.includes("react-day-picker")) return "vendor-date";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("react-i18next") || id.includes("i18next")) return "vendor-i18n";
          if (id.includes("zod") || id.includes("drizzle-zod")) return "vendor-zod";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler")) return "vendor-react";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
