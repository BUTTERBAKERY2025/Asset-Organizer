import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/operations-board-model.test.ts"],
    environment: "node",
  },
});