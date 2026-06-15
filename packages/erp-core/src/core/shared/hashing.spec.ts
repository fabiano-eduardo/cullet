import { describe, expect, it } from "vitest";

import { payloadHash, sha256Hex, stableStringify } from "./hashing.js";

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

describe("payloadHash", () => {
    it("is stable across key ordering", () => {
        expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
    });

    it("differs for semantically different payloads", () => {
        expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
    });

    it("returns a 64-char sha-256 hex digest", () => {
        expect(payloadHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("sha256Hex", () => {
    it("hashes deterministically as 64-char hex", () => {
        expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
        expect(sha256Hex("abc")).toMatch(/^[0-9a-f]{64}$/);
    });
});
