import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// LegacyIncompatibleError
// ─────────────────────────────────────────────────────────────────────────────

class LegacyIncompatibleError extends AppError {
    constructor(
        message: string,
        context?: Record<string, unknown>,
        options?: AppErrorOptions,
    ) {
        const mergedMetadata = options?.metadata
            ? { ...(context ?? {}), ...options.metadata }
            : context;

        super(message, ErrorCodes.legacyIncompatible, {
            ...options,
            metadata: mergedMetadata,
        });
        Object.freeze(this);
    }
}

export { LegacyIncompatibleError };
