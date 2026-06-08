import { describe, expect, it, vi } from "vitest";

import { InvariantViolationException } from "../../exceptions/invariant-violation-exception";

import {
    assertTemporalContext,
    createTemporalContext,
} from "./temporal-context";

describe("temporal-context", () => {
    it("uses requestedAt as the asOf fallback and creates defensive copies", () => {
        const requestedAt = new Date("2026-04-24T12:30:00.000Z");
        const temporalContext = createTemporalContext({ requestedAt });

        expect(Object.isFrozen(temporalContext)).toBe(true);
        expect(temporalContext.asOf).not.toBe(requestedAt);
        expect(temporalContext.requestedAt).not.toBe(requestedAt);
        expect(temporalContext.asOf.getTime()).toBe(requestedAt.getTime());
        expect(temporalContext.requestedAt.getTime()).toBe(
            requestedAt.getTime(),
        );
    });

    it("preserves an explicit asOf when provided", () => {
        const asOf = new Date("2026-03-01T00:00:00.000Z");
        const requestedAt = new Date("2026-04-24T12:30:00.000Z");
        const temporalContext = createTemporalContext({ asOf, requestedAt });

        expect(temporalContext.asOf.getTime()).toBe(asOf.getTime());
        expect(temporalContext.requestedAt.getTime()).toBe(
            requestedAt.getTime(),
        );
    });

    it("uses the system clock when no value is provided", () => {
        const now = new Date("2026-04-24T12:30:00.000Z");
        const dateSpy = vi.useFakeTimers();

        dateSpy.setSystemTime(now);

        const temporalContext = createTemporalContext();

        expect(temporalContext.asOf.toISOString()).toBe(now.toISOString());
        expect(temporalContext.requestedAt.toISOString()).toBe(
            now.toISOString(),
        );

        dateSpy.useRealTimers();
    });

    it("throws when asOf is not a valid date", () => {
        expect(() =>
            createTemporalContext({
                asOf: new Date("invalid"),
            }),
        ).toThrow(InvariantViolationException);
    });

    it("assertTemporalContext validates existing contexts", () => {
        expect(() =>
            assertTemporalContext({
                asOf: new Date("2026-04-24T12:30:00.000Z"),
                requestedAt: "invalid" as unknown as Date,
            }),
        ).toThrow("temporalContext.requestedAt must be a valid Date instance");
    });
});
