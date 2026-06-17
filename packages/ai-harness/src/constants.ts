import type { HarnessLimits } from "./harness/types.js";

export const DEFAULT_LIMITS: HarnessLimits = {
    maxAttempts: 3,
    pauseBetweenTasksMs: 1_000,
};

/**
 * File path patterns the bundled node file-writer refuses to overwrite. These
 * are defaults for the opt-in runtime helper — the neutral core knows nothing
 * about files. Extend or replace via `nodeFileWriter({ protectedPatterns })`.
 */
export const DEFAULT_PROTECTED_PATTERNS: RegExp[] = [
    /(^|\/)\.env(\..+)?$/,
    /(^|\/)tsconfig.*\.json$/,
    /(^|\/)package\.json$/,
    /(^|\/)package-lock\.json$/,
    /(^|\/)yarn\.lock$/,
    /(^|\/)pnpm-lock\.yaml$/,
    /(^|\/)\.git\//,
    /(^|\/)\.github\//,
    /\.(test|spec)\.[cm]?[jt]sx?$/,
];
