import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "../../../.."),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "../.."),
      "@shared": path.resolve(import.meta.dirname, "../../../../shared"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["client/src/components/branch-operations/*.test.tsx"],
  },
});