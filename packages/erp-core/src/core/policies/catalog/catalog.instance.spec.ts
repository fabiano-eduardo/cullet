import { describe, expect, it } from "vitest";

import type { PolicyPackage } from "../package/policy-package.js";

import { PolicyCatalogFactory } from "./catalog.instance.js";
import type { PolicyCatalogEntryProps } from "./policy-catalog-entry.js";
import { PolicyKey } from "./policy-key.js";

const eligibilityKey = PolicyKey.parse(
    "financial.charges.charge_eligibility",
).getOrThrow();
const discountKey = PolicyKey.parse("billing.invoice.discount").getOrThrow();

function gateEntry(
    overrides: Partial<PolicyCatalogEntryProps> & {
        key: PolicyCatalogEntryProps["key"];
    },
): PolicyCatalogEntryProps {
    return {
        kind: "GATE",
        gateEngineVersion: 1,
        payloadSchemaVersion: 1,
        owner: "PLATFORM_OWNER",
        allowedScopes: ["GLOBAL"],
        asOfSource: "NOW",
        contextRequirements: ["status"],
        description: "test gate",
        ...overrides,
    };
}

function packageOf(
    catalogEntries: readonly PolicyCatalogEntryProps[],
): PolicyPackage {
    return { catalogEntries, definitions: [], evaluators: [] };
}

describe("PolicyCatalogFactory.build", () => {
    describe("happy path", () => {
        it("aggregates entries contributed by every package into one catalog", () => {
            const catalog = PolicyCatalogFactory.build([
                packageOf([gateEntry({ key: eligibilityKey })]),
                packageOf([gateEntry({ key: discountKey })]),
            ]);

            expect(catalog.has(eligibilityKey.toString())).toBe(true);
            expect(catalog.has(discountKey.toString())).toBe(true);
            expect(catalog.list()).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        it("builds an empty catalog when no packages are provided", () => {
            const catalog = PolicyCatalogFactory.build([]);

            expect(catalog.list()).toHaveLength(0);
            expect(catalog.has(eligibilityKey.toString())).toBe(false);
        });
    });

    describe("error cases", () => {
        it("rejects two packages contributing the same key/variant", () => {
            expect(() =>
                PolicyCatalogFactory.build([
                    packageOf([gateEntry({ key: eligibilityKey })]),
                    packageOf([gateEntry({ key: eligibilityKey })]),
                ]),
            ).toThrow(/Duplicate PolicyCatalog entry/);
        });
    });
});
