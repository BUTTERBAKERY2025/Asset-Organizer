import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["client/src/components/central-kitchen/operations-workspace.test.ts"],
    environment: "node",
  },
});