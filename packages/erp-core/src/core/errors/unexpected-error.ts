import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

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
