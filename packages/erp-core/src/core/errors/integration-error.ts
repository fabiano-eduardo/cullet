import type { AppErrorOptions, ErrorSeverity } from "./types.js";
import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import { compactMetadata, pickAppErrorOptions } from "./utils/index.js";

type IntegrationErrorReason =
    | "timeout"
    | "unreachable"
    | "bad_response"
    | "unknown";

type IntegrationErrorMetadata = {
    reason: IntegrationErrorReason;
    provider: string;
    operation: string;
    startedAtIso: string;
    durationMs: number;
    detectedAtIso?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    details?: string;
    statusCode?: number;
    responseCode?: string;
};

type IntegrationErrorAppOptions = Pick<
    AppErrorOptions,
    | "cause"
    | "type"
    | "severity"
    | "correlationId"
    | "requestId"
    | "commandId"
    | "createdAtIso"
    | "publicMessage"
>;

type IntegrationErrorConstructorParams = {
    message: string;
    code: string;
    reason: IntegrationErrorReason;
    metadata: IntegrationErrorMetadata;
} & IntegrationErrorAppOptions;

/**
 * Raised when a call to an external provider fails — a timeout, an unreachable
 * endpoint, or a malformed response. This is the boundary error that separates
 * "our code is fine, the outside world misbehaved" from internal faults, which
 * matters for retry and alerting decisions.
 *
 * Every instance records the `provider`, the `operation`, and timing
 * (`startedAtIso` / `durationMs`) so failures are correlatable across services
 * and a slow dependency is visible in the metadata. The discriminating
 * {@link reason} lets callers decide whether a failure is worth retrying.
 * Instances are frozen; construct through the static factories.
 */
class IntegrationError extends AppError {
    public readonly reason: IntegrationErrorReason;

    private constructor(params: IntegrationErrorConstructorParams) {
        const { message, code, metadata, ...rest } = params;
        super(message, code, {
            ...rest,
            metadata,
        });

        this.reason = params.reason;
        Object.freeze(this);
    }

    /**
     * The provider did not respond within the allotted time. Usually retryable,
     * since a timeout leaves the outcome unknown rather than known-failed.
     */
    static timeout(options: IntegrationErrorTimeoutOptions): IntegrationError {
        return new IntegrationError({
            message: "Timeout while integrating with external provider",
            code: ErrorCodes.integration.timeout,
            reason: "timeout",
            metadata: buildMetadata({ reason: "timeout", ...options }),
            ...pickAppErrorOptions(options),
        });
    }

    /**
     * The provider could not be reached at all (connection refused, DNS
     * failure, network partition) — the request never landed.
     */
    static unreachable(
        options: IntegrationErrorEndpointOptions,
    ): IntegrationError {
        return new IntegrationError({
            message: "Provider unavailable",
            code: ErrorCodes.integration.unreachable,
            reason: "unreachable",
            metadata: buildMetadata({ reason: "unreachable", ...options }),
            ...pickAppErrorOptions(options),
        });
    }

    /**
     * The provider answered, but with something the system cannot use — an
     * unexpected status, an unparsable body, or a contract mismatch. Unlike a
     * timeout this is a definite failure, so blind retries rarely help.
     */
    static badResponse(
        options: IntegrationErrorEndpointOptions,
    ): IntegrationError {
        return new IntegrationError({
            message: "Unexpected response from provider",
            code: ErrorCodes.integration.badResponse,
            reason: "bad_response",
            metadata: buildMetadata({ reason: "bad_response", ...options }),
            ...pickAppErrorOptions(options),
        });
    }
}

type IntegrationErrorBaseOptions = {
    provider: string;
    operation: string;
    startedAtIso: string;
    durationMs: number;
    detectedAtIso?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    details?: string;
    statusCode?: number;
    responseCode?: string;
    cause?: unknown;
    type?: string;
    severity?: ErrorSeverity;
    createdAtIso?: string;
    publicMessage?: string;
};

type IntegrationErrorTimeoutOptions = IntegrationErrorBaseOptions;
type IntegrationErrorEndpointOptions = IntegrationErrorBaseOptions;

function buildMetadata(
    input: IntegrationErrorBaseOptions & { reason: IntegrationErrorReason },
): IntegrationErrorMetadata {
    return compactMetadata({
        reason: input.reason,
        provider: input.provider,
        operation: input.operation,
        startedAtIso: input.startedAtIso,
        durationMs: input.durationMs,
        detectedAtIso: input.detectedAtIso,
        correlationId: input.correlationId,
        requestId: input.requestId,
        commandId: input.commandId,
        details: input.details,
        statusCode: input.statusCode,
        responseCode: input.responseCode,
    }) as IntegrationErrorMetadata;
}

export { IntegrationError };
export type { IntegrationErrorReason, IntegrationErrorMetadata };
