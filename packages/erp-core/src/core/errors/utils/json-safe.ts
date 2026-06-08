// Utilities for ensuring metadata is JSON-serializable.

import type { JsonSafeRecord, JsonSafeValue } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NON_SERIALIZABLE_PLACEHOLDER = "[NonSerializable]";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function sanitizeValue(value: unknown): JsonSafeValue {
    // Null passthrough
    if (value === null) return null;

    const type = typeof value;

    // Primitives
    if (type === "string" || type === "number" || type === "boolean") {
        return value as JsonSafeValue;
    }

    // Non-serializable primitives
    if (
        type === "bigint" ||
        type === "function" ||
        type === "symbol" ||
        value === undefined
    ) {
        return NON_SERIALIZABLE_PLACEHOLDER;
    }

    // Arrays (recursive)
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    // Date → placeholder (could also use .toISOString() if preferred)
    if (value instanceof Date) {
        return NON_SERIALIZABLE_PLACEHOLDER;
    }

    // Class instances and non-plain objects → placeholder
    if (!isPlainObject(value)) {
        return NON_SERIALIZABLE_PLACEHOLDER;
    }

    // Plain object (recursive)
    const result: Record<string, JsonSafeValue> = {};
    for (const [key, val] of Object.entries(value)) {
        result[key] = sanitizeValue(val);
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures metadata is JSON-serializable.
 *
 * **Allowed:** string, number, boolean, null, arrays, and plain objects.
 *
 * **Converted to placeholder:** Date, BigInt, class instances, functions,
 * symbols, undefined.
 *
 * @throws {TypeError} If `input` is not a plain object at the root level.
 */
function assertJsonSafeMetadata(input: unknown): JsonSafeRecord {
    if (input === undefined) {
        return {};
    }

    if (!isPlainObject(input)) {
        throw new TypeError(
            "metadata must be a plain object (Record<string, unknown>).",
        );
    }

    return sanitizeValue(input) as JsonSafeRecord;
}

export { assertJsonSafeMetadata, NON_SERIALIZABLE_PLACEHOLDER };
