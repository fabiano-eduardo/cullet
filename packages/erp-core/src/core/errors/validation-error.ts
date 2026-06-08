import { ValidationCode } from "../exceptions/validation-code";
import { ValidationField } from "../exceptions/validation-field";

import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

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
