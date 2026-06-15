import { ValidationCode } from "../exceptions/validation-code.js";
import { ValidationField } from "../exceptions/validation-field.js";

import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// ValidationError
// ─────────────────────────────────────────────────────────────────────────────

class ValidationError extends AppError {
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
        const mergedMetadata = options?.metadata
            ? { ...baseMetadata, ...options.metadata }
            : baseMetadata;

        super(message, ErrorCodes.validation, {
            ...options,
            metadata: mergedMetadata,
        });
    }
}

export { ValidationError };
