import { describe, expect, it } from "vitest";

import { asPolicyDefinitionId, asSchoolId, asTenantId } from "../policy-ids";
import { InMemoryPolicyDefinitionRepository } from "./in-memory-policy-definition-repo";
import { PolicyDefinition } from "./policy-definition";

function makeDefinition(
    id: string,
    level: "GLOBAL" | "SCHOOL",
    payloadSchemaVersion = 1,
    enabled = true,
): PolicyDefinition<"financial.charges.charge_eligibility"> {
    return PolicyDefinition.gate({
        id: asPolicyDefinitionId(id),
        policyKey: "financial.charges.charge_eligibility",
        policyVersion: "1.0.0",
        gateEngineVersion: 1,
        payloadSchemaVersion,
        contextVersionMin: 1,
        contextVersionMax: 1,
        enabled,
        status: "PUBLISHED",
        scope:
            level === "GLOBAL"
                ? { level, tenantId: null, schoolId: null }
                : {
                      level,
                      tenantId: asTenantId("tenant-1"),
                      schoolId: asSchoolId("school-1"),
                  },
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        priority: 10,
        payloadJson: {
            condition: {
                field: "student.contractStatus",
                op: "eq",
                value: "ACTIVE",
            },
        },
        payloadHash: `${id}-hash`,
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        publishedAt: new Date("2025-12-02T00:00:00.000Z"),
    });
}

describe("InMemoryPolicyDefinitionRepository", () => {
    it("preserves storage order and leaves ranking to the resolver", () => {
        const globalDefinition = makeDefinition("global-definition", "GLOBAL");
        const schoolDefinition = makeDefinition("school-definition", "SCHOOL");
        const repository = new InMemoryPolicyDefinitionRepository([
            globalDefinition,
            schoolDefinition,
        ]);

        const candidates = repository.findCandidates({
            policyKey: "financial.charges.charge_eligibility",
            kind: "GATE",
            asOf: new Date("2026-02-01T00:00:00.000Z"),
            contextVersion: 1,
            scopeChain: [
                {
                    level: "SCHOOL",
                    tenantId: asTenantId("tenant-1"),
                    schoolId: asSchoolId("school-1"),
                },
                { level: "GLOBAL", tenantId: null, schoolId: null },
            ],
        });

        expect(candidates.map((candidate) => candidate.id)).toEqual([
            "global-definition",
            "school-definition",
        ]);
    });

    it("filters candidates by payloadSchemaVersion when provided", () => {
        const schemaV1Definition = makeDefinition(
            "global-definition-v1",
            "GLOBAL",
            1,
        );
        const schemaV2Definition = makeDefinition(
            "global-definition-v2",
            "GLOBAL",
            2,
        );
        const repository = new InMemoryPolicyDefinitionRepository([
            schemaV1Definition,
            schemaV2Definition,
        ]);

        const candidates = repository.findCandidates({
            policyKey: "financial.charges.charge_eligibility",
            kind: "GATE",
            payloadSchemaVersion: 1,
            asOf: new Date("2026-02-01T00:00:00.000Z"),
            contextVersion: 1,
            scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
        });

        expect(candidates.map((candidate) => candidate.id)).toEqual([
            "global-definition-v1",
        ]);
    });

    it("queries only definitions indexed by the requested policyKey", () => {
        const requestedDefinition = makeDefinition(
            "requested-definition",
            "GLOBAL",
        );
        const otherDefinition = PolicyDefinition.gate({
            id: asPolicyDefinitionId("other-definition"),
            policyKey: "financial.charges.late_charge_eligibility",
            policyVersion: "1.0.0",
            gateEngineVersion: 1,
            payloadSchemaVersion: 1,
            contextVersionMin: 1,
            contextVersionMax: 1,
            status: "PUBLISHED",
            scope: { level: "GLOBAL", tenantId: null, schoolId: null },
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            priority: 10,
            payloadJson: {
                condition: {
                    field: "student.contractStatus",
                    op: "eq",
                    value: "ACTIVE",
                },
            },
            payloadHash: "other-definition-hash",
            createdAt: new Date("2025-12-01T00:00:00.000Z"),
            publishedAt: new Date("2025-12-02T00:00:00.000Z"),
        });
        const repository = new InMemoryPolicyDefinitionRepository([
            otherDefinition,
            requestedDefinition,
        ]);

        const candidates = repository.findCandidates({
            policyKey: "financial.charges.charge_eligibility",
            kind: "GATE",
            asOf: new Date("2026-02-01T00:00:00.000Z"),
            contextVersion: 1,
            scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
        });

        expect(candidates.map((candidate) => candidate.id)).toEqual([
            "requested-definition",
        ]);
    });

    it("ignores disabled definitions even when they are otherwise eligible", () => {
        const disabledDefinition = makeDefinition(
            "disabled-definition",
            "GLOBAL",
            1,
            false,
        );
        const enabledDefinition = makeDefinition(
            "enabled-definition",
            "GLOBAL",
            1,
            true,
        );
        const repository = new InMemoryPolicyDefinitionRepository([
            disabledDefinition,
            enabledDefinition,
        ]);

        const candidates = repository.findCandidates({
            policyKey: "financial.charges.charge_eligibility",
            kind: "GATE",
            asOf: new Date("2026-02-01T00:00:00.000Z"),
            contextVersion: 1,
            scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
        });

        expect(candidates.map((candidate) => candidate.id)).toEqual([
            "enabled-definition",
        ]);
    });
});
