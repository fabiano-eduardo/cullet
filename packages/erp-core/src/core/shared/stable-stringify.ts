const CIRCULAR_STRUCTURE_MESSAGE =
    "Cannot stably stringify a circular structure";

// `seen` holds the current traversal branch so true cycles are rejected while
// repeated (acyclic) references are still serialized — matching JSON.stringify.
function sortKeysDeep(value: unknown, seen: WeakSet<object>): unknown {
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            throw new TypeError(CIRCULAR_STRUCTURE_MESSAGE);
        }
        seen.add(value);
        const mapped = value.map((item) => sortKeysDeep(item, seen));
        seen.delete(value);
        return mapped;
    }

    if (value instanceof Date) {
        return value;
    }

    if (value && typeof value === "object") {
        if (seen.has(value)) {
            throw new TypeError(CIRCULAR_STRUCTURE_MESSAGE);
        }
        seen.add(value);
        const record = value as Record<string, unknown>;
        const ordered = Object.create(null) as Record<string, unknown>;

        for (const key of Object.keys(record).sort()) {
            ordered[key] = sortKeysDeep(record[key], seen);
        }
        seen.delete(value);

        return ordered;
    }

    return value;
}

/**
 * Deterministic JSON string with object keys sorted recursively, so key order
 * does not affect the output.
 *
 * Follows `JSON.stringify` semantics for the values it serializes: `undefined`,
 * functions and symbols are dropped, non-finite numbers become `null`, `bigint`
 * throws, and `Map`/`Set` serialize as `{}`. Distinct payloads can therefore
 * collapse to the same string — for collision-resistant hashing use
 * `PolicyHashing.canonicalJson` (policies/utils), which rejects those values
 * up front.
 *
 * @throws {TypeError} On circular references (mirroring `JSON.stringify`).
 */
function stableStringify(value: unknown): string {
    return JSON.stringify(sortKeysDeep(value, new WeakSet<object>()));
}

export { stableStringify };
