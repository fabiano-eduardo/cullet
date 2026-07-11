import { describe, expect, it } from "vitest";

import { payloadHash, sha256Hex } from "./hashing.js";

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

    it("rejects lossy values instead of colliding on them", () => {
        // These would collapse onto `{}`/`{a:null}` under plain JSON.stringify,
        // producing false idempotency matches; strict hashing throws instead.
        expect(() => payloadHash({ a: undefined })).toThrow(TypeError);
        expect(() => payloadHash({ n: Number.NaN })).toThrow(/non-finite/);
        expect(() => payloadHash({ n: Number.POSITIVE_INFINITY })).toThrow(
            /non-finite/,
        );
    });
});

describe("sha256Hex", () => {
    it("hashes deterministically as 64-char hex", () => {
        expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
        expect(sha256Hex("abc")).toMatch(/^[0-9a-f]{64}$/);
    });
});
