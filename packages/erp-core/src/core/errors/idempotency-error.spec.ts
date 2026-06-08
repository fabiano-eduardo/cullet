import { describe, expect, it } from "vitest";

import {
    IdempotencyError,
    IdempotencyPayloadMismatchError,
    payloadHash,
    sha256Hex,
    stableStringify,
} from "./idempotency-error";
import { ErrorCodes } from "./error-codes";

// Regression coverage for the ESM crypto fix: these helpers previously used a
// CommonJS `require('crypto')`, which throws `ReferenceError: require is not
// defined` in this ESM-only package. They must now work via `node:crypto`.
describe("idempotency hashing helpers (ESM crypto)", () => {
    it("sha256Hex does not throw and matches the known empty-string digest", () => {
        expect(() => sha256Hex("")).not.toThrow();
        expect(sha256Hex("")).toBe(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        );
    });

    it("stableStringify sorts object keys deterministically", () => {
        expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
        expect(stableStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
    });

    it("payloadHash is deterministic and independent of key order", () => {
        const a = payloadHash({ b: 1, a: { d: 4, c: 3 } });
        const b = payloadHash({ a: { c: 3, d: 4 }, b: 1 });

        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it("payloadHash distinguishes semantically different payloads", () => {
        expect(payloadHash({ amount: 100 })).not.toBe(
            payloadHash({ amount: 101 }),
        );
    });
});

describe("IdempotencyError factories", () => {
    it("builds a payload-mismatch error with a hashed key preview without throwing", () => {
        const error = IdempotencyError.payloadMismatch({
            operation: "createInvoice",
            key: "idem-key-1234567890",
            incomingPayloadHash: payloadHash({ amount: 100 }),
            existingPayloadHash: payloadHash({ amount: 101 }),
        });

        expect(error).toBeInstanceOf(IdempotencyPayloadMismatchError);
        expect(error.kind).toBe("payload_mismatch");
        expect(error.code).toBe(ErrorCodes.idempotency.payloadMismatch);
        // keyPreview is truncated to the first 8 chars of the raw key.
        expect(error.metadata?.keyPreview).toBe("idem-key");
    });
});
