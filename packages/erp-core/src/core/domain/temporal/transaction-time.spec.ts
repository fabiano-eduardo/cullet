import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../../exceptions/invariant-violation-exception.js";

import {
    assertTransactionTime,
    createTransactionTime,
} from "./transaction-time.js";

describe("transaction-time", () => {
    it("creates an open transaction-time range with defensive copies", () => {
        const recordedAt = new Date("2026-01-01T00:00:00.000Z");
        const txTime = createTransactionTime({ recordedAt });

        expect(Object.isFrozen(txTime)).toBe(true);
        expect(txTime.recordedAt).not.toBe(recordedAt);
        expect(txTime.recordedAt.getTime()).toBe(recordedAt.getTime());
        expect(txTime.supersededAt).toBeUndefined();
    });

    it("creates a closed range when supersededAt is provided", () => {
        const txTime = createTransactionTime({
            recordedAt: new Date("2026-01-01T00:00:00.000Z"),
            supersededAt: new Date("2026-03-01T00:00:00.000Z"),
        });

        expect(txTime.supersededAt?.toISOString()).toBe(
            "2026-03-01T00:00:00.000Z",
        );
    });

    it("throws when recordedAt is not a valid date", () => {
        expect(() =>
            createTransactionTime({
                recordedAt: "invalid" as unknown as Date,
            }),
        ).toThrow(InvariantViolationException);
    });

    it("throws when supersededAt is not a valid date", () => {
        expect(() =>
            createTransactionTime({
                recordedAt: new Date("2026-01-01T00:00:00.000Z"),
                supersededAt: new Date("invalid"),
            }),
        ).toThrow(InvariantViolationException);
    });

    it("throws when supersededAt is not later than recordedAt", () => {
        expect(() =>
            createTransactionTime({
                recordedAt: new Date("2026-01-01T00:00:00.000Z"),
                supersededAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
        ).toThrow("txTime.supersededAt must be later than txTime.recordedAt");
    });

    it("assertTransactionTime validates already-instantiated ranges", () => {
        expect(() =>
            assertTransactionTime({
                recordedAt: new Date("2026-04-01T00:00:00.000Z"),
                supersededAt: new Date("2026-03-01T00:00:00.000Z"),
            }),
        ).toThrow(InvariantViolationException);
    });
});
