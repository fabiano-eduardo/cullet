import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions } from "./types";

/**
 * Conflict kinds we want to distinguish semantically.
 */
type ConflictKind = "already_exists" | "duplicate" | "unique_violation";

/**
 * Metadata attached to conflicts without exposing sensitive values.
 */
type ConflictErrorMetadata = {
    kind: ConflictKind;
    entity: string;
    operation?: string;
    field?: string;
    constraintName?: string;
    existingId?: string;
    valueHash?: string;
    valuePreview?: string;
    detectedAtIso?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    hint?: string;
};

type UniqueConstraintViolation = {
    kind: "unique_violation";
    constraintName?: string;
    table?: string;
    columns?: string[];
};

abstract class ConflictError extends AppError {
    public readonly kind: ConflictKind;

    protected constructor(
        params: {
            message: string;
            code: string;
            kind: ConflictKind;
            metadata: Omit<ConflictErrorMetadata, "kind">;
            cause?: unknown;
        } & AppErrorOptions,
    ) {
        super(params.message, params.code, {
            ...params,
            metadata: {
                kind: params.kind,
                ...params.metadata,
            },
        });

        this.kind = params.kind;
        Object.freeze(this);
    }
}

class AlreadyExistsError extends ConflictError {
    private constructor(
        input: {
            metadata: Omit<ConflictErrorMetadata, "kind">;
            cause?: unknown;
        } & AppErrorOptions,
    ) {
        super({
            message:
                "A matching record already exists for the requested operation",
            code: ErrorCodes.conflict.alreadyExists,
            kind: "already_exists",
            ...input,
        });
    }

    static detected(input: {
        entity: string;
        operation?: string;
        field?: string;
        existingId?: string;
        valueHash?: string;
        valuePreview?: string;
        detectedAtIso?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        hint?: string;
        cause?: unknown;
    }): AlreadyExistsError {
        return new AlreadyExistsError({
            metadata: {
                entity: input.entity,
                operation: input.operation ?? "create",
                field: input.field,
                existingId: input.existingId,
                valueHash: input.valueHash,
                valuePreview: input.valuePreview,
                detectedAtIso: input.detectedAtIso,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                hint: input.hint ?? "Verify existing records before retrying.",
            },
            cause: input.cause,
        });
    }
}

class DuplicateError extends ConflictError {
    private constructor(
        input: {
            metadata: Omit<ConflictErrorMetadata, "kind">;
            cause?: unknown;
        } & AppErrorOptions,
    ) {
        super({
            message: "Conflict: an existing record violates uniqueness",
            code: ErrorCodes.conflict.duplicate,
            kind: "duplicate",
            ...input,
        });
    }

    static detected(input: {
        entity: string;
        operation?: string;
        field?: string;
        constraintName?: string;
        existingId?: string;
        valueHash?: string;
        valuePreview?: string;
        detectedAtIso?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        hint?: string;
        cause?: unknown;
    }): DuplicateError {
        return new DuplicateError({
            metadata: {
                entity: input.entity,
                operation: input.operation,
                field: input.field,
                constraintName: input.constraintName,
                existingId: input.existingId,
                valueHash: input.valueHash,
                valuePreview: input.valuePreview,
                detectedAtIso: input.detectedAtIso,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                hint:
                    input.hint ??
                    "Adjust the data so it does not duplicate existing records.",
            },
            cause: input.cause,
        });
    }
}

class UniqueConstraintViolationError extends ConflictError {
    private constructor(
        input: {
            metadata: Omit<ConflictErrorMetadata, "kind"> & {
                violation: UniqueConstraintViolation;
            };
            cause?: unknown;
        } & AppErrorOptions,
    ) {
        super({
            message: "Uniqueness violation in storage",
            code: ErrorCodes.conflict.uniqueViolation,
            kind: "unique_violation",
            ...input,
        });
    }

    static detected(input: {
        entity: string;
        operation?: string;
        constraintName?: string;
        table?: string;
        columns?: string[];
        detectedAtIso?: string;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        cause?: unknown;
    }): UniqueConstraintViolationError {
        return new UniqueConstraintViolationError({
            metadata: {
                entity: input.entity,
                operation: input.operation,
                constraintName: input.constraintName,
                detectedAtIso: input.detectedAtIso,
                correlationId: input.correlationId,
                requestId: input.requestId,
                commandId: input.commandId,
                violation: {
                    kind: "unique_violation",
                    constraintName: input.constraintName,
                    table: input.table,
                    columns: input.columns,
                },
                hint: "Uniqueness conflict detected in the database.",
            },
            cause: input.cause,
        });
    }
}

function translateUniqueViolationToDuplicate(input: {
    entity: string;
    operation?: string;
    violation: UniqueConstraintViolation;
    field?: string;
    ctx?: {
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        nowIso?: string;
    };
    cause?: unknown;
}): DuplicateError {
    return DuplicateError.detected({
        entity: input.entity,
        operation: input.operation,
        field: input.field,
        constraintName: input.violation.constraintName,
        detectedAtIso: input.ctx?.nowIso,
        correlationId: input.ctx?.correlationId,
        requestId: input.ctx?.requestId,
        commandId: input.ctx?.commandId,
        cause: input.cause,
    });
}

export {
    AlreadyExistsError,
    ConflictError,
    DuplicateError,
    translateUniqueViolationToDuplicate,
    UniqueConstraintViolationError,
};

export type { ConflictErrorMetadata, ConflictKind, UniqueConstraintViolation };
