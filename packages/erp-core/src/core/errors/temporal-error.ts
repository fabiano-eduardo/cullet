import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

type TemporalKind = "expired" | "not_yet_valid";

type TemporalPrecision = "EXACT" | "ESTIMATED" | "UNKNOWN" | "APPROXIMATE";

type TemporalErrorMetadata = {
    resourceType: string;
    resourceId?: string;
    operation?: string;
    validFromIso?: string | null;
    validUntilIso?: string | null;
    evaluatedAtIso: string;
    policyId?: string;
    precision?: TemporalPrecision;
    hint?: string;
    details?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
};

type TemporalErrorOptions = {
    message: string;
    code: string;
    kind: TemporalKind;
    metadata: TemporalErrorMetadata;
} & AppErrorOptions;

abstract class TemporalError extends AppError {
    public readonly kind: TemporalKind;
    public readonly resourceType: string;
    public readonly evaluatedAtIso: string;

    protected constructor(input: TemporalErrorOptions) {
        super(input.message, input.code, {
            ...input,
            metadata: {
                kind: input.kind,
                ...input.metadata,
            },
        });

        this.kind = input.kind;
        this.resourceType = input.metadata.resourceType;
        this.evaluatedAtIso = input.metadata.evaluatedAtIso;
        Object.freeze(this);
    }
}

type TemporalCreationInput = TemporalErrorMetadata &
    Partial<Omit<AppErrorOptions, "metadata">> & {
        cause?: unknown;
    };

class ExpiredError extends TemporalError {
    private constructor(input: TemporalErrorOptions) {
        super(input);
    }

    static detected(input: TemporalCreationInput): ExpiredError {
        return new ExpiredError({
            message: "The validity of the resource/action has expired",
            code: ErrorCodes.temporal.expired,
            kind: "expired",
            metadata: {
                ...input,
                hint:
                    input.hint ??
                    "The window has expired. Request a new link or try again within the valid period.",
            },
            cause: input.cause,
            type: input.type,
            severity: input.severity,
            correlationId: input.correlationId,
            requestId: input.requestId,
            commandId: input.commandId,
            createdAtIso: input.createdAtIso,
            publicMessage: input.publicMessage,
        });
    }
}

class NotYetValidError extends TemporalError {
    private constructor(input: TemporalErrorOptions) {
        super(input);
    }

    static detected(input: TemporalCreationInput): NotYetValidError {
        return new NotYetValidError({
            message: "The resource/action is not yet valid",
            code: ErrorCodes.temporal.notYetValid,
            kind: "not_yet_valid",
            metadata: {
                ...input,
                hint:
                    input.hint ??
                    "Not yet within the valid period. Try again later.",
            },
            cause: input.cause,
            type: input.type,
            severity: input.severity,
            correlationId: input.correlationId,
            requestId: input.requestId,
            commandId: input.commandId,
            createdAtIso: input.createdAtIso,
            publicMessage: input.publicMessage,
        });
    }
}

function evaluateTemporalWindow(input: {
    validFromIso?: string | null;
    validUntilIso?: string | null;
    evaluatedAtIso: string;
}): { expired: boolean; notYetValid: boolean } | null {
    const evaluatedMs = Date.parse(input.evaluatedAtIso);
    if (Number.isNaN(evaluatedMs)) return null;

    let notYetValid = false;

    if (input.validFromIso) {
        const fromMs = Date.parse(input.validFromIso);
        if (!Number.isNaN(fromMs) && evaluatedMs < fromMs) {
            notYetValid = true;
        }
    }

    if (input.validUntilIso) {
        const untilMs = Date.parse(input.validUntilIso);
        if (!Number.isNaN(untilMs) && evaluatedMs > untilMs) {
            return { expired: true, notYetValid: false };
        }
    }

    return { expired: false, notYetValid };
}

export {
    evaluateTemporalWindow,
    ExpiredError,
    NotYetValidError,
    TemporalError,
};
export type { TemporalErrorMetadata, TemporalKind, TemporalPrecision };
