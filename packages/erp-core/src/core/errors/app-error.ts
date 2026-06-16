// Base application error for the domain/application layer.
// Encapsulates a code, optional cause, and JSON-safe metadata.

import type {
    AppErrorOptions,
    ErrorSeverity,
    JsonSafeRecord,
} from "./types.js";
import { assertJsonSafeMetadata } from "./utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// AppError (abstract base class)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Root of the application/domain error hierarchy. Every error the system raises
 * on purpose extends `AppError`, which gives callers a single `instanceof` to
 * catch and a uniform, serializable shape to log and transport.
 *
 * Beyond the native `Error` message it carries a stable `code` (the contract the
 * outside world matches on), an optional non-leaking `publicMessage`, a
 * severity, JSON-safe `metadata`, and the correlation/request/command ids that
 * stitch an error back to the request that produced it. The metadata is
 * validated as JSON-safe on construction, so a logger can serialize any
 * `AppError` without hitting a circular reference or a non-serializable value.
 *
 * Abstract on purpose: callers should throw a specific subclass (e.g.
 * {@link ValidationError}, {@link NotFoundError}) so the `code` and shape are
 * meaningful, never a bare `AppError`.
 */
abstract class AppError extends Error {
    public readonly code: string;
    public readonly cause?: unknown;
    public readonly metadata?: JsonSafeRecord;
    public readonly type?: string;
    public readonly severity?: ErrorSeverity;
    public readonly createdAtIso: string;
    public readonly publicMessage?: string;
    /**
     * Identifies a single execution "story" in the system. All operations
     * related to the same logical flow must share the same correlationId.
     */
    public readonly correlationId?: string;
    /**
     * Identifies a specific technical request attempt (each retry may produce
     * a new requestId), even when the correlationId stays the same.
     */
    public readonly requestId?: string;
    /**
     * Marks the business intent / idempotency key; stays the same across
     * technical retries and multiple requests that represent the same intent.
     */
    public readonly commandId?: string;

    /**
     * Builds the common error envelope shared by every subclass.
     *
     * `name` is taken from `new.target` so the thrown instance reports its
     * concrete subclass name (not `"AppError"`), and the prototype is re-pinned
     * via `setPrototypeOf` so `instanceof` keeps working after transpilation to
     * older targets where extending built-ins breaks the chain. `createdAtIso`
     * defaults to now, and `metadata` is validated as JSON-safe so the error is
     * always serializable.
     *
     * Declared `protected`: instantiate a concrete subclass, never `AppError`.
     *
     * @param message - The internal, developer-facing message.
     * @param code - The stable machine-readable code callers match on.
     * @param options - Optional cause, metadata, severity, and correlation ids.
     * @throws When `options.metadata` contains a value that is not JSON-safe.
     */
    protected constructor(
        message: string,
        code: string,
        options?: AppErrorOptions,
    ) {
        super(message);

        this.name = new.target.name;
        this.code = code;
        this.cause = options?.cause;
        this.type = options?.type;
        this.severity = options?.severity;
        this.correlationId = options?.correlationId;
        this.requestId = options?.requestId;
        this.commandId = options?.commandId;
        this.createdAtIso = options?.createdAtIso ?? new Date().toISOString();
        this.publicMessage = options?.publicMessage;

        this.metadata = options?.metadata
            ? assertJsonSafeMetadata(options.metadata)
            : undefined;

        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Returns a JSON-safe representation of the error.
     * Does NOT include `cause` by default (to avoid leaking internal details).
     */
    public toJSON(): Record<string, unknown> {
        const payload: Record<string, unknown> = {
            name: this.name,
            code: this.code,
            message: this.message,
            createdAtIso: this.createdAtIso,
        };

        // Optional fields are emitted only when defined, so the serialized
        // shape never carries `undefined`-valued keys (consistent with how the
        // correlation/request/command ids are handled).
        if (this.type !== undefined) payload.type = this.type;
        if (this.severity !== undefined) payload.severity = this.severity;
        if (this.publicMessage !== undefined)
            payload.publicMessage = this.publicMessage;
        if (this.metadata !== undefined) payload.metadata = this.metadata;
        if (this.correlationId !== undefined)
            payload.correlationId = this.correlationId;
        if (this.requestId !== undefined) payload.requestId = this.requestId;
        if (this.commandId !== undefined) payload.commandId = this.commandId;

        return payload;
    }
}

export { AppError };
