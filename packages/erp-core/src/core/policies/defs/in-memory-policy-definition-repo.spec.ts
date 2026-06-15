import { describe, expect, it } from "vitest";

import { asPolicyDefinitionId, asSchoolId, asTenantId } from "../policy-ids.js";
import { InMemoryPolicyDefinitionRepository } from "./in-memory-policy-definition-repo.js";
import { PolicyDefinition } from "./policy-definition.js";
import type { GatePolicyDefinitionInput } from "./policy-definition.js";

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

    describe("eligibility filtering", () => {
        const POLICY_KEY = "financial.charges.charge_eligibility" as const;

        function gate(
            overrides: Partial<
                GatePolicyDefinitionInput<typeof POLICY_KEY>
            > = {},
        ): PolicyDefinition<typeof POLICY_KEY> {
            return PolicyDefinition.gate({
                id: asPolicyDefinitionId("definition-under-test"),
                policyKey: POLICY_KEY,
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
                payloadHash: "definition-under-test-hash",
                createdAt: new Date("2025-12-01T00:00:00.000Z"),
                publishedAt: new Date("2025-12-02T00:00:00.000Z"),
                ...overrides,
            });
        }

        function findGlobal(repository: InMemoryPolicyDefinitionRepository) {
            return repository.findCandidates({
                policyKey: POLICY_KEY,
                kind: "GATE",
                asOf: new Date("2026-02-01T00:00:00.000Z"),
                contextVersion: 1,
                scopeChain: [
                    { level: "GLOBAL", tenantId: null, schoolId: null },
                ],
            });
        }

        it("returns no candidates when the policyKey is not indexed", () => {
            const repository = new InMemoryPolicyDefinitionRepository([gate()]);

            const candidates = repository.findCandidates({
                policyKey: "financial.billing.psp_selection",
                kind: "GATE",
                asOf: new Date("2026-02-01T00:00:00.000Z"),
                contextVersion: 1,
                scopeChain: [
                    { level: "GLOBAL", tenantId: null, schoolId: null },
                ],
            });

            expect(candidates).toEqual([]);
        });

        it("excludes definitions that are not PUBLISHED", () => {
            const repository = new InMemoryPolicyDefinitionRepository([
                gate({ status: "DRAFT" }),
            ]);

            expect(findGlobal(repository)).toEqual([]);
        });

        it("excludes definitions whose effectiveFrom is after asOf", () => {
            const repository = new InMemoryPolicyDefinitionRepository([
                gate({ effectiveFrom: new Date("2030-01-01T00:00:00.000Z") }),
            ]);

            expect(findGlobal(repository)).toEqual([]);
        });

        it("excludes definitions whose effectiveTo is at or before asOf", () => {
            const repository = new InMemoryPolicyDefinitionRepository([
                gate({
                    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
                    effectiveTo: new Date("2025-06-01T00:00:00.000Z"),
                }),
            ]);

            expect(findGlobal(repository)).toEqual([]);
        });

        it("excludes definitions outside the requested contextVersion range", () => {
            const belowMin = new InMemoryPolicyDefinitionRepository([
                gate({ contextVersionMin: 5, contextVersionMax: 9 }),
            ]);
            const aboveMax = new InMemoryPolicyDefinitionRepository([
                gate({ contextVersionMin: 1, contextVersionMax: 1 }),
            ]);

            expect(findGlobal(belowMin)).toEqual([]);
            expect(
                aboveMax.findCandidates({
                    policyKey: POLICY_KEY,
                    kind: "GATE",
                    asOf: new Date("2026-02-01T00:00:00.000Z"),
                    contextVersion: 3,
                    scopeChain: [
                        { level: "GLOBAL", tenantId: null, schoolId: null },
                    ],
                }),
            ).toEqual([]);
        });

        it("excludes definitions whose scope does not match the chain", () => {
            const repository = new InMemoryPolicyDefinitionRepository([
                gate({
                    scope: {
                        level: "SCHOOL",
                        tenantId: asTenantId("tenant-1"),
                        schoolId: asSchoolId("school-1"),
                    },
                }),
            ]);

            // Chain only offers GLOBAL, so the SCHOOL-scoped definition is dropped.
            expect(findGlobal(repository)).toEqual([]);
        });
    });
});
