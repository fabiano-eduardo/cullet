// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
    AppErrorOptions,
    ErrorSeverity,
    JsonSafePrimitive,
    JsonSafeRecord,
    JsonSafeValue,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export { ErrorCodes, serializationErrorCode } from "./error-codes.js";
export { assertJsonSafeMetadata } from "./utils/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Error classes
// ─────────────────────────────────────────────────────────────────────────────

export { AppError } from "./app-error.js";
export type {
    AuthenticationErrorMetadata,
    AuthenticationErrorReason,
} from "./authentication-error.js";
export { AuthenticationError } from "./authentication-error.js";
export type {
    AuthorizationErrorMetadata,
    AuthorizationErrorReason,
    AuthorizationRequirement,
} from "./authorization-error.js";
export { AuthorizationError } from "./authorization-error.js";
export { BusinessRuleViolationError } from "./business-rule-violation-error.js";
export type {
    ConflictErrorMetadata,
    ConflictKind,
    UniqueConstraintViolation,
} from "./conflict-error.js";
export {
    AlreadyExistsError,
    ConflictError,
    DuplicateError,
    translateUniqueViolationToDuplicate,
    UniqueConstraintViolationError,
} from "./conflict-error.js";
export type {
    IdempotencyErrorMetadata,
    IdempotencyFailureKind,
} from "./idempotency-error.js";
export {
    IdempotencyError,
    IdempotencyInProgressError,
    IdempotencyKeyMissingError,
    IdempotencyPayloadMismatchError,
    IdempotencyReplayNotSupportedError,
    payloadHash,
    sha256Hex,
    stableStringify,
} from "./idempotency-error.js";
export type {
    IntegrationErrorMetadata,
    IntegrationErrorReason,
} from "./integration-error.js";
export { IntegrationError } from "./integration-error.js";
export { LegacyIncompatibleError } from "./legacy-incompatible-error.js";
export { NotFoundError } from "./not-found-error.js";
export type {
    SerializationBoundary,
    SerializationDirection,
    SerializationErrorMetadata,
    SerializationFailureCategory,
} from "./serialization-error.js";
export {
    // `DeserializationError` is a readability alias for the inbound direction
    // (deserialization == SerializationInError); both names are public API.
    SerializationInError as DeserializationError,
    safePreview,
    SerializationCodes,
    SerializationError,
    SerializationInError,
    SerializationMessages,
    SerializationOutError,
} from "./serialization-error.js";
export type {
    // `ExpiredError*` aliases are kept for callers that reach for the
    // expiry-specific name; they are the same shapes as the generic Temporal*.
    TemporalErrorMetadata as ExpiredErrorMetadata,
    TemporalPrecision as ExpiredErrorPrecision,
    TemporalErrorMetadata,
    TemporalKind,
    TemporalPrecision,
} from "./temporal-error.js";
export {
    evaluateTemporalWindow,
    ExpiredError,
    NotYetValidError,
    TemporalError,
} from "./temporal-error.js";
export { UnexpectedError } from "./unexpected-error.js";
export { ValidationError } from "./validation-error.js";
