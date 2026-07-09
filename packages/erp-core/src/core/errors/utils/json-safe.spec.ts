import { describe, expect, it } from "vitest";

import { AppError } from "../app-error.js";
import {
    assertJsonSafeMetadata,
    CIRCULAR_REFERENCE_PLACEHOLDER,
    NON_SERIALIZABLE_PLACEHOLDER,
} from "./json-safe.js";

class TestError extends AppError {
    constructor(metadata: Record<string, unknown>) {
        super("test failure", "TEST_ERROR", { metadata });
    }
}

describe("assertJsonSafeMetadata", () => {
    it("keeps JSON-safe primitives, arrays and nested plain objects", () => {
        const input = {
            name: "ok",
            count: 3,
            active: true,
            empty: null,
            nested: { items: [1, "two", false] },
        };

        expect(assertJsonSafeMetadata(input)).toEqual(input);
    });

    it("converts non-serializable values to the placeholder", () => {
        const result = assertJsonSafeMetadata({
            when: new Date("2026-01-01T00:00:00.000Z"),
            big: 10n,
            fn: () => 1,
            sym: Symbol("x"),
            nan: Number.NaN,
            inf: Number.POSITIVE_INFINITY,
        });

        expect(result).toEqual({
            when: NON_SERIALIZABLE_PLACEHOLDER,
            big: NON_SERIALIZABLE_PLACEHOLDER,
            fn: NON_SERIALIZABLE_PLACEHOLDER,
            sym: NON_SERIALIZABLE_PLACEHOLDER,
            nan: NON_SERIALIZABLE_PLACEHOLDER,
            inf: NON_SERIALIZABLE_PLACEHOLDER,
        });
    });

    it("mirrors JSON.stringify for undefined: omits object keys, nulls array items", () => {
        const result = assertJsonSafeMetadata({
            present: "yes",
            missing: undefined,
            nested: { alsoMissing: undefined, kept: 1 },
            items: [1, undefined, 2],
        });

        expect(result).toEqual({
            present: "yes",
            nested: { kept: 1 },
            items: [1, null, 2],
        });
        expect(Object.keys(result)).not.toContain("missing");
    });

    it("replaces a direct self-reference with the circular placeholder", () => {
        const input: Record<string, unknown> = { name: "root" };
        input.self = input;

        const result = assertJsonSafeMetadata(input);

        expect(result).toEqual({
            name: "root",
            self: CIRCULAR_REFERENCE_PLACEHOLDER,
        });
    });

    it("replaces an indirect circular reference with the placeholder", () => {
        const parent: Record<string, unknown> = { id: "p" };
        const child: Record<string, unknown> = { id: "c", parent };
        parent.child = child;

        const result = assertJsonSafeMetadata(parent) as {
            child: { parent: unknown };
        };

        expect(result.child.parent).toBe(CIRCULAR_REFERENCE_PLACEHOLDER);
    });

    it("detects a cycle that runs through an array", () => {
        const input: Record<string, unknown> = { id: "root" };
        input.items = [input];

        const result = assertJsonSafeMetadata(input) as { items: unknown[] };

        expect(result.items[0]).toBe(CIRCULAR_REFERENCE_PLACEHOLDER);
    });

    it("does not treat a repeated (acyclic) reference as circular", () => {
        const shared = { value: 1 };
        const input = { left: shared, right: shared };

        const result = assertJsonSafeMetadata(input);

        expect(result).toEqual({
            left: { value: 1 },
            right: { value: 1 },
        });
    });

    it("lets an AppError be constructed from circular metadata without throwing", () => {
        const metadata: Record<string, unknown> = { context: "payment" };
        metadata.itself = metadata;

        const error = new TestError(metadata);

        expect(error.metadata).toEqual({
            context: "payment",
            itself: CIRCULAR_REFERENCE_PLACEHOLDER,
        });
        // The whole point: serialization stays safe afterwards.
        expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });

    it("returns an empty object when the input is undefined", () => {
        expect(assertJsonSafeMetadata(undefined)).toEqual({});
    });
});
