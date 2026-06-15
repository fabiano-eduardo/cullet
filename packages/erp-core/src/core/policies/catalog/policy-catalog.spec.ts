import { describe, expect, it } from "vitest";

import { PolicyCatalog } from "./policy-catalog.js";
import { PolicyCatalogEntry } from "./policy-catalog-entry.js";
import { PolicyKey } from "./policy-key.js";

const policyKey = PolicyKey.parse(
    "financial.charges.charge_eligibility",
).getOrThrow();

describe("PolicyCatalog", () => {
    it("rejects ambiguous get() and allows querying family and exact variant", () => {
        const catalog = new PolicyCatalog([
            PolicyCatalogEntry.from({
                key: policyKey,
                kind: "GATE",
                gateEngineVersion: 1,
                payloadSchemaVersion: 1,
                owner: "PLATFORM_OWNER",
                allowedScopes: ["GLOBAL"],
                asOfSource: "NOW",
                contextRequirements: ["status"],
                description: "Eligibility gate",
            }),
            PolicyCatalogEntry.from({
                key: policyKey,
                kind: "GATE",
                gateEngineVersion: 2,
                payloadSchemaVersion: 2,
                owner: "PLATFORM_OWNER",
                allowedScopes: ["GLOBAL", "TENANT"],
                asOfSource: "NOW",
                contextRequirements: ["status", "student.segment"],
                tags: ["gate-v2"],
                description: "Eligibility gate",
            }),
        ]);

        const mergedEntryResult = catalog.get(policyKey.toString());
        const familyResult = catalog.getFamily(policyKey.toString());
        const versionedEntryResult = catalog.getVersioned({
            key: policyKey.toString(),
            kind: "GATE",
            gateEngineVersion: 2,
            payloadSchemaVersion: 2,
        });

        expect(mergedEntryResult.isErr()).toBe(true);
        expect(mergedEntryResult.errorOrNull()).toContain(
            "has multiple catalog variants",
        );
        expect(familyResult.isOk()).toBe(true);
        expect(familyResult.getOrNull()).toHaveLength(2);
        expect(versionedEntryResult.isOk()).toBe(true);
        expect(versionedEntryResult.getOrNull()!.gateEngineVersion).toBe(2);
        expect(
            versionedEntryResult
                .getOrNull()!
                .requiresContext("student.segment"),
        ).toBe(true);
    });

    it("returns an error when the versioned variant does not exist", () => {
        const catalog = new PolicyCatalog([
            PolicyCatalogEntry.from({
                key: policyKey,
                kind: "GATE",
                gateEngineVersion: 1,
                payloadSchemaVersion: 1,
                owner: "PLATFORM_OWNER",
                allowedScopes: ["GLOBAL"],
                asOfSource: "NOW",
                contextRequirements: ["status"],
                description: "Eligibility gate",
            }),
        ]);

        const result = catalog.getVersioned({
            key: policyKey.toString(),
            kind: "GATE",
            gateEngineVersion: 2,
            payloadSchemaVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("Policy variant not found");
    });
});
