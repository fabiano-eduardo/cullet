import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// NotFoundError
// ─────────────────────────────────────────────────────────────────────────────

class NotFoundError extends AppError {
    constructor(
        resource: string,
        criteria?: Record<string, unknown>,
        options?: AppErrorOptions,
    ) {
        const baseMetadata = criteria ? { resource, criteria } : { resource };
        const mergedMetadata = options?.metadata
            ? { ...baseMetadata, ...options.metadata }
            : baseMetadata;

        super(`${resource} not found`, ErrorCodes.notFound, {
            ...options,
            metadata: mergedMetadata,
        });
    }
}

export { NotFoundError };
