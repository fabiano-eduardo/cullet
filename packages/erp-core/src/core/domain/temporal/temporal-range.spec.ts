import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../../exceptions/invariant-violation-exception";

import { contains, isClosed, isOpen, overlaps } from "./temporal-range";
import { createValidTime } from "./valid-time";

describe("temporal-range", () => {
    it('isOpen identifies ranges without "to"', () => {
        expect(
            isOpen(
                createValidTime({ from: new Date("2026-01-01T00:00:00.000Z") }),
            ),
        ).toBe(true);
    });

    it('isClosed identifies ranges with "to"', () => {
        expect(
            isClosed(
                createValidTime({
                    from: new Date("2026-01-01T00:00:00.000Z"),
                    to: new Date("2026-02-01T00:00:00.000Z"),
                }),
            ),
        ).toBe(true);
    });

    it("contains includes the start date", () => {
        const range = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
            to: new Date("2026-02-01T00:00:00.000Z"),
        });

        expect(contains(range, new Date("2026-01-01T00:00:00.000Z"))).toBe(
            true,
        );
    });

    it("contains treats the end bound as exclusive", () => {
        const range = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
            to: new Date("2026-02-01T00:00:00.000Z"),
        });

        expect(contains(range, new Date("2026-02-01T00:00:00.000Z"))).toBe(
            false,
        );
    });

    it("contains works for open ranges", () => {
        const range = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
        });

        expect(contains(range, new Date("2027-01-01T00:00:00.000Z"))).toBe(
            true,
        );
    });

    it("overlaps returns true for ranges that share an interval", () => {
        const left = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
            to: new Date("2026-03-01T00:00:00.000Z"),
        });
        const right = createValidTime({
            from: new Date("2026-02-01T00:00:00.000Z"),
            to: new Date("2026-04-01T00:00:00.000Z"),
        });

        expect(overlaps(left, right)).toBe(true);
    });

    it("overlaps returns false for ranges that are only adjacent", () => {
        const left = createValidTime({
            from: new Date("2026-01-01T00:00:00.000Z"),
            to: new Date("2026-02-01T00:00:00.000Z"),
        });
        const right = createValidTime({
            from: new Date("2026-02-01T00:00:00.000Z"),
            to: new Date("2026-03-01T00:00:00.000Z"),
        });

        expect(overlaps(left, right)).toBe(false);
    });

    it("contains throws when the target date is invalid", () => {
        expect(() =>
            contains(
                createValidTime({ from: new Date("2026-01-01T00:00:00.000Z") }),
                new Date("invalid"),
            ),
        ).toThrow(InvariantViolationException);
    });
});
