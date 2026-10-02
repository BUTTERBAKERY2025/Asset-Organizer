import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "client/src"), "@shared": path.resolve(process.cwd(), "shared") } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["client/src/lib/employee-account-delegation.test.ts", "client/src/components/operations-center/employee-account-dialog.test.ts", "client/src/components/operations-center/employee-template-assignment-dialog.test.ts", "client/src/components/operations-center/employee-account-manager-selection.test.ts", "client/src/pages/operations-employee-accounts.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});