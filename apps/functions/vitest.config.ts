import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    target: "node18",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".sst"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
      ],
    },
    testTimeout: 30000, // 30 seconds for integration tests
  },
});

// Integration test config - can be used with --config flag
export const integrationConfig = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    target: "node18",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*integration*.test.ts"],
    exclude: ["node_modules", "dist", ".sst"],
    testTimeout: 30000,
  },
});

