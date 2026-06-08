import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

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
    }
}

export { LegacyIncompatibleError };
