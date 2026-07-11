import { describe, expect, it } from "vitest";

import { UuidIdentifier } from "./uuid-identifier.js";

class InvalidOrderIdError extends Error {}

class OrderId extends UuidIdentifier<"OrderId"> {
    private constructor(value: string) {
        super(value);
    }

    public static create(raw: string): OrderId {
        if (!UuidIdentifier.isValid(raw)) {
            throw new InvalidOrderIdError(`not a uuid: "${raw}"`);
        }

        return new OrderId(raw);
    }

    public static reconstitute(value: string): OrderId {
        return new OrderId(value);
    }
}

const VALID_UUID = "3f9a1c2e-7b4d-4e2a-9c1f-2b6d8e0a1f33";

describe("UuidIdentifier", () => {
    describe("isValid()", () => {
        it("accepts a canonical v1–v8 UUID, case-insensitively", () => {
            expect(UuidIdentifier.isValid(VALID_UUID)).toBe(true);
            expect(UuidIdentifier.isValid(VALID_UUID.toUpperCase())).toBe(true);
            // UUIDv7 (time-ordered) — the modern default for sortable ids
            expect(
                UuidIdentifier.isValid("0190a1b2-c3d4-7e5f-8a1b-2c3d4e5f6a7b"),
            ).toBe(true);
        });

        it("rejects malformed strings, the nil/max UUID and out-of-range versions", () => {
            expect(UuidIdentifier.isValid("")).toBe(false);
            expect(UuidIdentifier.isValid("not-a-uuid")).toBe(false);
            expect(UuidIdentifier.isValid(VALID_UUID.slice(0, -1))).toBe(false);
            // version nibble 0 is outside the [1-8] range (nil UUID lands here)
            expect(
                UuidIdentifier.isValid("3f9a1c2e-7b4d-0e2a-9c1f-2b6d8e0a1f33"),
            ).toBe(false);
            expect(
                UuidIdentifier.isValid("00000000-0000-0000-0000-000000000000"),
            ).toBe(false);
            // version nibble f (max UUID) is above the [1-8] range
            expect(
                UuidIdentifier.isValid("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            ).toBe(false);
        });
    });

    describe("subclass factory", () => {
        it("create() builds an instance from a valid UUID", () => {
            const id = OrderId.create(VALID_UUID);

            expect(id).toBeInstanceOf(OrderId);
            expect(id).toBeInstanceOf(UuidIdentifier);
            expect(id.toPrimitive()).toBe(VALID_UUID);
            expect(id.toString()).toBe(VALID_UUID);
            expect(id.value).toBe(VALID_UUID);
        });

        it("create() throws the subclass error for an invalid UUID", () => {
            expect(() => OrderId.create("nope")).toThrow(InvalidOrderIdError);
        });

        it("reconstitute() trusts an already-persisted value without validating", () => {
            const id = OrderId.reconstitute("legacy-non-uuid");

            expect(id.value).toBe("legacy-non-uuid");
        });
    });

    describe("equality", () => {
        it("two ids holding the same UUID are equal", () => {
            expect(
                OrderId.create(VALID_UUID).equals(OrderId.create(VALID_UUID)),
            ).toBe(true);
        });

        it("ids holding different UUIDs are not equal", () => {
            const other = "00000000-0000-4000-8000-000000000001";

            expect(
                OrderId.create(VALID_UUID).equals(OrderId.create(other)),
            ).toBe(false);
        });
    });
});
