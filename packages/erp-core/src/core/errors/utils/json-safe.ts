// Utilities for ensuring metadata is JSON-serializable.

import type { JsonSafeRecord, JsonSafeValue } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NON_SERIALIZABLE_PLACEHOLDER = "[NonSerializable]";
const CIRCULAR_REFERENCE_PLACEHOLDER = "[Circular]";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// `seen` tracks the ancestors on the current traversal branch (a DFS path), not
// every object visited. This collapses true circular references to a placeholder
// while still serializing the same object referenced more than once across
// sibling branches (a DAG) — matching `JSON.stringify`, which only rejects
// cycles, not shared references.
function sanitizeValue(value: unknown, seen: WeakSet<object>): JsonSafeValue {
    // Null passthrough
    if (value === null) return null;

    const type = typeof value;

    // Primitives (non-finite numbers are not JSON-representable — placeholder)
    if (type === "number") {
        return Number.isFinite(value)
            ? (value as number)
            : NON_SERIALIZABLE_PLACEHOLDER;
    }
    if (type === "string" || type === "boolean") {
        return value as JsonSafeValue;
    }

    // `undefined` only reaches here as an array item: object properties with
    // undefined values are omitted by the plain-object branch below. Both
    // mirror `JSON.stringify` semantics.
    if (value === undefined) return null;

    // Non-serializable primitives
    if (type === "bigint" || type === "function" || type === "symbol") {
        return NON_SERIALIZABLE_PLACEHOLDER;
    }

    // Arrays (recursive)
    if (Array.isArray(value)) {
        if (seen.has(value)) return CIRCULAR_REFERENCE_PLACEHOLDER;
        seen.add(value);
        const sanitized = value.map((item) => sanitizeValue(item, seen));
        seen.delete(value);
        return sanitized;
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
    if (seen.has(value)) return CIRCULAR_REFERENCE_PLACEHOLDER;
    seen.add(value);
    const result: Record<string, JsonSafeValue> = {};
    for (const [key, val] of Object.entries(value)) {
        if (val === undefined) continue;
        result[key] = sanitizeValue(val, seen);
    }
    seen.delete(value);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures metadata is JSON-serializable.
 *
 * **Allowed:** finite number, string, boolean, null, arrays, and plain objects.
 *
 * **Dropped (mirroring `JSON.stringify`):** object properties whose value is
 * `undefined` (the key is omitted); an `undefined` array item becomes `null`.
 *
 * **Converted to placeholder:** Date, BigInt, class instances, functions,
 * symbols, non-finite numbers (`NaN`/`Infinity`), and circular references
 * (which would otherwise make `JSON.stringify` throw).
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

    return sanitizeValue(input, new WeakSet<object>()) as JsonSafeRecord;
}

export {
    assertJsonSafeMetadata,
    CIRCULAR_REFERENCE_PLACEHOLDER,
    NON_SERIALIZABLE_PLACEHOLDER,
};
