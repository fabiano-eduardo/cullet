import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../../exceptions/invariant-violation-exception";

import { assertValidTime, createValidTime } from "./valid-time";

describe("valid-time", () => {
    it("creates an open immutable range with defensive copies", () => {
        const from = new Date("2026-01-01T00:00:00.000Z");
        const validTime = createValidTime({ from });

        expect(Object.isFrozen(validTime)).toBe(true);
        expect(validTime.from).not.toBe(from);
        expect(validTime.from.getTime()).toBe(from.getTime());
        expect(validTime.to).toBeUndefined();
    });

    it('creates a closed range when "to" is provided', () => {
        const validTime = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
            to: new Date("2026-02-01T00:00:00.000Z"),
        });

        expect(validTime.to?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });

    it('throws when "from" is not a valid date', () => {
        expect(() =>
            createValidTime({
                from: "invalid" as unknown as Date,
            }),
        ).toThrow(InvariantViolationException);
    });

    it('throws when "to" is not a valid date', () => {
        expect(() =>
            createValidTime({
                from: new Date("2026-01-01T00:00:00.000Z"),
                to: new Date("invalid"),
            }),
        ).toThrow(InvariantViolationException);
    });

    it('throws when "to" is not later than "from"', () => {
        expect(() =>
            createValidTime({
                from: new Date("2026-01-01T00:00:00.000Z"),
                to: new Date("2026-01-01T00:00:00.000Z"),
            }),
        ).toThrow("validTime.to must be later than validTime.from");
    });

    it("assertValidTime validates already-instantiated ranges", () => {
        expect(() =>
            assertValidTime({
                from: new Date("2026-02-01T00:00:00.000Z"),
                to: new Date("2026-01-01T00:00:00.000Z"),
            }),
        ).toThrow(InvariantViolationException);
    });
});
