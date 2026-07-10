import { ValidationCode } from "../exceptions/validation-code.js";
import { ValidationField } from "../exceptions/validation-field.js";

import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// ValidationError
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raised when a single input fails a validation rule — the canonical
 * "this field is wrong, and here is why" error.
 *
 * It pins the offending `field` and a machine-readable `validationCode` into
 * the metadata (merged ahead of any caller-supplied metadata) so an API layer
 * can map the failure straight onto a form field without parsing the message.
 * The fixed {@link ErrorCodes.validation} code lets callers catch all
 * validation failures uniformly while still distinguishing the specific rule
 * through `validationCode`.
 */
class ValidationError extends AppError {
    /**
     * @param field - The input that failed validation; surfaced as `metadata.field`.
     * @param code - The specific rule that was violated; surfaced as `metadata.validationCode`.
     * @param message - The developer-facing description of the failure.
     * @param options - Optional cause, correlation ids, and extra metadata
     *   (merged over the field/code metadata, never overwriting it by accident).
     */
    constructor(
        field: ValidationField,
        code: ValidationCode,
        message: string,
        options?: AppErrorOptions,
    ) {
        const baseMetadata = {
            field: field.value,
            validationCode: code.value,
        };
        // `field`/`validationCode` spread last so caller metadata is merged
        // over them without ever overwriting them by accident.
        const mergedMetadata = options?.metadata
            ? { ...options.metadata, ...baseMetadata }
            : baseMetadata;

        super(message, ErrorCodes.validation, {
            ...options,
            metadata: mergedMetadata,
        });
        Object.freeze(this);
    }
}

export { ValidationError };
