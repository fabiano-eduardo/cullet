import { describe, expect, it, vi } from "vitest";

import { ConditionEvaluatorV1 } from "./condition-evaluator.js";
import type {
    ConditionEvaluationOptions,
    ConditionEvaluationReport,
    ConditionEvaluatorReporter,
} from "../condition-evaluator-reporter.js";
import type { PolicyContext } from "../gate-types.js";
import type { ConditionLeafNode, ConditionNode } from "./condition-types.js";

function evaluateCondition(
    node: ConditionNode,
    context: PolicyContext,
    options: ConditionEvaluationOptions,
) {
    return new ConditionEvaluatorV1(context, options).evaluate(node);
}

describe("ConditionEvaluator errors — operand validation", () => {
    const noOpReporter: ConditionEvaluatorReporter = {
        warn: () => {},
        error: () => {},
    };
    const options: ConditionEvaluationOptions = {
        reporter: noOpReporter,
        engineVersion: 1,
    };

    it("returns Result.err with MISSING_CONTEXT_FIELD when the field is missing from the context", () => {
        const context: PolicyContext = { status: "ACTIVE" };
        const node: ConditionLeafNode = {
            field: "missing.field",
            op: "eq",
            value: "x",
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("MISSING_CONTEXT_FIELD");
        expect(result.errorOrNull()).toContain("missing.field");
    });

    it("reports a missing field to the optional reporter", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { status: "ACTIVE" };
        const node: ConditionLeafNode = {
            field: "missing.field",
            op: "eq",
            value: "x",
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(reporter.warn).toHaveBeenCalledOnce();
        expect(reporter.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "warn",
                tag: "MISSING_CONTEXT_FIELD",
                message:
                    'MISSING_CONTEXT_FIELD: "missing.field" not found in context',
                details: {
                    field: "missing.field",
                    node,
                },
            }),
        );
    });

    it("returns Result.err when a numeric operator receives null without allowNull", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { amount: null };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 100,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to null for numeric operator "gt"',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
                message:
                    'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to null for numeric operator "gt"',
                details: {
                    field: "amount",
                    op: "gt",
                    actual: null,
                    expected: 100,
                    allowNull: false,
                    node,
                },
            }),
        );
    });

    it("returns Result.err when a numeric operator receives undefined", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { amount: undefined };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 100,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to undefined for numeric operator "gt"',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
                message:
                    'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to undefined for numeric operator "gt"',
                details: {
                    field: "amount",
                    op: "gt",
                    actual: undefined,
                    expected: 100,
                    allowNull: false,
                    node,
                },
            }),
        );
    });

    it("accepts null when the leaf opts into allowNull", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { amount: null };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 100,
            allowNull: true,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(false);
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).not.toHaveBeenCalled();
    });

    it("returns Result.err when a date comparison receives null without allowNull", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { dueDate: null };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: "2026-01-01T00:00:00.000Z",
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'NULLISH_DATE_OPERAND_NOT_ALLOWED: "dueDate" resolved to null for date comparison operator "gt"',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "NULLISH_DATE_OPERAND_NOT_ALLOWED",
                message:
                    'NULLISH_DATE_OPERAND_NOT_ALLOWED: "dueDate" resolved to null for date comparison operator "gt"',
                details: {
                    field: "dueDate",
                    op: "gt",
                    actual: null,
                    expected: "2026-01-01T00:00:00.000Z",
                    allowNull: false,
                    node,
                },
            }),
        );
    });

    it("accepts null in a date comparison when the leaf opts into allowNull", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { dueDate: null };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: "2026-01-01T00:00:00.000Z",
            allowNull: true,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(false);
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).not.toHaveBeenCalled();
    });

    it("returns Result.err when the ISO UTC date operand is invalid", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = {
            dueDate: new Date("2026-02-01T00:00:00.000Z"),
        };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: "2026-02-30T00:00:00.000Z",
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.SSSZ) string operands',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "INVALID_DATE_OPERAND",
                message:
                    'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.SSSZ) string operands',
                details: {
                    field: "dueDate",
                    op: "gt",
                    actual: new Date("2026-02-01T00:00:00.000Z"),
                    expected: "2026-02-30T00:00:00.000Z",
                    node,
                },
            }),
        );
    });

    it("returns Result.err when a relational comparison mixes date and number", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = {
            dueDate: new Date("2026-02-01T00:00:00.000Z"),
        };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: 100,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.SSSZ) string operands',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "INVALID_DATE_OPERAND",
                message:
                    'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.SSSZ) string operands',
                details: {
                    field: "dueDate",
                    op: "gt",
                    actual: new Date("2026-02-01T00:00:00.000Z"),
                    expected: 100,
                    node,
                },
            }),
        );
    });

    it("returns Result.err when a numeric operator receives a non-numeric actual", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = { amount: "100" };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 50,
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'INVALID_NUMERIC_OPERAND: "amount" with operator "gt" requires numeric operands',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "INVALID_NUMERIC_OPERAND",
                details: {
                    field: "amount",
                    op: "gt",
                    actual: "100",
                    expected: 50,
                    node,
                },
            }),
        );
    });

    it("returns Result.err when the numeric leaf value is not a number", () => {
        const context: PolicyContext = { amount: 100 };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gte",
            value: "50",
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("INVALID_NUMERIC_OPERAND");
    });

    it("returns Result.err when in/notIn receive a non-array operand", () => {
        const inNode: ConditionLeafNode = {
            field: "tier",
            op: "in",
            value: "gold",
        };
        const inResult = evaluateCondition(inNode, { tier: "gold" }, options);

        expect(inResult.isErr()).toBe(true);
        expect(inResult.errorOrNull()).toBe(
            'INVALID_SET_OPERAND: "tier" with operator "in" requires an array operand',
        );

        const notInNode: ConditionLeafNode = {
            field: "tier",
            op: "notIn",
            value: "gold",
        };
        const notInResult = evaluateCondition(
            notInNode,
            { tier: "bronze" },
            options,
        );

        expect(notInResult.isErr()).toBe(true);
        expect(notInResult.errorOrNull()).toContain("INVALID_SET_OPERAND");
    });

    it("returns Result.err with tag when evaluation throws and reports via the optional reporter", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const node: ConditionNode = {
            get and(): readonly ConditionNode[] {
                throw new RangeError("boom");
            },
        };

        const result = evaluateCondition(
            node,
            {},
            {
                reporter,
                engineVersion: 1,
            },
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("CONDITION_EVAL_THREW");
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "CONDITION_EVAL_THREW",
                message: "CONDITION_EVAL_THREW: RangeError: boom",
                details: {
                    node,
                    cause: {
                        name: "RangeError",
                        message: "boom",
                    },
                },
            }),
        );
    });

    describe("Date operands in eq/neq/in/notIn", () => {
        const ISO = "2026-01-01T00:00:00.000Z";

        it("eq matches a context Date against an equal ISO string in the rule", () => {
            const result = evaluateCondition(
                { field: "when", op: "eq", value: ISO },
                { when: new Date(ISO) },
                options,
            );

            expect(result.getOrNull()).toBe(true);
        });

        it("eq matches two equal Date instances by instant, not reference", () => {
            const result = evaluateCondition(
                { field: "when", op: "eq", value: new Date(ISO) },
                { when: new Date(ISO) },
                options,
            );

            expect(result.getOrNull()).toBe(true);
        });

        it("neq distinguishes different instants", () => {
            const result = evaluateCondition(
                { field: "when", op: "neq", value: ISO },
                { when: new Date("2027-06-06T12:00:00.000Z") },
                options,
            );

            expect(result.getOrNull()).toBe(true);
        });

        it("in finds a context Date among ISO strings and Dates in the set", () => {
            const result = evaluateCondition(
                {
                    field: "when",
                    op: "in",
                    value: ["2025-01-01T00:00:00.000Z", new Date(ISO)],
                },
                { when: new Date(ISO) },
                options,
            );

            expect(result.getOrNull()).toBe(true);
        });

        it("notIn holds when the instant is absent from the set", () => {
            const result = evaluateCondition(
                { field: "when", op: "notIn", value: [ISO] },
                { when: new Date("2027-06-06T12:00:00.000Z") },
                options,
            );

            expect(result.getOrNull()).toBe(true);
        });

        it("reports INVALID_DATE_OPERAND for an invalid Date instead of silently not matching", () => {
            const result = evaluateCondition(
                { field: "when", op: "eq", value: ISO },
                { when: new Date("not-a-date") },
                options,
            );

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("INVALID_DATE_OPERAND");
        });
    });
});
