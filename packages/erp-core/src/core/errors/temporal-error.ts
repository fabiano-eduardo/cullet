import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";
import { pickAppErrorOptions, stripAppErrorOptions } from "./utils/index.js";

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
                ...stripAppErrorOptions(input),
                hint:
                    input.hint ??
                    "The window has expired. Request a new link or try again within the valid period.",
            },
            ...pickAppErrorOptions(input),
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
                ...stripAppErrorOptions(input),
                hint:
                    input.hint ??
                    "Not yet within the valid period. Try again later.",
            },
            ...pickAppErrorOptions(input),
        });
    }
}

/**
 * Evaluates whether `evaluatedAtIso` falls inside the [`validFromIso`,
 * `validUntilIso`] window.
 *
 * Fails **closed**: a boundary that is present but unparseable is treated as if
 * the window were closed on that side (a bad `validUntilIso` → expired, a bad
 * `validFromIso` → not-yet-valid), never silently ignored — these checks guard
 * access (invites, links, tokens), so a typo in an expiry must not disable
 * expiry. A `null`/absent boundary means "no bound on that side", which is
 * distinct from a malformed one. Returns `null` only when `evaluatedAtIso`
 * itself is unparseable (nothing can be decided).
 *
 * For an inverted window (`validFrom` > `validUntil`) `expired` wins, since the
 * upper-bound check short-circuits.
 */
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
        if (Number.isNaN(fromMs) || evaluatedMs < fromMs) {
            notYetValid = true;
        }
    }

    if (input.validUntilIso) {
        const untilMs = Date.parse(input.validUntilIso);
        if (Number.isNaN(untilMs) || evaluatedMs > untilMs) {
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
