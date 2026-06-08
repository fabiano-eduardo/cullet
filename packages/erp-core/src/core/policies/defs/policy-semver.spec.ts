import { describe, expect, it } from "vitest";

import { comparePolicySemver } from "./policy-semver";

describe("comparePolicySemver", () => {
    it("orders numeric pre-release identifiers numerically", () => {
        expect(
            comparePolicySemver("1.0.0-beta.2", "1.0.0-beta.10"),
        ).toBeLessThan(0);
    });

    it("orders numeric identifiers before alphanumeric ones", () => {
        expect(
            comparePolicySemver("1.0.0-beta.1", "1.0.0-beta.alpha"),
        ).toBeLessThan(0);
    });

    it("treats a release as higher precedence than a pre-release", () => {
        expect(comparePolicySemver("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
    });
});
