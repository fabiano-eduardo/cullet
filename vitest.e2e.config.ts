import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      include: ["tests/e2e/**/*.test.ts"],
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  }),
);
