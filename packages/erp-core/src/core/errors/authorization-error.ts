import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions, ErrorSeverity } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AuthorizationErrorReason =
  | "forbidden"
  | "missing_role"
  | "missing_capability"
  | "out_of_scope"
  | "outside_time_window"
  | "policy_denied"
  | "unknown";

type AuthorizationRequirement = {
  role?: string;
  capability?: string;
  scope?: string; // e.g.: "school:{id}" or "class:{id}"
};

type AuthorizationErrorMetadata = {
  reason: AuthorizationErrorReason;

  /** Stable action you evaluated (not an HTTP route — a "business action") */
  action: string;

  /** Resource identification (without leaking the full payload) */
  resource?: { type: string; id?: string };

  /** Optional: actor (do not include sensitive data) */
  actor?: { userId: string; role?: string };

  /** Optional: expected requirement */
  required?: AuthorizationRequirement;

  /** Optional: policy (when you already have PolicyEvaluation or similar) */
  policyId?: string;
  policyVersion?: number;
  evaluatedAtIso?: string;
  decision?: "allow" | "deny";
  reasonCode?: string;

  /** Optional: additional non-sensitive info */
  details?: string;
};

/**
 * Options for AuthorizationError factory methods.
 * Combines metadata fields (except 'reason') with common AppError options.
 */
type AuthorizationErrorFactoryOptions = Omit<
  AuthorizationErrorMetadata,
  "reason"
> &
  Omit<AppErrorOptions, "metadata">;

// ─────────────────────────────────────────────────────────────────────────────
// AuthorizationError
// ─────────────────────────────────────────────────────────────────────────────

class AuthorizationError extends AppError {
  public readonly reason: AuthorizationErrorReason;

  private constructor(params: {
    message: string;
    code: string;
    reason: AuthorizationErrorReason;
    metadata: AuthorizationErrorMetadata;
    cause?: unknown;
    type?: string;
    severity?: ErrorSeverity;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    createdAtIso?: string;
    publicMessage?: string;
  }) {
    super(params.message, params.code, {
      cause: params.cause,
      metadata: params.metadata,
      type: params.type,
      severity: params.severity,
      correlationId: params.correlationId,
      requestId: params.requestId,
      commandId: params.commandId,
      createdAtIso: params.createdAtIso,
      publicMessage: params.publicMessage,
    });

    this.reason = params.reason;
    Object.freeze(this);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factories
  // ─────────────────────────────────────────────────────────────────────────

  static forbidden(
    input: AuthorizationErrorFactoryOptions,
  ): AuthorizationError {
    return new AuthorizationError({
      message: "Action not allowed",
      code: ErrorCodes.authorization.forbidden,
      reason: "forbidden",
      metadata: { reason: "forbidden", ...extractMetadataOnly(input) },
      ...extractAppErrorOptions(input),
    });
  }

  static policyDenied(
    input: AuthorizationErrorFactoryOptions & {
      policyId: string;
      policyVersion: number;
      evaluatedAtIso: string;
    },
  ): AuthorizationError {
    return new AuthorizationError({
      message: "Action denied by policy",
      code: ErrorCodes.authorization.policyDenied,
      reason: "policy_denied",
      metadata: {
        reason: "policy_denied",
        ...extractMetadataOnly(input),
        decision: "deny",
      },
      ...extractAppErrorOptions(input),
    });
  }

  static missingCapability(
    input: AuthorizationErrorFactoryOptions & {
      required: AuthorizationRequirement;
    },
  ): AuthorizationError {
    return new AuthorizationError({
      message: "Insufficient capability to perform the action",
      code: ErrorCodes.authorization.missingCapability,
      reason: "missing_capability",
      metadata: {
        reason: "missing_capability",
        ...extractMetadataOnly(input),
      },
      ...extractAppErrorOptions(input),
    });
  }

  static outOfScope(
    input: AuthorizationErrorFactoryOptions & {
      required?: AuthorizationRequirement;
    },
  ): AuthorizationError {
    return new AuthorizationError({
      message: "Action outside the allowed scope",
      code: ErrorCodes.authorization.outOfScope,
      reason: "out_of_scope",
      metadata: { reason: "out_of_scope", ...extractMetadataOnly(input) },
      ...extractAppErrorOptions(input),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractAppErrorOptions(options?: Partial<AppErrorOptions>) {
  return {
    cause: options?.cause,
    type: options?.type,
    severity: options?.severity,
    correlationId: options?.correlationId,
    requestId: options?.requestId,
    commandId: options?.commandId,
    createdAtIso: options?.createdAtIso,
    publicMessage: options?.publicMessage,
  };
}

function extractMetadataOnly(
  input: AuthorizationErrorFactoryOptions,
): Omit<AuthorizationErrorMetadata, "reason"> {
  const {
    cause,
    type,
    severity,
    correlationId,
    requestId,
    commandId,
    createdAtIso,
    publicMessage,
    ...metadata
  } = input;
  return metadata;
}

export { AuthorizationError };
export type {
  AuthorizationErrorMetadata,
  AuthorizationErrorReason,
  AuthorizationRequirement,
};
