import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";
import { assertValidDate, cloneDate, isValidDate } from "./temporal-guards.js";

describe("isValidDate", () => {
    it("accepts a valid Date", () => {
        expect(isValidDate(new Date("2026-07-10T00:00:00Z"))).toBe(true);
    });

    it("rejects an Invalid Date", () => {
        expect(isValidDate(new Date("not-a-date"))).toBe(false);
    });

    it("rejects non-Date values", () => {
        expect(isValidDate("2026-07-10")).toBe(false);
        expect(isValidDate(1_752_105_600_000)).toBe(false);
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
    });
});

describe("cloneDate", () => {
    it("returns a distinct instance with the same time", () => {
        const original = new Date("2026-07-10T12:00:00Z");
        const copy = cloneDate(original);

        expect(copy).not.toBe(original);
        expect(copy.getTime()).toBe(original.getTime());
    });

    it("clones an Invalid Date into another Invalid Date (no guard)", () => {
        const copy = cloneDate(new Date("nope"));

        expect(copy).toBeInstanceOf(Date);
        expect(Number.isNaN(copy.getTime())).toBe(true);
    });
});

describe("assertValidDate", () => {
    it("passes through a valid Date", () => {
        expect(() =>
            assertValidDate("createdAt", new Date("2026-07-10T00:00:00Z")),
        ).not.toThrow();
    });

    it("throws an InvariantViolationException naming the field", () => {
        expect(() => assertValidDate("createdAt", new Date("bad"))).toThrow(
            InvariantViolationException,
        );
        expect(() => assertValidDate("createdAt", "2026-07-10")).toThrow(
            /createdAt must be a valid Date instance/,
        );
        expect(() => assertValidDate("updatedAt", null)).toThrow(
            /updatedAt must be a valid Date instance/,
        );
    });
});
