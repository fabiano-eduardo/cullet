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

    it("treats a present undefined value as null-ish for isNull/isNotNull", () => {
        const context: PolicyContext = { student: { name: undefined } };

        const isNull = evaluateCondition(
            { field: "student.name", op: "isNull", value: null },
            context,
            options,
        );
        const isNotNull = evaluateCondition(
            { field: "student.name", op: "isNotNull", value: null },
            context,
            options,
        );

        expect(isNull.getOrNull()).toBe(true);
        expect(isNotNull.getOrNull()).toBe(false);
    });

    it("reports INVALID_DATE_OPERAND (not numeric) for a date-like but non-canonical string operand", () => {
        const reporter = {
            warn: vi.fn<(report: ConditionEvaluationReport) => void>(),
            error: vi.fn<(report: ConditionEvaluationReport) => void>(),
        };
        const context: PolicyContext = {
            dueDate: new Date("2026-02-01T00:00:00.000Z"),
        };
        // Valid instant, wrong shape: no milliseconds. Must not be misreported
        // as a numeric-operand error.
        const node: ConditionLeafNode = {
            field: "dueDate",
            op: "gt",
            value: "2026-01-01T00:00:00Z",
        };

        const result = evaluateCondition(node, context, {
            reporter,
            engineVersion: 1,
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("INVALID_DATE_OPERAND");
        expect(result.errorOrNull()).toContain("YYYY-MM-DDTHH:mm:ss.SSSZ");
        expect(reporter.error).toHaveBeenCalledWith(
            expect.objectContaining({ tag: "INVALID_DATE_OPERAND" }),
        );
    });

    it("reports INVALID_NUMERIC_OPERAND for a NaN operand instead of silently not matching", () => {
        const context: PolicyContext = { amount: Number.NaN };
        const node: ConditionLeafNode = {
            field: "amount",
            op: "gt",
            value: 10,
        };

        const result = evaluateCondition(node, context, options);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain("INVALID_NUMERIC_OPERAND");
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

    it("returns Result.err when AND receives no children", () => {
        const result = evaluateCondition({ and: [] }, {}, options);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "EMPTY_AND_CONDITION: AND nodes must contain at least one child condition",
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
});

describe("ConditionEvaluatorV1.extractFields", () => {
    it("collects field paths across leaf, and/or and not nodes", () => {
        const node: ConditionNode = {
            and: [
                { field: "a.x", op: "eq", value: 1 },
                {
                    or: [
                        { field: "b.y", op: "gt", value: 2 },
                        { not: { field: "c.z", op: "isNull", value: null } },
                    ],
                },
            ],
        };

        expect(ConditionEvaluatorV1.extractFields(node)).toEqual([
            "a.x",
            "b.y",
            "c.z",
        ]);
    });
});
