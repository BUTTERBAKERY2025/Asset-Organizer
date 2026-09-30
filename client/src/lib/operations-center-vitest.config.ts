import { defineConfig } from "vitest/config";

// Isolated presentation-contract tests; the repository's server test config only includes tests/**.
export default defineConfig({
  test: { include: ["client/src/lib/operations-center-presentation.test.ts"], environment: "node" },
});