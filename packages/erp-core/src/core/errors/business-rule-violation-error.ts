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
        const mergedMetadata = options?.metadata
            ? { ...baseMetadata, ...options.metadata }
            : baseMetadata;

        super(message, ErrorCodes.businessRuleViolation, {
            ...options,
            metadata: mergedMetadata,
        });
    }
}

export { BusinessRuleViolationError };
