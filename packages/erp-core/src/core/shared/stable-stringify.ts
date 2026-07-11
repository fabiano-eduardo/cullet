import { isValidDate } from "./temporal-guards.js";

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
 * collapse to the same string — this is fine for the structural-equality use it
 * serves (comparing two value objects), but **not** for hashing. For a
 * collision-resistant canonical form use {@link canonicalStringify}, which
 * rejects those lossy values up front.
 *
 * @throws {TypeError} On circular references (mirroring `JSON.stringify`).
 */
function stableStringify(value: unknown): string {
    return JSON.stringify(sortKeysDeep(value, new WeakSet<object>()));
}

// Rejects every value `JSON.stringify` would silently drop or coerce, so
// semantically different payloads can never collapse to the same canonical
// string. Owned here (rather than in policies) so `payloadHash` and
// `PolicyHashing` share one strict definition instead of each re-implementing
// the deep guard.
function assertHashable(
    value: unknown,
    path: string,
    seen: WeakSet<object>,
): void {
    if (value === null) {
        return;
    }

    const type = typeof value;

    if (type === "undefined") {
        throw new TypeError(
            `canonicalStringify does not accept undefined values (at ${path})`,
        );
    }

    if (type === "number" && !Number.isFinite(value)) {
        throw new TypeError(
            `canonicalStringify does not accept non-finite numbers (at ${path}, value: ${String(value)})`,
        );
    }

    if (type === "bigint" || type === "function" || type === "symbol") {
        throw new TypeError(
            `canonicalStringify does not accept ${type} values (at ${path})`,
        );
    }

    if (type !== "object") {
        return;
    }

    if (value instanceof Date) {
        if (!isValidDate(value)) {
            throw new TypeError(
                `canonicalStringify does not accept Invalid Date (at ${path})`,
            );
        }
        return;
    }

    if (seen.has(value as object)) {
        throw new TypeError(
            `canonicalStringify does not accept circular references (at ${path})`,
        );
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            assertHashable(item, `${path}[${index}]`, seen);
        });
    } else {
        for (const [key, nested] of Object.entries(
            value as Record<string, unknown>,
        )) {
            assertHashable(nested, `${path}.${key}`, seen);
        }
    }

    seen.delete(value as object);
}

/**
 * Strict counterpart to {@link stableStringify}: same deterministic output, but
 * throws on any value `JSON.stringify` would drop or coerce (`undefined`,
 * non-finite numbers, `bigint`, functions, symbols, `Invalid Date`) and on
 * circular references. Use this whenever the string feeds a hash or integrity
 * check, so distinct payloads cannot collide.
 *
 * @throws {TypeError} On lossy values or circular references.
 */
function canonicalStringify(value: unknown): string {
    assertHashable(value, "$", new WeakSet<object>());

    return stableStringify(value);
}

export { assertHashable, canonicalStringify, stableStringify };
