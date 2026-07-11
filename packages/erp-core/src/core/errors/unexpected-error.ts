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
        // The error you most want alerted on defaults to "critical" — a caller
        // can still lower it via options.severity.
        super(message, ErrorCodes.unexpected, {
            severity: "critical",
            ...options,
            cause,
        });
        Object.freeze(this);
    }
}

export { UnexpectedError };
