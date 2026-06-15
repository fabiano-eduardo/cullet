import { describe, expect, it, vi } from "vitest";

import {
    CoreConfig,
    type PolicyEvent,
    type PolicyReporter,
} from "../../../../config/index.js";
import { Outcome } from "../../../../result/outcome.js";
import { Result } from "../../../../result/result.js";

import { ComputeEngineV1 } from "./compute-engine-v1.js";
import type { ComputeEvaluator, ComputeOutcome } from "../../compute-types.js";

function makeReporter(): PolicyReporter & { report: ReturnType<typeof vi.fn> } {
    return { report: vi.fn<(event: PolicyEvent) => void>() };
}

function makeCoreConfig(reporter: PolicyReporter): CoreConfig {
    return new CoreConfig({
        observability: {
            reporter,
        },
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvaluator(
    returnValue: unknown = 99,
): ComputeEvaluator & { evaluate: ReturnType<typeof vi.fn> } {
    const outcome = Outcome.of<
        ComputeOutcome["status"],
        { values: unknown; violations: [] }
    >("OK", { values: returnValue, violations: [] });
    return {
        evaluate: vi.fn(() => Result.ok(outcome)),
    };
}

describe("ComputeEngineV1", () => {
    const engine = new ComputeEngineV1();

    describe("params pattern", () => {
        it("forwards data directly to the evaluator", () => {
            const evaluator = makeEvaluator();
            const payload = {
                type: "params" as const,
                data: { fineRate: 0.015, gracePeriodDays: 3 },
            };
            const context = { tenantId: "school-1" };

            const result = engine.evaluate(payload, context, evaluator);

            expect(result.isOk()).toBe(true);
            expect(evaluator.evaluate).toHaveBeenCalledOnce();
            expect(evaluator.evaluate).toHaveBeenCalledWith(
                payload.data,
                context,
            );
        });

        it("returns the evaluator outcome without modification", () => {
            const evaluator = makeEvaluator(42);
            const payload = { type: "params" as const, data: { rate: 0.1 } };

            const result = engine.evaluate(payload, {}, evaluator);

            expect(result.isOk()).toBe(true);
            expect(result.getOrNull()!.status).toBe("OK");
            expect(result.getOrNull()!.data.values).toBe(42);
        });
    });

    describe("decision-table pattern", () => {
        it("uses the result of the first rule whose conditions pass", () => {
            const evaluator = makeEvaluator();
            const payload = {
                type: "decision-table" as const,
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "gte" as const,
                            value: 1000,
                        },
                        result: "premium",
                    },
                    {
                        conditions: {
                            field: "amount",
                            op: "gte" as const,
                            value: 500,
                        },
                        result: "standard",
                    },
                ],
                default: "basic",
            };
            const context = { amount: 800 };

            engine.evaluate(payload, context, evaluator);

            expect(evaluator.evaluate).toHaveBeenCalledOnce();
            expect(evaluator.evaluate).toHaveBeenCalledWith(
                "standard",
                context,
            );
        });

        it("uses default when no rule passes", () => {
            const evaluator = makeEvaluator();
            const payload = {
                type: "decision-table" as const,
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "gte" as const,
                            value: 1000,
                        },
                        result: "premium",
                    },
                ],
                default: "basic",
            };
            const context = { amount: 100 };

            engine.evaluate(payload, context, evaluator);

            expect(evaluator.evaluate).toHaveBeenCalledWith("basic", context);
        });

        it("evaluates rules in order and stops at the first one that passes", () => {
            const evaluator = makeEvaluator();

            const orderedPayload = {
                type: "decision-table" as const,
                rules: [
                    {
                        conditions: {
                            field: "tier",
                            op: "eq" as const,
                            value: "A",
                        },
                        result: "first",
                    },
                    {
                        conditions: {
                            field: "tier",
                            op: "eq" as const,
                            value: "B",
                        },
                        result: "second",
                    },
                    {
                        conditions: {
                            field: "tier",
                            op: "eq" as const,
                            value: "A",
                        },
                        result: "third",
                    },
                ],
                default: "none",
            };

            // tier = 'A' → first rule passes; the third one must never be evaluated
            evaluator.evaluate.mockImplementationOnce((val) => {
                return Result.ok(
                    Outcome.of<
                        ComputeOutcome["status"],
                        { values: unknown; violations: [] }
                    >("OK", { values: val, violations: [] }),
                );
            });

            engine.evaluate(orderedPayload, { tier: "A" }, evaluator);

            expect(evaluator.evaluate).toHaveBeenCalledOnce();
            expect(evaluator.evaluate).toHaveBeenCalledWith("first", {
                tier: "A",
            });
        });

        it("propagates a technical error from condition evaluation", () => {
            const evaluator = makeEvaluator();
            const reporter = makeReporter();
            const reportingEngine = new ComputeEngineV1({
                coreConfig: makeCoreConfig(reporter),
            });
            const payload = {
                type: "decision-table" as const,
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "gte" as const,
                            value: 1000,
                        },
                        result: "premium",
                    },
                ],
                default: "basic",
            };
            const context = {
                get amount(): number {
                    throw new RangeError("context exploded");
                },
            };

            const result = reportingEngine.evaluate(
                payload,
                context,
                evaluator,
            );

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain(
                "COMPUTE_CONDITION_EVAL_FAILED",
            );
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
            expect(evaluator.evaluate).not.toHaveBeenCalled();
        });

        it("propagates an error when a numeric operator receives null without allowNull", () => {
            const evaluator = makeEvaluator();
            const reporter = makeReporter();
            const reportingEngine = new ComputeEngineV1({
                coreConfig: makeCoreConfig(reporter),
            });
            const payload = {
                type: "decision-table" as const,
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "gte" as const,
                            value: 1000,
                        },
                        result: "premium",
                    },
                ],
                default: "basic",
            };
            const context = { amount: null };

            const result = reportingEngine.evaluate(
                payload,
                context,
                evaluator,
            );

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain(
                "COMPUTE_CONDITION_EVAL_FAILED",
            );
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
            expect(evaluator.evaluate).not.toHaveBeenCalled();
        });
    });
});
