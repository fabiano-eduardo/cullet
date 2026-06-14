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

    it("treats a pre-release as lower precedence than its release", () => {
        expect(comparePolicySemver("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    });

    it("orders by major, then minor, then patch", () => {
        expect(comparePolicySemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
        expect(comparePolicySemver("1.1.0", "1.2.0")).toBeLessThan(0);
        expect(comparePolicySemver("1.0.2", "1.0.1")).toBeGreaterThan(0);
    });

    it("returns 0 for equal versions and equal pre-releases", () => {
        expect(comparePolicySemver("1.2.3", "1.2.3")).toBe(0);
        expect(comparePolicySemver("1.0.0-beta.1", "1.0.0-beta.1")).toBe(0);
    });

    it("ignores build metadata when comparing", () => {
        expect(comparePolicySemver("1.2.3+build.99", "1.2.3+build.1")).toBe(0);
    });

    it("orders alphanumeric pre-release identifiers lexically", () => {
        expect(comparePolicySemver("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(
            0,
        );
        expect(
            comparePolicySemver("1.0.0-beta.b", "1.0.0-beta.a"),
        ).toBeGreaterThan(0);
    });

    it("gives a longer pre-release higher precedence when the prefix matches", () => {
        expect(comparePolicySemver("1.0.0-beta", "1.0.0-beta.1")).toBeLessThan(
            0,
        );
        expect(
            comparePolicySemver("1.0.0-beta.1", "1.0.0-beta"),
        ).toBeGreaterThan(0);
    });
});
