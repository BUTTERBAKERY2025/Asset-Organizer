import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["client/src/components/central-kitchen/production-redesign.test.ts"],
    environment: "node",
  },
});