import { AppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
import type { AppErrorOptions } from "./types.js";

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

/**
 * Storage-level description of a unique-constraint breach, as reported by a
 * database driver. Used to translate a raw DB error into a domain
 * {@link DuplicateError} via {@link translateUniqueViolationToDuplicate}.
 */
type UniqueConstraintViolation = {
    kind: "unique_violation";
    constraintName?: string;
    table?: string;
    columns?: string[];
};

/**
 * Base for errors that signal a state conflict — the request collides with data
 * that already exists. Common at an HTTP 409 boundary.
 *
 * The discriminating {@link kind} lets a handler branch on *why* it conflicted
 * (an already-existing record, a domain duplicate, or a raw storage uniqueness
 * breach) without `instanceof` chains. Abstract: construct one of the concrete
 * subclasses through its `detected(...)` factory, which fills in the right code,
 * message, and metadata. Instances are frozen, so a conflict error can be shared
 * and rethrown without risk of tampering.
 */
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

/**
 * The operation cannot proceed because a matching record already exists —
 * e.g. creating something whose natural key is already taken. Construct via
 * {@link AlreadyExistsError.detected}.
 */
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

    /**
     * Builds an {@link AlreadyExistsError} for a detected collision. `operation`
     * defaults to `"create"` and a generic retry `hint` is supplied when none is
     * given, so the error is actionable even from a minimal call site.
     *
     * @param input - The conflicting entity plus optional non-sensitive context
     *   (operation, field, existing id, value hash/preview, correlation ids).
     */
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

/**
 * A domain-level duplicate: the data being written would duplicate an existing
 * record under the model's own uniqueness rules. Use this when the duplication
 * is recognized in the domain, as opposed to a raw DB constraint
 * ({@link UniqueConstraintViolationError}). Construct via
 * {@link DuplicateError.detected}.
 */
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

    /**
     * Builds a {@link DuplicateError} for a detected duplicate, defaulting to a
     * "adjust the data so it does not duplicate" hint when none is provided.
     *
     * @param input - The conflicting entity plus optional non-sensitive context
     *   (field, constraint name, existing id, value hash/preview, correlation ids).
     */
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

/**
 * A uniqueness breach surfaced by the storage layer itself (a database unique
 * index), carrying the raw {@link UniqueConstraintViolation} (constraint, table,
 * columns). Keep this distinct from {@link DuplicateError}: this one is the
 * infrastructure signal; translate it into a domain duplicate at the boundary
 * with {@link translateUniqueViolationToDuplicate} when the model should own the
 * message. Construct via {@link UniqueConstraintViolationError.detected}.
 */
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

    /**
     * Builds a {@link UniqueConstraintViolationError} from the constraint details
     * a driver reports, packaging them into a nested `violation` payload.
     *
     * @param input - The entity plus the offending constraint name, table, and
     *   columns, and optional correlation ids.
     */
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

/**
 * Translates a raw storage {@link UniqueConstraintViolation} into a domain-level
 * {@link DuplicateError}. This is the seam where an infrastructure concern (a DB
 * unique index firing) is re-expressed in the language of the model, so callers
 * upstream catch a `DuplicateError` and never have to know a database was
 * involved.
 *
 * @param input - The entity, the driver-reported `violation`, and optional
 *   request context (`ctx`) carrying correlation ids and a clock instant.
 * @returns A {@link DuplicateError} carrying the constraint name as its field hint.
 */
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
