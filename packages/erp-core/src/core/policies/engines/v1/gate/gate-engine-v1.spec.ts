import { describe, expect, it, vi } from "vitest";

import {
    CoreConfig,
    type PolicyEvent,
    type PolicyReporter,
} from "../../../../config";

import { GateEngineV1 } from "./gate-engine-v1";
import type { GatePayloadV1 } from "./gate-types-v1";

function makeCoreConfig(reporter: PolicyReporter): CoreConfig {
    return new CoreConfig({
        observability: {
            reporter,
        },
    });
}

function makeReporter(): PolicyReporter & { report: ReturnType<typeof vi.fn> } {
    return { report: vi.fn<(event: PolicyEvent) => void>() };
}

describe("GateEngine", () => {
    it("returns ALLOW when the payload uses the shorthand format with condition", () => {
        const engine = new GateEngineV1();
        const payload = {
            condition: { field: "status", op: "eq" as const, value: "ACTIVE" },
        };
        const context = { status: "ACTIVE" };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("ALLOW");
    });

    it("interprets the shorthand condition as allowIf with defaultOutcome DENY", () => {
        const engine = new GateEngineV1();
        const payload = {
            condition: { field: "status", op: "eq" as const, value: "ACTIVE" },
        };
        const context = { status: "INACTIVE" };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("DENY");
        expect(result.getOrNull()!.data.violations).toHaveLength(1);
    });

    it("returns ALLOW when allowIf is true", () => {
        const engine = new GateEngineV1();
        const payload: GatePayloadV1 = {
            allowIf: { field: "amount", op: "gte", value: 100 },
            defaultOutcome: "DENY",
        };
        const context = { amount: 150 };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("ALLOW");
    });

    it("returns ALLOW when allowIf compares Date with an ISO UTC string", () => {
        const engine = new GateEngineV1();
        const payload: GatePayloadV1 = {
            allowIf: {
                field: "charge.dueDate",
                op: "gte",
                value: "2026-01-01T00:00:00.000Z",
            },
            defaultOutcome: "DENY",
        };
        const context = {
            charge: {
                dueDate: new Date("2026-01-15T00:00:00.000Z"),
            },
        };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("ALLOW");
    });

    it("returns DENY when allowIf is false and defaultOutcome is DENY", () => {
        const engine = new GateEngineV1();
        const payload: GatePayloadV1 = {
            allowIf: { field: "amount", op: "gte", value: 100 },
            defaultOutcome: "DENY",
        };
        const context = { amount: 80 };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("DENY");
        expect(result.getOrNull()!.data.violations).toHaveLength(1);
        expect(result.getOrNull()!.data.violations[0]).toEqual(
            expect.objectContaining({
                code: "DENY_CONDITION_MET",
                message: "Gate denied at $",
                trace: expect.objectContaining({
                    conditionPath: "$",
                    lastEvaluatedLeafPath: "$",
                    field: "amount",
                    op: "gte",
                    lastEvaluatedLeafResult: false,
                }),
            }),
        );
    });

    it("applies defaultOutcome when allowIf is false", () => {
        const engine = new GateEngineV1();
        const payload: GatePayloadV1 = {
            allowIf: { field: "amount", op: "gte", value: 100 },
            defaultOutcome: "ALLOW",
        };
        const context = { amount: 80 };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("ALLOW");
    });

    it("propagates a technical error from condition evaluation", () => {
        const reporter = makeReporter();
        const engine = new GateEngineV1({
            coreConfig: makeCoreConfig(reporter),
        });
        const payload = {
            allowIf: { field: "amount", op: "gte" as const, value: 100 },
            defaultOutcome: "DENY" as const,
        };
        const context = {
            get amount(): number {
                throw new RangeError("context exploded");
            },
        };

        const result = engine.evaluate(payload, context);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("CONDITION_EVAL_THREW");
        expect(reporter.report).toHaveBeenCalledOnce();
        expect(reporter.report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "condition-eval",
                level: "error",
                tag: "CONDITION_EVAL_THREW",
                engineVersion: 1,
            }),
        );
    });

    it("returns Result.err when a numeric operator receives null without allowNull", () => {
        const reporter = makeReporter();
        const engine = new GateEngineV1({
            coreConfig: makeCoreConfig(reporter),
        });
        const payload = {
            allowIf: { field: "amount", op: "gte" as const, value: 100 },
            defaultOutcome: "DENY" as const,
        };
        const context = { amount: null };

        const result = engine.evaluate(payload, context);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain(
            "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
        );
        expect(reporter.report).toHaveBeenCalledOnce();
        expect(reporter.report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "condition-eval",
                level: "error",
                tag: "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
                engineVersion: 1,
            }),
        );
    });

    it("returns Result.err when a date comparison receives an invalid ISO operand", () => {
        const reporter = makeReporter();
        const engine = new GateEngineV1({
            coreConfig: makeCoreConfig(reporter),
        });
        const payload: GatePayloadV1 = {
            allowIf: {
                field: "charge.dueDate",
                op: "gte",
                value: "2026-13-01T00:00:00.000Z",
            },
            defaultOutcome: "DENY",
        };
        const context = {
            charge: {
                dueDate: new Date("2026-01-15T00:00:00.000Z"),
            },
        };

        const result = engine.evaluate(payload, context);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("INVALID_DATE_OPERAND");
        expect(reporter.report).toHaveBeenCalledOnce();
        expect(reporter.report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "condition-eval",
                level: "error",
                tag: "INVALID_DATE_OPERAND",
                engineVersion: 1,
            }),
        );
    });

    it("returns Result.err with MISSING_CONTEXT_FIELD when the payload field is missing from the context (shorthand)", () => {
        const reporter = makeReporter();
        const engine = new GateEngineV1({
            coreConfig: makeCoreConfig(reporter),
        });
        const payload = {
            condition: { field: "tenanttId", op: "eq" as const, value: "abc" },
        };
        const context = { tenantId: "abc" };

        const result = engine.evaluate(payload, context);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("MISSING_CONTEXT_FIELD");
        expect(result.errorOrNull()).toContain('"tenanttId"');
        expect(reporter.report).toHaveBeenCalledOnce();
        expect(reporter.report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "condition-eval",
                level: "warn",
                tag: "MISSING_CONTEXT_FIELD",
            }),
        );
    });

    it("returns Result.err with MISSING_CONTEXT_FIELD when the payload field is missing from the context (allowIf)", () => {
        const reporter = makeReporter();
        const engine = new GateEngineV1({
            coreConfig: makeCoreConfig(reporter),
        });
        const payload = {
            allowIf: { field: "tenanttId", op: "eq" as const, value: "abc" },
            defaultOutcome: "DENY" as const,
        };
        const context = { tenantId: "abc" };

        const result = engine.evaluate(payload, context);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("MISSING_CONTEXT_FIELD");
        expect(result.errorOrNull()).toContain('"tenanttId"');
        expect(reporter.report).toHaveBeenCalledOnce();
        expect(reporter.report).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "condition-eval",
                level: "warn",
                tag: "MISSING_CONTEXT_FIELD",
            }),
        );
    });

    it("carries the path of the decisive subtree when a NOT negates the rule", () => {
        const engine = new GateEngineV1();
        const payload = {
            condition: {
                not: {
                    field: "student.flags.financialHold",
                    op: "eq" as const,
                    value: true,
                },
            },
        };
        const context = {
            student: {
                flags: {
                    financialHold: true,
                },
            },
        };

        const result = engine.evaluate(payload, context);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.status).toBe("DENY");
        expect(result.getOrNull()!.data.violations[0]).toEqual(
            expect.objectContaining({
                trace: expect.objectContaining({
                    conditionPath: "$",
                    lastEvaluatedLeafPath: "$.not",
                    field: "student.flags.financialHold",
                    op: "eq",
                    lastEvaluatedLeafResult: true,
                }),
            }),
        );
    });
});
