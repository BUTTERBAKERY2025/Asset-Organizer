import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@assets": path.resolve(process.cwd(), "attached_assets"), "@shared": path.resolve(process.cwd(), "shared"), "@": path.resolve(process.cwd(), "client/src") } },
  test: { include: ["client/src/lib/owner-pdf.test.ts", "client/src/lib/owner-access.test.ts"], environment: "node" },
});