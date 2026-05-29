// Base application error for the domain/application layer.
// Encapsulates a code, optional cause, and JSON-safe metadata.

import type { AppErrorOptions, ErrorSeverity, JsonSafeRecord } from "./types";
import { assertJsonSafeMetadata } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
// AppError (abstract base class)
// ─────────────────────────────────────────────────────────────────────────────

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
      type: this.type,
      severity: this.severity,
      message: this.message,
      publicMessage: this.publicMessage,
      createdAtIso: this.createdAtIso,
      metadata: this.metadata,
    };

    if (this.correlationId !== undefined)
      payload.correlationId = this.correlationId;
    if (this.requestId !== undefined) payload.requestId = this.requestId;
    if (this.commandId !== undefined) payload.commandId = this.commandId;

    return payload;
  }
}

export { AppError };
