import { payloadHash, sha256Hex, stableStringify } from "../shared/hashing.js";

import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";

export type IdempotencyFailureKind =
    | "key_missing"
    | "in_progress"
    | "payload_mismatch"
    | "replay_not_supported"
    | "unknown";

export type IdempotencyErrorMetadata = {
    kind: IdempotencyFailureKind;
    operation: string;
    scope?: string;
    entity?: string;
    keyHash?: string;
    keyPreview?: string;
    incomingPayloadHash?: string;
    existingPayloadHash?: string;
    idempotencyRecordId?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    detectedAtIso?: string;
    hint?: string;
    details?: string;
};

type IdempotencyErrorConstructorInput = {
    message: string;
    code: string;
    kind: IdempotencyFailureKind;
    metadata: Omit<IdempotencyErrorMetadata, "kind">;
    cause?: unknown;
};

abstract class IdempotencyError extends AppError {
    public readonly kind: IdempotencyFailureKind;

    protected constructor(input: IdempotencyErrorConstructorInput) {
        super(input.message, input.code, {
            cause: input.cause,
            metadata: { kind: input.kind, ...input.metadata },
        });

        this.kind = input.kind;
        Object.freeze(this);
    }

    static keyMissing(input: {
        operation: string;
        scope?: string;
        entity?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyKeyMissingError {
        return IdempotencyKeyMissingError.detected(input);
    }

    static inProgress(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyInProgressError {
        return IdempotencyInProgressError.detected(input);
    }

    static payloadMismatch(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        incomingPayloadHash?: string;
        existingPayloadHash?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyPayloadMismatchError {
        return IdempotencyPayloadMismatchError.detected(input);
    }

    static replayNotSupported(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyReplayNotSupportedError {
        return IdempotencyReplayNotSupportedError.detected(input);
    }
}

class IdempotencyKeyMissingError extends IdempotencyError {
    private constructor(input: {
        metadata: Omit<IdempotencyErrorMetadata, "kind">;
        cause?: unknown;
    }) {
        super({
            message:
                "Idempotency key/commandId missing for the requested operation",
            code: ErrorCodes.idempotency.keyMissing,
            kind: "key_missing",
            metadata: input.metadata,
            cause: input.cause,
        });
    }

    static detected(input: {
        operation: string;
        scope?: string;
        entity?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyKeyMissingError {
        return new IdempotencyKeyMissingError({
            cause: input.cause,
            metadata: {
                operation: input.operation,
                scope: input.scope,
                entity: input.entity,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                detectedAtIso: input.detectedAtIso,
                hint:
                    input.hint ??
                    "Send a commandId/idempotency key to prevent duplicate processing.",
                details: input.details,
            },
        });
    }
}

class IdempotencyInProgressError extends IdempotencyError {
    private constructor(input: {
        metadata: Omit<IdempotencyErrorMetadata, "kind">;
        cause?: unknown;
    }) {
        super({
            message: "The same business intent is already being processed",
            code: ErrorCodes.idempotency.inProgress,
            kind: "in_progress",
            metadata: input.metadata,
            cause: input.cause,
        });
    }

    static detected(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyInProgressError {
        const resolved = resolveKeyIdentity(
            input.key,
            input.keyHash,
            input.keyPreview,
        );

        return new IdempotencyInProgressError({
            cause: input.cause,
            metadata: {
                operation: input.operation,
                scope: input.scope,
                entity: input.entity,
                keyHash: resolved.keyHash,
                keyPreview: resolved.keyPreview,
                idempotencyRecordId: input.idempotencyRecordId,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                detectedAtIso: input.detectedAtIso,
                hint:
                    input.hint ??
                    "Wait for completion and retry using the same key.",
                details: input.details,
            },
        });
    }
}

class IdempotencyPayloadMismatchError extends IdempotencyError {
    private constructor(input: {
        metadata: Omit<IdempotencyErrorMetadata, "kind">;
        cause?: unknown;
    }) {
        super({
            message: "The idempotency key was reused with a different payload",
            code: ErrorCodes.idempotency.payloadMismatch,
            kind: "payload_mismatch",
            metadata: input.metadata,
            cause: input.cause,
        });
    }

    static detected(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        incomingPayloadHash?: string;
        existingPayloadHash?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyPayloadMismatchError {
        const resolved = resolveKeyIdentity(
            input.key,
            input.keyHash,
            input.keyPreview,
        );

        return new IdempotencyPayloadMismatchError({
            cause: input.cause,
            metadata: {
                operation: input.operation,
                scope: input.scope,
                entity: input.entity,
                keyHash: resolved.keyHash,
                keyPreview: resolved.keyPreview,
                incomingPayloadHash: input.incomingPayloadHash,
                existingPayloadHash: input.existingPayloadHash,
                idempotencyRecordId: input.idempotencyRecordId,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                detectedAtIso: input.detectedAtIso,
                hint:
                    input.hint ??
                    "Use a new idempotency key for a new intent. The same key should only be reused for retries of the same payload.",
                details: input.details,
            },
        });
    }
}

class IdempotencyReplayNotSupportedError extends IdempotencyError {
    private constructor(input: {
        metadata: Omit<IdempotencyErrorMetadata, "kind">;
        cause?: unknown;
    }) {
        super({
            message:
                "Re-execution detected, but replay of the previous result is not implemented",
            code: ErrorCodes.idempotency.replayNotSupported,
            kind: "replay_not_supported",
            metadata: input.metadata,
            cause: input.cause,
        });
    }

    static detected(input: {
        operation: string;
        scope?: string;
        entity?: string;
        key?: string;
        keyHash?: string;
        keyPreview?: string;
        idempotencyRecordId?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        detectedAtIso?: string;
        hint?: string;
        details?: string;
        cause?: unknown;
    }): IdempotencyReplayNotSupportedError {
        const resolved = resolveKeyIdentity(
            input.key,
            input.keyHash,
            input.keyPreview,
        );

        return new IdempotencyReplayNotSupportedError({
            cause: input.cause,
            metadata: {
                operation: input.operation,
                scope: input.scope,
                entity: input.entity,
                keyHash: resolved.keyHash,
                keyPreview: resolved.keyPreview,
                idempotencyRecordId: input.idempotencyRecordId,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                detectedAtIso: input.detectedAtIso,
                hint:
                    input.hint ??
                    "Try again later, or enable result replay for full idempotency.",
                details: input.details,
            },
        });
    }
}

function resolveKeyIdentity(
    key?: string,
    keyHash?: string,
    keyPreview?: string,
): { keyHash?: string; keyPreview?: string } {
    const preview =
        keyPreview ??
        (key ? (key.length <= 8 ? key : key.slice(0, 8)) : undefined);

    return {
        // Derive the hash from the raw key when the caller didn't supply one —
        // cheap traceability without leaking the key itself.
        keyHash: keyHash ?? (key ? sha256Hex(key) : undefined),
        keyPreview: preview,
    };
}

export {
    IdempotencyError,
    IdempotencyKeyMissingError,
    IdempotencyInProgressError,
    IdempotencyPayloadMismatchError,
    IdempotencyReplayNotSupportedError,
    sha256Hex,
    stableStringify,
    payloadHash,
};
