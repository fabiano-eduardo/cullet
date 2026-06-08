import type { AppErrorOptions, ErrorSeverity } from "./types";
import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";

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

    static timeout(options: IntegrationErrorTimeoutOptions): IntegrationError {
        return new IntegrationError({
            message: "Timeout while integrating with external provider",
            code: ErrorCodes.integration.timeout,
            reason: "timeout",
            metadata: buildMetadata({ reason: "timeout", ...options }),
            ...pickAppErrorFields(options),
        });
    }

    static unreachable(
        options: IntegrationErrorEndpointOptions,
    ): IntegrationError {
        return new IntegrationError({
            message: "Provider unavailable",
            code: ErrorCodes.integration.unreachable,
            reason: "unreachable",
            metadata: buildMetadata({ reason: "unreachable", ...options }),
            ...pickAppErrorFields(options),
        });
    }

    static badResponse(
        options: IntegrationErrorEndpointOptions,
    ): IntegrationError {
        return new IntegrationError({
            message: "Unexpected response from provider",
            code: ErrorCodes.integration.badResponse,
            reason: "bad_response",
            metadata: buildMetadata({ reason: "bad_response", ...options }),
            ...pickAppErrorFields(options),
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

function pickAppErrorFields(
    options: IntegrationErrorBaseOptions,
): IntegrationErrorAppOptions {
    return {
        cause: options.cause,
        type: options.type,
        severity: options.severity,
        correlationId: options.correlationId,
        requestId: options.requestId,
        commandId: options.commandId,
        createdAtIso: options.createdAtIso,
        publicMessage: options.publicMessage,
    };
}

function compactMetadata<T extends Record<string, unknown>>(input: T): T {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
    ) as T;
}

export { IntegrationError };
export type { IntegrationErrorReason, IntegrationErrorMetadata };
