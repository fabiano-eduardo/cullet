import { describe, expect, it } from "vitest";

import { PolicyDefinition } from "../defs/index.js";
import type { PolicyScope } from "../defs/policy-scope.js";
import { asPolicyDefinitionId, asSchoolId, asTenantId } from "../policy-ids.js";

import { PolicyResolver } from "./policy-resolver.js";

const POLICY_KEY = "financial.billing.psp_selection" as const;
const EFFECTIVE_FROM = new Date("2024-01-01T00:00:00.000Z");
const DEFAULT_CREATED_AT = new Date("2024-01-01T00:00:00.000Z");
const DEFAULT_PUBLISHED_AT = new Date("2024-01-02T00:00:00.000Z");

const GLOBAL_SCOPE: PolicyScope = {
    level: "GLOBAL",
    tenantId: null,
    schoolId: null,
};

const TENANT_SCOPE: PolicyScope = {
    level: "TENANT",
    tenantId: asTenantId("tenant-1"),
    schoolId: null,
};

const SCHOOL_SCOPE: PolicyScope = {
    level: "SCHOOL",
    tenantId: asTenantId("tenant-1"),
    schoolId: asSchoolId("school-1"),
};

type DefinitionParams = {
    readonly id?: string;
    readonly scope?: PolicyScope;
    readonly priority?: number;
    readonly createdAt?: Date;
    readonly publishedAt?: Date | null;
    readonly policyVersion?: string;
    readonly engineVersion?: number;
};

function makeBaseDefinitionProps(params: DefinitionParams = {}) {
    const id = params.id ?? "definition-1";

    return {
        id: asPolicyDefinitionId(id),
        policyKey: POLICY_KEY,
        policyVersion: params.policyVersion ?? "1.0.0",
        payloadSchemaVersion: 1,
        contextVersionMin: 1,
        contextVersionMax: 99,
        status: "PUBLISHED" as const,
        scope: params.scope ?? GLOBAL_SCOPE,
        effectiveFrom: EFFECTIVE_FROM,
        effectiveTo: null,
        priority: params.priority ?? 10,
        payloadHash: `${id}-hash`,
        createdAt: params.createdAt ?? DEFAULT_CREATED_AT,
        publishedAt:
            params.publishedAt === undefined
                ? DEFAULT_PUBLISHED_AT
                : params.publishedAt,
    };
}

function makeGateDefinition(
    params: DefinitionParams = {},
): PolicyDefinition<typeof POLICY_KEY> {
    return PolicyDefinition.gate({
        ...makeBaseDefinitionProps(params),
        gateEngineVersion: params.engineVersion ?? 1,
        payloadJson: {
            condition: {
                field: "student.contractStatus",
                op: "eq",
                value: "ACTIVE",
            },
        },
    });
}

function makeComputeDefinition(
    params: DefinitionParams = {},
): PolicyDefinition<typeof POLICY_KEY> {
    return PolicyDefinition.compute({
        ...makeBaseDefinitionProps(params),
        computeEngineVersion: params.engineVersion ?? 1,
        payloadJson: {
            type: "params",
            data: {
                selectedPsp: "premium",
            },
        },
    });
}

describe("PolicyResolver", () => {
    const resolver = new PolicyResolver();

    describe("happy path", () => {
        it("prefers the most specific scope before any other tiebreaker", () => {
            const globalDefinition = makeGateDefinition({
                id: "global-definition",
                scope: GLOBAL_SCOPE,
                priority: 100,
                publishedAt: new Date("2024-03-01T00:00:00.000Z"),
            });
            const schoolDefinition = makeGateDefinition({
                id: "school-definition",
                scope: SCHOOL_SCOPE,
                priority: 1,
                publishedAt: new Date("2024-01-01T00:00:00.000Z"),
            });

            const result = resolver.resolveBest([
                globalDefinition,
                schoolDefinition,
            ]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(schoolDefinition);
        });

        it("prefers higher priority when scope is tied", () => {
            const lowerPriority = makeGateDefinition({
                id: "priority-low",
                scope: TENANT_SCOPE,
                priority: 10,
                publishedAt: new Date("2024-03-01T00:00:00.000Z"),
            });
            const higherPriority = makeGateDefinition({
                id: "priority-high",
                scope: TENANT_SCOPE,
                priority: 20,
                publishedAt: new Date("2024-01-01T00:00:00.000Z"),
            });

            const result = resolver.resolveBest([
                lowerPriority,
                higherPriority,
            ]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(higherPriority);
        });

        it("prefers the newest publishedAt when scope and priority are tied", () => {
            const olderDefinition = makeGateDefinition({
                id: "published-old",
                publishedAt: new Date("2024-01-15T00:00:00.000Z"),
            });
            const newerDefinition = makeGateDefinition({
                id: "published-new",
                publishedAt: new Date("2024-02-15T00:00:00.000Z"),
            });

            const result = resolver.resolveBest([
                olderDefinition,
                newerDefinition,
            ]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(newerDefinition);
        });

        it("prefers the newest engine version when previous criteria are tied", () => {
            const engineV1 = makeComputeDefinition({
                id: "compute-v1",
                engineVersion: 1,
            });
            const engineV2 = makeComputeDefinition({
                id: "compute-v2",
                engineVersion: 2,
            });

            const result = resolver.resolveBest([engineV1, engineV2]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(engineV2);
        });

        it("prefers the highest policy semver as the final deterministic tiebreaker", () => {
            const olderVersion = makeGateDefinition({
                id: "semver-older",
                policyVersion: "1.2.0",
            });
            const newerVersion = makeGateDefinition({
                id: "semver-newer",
                policyVersion: "1.10.0",
            });

            const result = resolver.resolveBest([olderVersion, newerVersion]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(newerVersion);
        });
    });

    describe("error cases", () => {
        it("returns an Err result when the candidates list is empty", () => {
            const result = resolver.resolveBest([]);

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toBe(
                "No matching policy definition found (candidates list is empty)",
            );
        });
    });

    describe("edge cases", () => {
        it("falls back to createdAt when publishedAt is null", () => {
            const olderDraft = makeGateDefinition({
                id: "created-old",
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                publishedAt: null,
            });
            const newerDraft = makeGateDefinition({
                id: "created-new",
                createdAt: new Date("2024-02-01T00:00:00.000Z"),
                publishedAt: null,
            });

            const result = resolver.resolveBest([olderDraft, newerDraft]);

            expect(result.isOk()).toBe(true);
            expect(result.getOrThrow()).toBe(newerDraft);
        });
    });
});
