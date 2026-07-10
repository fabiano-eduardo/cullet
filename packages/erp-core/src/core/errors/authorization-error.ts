import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions, ErrorSeverity } from "./types.js";
import { pickAppErrorOptions } from "./utils/index.js";

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

/**
 * Raised when an authenticated actor is not allowed to perform a business
 * action — the "you may not" error, distinct from authentication ("who are
 * you"). Maps to an HTTP 403 at the edge.
 *
 * The discriminating {@link reason} records *why* access was denied (a flat
 * forbid, a missing role/capability, an out-of-scope target, or a policy
 * decision) so the boundary can shape the response without re-deriving it. The
 * metadata is deliberately built around a stable business `action` and a
 * type/id resource reference rather than an HTTP route or full payload, keeping
 * sensitive data out of logs. Instances are frozen. Construct through the
 * static factories, never directly.
 */
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

    /**
     * A flat denial with no more specific reason — the actor simply may not
     * perform this action. Reach for a more precise factory
     * ({@link AuthorizationError.missingCapability}, {@link AuthorizationError.outOfScope},
     * {@link AuthorizationError.policyDenied}) when the cause is known.
     */
    static forbidden(
        input: AuthorizationErrorFactoryOptions,
    ): AuthorizationError {
        return new AuthorizationError({
            message: "Action not allowed",
            code: ErrorCodes.authorization.forbidden,
            reason: "forbidden",
            metadata: { reason: "forbidden", ...extractMetadataOnly(input) },
            ...pickAppErrorOptions(input),
        });
    }

    /**
     * The action was denied by an evaluated policy. Captures the deciding
     * policy's id, version, and evaluation instant into the metadata (with
     * `decision: "deny"`) so the denial is auditable back to the exact policy
     * that produced it.
     *
     * @param input - Factory options plus the required `policyId`,
     *   `policyVersion`, and `evaluatedAtIso` of the deciding policy.
     */
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
            ...pickAppErrorOptions(input),
        });
    }

    /**
     * The actor holds no role at all that bears on the action — the most basic
     * denial, distinct from {@link AuthorizationError.missingCapability} (which
     * means the actor *has* roles, just none granting the required capability).
     * The expected {@link AuthorizationRequirement} is recorded so the boundary
     * can tell the caller what grant is missing.
     *
     * @param input - Factory options plus the `required` role/capability/scope.
     */
    static missingRole(
        input: AuthorizationErrorFactoryOptions & {
            required: AuthorizationRequirement;
        },
    ): AuthorizationError {
        return new AuthorizationError({
            message: "Missing required role to perform the action",
            code: ErrorCodes.authorization.missingRole,
            reason: "missing_role",
            metadata: {
                reason: "missing_role",
                ...extractMetadataOnly(input),
            },
            ...pickAppErrorOptions(input),
        });
    }

    /**
     * The actor lacks a required role or capability. The expected
     * {@link AuthorizationRequirement} is recorded so the boundary can tell the
     * caller precisely what grant is missing.
     *
     * @param input - Factory options plus the `required` role/capability/scope.
     */
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
            ...pickAppErrorOptions(input),
        });
    }

    /**
     * The actor may perform the action in general, but not on *this* target —
     * the resource falls outside the actor's permitted scope (e.g. a different
     * school or tenant than the one they are bound to).
     *
     * @param input - Factory options plus the optional `required` scope that the
     *   target failed to satisfy.
     */
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
            ...pickAppErrorOptions(input),
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
