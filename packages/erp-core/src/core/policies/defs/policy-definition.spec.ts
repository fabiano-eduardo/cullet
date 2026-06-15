import { describe, expect, it } from "vitest";

import { asPolicyDefinitionId } from "../policy-ids.js";
import { PolicyDefinition } from "./policy-definition.js";

describe("PolicyDefinition", () => {
    it("accepts policyVersion in semver format", () => {
        expect(() =>
            PolicyDefinition.gate({
                id: asPolicyDefinitionId("definition-id"),
                policyKey: "financial.charges.charge_eligibility",
                policyVersion: "1.2.3-beta.1+build.5",
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
                payloadHash: "payload-hash",
                createdAt: new Date("2025-12-01T00:00:00.000Z"),
                publishedAt: new Date("2025-12-02T00:00:00.000Z"),
            }),
        ).not.toThrow();
    });

    it("rejects policyVersion outside the semver format", () => {
        expect(() =>
            PolicyDefinition.gate({
                id: asPolicyDefinitionId("definition-id"),
                policyKey: "financial.charges.charge_eligibility",
                policyVersion: "banana",
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
                payloadHash: "payload-hash",
                createdAt: new Date("2025-12-01T00:00:00.000Z"),
                publishedAt: new Date("2025-12-02T00:00:00.000Z"),
            }),
        ).toThrow(
            'PolicyDefinition.policyVersion must be a valid semver. Received: "banana"',
        );
    });

    it("defaults enabled to true when omitted", () => {
        const definition = PolicyDefinition.gate({
            id: asPolicyDefinitionId("definition-id"),
            policyKey: "financial.charges.charge_eligibility",
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
            payloadHash: "payload-hash",
            createdAt: new Date("2025-12-01T00:00:00.000Z"),
            publishedAt: new Date("2025-12-02T00:00:00.000Z"),
        });

        expect(definition.enabled).toBe(true);
    });

    it("rejects effectiveTo at or before effectiveFrom", () => {
        expect(() =>
            PolicyDefinition.gate({
                id: asPolicyDefinitionId("definition-id"),
                policyKey: "financial.charges.charge_eligibility",
                policyVersion: "1.0.0",
                gateEngineVersion: 1,
                payloadSchemaVersion: 1,
                contextVersionMin: 1,
                contextVersionMax: 1,
                status: "PUBLISHED",
                scope: { level: "GLOBAL", tenantId: null, schoolId: null },
                effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
                effectiveTo: new Date("2026-01-01T00:00:00.000Z"),
                priority: 10,
                payloadJson: {
                    condition: {
                        field: "student.contractStatus",
                        op: "eq",
                        value: "ACTIVE",
                    },
                },
                payloadHash: "payload-hash",
                createdAt: new Date("2025-12-01T00:00:00.000Z"),
                publishedAt: new Date("2025-12-02T00:00:00.000Z"),
            }),
        ).toThrow(
            "PolicyDefinition.effectiveTo must be later than effectiveFrom",
        );
    });

    it("rejects contextVersionMin greater than contextVersionMax", () => {
        expect(() =>
            PolicyDefinition.gate({
                id: asPolicyDefinitionId("definition-id"),
                policyKey: "financial.charges.charge_eligibility",
                policyVersion: "1.0.0",
                gateEngineVersion: 1,
                payloadSchemaVersion: 1,
                contextVersionMin: 5,
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
                payloadHash: "payload-hash",
                createdAt: new Date("2025-12-01T00:00:00.000Z"),
                publishedAt: new Date("2025-12-02T00:00:00.000Z"),
            }),
        ).toThrow(
            "PolicyDefinition.contextVersionMin (5) must not exceed contextVersionMax (1)",
        );
    });
});
