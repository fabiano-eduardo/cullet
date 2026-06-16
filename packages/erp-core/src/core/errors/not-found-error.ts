import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// NotFoundError
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raised when a requested resource does not exist. Maps naturally onto an HTTP
 * 404 at the edge, but stays transport-agnostic here.
 *
 * The `resource` name builds the message (`"<resource> not found"`) and, with
 * the optional lookup `criteria`, lands in the metadata so logs show *what* was
 * searched for without the caller having to restate it in the message.
 */
class NotFoundError extends AppError {
    /**
     * @param resource - Human-readable name of the missing resource (e.g. `"Order"`).
     * @param criteria - Optional lookup keys used in the search; recorded in
     *   metadata to aid debugging. Avoid putting sensitive values here.
     * @param options - Optional cause, correlation ids, and extra metadata.
     */
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
