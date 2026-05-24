// Shared types for V3 application errors.

// ─────────────────────────────────────────────────────────────────────────────
// Severity levels
// ─────────────────────────────────────────────────────────────────────────────

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ─────────────────────────────────────────────────────────────────────────────
// JSON-safe value types (for metadata serialization)
// ─────────────────────────────────────────────────────────────────────────────

type JsonSafePrimitive = string | number | boolean | null;

type JsonSafeValue =
	| JsonSafePrimitive
	| JsonSafeValue[]
	| { [key: string]: JsonSafeValue };

type JsonSafeRecord = Record<string, JsonSafeValue>;

// ─────────────────────────────────────────────────────────────────────────────
// AppError options (reusable across all error subclasses)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options accepted by the AppError constructor.
 * Subclasses can extend or pick from this type.
 */
type AppErrorOptions = {
	/** Original error or exception that caused this error. */
	cause?: unknown;

	/** Arbitrary key-value metadata (will be sanitized to JSON-safe values). */
	metadata?: Record<string, unknown>;

	/** Error category/type for grouping (e.g., "authentication", "validation"). */
	type?: string;

	/** severity level for alerting/logging prioritization. */
	severity?: ErrorSeverity;

	/**
	 * Identifies a single execution "story" in the system. All operations
	 * related to the same logical flow must share the same correlationId.
	 */
	correlationId?: string;

	/**
	 * Identifies a specific technical request attempt (each retry may produce
	 * a new requestId), even when the correlationId stays the same.
	 */
	requestId?: string;

	/**
	 * Identifies a unique business intent (idempotency key); stays the same
	 * across technical retries and multiple requests that represent the same intent.
	 */
	commandId?: string;

	/** ISO timestamp of when the error was created (defaults to now). */
	createdAtIso?: string;

	/** Safe message that can be exposed to end users (no internal details). */
	publicMessage?: string;
};

export type {
	AppErrorOptions,
	ErrorSeverity,
	JsonSafePrimitive,
	JsonSafeRecord,
	JsonSafeValue,
};
