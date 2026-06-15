import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// UnexpectedError
// ─────────────────────────────────────────────────────────────────────────────

class UnexpectedError extends AppError {
    constructor(
        message = "Unexpected error",
        cause?: unknown,
        options?: Omit<AppErrorOptions, "cause">,
    ) {
        super(message, ErrorCodes.unexpected, {
            cause,
            ...options,
        });
    }
}

export { UnexpectedError };
