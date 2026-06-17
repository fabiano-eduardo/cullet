import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "./vitest.config.base";

// Per-kit coverage profiles. Each kit that gates coverage in CI gets one
// entry: the files to measure plus thresholds pinned just below that kit's
// measured floor, so its coverage can no longer silently regress. To add a
// kit, add a profile here and point its CI slice at it via `KIT_COVERAGE`.
const COVERAGE_PROFILES = {
    "erp-core": {
        include: ["packages/erp-core/src/**/*.ts"],
        exclude: [
            "packages/erp-core/src/**/*.spec.ts",
            "packages/erp-core/src/examples/**",
        ],
        thresholds: {
            statements: 92,
            branches: 87,
            functions: 93,
            lines: 92,
        },
    },
    "ai-harness": {
        include: ["packages/ai-harness/src/**/*.ts"],
        exclude: [
            "packages/ai-harness/src/**/*.spec.ts",
            "packages/ai-harness/src/examples/**",
            "packages/ai-harness/src/version.ts",
        ],
        // Floor measured 2026-06-17: 100% stmt / 97.53% branch / 100% func /
        // 100% lines (129 specs). Statements/functions/lines are pinned at full
        // coverage so any new code must ship with a test; branches allow the few
        // defensive `?? default` paths that remain.
        thresholds: {
            statements: 100,
            branches: 97,
            functions: 100,
            lines: 100,
        },
    },
} as const;

// Which profile a `--coverage` run gates against. Defaults to erp-core so
// existing invocations keep their behaviour; CI slices set `KIT_COVERAGE`.
const kitProfile =
    COVERAGE_PROFILES[
        (process.env.KIT_COVERAGE ??
            "erp-core") as keyof typeof COVERAGE_PROFILES
    ] ?? COVERAGE_PROFILES["erp-core"];

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
            // when a run passes `--coverage` (the erp-core / ai-harness CI
            // slices do; local `test:kits` and the dummy-api slice do not, so
            // neither pays for it nor trips the kit-scoped thresholds). The
            // measured surface and thresholds come from the `KIT_COVERAGE`
            // profile selected above.
            coverage: {
                provider: "v8",
                include: kitProfile.include,
                exclude: kitProfile.exclude,
                reporter: ["text"],
                thresholds: kitProfile.thresholds,
            },
        },
    }),
);
