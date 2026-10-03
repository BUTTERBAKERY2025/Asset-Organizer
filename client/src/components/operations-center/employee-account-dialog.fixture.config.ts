import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Standalone, loopback-only fixture; no Express, auth bypass or DB connection.
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") } },
  css: { postcss: { plugins: [] } },
  server: { host: "127.0.0.1", port: 5187, strictPort: true, fs: { allow: [path.resolve(".")] } },
});