import { describe, expect, it } from "vitest";

import { canonicalStringify, stableStringify } from "./stable-stringify.js";

describe("stableStringify", () => {
    it("produces the same string regardless of key order", () => {
        expect(stableStringify({ b: 1, a: 2 })).toBe(
            stableStringify({ a: 2, b: 1 }),
        );
    });

    it("sorts keys recursively", () => {
        expect(stableStringify({ outer: { z: 1, a: 2 } })).toBe(
            '{"outer":{"a":2,"z":1}}',
        );
    });

    it("preserves array order", () => {
        expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
    });

    it("stays lossy on purpose (drops undefined) for value-object equality", () => {
        expect(stableStringify({ a: 1, b: undefined })).toBe(
            stableStringify({ a: 1 }),
        );
    });

    it("throws a TypeError on circular references instead of overflowing", () => {
        const node: Record<string, unknown> = { id: 1 };
        node.self = node;

        expect(() => stableStringify(node)).toThrow(TypeError);
    });

    it("serializes a repeated (acyclic) reference without throwing", () => {
        const shared = { v: 1 };

        expect(() => stableStringify({ a: shared, b: shared })).not.toThrow();
    });
});

describe("canonicalStringify", () => {
    it("normalizes key order like stableStringify for hashable payloads", () => {
        expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    });

    it("rejects undefined, non-finite, bigint, symbol, function", () => {
        expect(() => canonicalStringify({ a: undefined })).toThrow(/undefined/);
        expect(() => canonicalStringify({ a: Number.NaN })).toThrow(
            /non-finite/,
        );
        expect(() =>
            canonicalStringify({ a: Number.POSITIVE_INFINITY }),
        ).toThrow(/non-finite/);
        expect(() => canonicalStringify({ a: BigInt(1) })).toThrow(/bigint/);
        expect(() => canonicalStringify({ a: Symbol("x") })).toThrow(/symbol/);
        expect(() => canonicalStringify({ a: () => undefined })).toThrow(
            /function/,
        );
    });

    it("rejects an Invalid Date but accepts a valid one", () => {
        expect(() => canonicalStringify({ at: new Date("invalid") })).toThrow(
            /Invalid Date/,
        );
        expect(() =>
            canonicalStringify({ at: new Date("2026-07-10T00:00:00Z") }),
        ).not.toThrow();
    });

    it("rejects circular references but allows a repeated acyclic reference", () => {
        const node: Record<string, unknown> = { id: 1 };
        node.self = node;
        expect(() => canonicalStringify(node)).toThrow(/circular/);

        const shared = { v: 1 };
        expect(() =>
            canonicalStringify({ a: shared, b: shared }),
        ).not.toThrow();
    });

    it("reports the path of the offending value", () => {
        expect(() =>
            canonicalStringify({ outer: { inner: undefined } }),
        ).toThrow(/\$\.outer\.inner/);
        expect(() => canonicalStringify({ list: [1, undefined] })).toThrow(
            /\$\.list\[1\]/,
        );
    });
});
