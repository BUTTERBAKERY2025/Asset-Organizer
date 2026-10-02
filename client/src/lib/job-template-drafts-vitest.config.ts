import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "client/src"), "@shared": path.resolve(process.cwd(), "shared") } },
  esbuild: { jsx: "automatic" },
  css: { postcss: { plugins: [] } },
  test: { include: ["client/src/components/security/job-template-drafts.test.ts"], environment: "node", fileParallelism: false },
});