import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

// Dedicated run for the kit specs (`packages/*/src/**/*.spec.ts`), kept
// separate from the main unit suite (vitest.config.ts). Kits carry
// module-level singletons and heavier transforms; isolating them avoids
// cross-suite worker contention that made the repo suite flaky when both ran
// in a single invocation.
export default mergeConfig(
    baseVitestConfig,
    defineConfig({
        test: {
            include: ["packages/*/src/**/*.spec.ts"],
            exclude: ["node_modules", "dist"],
            testTimeout: 15_000,
            // Coverage settings live here but stay opt-in: they only activate
            // when a run passes `--coverage` (the erp-core CI slice does; local
            // `test:kits` and the dummy-api slice do not, so neither pays for it
            // nor trips the erp-core-scoped thresholds). The thresholds are
            // pinned just below the measured floor so the kit's coverage can no
            // longer silently regress.
            coverage: {
                provider: "v8",
                include: ["packages/erp-core/src/**/*.ts"],
                exclude: [
                    "packages/erp-core/src/**/*.spec.ts",
                    "packages/erp-core/src/examples/**",
                ],
                reporter: ["text"],
                thresholds: {
                    statements: 92,
                    branches: 87,
                    functions: 93,
                    lines: 92,
                },
            },
        },
    }),
);
