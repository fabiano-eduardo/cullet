// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  AppErrorOptions,
  ErrorSeverity,
  JsonSafePrimitive,
  JsonSafeRecord,
  JsonSafeValue,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export { ErrorCodes, serializationErrorCode } from "./error-codes";
export { assertJsonSafeMetadata } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
// Error classes
// ─────────────────────────────────────────────────────────────────────────────

export { AppError } from "./app-error";
export type {
  AuthenticationErrorMetadata,
  AuthenticationErrorReason,
} from "./authentication-error";
export { AuthenticationError } from "./authentication-error";
export type {
  AuthorizationErrorMetadata,
  AuthorizationErrorReason,
  AuthorizationRequirement,
} from "./authorization-error";
export { AuthorizationError } from "./authorization-error";
export { BusinessRuleViolationError } from "./business-rule-violation-error";
export type {
  ConflictErrorMetadata,
  ConflictKind,
  UniqueConstraintViolation,
} from "./conflict-error";
export {
  AlreadyExistsError,
  ConflictError,
  DuplicateError,
  translateUniqueViolationToDuplicate,
  UniqueConstraintViolationError,
} from "./conflict-error";
export type {
  IdempotencyErrorMetadata,
  IdempotencyFailureKind,
} from "./idempotency-error";
export {
  IdempotencyError,
  IdempotencyInProgressError,
  IdempotencyKeyMissingError,
  IdempotencyPayloadMismatchError,
  IdempotencyReplayNotSupportedError,
  payloadHash,
  sha256Hex,
  stableStringify,
} from "./idempotency-error";
export type {
  IntegrationErrorMetadata,
  IntegrationErrorReason,
} from "./integration-error";
export { IntegrationError } from "./integration-error";
export { LegacyIncompatibleError } from "./legacy-incompatible-error";
export { NotFoundError } from "./not-found-error";
export type {
  SerializationBoundary,
  SerializationDirection,
  SerializationErrorMetadata,
  SerializationFailureCategory,
} from "./serialization-error";
export {
  DeserializationError,
  safePreview,
  SerializationCodes,
  SerializationError,
  SerializationMessages,
  SerializationOutError,
} from "./serialization-error";
export type {
  TemporalErrorMetadata as ExpiredErrorMetadata,
  TemporalPrecision as ExpiredErrorPrecision,
  TemporalErrorMetadata,
  TemporalKind,
  TemporalPrecision,
} from "./temporal-error";
export {
  evaluateTemporalWindow,
  ExpiredError,
  NotYetValidError,
  TemporalError,
} from "./temporal-error";
export { UnexpectedError } from "./unexpected-error";
export { ValidationError } from "./validation-error";
