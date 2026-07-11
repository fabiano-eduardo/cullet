import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";
import { assertValidAggregateVersion } from "./aggregate-version.js";

describe("assertValidAggregateVersion", () => {
    it("accepts zero and positive integers", () => {
        expect(() => assertValidAggregateVersion(0)).not.toThrow();
        expect(() => assertValidAggregateVersion(1)).not.toThrow();
        expect(() => assertValidAggregateVersion(42)).not.toThrow();
    });

    it("rejects negative numbers", () => {
        expect(() => assertValidAggregateVersion(-1)).toThrow(
            InvariantViolationException,
        );
    });

    it("rejects non-integers", () => {
        expect(() => assertValidAggregateVersion(1.5)).toThrow(
            InvariantViolationException,
        );
    });

    it("rejects NaN and non-finite values", () => {
        expect(() => assertValidAggregateVersion(Number.NaN)).toThrow(
            InvariantViolationException,
        );
        expect(() =>
            assertValidAggregateVersion(Number.POSITIVE_INFINITY),
        ).toThrow(InvariantViolationException);
    });

    it("reports the received value in the error message", () => {
        expect(() => assertValidAggregateVersion(-1)).toThrow(
            /non-negative integer.*Received: -1/,
        );
    });
});
