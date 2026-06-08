import { AppError } from "./app-error";
import { serializationErrorCode } from "./error-codes";
import type { AppErrorOptions } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SerializationDirection = "serialize" | "deserialize";

type SerializationFailureCategory =
    | "invalid_json"
    | "invalid_shape"
    | "missing_field"
    | "unexpected_field"
    | "invalid_type"
    | "schema_version_missing"
    | "schema_version_unsupported"
    | "mapping_not_implemented"
    | "contract_mismatch"
    | "parse_failed"
    | "stringify_failed"
    | "unknown";

type SerializationBoundary =
    | "http_in"
    | "http_out"
    | "graphql_in"
    | "graphql_out"
    | "dto_to_domain"
    | "domain_to_dto"
    | "persistence_to_domain"
    | "domain_to_persistence"
    | "event_in"
    | "event_out"
    | "projection"
    | "unknown";

/**
 * Metadata shared by serialization/deserialization failures. Payload previews must be sanitized.
 */
type SerializationErrorMetadata = {
    direction: SerializationDirection;
    category: SerializationFailureCategory;
    boundary: SerializationBoundary;
    contract: string;
    schemaVersion?: number | string;
    path?: string;
    payloadPreview?: string;
    correlationId?: string;
    requestId?: string;
    commandId?: string;
    hint?: string;
    details?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Base error
// ─────────────────────────────────────────────────────────────────────────────

type SerializationErrorOptions = Omit<AppErrorOptions, "metadata"> & {
    message: string;
    code: string;
    metadata: Omit<SerializationErrorMetadata, "direction" | "category">;
    direction: SerializationDirection;
    category: SerializationFailureCategory;
};

abstract class SerializationError extends AppError {
    public readonly direction: SerializationDirection;
    public readonly category: SerializationFailureCategory;
    public readonly boundary: SerializationBoundary;
    public readonly contract: string;

    protected constructor(input: SerializationErrorOptions) {
        super(input.message ?? "Serialization failure", input.code, {
            cause: input.cause,
            metadata: {
                direction: input.direction,
                category: input.category,
                ...input.metadata,
            },
            type: input.type,
            severity: input.severity,
            correlationId: input.correlationId,
            requestId: input.requestId,
            commandId: input.commandId,
            createdAtIso: input.createdAtIso,
            publicMessage: input.publicMessage,
        });

        this.direction = input.direction;
        this.category = input.category;
        this.boundary = input.metadata.boundary;
        this.contract = input.metadata.contract;

        Object.freeze(this);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization In
// ─────────────────────────────────────────────────────────────────────────────

class SerializationInError extends SerializationError {
    private constructor(input: SerializationErrorOptions) {
        super(input);
    }

    static failure(
        category: SerializationFailureCategory,
        metadata: Omit<SerializationErrorMetadata, "direction" | "category"> & {
            cause?: unknown;
        },
    ): SerializationInError {
        return new SerializationInError({
            message: SerializationMessages.message("deserialize", category),
            code: SerializationCodes.code("deserialize", category),
            category,
            direction: "deserialize",
            metadata,
            cause: metadata.cause,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────────────────────────

class SerializationOutError extends SerializationError {
    private constructor(input: SerializationErrorOptions) {
        super(input);
    }

    static failure(
        category: SerializationFailureCategory,
        metadata: Omit<SerializationErrorMetadata, "direction" | "category"> & {
            cause?: unknown;
        },
    ): SerializationOutError {
        return new SerializationOutError({
            message: SerializationMessages.message("serialize", category),
            code: SerializationCodes.code("serialize", category),
            category,
            direction: "serialize",
            metadata,
            cause: metadata.cause,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Codes + Messages helpers
// ─────────────────────────────────────────────────────────────────────────────

class SerializationCodes {
    static code(
        direction: SerializationDirection,
        category: SerializationFailureCategory,
    ): string {
        return serializationErrorCode(direction, category);
    }
}

class SerializationMessages {
    static message(
        direction: SerializationDirection,
        category: SerializationFailureCategory,
    ): string {
        if (direction === "deserialize") {
            if (category === "invalid_json") {
                return "Invalid payload: malformed JSON";
            }
            if (category === "schema_version_missing") {
                return "Invalid payload: schemaVersion is missing";
            }
            if (category === "schema_version_unsupported") {
                return "Invalid payload: schemaVersion is not supported";
            }
            if (category === "invalid_shape") {
                return "Invalid payload: incompatible shape";
            }
            if (category === "mapping_not_implemented") {
                return "Unsupported payload: mapping not implemented";
            }
            if (category === "contract_mismatch") {
                return "Payload does not match the expected contract";
            }
            return "Failed to parse incoming payload";
        }

        if (category === "stringify_failed") {
            return "Failed to serialize the response";
        }
        if (category === "contract_mismatch") {
            return "Response does not match the expected contract";
        }
        return "Failed to build the response";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function safePreview(value: unknown, limit = 240): string | undefined {
    try {
        const serialized =
            typeof value === "string" ? value : JSON.stringify(value);
        return serialized.length > limit
            ? `${serialized.slice(0, limit)}…`
            : serialized;
    } catch {
        return undefined;
    }
}

export {
    safePreview,
    SerializationCodes,
    SerializationError,
    SerializationInError as DeserializationError,
    SerializationInError,
    SerializationMessages,
    SerializationOutError,
};
export type {
    SerializationBoundary,
    SerializationDirection,
    SerializationErrorMetadata,
    SerializationFailureCategory,
};
