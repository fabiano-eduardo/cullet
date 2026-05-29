import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

// Dedicated run for the kit specs (`kits/**/*.spec.ts`), kept separate from the
// main unit suite (vitest.config.ts). Kits carry module-level singletons and
// heavier transforms; isolating them avoids cross-suite worker contention that
// made the repo suite flaky when both ran in a single invocation.
export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      include: ["kits/**/*.spec.ts"],
      exclude: ["node_modules", "dist"],
      testTimeout: 15_000,
    },
  }),
);
