import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// BusinessRuleViolationError
// ─────────────────────────────────────────────────────────────────────────────

class BusinessRuleViolationError extends AppError {
    constructor(
        rule: string,
        message: string,
        detail?: Record<string, unknown>,
        options?: AppErrorOptions,
    ) {
        const baseMetadata = detail ? { rule, detail } : { rule };
        // Reserved keys (`rule`/`detail`) spread last so caller metadata cannot
        // clobber them.
        const mergedMetadata = options?.metadata
            ? { ...options.metadata, ...baseMetadata }
            : baseMetadata;

        super(message, ErrorCodes.businessRuleViolation, {
            ...options,
            metadata: mergedMetadata,
        });
        Object.freeze(this);
    }
}

export { BusinessRuleViolationError };
