import { describe, expect, it } from "vitest";

import { PolicyKey } from "./policy-key.js";

describe("PolicyKey", () => {
    it("rejects keys above the maximum limit", () => {
        const oversizedKey = `financial.${"a".repeat(120)}.${"b".repeat(130)}`;

        const result = PolicyKey.parse(oversizedKey);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "PolicyKey cannot exceed 255 characters, got 261",
        );
    });

    it("parses a valid key and exposes its segments", () => {
        const result = PolicyKey.parse("financial.charges.charge_eligibility");

        expect(result.isOk()).toBe(true);
        const key = result.getOrThrow();
        expect(key.module).toBe("financial");
        expect(key.area).toBe("charges");
        expect(key.name).toBe("charge_eligibility");
        expect(key.toString()).toBe("financial.charges.charge_eligibility");
    });

    it("compares keys structurally via equals()", () => {
        const a = PolicyKey.parse(
            "financial.charges.charge_eligibility",
        ).getOrThrow();
        const b = PolicyKey.parse(
            "financial.charges.charge_eligibility",
        ).getOrThrow();
        const c = PolicyKey.parse(
            "financial.billing.psp_selection",
        ).getOrThrow();

        expect(a.equals(b)).toBe(true);
        expect(a.equals(c)).toBe(false);
    });

    it("rejects an empty key", () => {
        const result = PolicyKey.parse("");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe("PolicyKey cannot be empty");
    });

    it("rejects a key that does not have exactly 3 segments", () => {
        const result = PolicyKey.parse("financial.charges");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("must have exactly 3 segments");
    });

    it("rejects an invalid module segment", () => {
        const result = PolicyKey.parse("1financial.charges.charge_eligibility");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain('segment "module" is invalid');
    });

    it("rejects an invalid area segment", () => {
        const result = PolicyKey.parse("financial.Charges.charge_eligibility");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain('segment "area" is invalid');
    });

    it("rejects an invalid name segment", () => {
        const result = PolicyKey.parse("financial.charges.Charge");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain('segment "name" is invalid');
    });
});
