import { describe, expect, it } from "vitest";

import {
    AppError,
    BusinessRuleViolationError,
    NotFoundError,
    UnexpectedError,
} from "../errors/index.js";
import { ErrorCodes } from "../errors/error-codes.js";
import type { PolicyEvaluationError } from "../policies/service/policy-evaluation-error.js";

import { mapPolicyEvaluationError } from "./policy-error-mapper.js";

describe("mapPolicyEvaluationError", () => {
    describe("INVALID_CONTEXT", () => {
        it("maps to a BusinessRuleViolationError keyed by the lowercased stage", () => {
            const err: PolicyEvaluationError = {
                kind: "INVALID_CONTEXT",
                stage: "SEED_VALIDATION",
                policyKey: "billing.discount",
                message: "context is invalid",
                cause: "seed.fields.now is not a Date",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(BusinessRuleViolationError);
            expect(mapped.code).toBe(ErrorCodes.businessRuleViolation);
            expect(mapped.message).toBe("context is invalid");
            expect(mapped.cause).toBe("seed.fields.now is not a Date");
            expect(mapped.metadata).toEqual({
                rule: "policy.seed_validation",
                detail: {
                    policyKey: "billing.discount",
                    stage: "SEED_VALIDATION",
                },
            });
        });

        it("lowercases every stage variant into the rule key", () => {
            const stages: ReadonlyArray<
                Extract<
                    PolicyEvaluationError,
                    { kind: "INVALID_CONTEXT" }
                >["stage"]
            > = ["SEED_VALIDATION", "AS_OF_DERIVATION", "CONTEXT_BUILD"];

            for (const stage of stages) {
                const mapped = mapPolicyEvaluationError({
                    kind: "INVALID_CONTEXT",
                    stage,
                    policyKey: "k",
                    message: "m",
                    cause: "c",
                });

                expect(mapped.metadata).toMatchObject({
                    rule: `policy.${stage.toLowerCase()}`,
                });
            }
        });
    });

    describe("INVALID_POLICY_KEY", () => {
        it("maps to a BusinessRuleViolationError with the raw key in the detail", () => {
            const err: PolicyEvaluationError = {
                kind: "INVALID_POLICY_KEY",
                rawPolicyKey: "  not a key  ",
                message: "policy key is invalid",
                cause: "must match the policy key grammar",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(BusinessRuleViolationError);
            expect(mapped.code).toBe(ErrorCodes.businessRuleViolation);
            expect(mapped.message).toBe("policy key is invalid");
            expect(mapped.cause).toBe("must match the policy key grammar");
            expect(mapped.metadata).toEqual({
                rule: "policy.invalid_key",
                detail: { rawPolicyKey: "  not a key  " },
            });
        });
    });

    describe("POLICY_NOT_FOUND", () => {
        it("maps to a NotFoundError for the Policy resource", () => {
            const err: PolicyEvaluationError = {
                kind: "POLICY_NOT_FOUND",
                policyKey: "billing.discount",
                message: "ignored — NotFoundError builds its own message",
                cause: "not registered in the catalog",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(NotFoundError);
            expect(mapped.code).toBe(ErrorCodes.notFound);
            expect(mapped.message).toBe("Policy not found");
            expect(mapped.cause).toBe("not registered in the catalog");
            expect(mapped.metadata).toEqual({
                resource: "Policy",
                criteria: { policyKey: "billing.discount" },
            });
        });
    });

    describe("POLICY_DEFINITION_NOT_FOUND", () => {
        it("maps to a NotFoundError and serializes asOf as an ISO-8601 string", () => {
            const asOf = new Date("2026-01-15T08:30:00.000Z");
            const err: PolicyEvaluationError = {
                kind: "POLICY_DEFINITION_NOT_FOUND",
                policyKey: "billing.discount",
                contextVersion: 3,
                asOf,
                message: "no published definition matched",
                cause: "no row in scope chain",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(NotFoundError);
            expect(mapped.code).toBe(ErrorCodes.notFound);
            expect(mapped.message).toBe("PolicyDefinition not found");
            expect(mapped.cause).toBe("no row in scope chain");
            expect(mapped.metadata).toEqual({
                resource: "PolicyDefinition",
                criteria: {
                    policyKey: "billing.discount",
                    contextVersion: 3,
                    asOf: "2026-01-15T08:30:00.000Z",
                },
            });
        });
    });

    describe("POLICY_VARIANT_NOT_FOUND", () => {
        it("maps to a NotFoundError carrying only the variant selectors the mapper forwards", () => {
            const err: PolicyEvaluationError = {
                kind: "POLICY_VARIANT_NOT_FOUND",
                policyKey: "billing.discount",
                policyKind: "GATE",
                payloadSchemaVersion: 2,
                gateEngineVersion: 1,
                message: "no catalog variant matched",
                cause: "engine version mismatch",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(NotFoundError);
            expect(mapped.code).toBe(ErrorCodes.notFound);
            expect(mapped.message).toBe("PolicyVariant not found");
            expect(mapped.cause).toBe("engine version mismatch");
            expect(mapped.metadata).toEqual({
                resource: "PolicyVariant",
                criteria: {
                    policyKey: "billing.discount",
                    policyKind: "GATE",
                    payloadSchemaVersion: 2,
                },
            });
        });
    });

    describe("ENGINE_FAILURE", () => {
        it("maps to an UnexpectedError preserving message, cause, and engine metadata", () => {
            const err: PolicyEvaluationError = {
                kind: "ENGINE_FAILURE",
                policyKey: "billing.discount",
                engine: "COMPUTE",
                engineVersion: 4,
                message: "engine threw while evaluating",
                cause: "division by zero",
            };

            const mapped = mapPolicyEvaluationError(err);

            expect(mapped).toBeInstanceOf(UnexpectedError);
            expect(mapped.code).toBe(ErrorCodes.unexpected);
            expect(mapped.message).toBe("engine threw while evaluating");
            expect(mapped.cause).toBe("division by zero");
            expect(mapped.metadata).toEqual({
                policyKey: "billing.discount",
                engine: "COMPUTE",
                engineVersion: 4,
            });
        });
    });

    describe("contract", () => {
        const samples: readonly PolicyEvaluationError[] = [
            {
                kind: "INVALID_CONTEXT",
                stage: "CONTEXT_BUILD",
                policyKey: "k",
                message: "m",
                cause: "c",
            },
            {
                kind: "INVALID_POLICY_KEY",
                rawPolicyKey: "k",
                message: "m",
                cause: "c",
            },
            {
                kind: "POLICY_NOT_FOUND",
                policyKey: "k",
                message: "m",
                cause: "c",
            },
            {
                kind: "POLICY_DEFINITION_NOT_FOUND",
                policyKey: "k",
                contextVersion: 1,
                asOf: new Date("2026-01-01T00:00:00.000Z"),
                message: "m",
                cause: "c",
            },
            {
                kind: "POLICY_VARIANT_NOT_FOUND",
                policyKey: "k",
                policyKind: "GATE",
                payloadSchemaVersion: 1,
                message: "m",
                cause: "c",
            },
            {
                kind: "ENGINE_FAILURE",
                policyKey: "k",
                engine: "GATE",
                engineVersion: 1,
                message: "m",
                cause: "c",
            },
        ];

        it("always returns a concrete AppError with a non-empty code for every error kind", () => {
            for (const sample of samples) {
                const mapped = mapPolicyEvaluationError(sample);

                expect(mapped).toBeInstanceOf(AppError);
                expect(typeof mapped.code).toBe("string");
                expect(mapped.code.length).toBeGreaterThan(0);
            }
        });

        it("produces a JSON-safe payload for every error kind", () => {
            for (const sample of samples) {
                const mapped = mapPolicyEvaluationError(sample);

                expect(() => JSON.stringify(mapped.toJSON())).not.toThrow();
            }
        });
    });
});
