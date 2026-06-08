import { describe, expect, it, vi } from "vitest";

import { ConditionEvaluatorV1 } from "./condition-evaluator";
import type {
    ConditionEvaluationOptions,
    ConditionEvaluationReport,
    ConditionEvaluatorReporter,
} from "../condition-evaluator-reporter";
import type { PolicyContext } from "../gate-types";
import type { ConditionLeafNode, ConditionNode } from "./condition-types";

function evaluateCondition(
    node: ConditionNode,
    context: PolicyContext,
    options: ConditionEvaluationOptions,
) {
    return new ConditionEvaluatorV1(context, options).evaluate(node);
}

describe("ConditionEvaluatorV1.evaluate", () => {
    const noOpReporter: ConditionEvaluatorReporter = {
        warn: () => {},
        error: () => {},
    };
    const options: ConditionEvaluationOptions = {
        reporter: noOpReporter,
        engineVersion: 1,
    };

    it("evaluates the eq operator", () => {
        const context: PolicyContext = { status: "ACTIVE" };
        const node: ConditionLeafNode = {
            field: "status",
            op: "eq",
            value: "ACTIVE",
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the neq operator", () => {
        const context: PolicyContext = { status: "INACTIVE" };
        const node: ConditionLeafNode = {
            field: "status",
            op: "neq",
            value: "ACTIVE",
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the gt operator", () => {
        const context: PolicyContext = { amount: 100 };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 50,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the gte operator", () => {
        const context: PolicyContext = { amount: 50 };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gte",
            value: 50,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the lt operator", () => {
        const context: PolicyContext = { amount: 30 };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "lt",
            value: 50,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the lte operator", () => {
        const context: PolicyContext = { amount: 50 };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "lte",
            value: 50,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the gt operator between Date and ISO UTC string", () => {
        const context: PolicyContext = {
            dueDate: new Date("2026-02-01T00:00:00.000Z"),
        };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: "2026-01-01T00:00:00.000Z",
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the lte operator between ISO UTC string and Date", () => {
        const context: PolicyContext = {
            dueDate: "2026-01-01T00:00:00.000Z",
        };
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "lte",
            value: new Date("2026-01-01T00:00:00.000Z"),
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the in operator", () => {
        const context: PolicyContext = { tier: "gold" };
        const node: ConditionLeafNode = {
            field: "tier",
            op: "in",
            value: ["silver", "gold", "platinum"],
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the notIn operator", () => {
        const context: PolicyContext = { tier: "bronze" };
        const node: ConditionLeafNode = {
            field: "tier",
            op: "notIn",
            value: ["silver", "gold", "platinum"],
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the isNull operator", () => {
        const context: PolicyContext = { canceledAt: null };
        const node: ConditionLeafNode = {
            field: "canceledAt",
            op: "isNull",
            value: null,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the isNotNull operator", () => {
        const context: PolicyContext = { approvedAt: new Date("2026-01-01") };
        const node: ConditionLeafNode = {
            field: "approvedAt",
            op: "isNotNull",
            value: null,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates AND", () => {
        const context: PolicyContext = {
            status: "ACTIVE",
            amount: 120,
        };

        const node = {
            and: [
                { field: "status", op: "eq", value: "ACTIVE" },
                { field: "amount", op: "gte", value: 100 },
            ],
        } as const;

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates the last AND branch only once", () => {
        let amountReads = 0;
        const context = {
            status: "ACTIVE",
            get amount() {
                amountReads += 1;
                return 120;
            },
        } as PolicyContext;

        const node = {
            and: [
                { field: "status", op: "eq", value: "ACTIVE" },
                { field: "amount", op: "gte", value: 100 },
            ],
        } as const;

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
        expect(amountReads).toBe(1);
    });

    it("evaluates OR", () => {
        const context: PolicyContext = {
            status: "PENDING",
            tier: "gold",
        };

        const node = {
            or: [
                { field: "status", op: "eq", value: "ACTIVE" },
                { field: "tier", op: "eq", value: "gold" },
            ],
        } as const;

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("returns Result.err when OR receives no children", () => {
        const result = evaluateCondition({ or: [] }, {}, options);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "EMPTY_OR_CONDITION: OR nodes must contain at least one child condition",
        );
    });

    it("evaluates NOT", () => {
        const context: PolicyContext = { isDebtPrescribed: false };
        const node = {
            not: { field: "isDebtPrescribed", op: "eq", value: true },
        } as const;

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

    it("evaluates recursive nesting", () => {
        const context: PolicyContext = {
            status: "ACTIVE",
            amount: 200,
            isSuspended: false,
        };

        const node = {
            and: [
                { field: "status", op: "eq", value: "ACTIVE" },
                {
                    or: [
                        { field: "amount", op: "gte", value: 150 },
                        { field: "amount", op: "lt", value: 20 },
                    ],
                },
                { not: { field: "isSuspended", op: "eq", value: true } },
            ],
        } as const;

        const result = evaluateCondition(node, context, options);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(true);
    });

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
            'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC string operands',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "INVALID_DATE_OPERAND",
                message:
                    'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC string operands',
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
            'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC string operands',
        );
        expect(reporter.warn).not.toHaveBeenCalled();
        expect(reporter.error).toHaveBeenCalledOnce();
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({
                level: "error",
                tag: "INVALID_DATE_OPERAND",
                message:
                    'INVALID_DATE_OPERAND: "dueDate" with operator "gt" requires Date or ISO 8601 UTC string operands',
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
});
