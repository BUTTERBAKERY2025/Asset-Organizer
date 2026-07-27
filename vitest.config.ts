import { defineConfig } from "vitest/config";
import path from "path";

// إعداد مستقل لاختبارات السيرفر — لا يرث vite.config.ts (جذره client/)
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  test: {
    root: __dirname,
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // اختبارات قاعدة البيانات تعمل تسلسلياً حتى لا تتسابق على نفس البيانات
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
