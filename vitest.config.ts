import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      include: ["tests/**/*.test.ts"],
      exclude: ["tests/e2e/**", "node_modules", "dist"],
      testTimeout: 15_000,
      coverage: {
        provider: "v8",
        include: [
          "cli/**/*.ts",
          "registry/**/*.ts",
          "scripts/{validate-kit,sync-package-exports,new-kit,check-pack-contents}.mjs",
        ],
        reporter: ["text", "lcov"],
        thresholds: {
          lines: 70,
          functions: 70,
          statements: 70,
          branches: 66,
          "cli/index.ts": {
            lines: 100,
            functions: 100,
            statements: 100,
            branches: 75,
          },
          "cli/commands/**/*.ts": {
            lines: 65,
            functions: 85,
            statements: 65,
            branches: 40,
          },
          "cli/utils/**/*.ts": {
            lines: 90,
            functions: 95,
            statements: 89,
            branches: 75,
          },
          "registry/**/*.ts": {
            lines: 100,
            functions: 100,
            statements: 100,
            branches: 50,
          },
          "scripts/**/*.mjs": {
            lines: 78,
            functions: 89,
            statements: 76,
            branches: 69,
          },
        },
      },
    },
  }),
);
