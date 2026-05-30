import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      // Repo suite only. Kit specs (`packages/*/src/**/*.spec.ts`) run in
      // their own invocation via `npm run test:kits` (see
      // vitest.kits.config.ts) to keep this fast unit suite isolated from
      // kit-level global state and worker contention.
      include: ["tests/**/*.test.ts"],
      exclude: [
        "tests/e2e/**",
        "kits/**",
        "node_modules",
        "dist",
        "packages/*/src/**/*.spec.ts",
        "packages/**/dist",
      ],
      testTimeout: 15_000,
      coverage: {
        provider: "v8",
        include: [
          "packages/cli/src/cli/**/*.ts",
          "packages/cli/src/registry/**/*.ts",
          "scripts/{validate-kit,sync-kit-deps,new-kit,check-pack-contents}.mjs",
        ],
        reporter: ["text", "lcov"],
        thresholds: {
          lines: 70,
          functions: 70,
          statements: 70,
          branches: 66,
          "packages/cli/src/cli/index.ts": {
            lines: 100,
            functions: 100,
            statements: 100,
            branches: 75,
          },
          "packages/cli/src/cli/commands/**/*.ts": {
            lines: 65,
            functions: 85,
            statements: 65,
            branches: 40,
          },
          "packages/cli/src/cli/utils/**/*.ts": {
            lines: 90,
            functions: 95,
            statements: 89,
            branches: 75,
          },
          "packages/cli/src/registry/**/*.ts": {
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
