import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

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
