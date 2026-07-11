import { PolicyContextPath } from "../../context/index.js";
import { Result } from "../../../result/result.js";

import {
    CANONICAL_UTC_DATE_FORMAT,
    containsInvalidDate,
    evaluateRelationalNumbers,
    normalizeDateOperand,
    parseComparableDate,
    type RelationalOperator,
} from "./condition-date-operands.js";
import type {
    ConditionAndNode,
    ConditionLeafNode,
    ConditionNode,
    ConditionNotNode,
    ConditionOp,
    ConditionOrNode,
} from "./condition-types.js";
import type {
    ConditionEvaluationOptions,
    ConditionEvaluationReport,
} from "../condition-evaluator-reporter.js";
import type { PolicyContext } from "../gate-types.js";

const CONDITION_EVAL_THROWN_TAG = "CONDITION_EVAL_THREW";
const NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG =
    "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED";
const NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG = "NULLISH_DATE_OPERAND_NOT_ALLOWED";
const INVALID_DATE_OPERAND_TAG = "INVALID_DATE_OPERAND";
const INVALID_NUMERIC_OPERAND_TAG = "INVALID_NUMERIC_OPERAND";
const INVALID_SET_OPERAND_TAG = "INVALID_SET_OPERAND";
const EMPTY_OR_CONDITION_TAG = "EMPTY_OR_CONDITION";
const EMPTY_AND_CONDITION_TAG = "EMPTY_AND_CONDITION";

export interface ConditionEvaluationTrace {
    readonly conditionPath: string;
    readonly decisiveNode: ConditionNode;
    readonly lastEvaluatedLeaf: ConditionLeafNode;
    readonly lastEvaluatedLeafPath: string;
    readonly lastEvaluatedLeafResult: boolean;
}

export interface TracedConditionEvaluation {
    readonly matched: boolean;
    readonly trace: ConditionEvaluationTrace;
}

export class ConditionEvaluatorV1 {
    constructor(
        private readonly context: PolicyContext,
        private readonly options: ConditionEvaluationOptions,
    ) {}

    private static isLeafNode(node: ConditionNode): node is ConditionLeafNode {
        return "field" in node && "op" in node;
    }

    private static isAndNode(node: ConditionNode): node is ConditionAndNode {
        return "and" in node;
    }

    private static isOrNode(node: ConditionNode): node is ConditionOrNode {
        return "or" in node;
    }

    private static isNotNode(node: ConditionNode): node is ConditionNotNode {
        return "not" in node;
    }

    private static isRelationalOperator(
        op: ConditionOp,
    ): op is RelationalOperator {
        return op === "gt" || op === "gte" || op === "lt" || op === "lte";
    }

    private static describeError(error: unknown): {
        name: string;
        message: string;
    } {
        if (error instanceof Error) {
            return { name: error.name, message: error.message };
        }

        return { name: "NonErrorThrown", message: String(error) };
    }

    private static invalidDateOperandMessage(node: ConditionLeafNode): string {
        return `${INVALID_DATE_OPERAND_TAG}: "${node.field}" with operator "${node.op}" requires Date or ISO 8601 UTC (${CANONICAL_UTC_DATE_FORMAT}) string operands`;
    }

    private buildReport(params: {
        readonly level: ConditionEvaluationReport["level"];
        readonly tag: ConditionEvaluationReport["tag"];
        readonly message: string;
        readonly details: Readonly<Record<string, unknown>>;
    }): ConditionEvaluationReport {
        return {
            occurredAt: new Date(),
            level: params.level,
            tag: params.tag,
            message: params.message,
            engineVersion: this.options.engineVersion,
            details: params.details,
        };
    }

    // Single reporting seam for every leaf-level operand error. Collapses the
    // formerly per-tag report methods, whose only real difference was the tag,
    // message, and (for the nullish cases) an `allowNull` detail.
    private reportLeafError(
        tag: ConditionEvaluationReport["tag"],
        message: string,
        node: ConditionLeafNode,
        actual: unknown,
        extra?: Readonly<Record<string, unknown>>,
    ): Result<boolean, string> {
        this.options.reporter.error(
            this.buildReport({
                level: "error",
                tag,
                message,
                details: {
                    field: node.field,
                    op: node.op,
                    actual,
                    expected: node.value,
                    ...extra,
                    node,
                },
            }),
        );

        return Result.err(message);
    }

    private conditionEvalErr<TValue>(
        node: ConditionNode,
        error: unknown,
    ): Result<TValue, string> {
        const cause = ConditionEvaluatorV1.describeError(error);
        const message = `${CONDITION_EVAL_THROWN_TAG}: ${cause.name}: ${cause.message}`;

        this.options.reporter.error(
            this.buildReport({
                level: "error",
                tag: CONDITION_EVAL_THROWN_TAG,
                message,
                details: { node, cause },
            }),
        );

        return Result.err(message);
    }

    private evaluateDateRelationalNode(
        node: ConditionLeafNode,
        actual: unknown,
    ): Result<boolean, string> | null {
        if (!ConditionEvaluatorV1.isRelationalOperator(node.op)) {
            return null;
        }

        const actualDate = parseComparableDate(actual);
        const expectedDate = parseComparableDate(node.value);

        // Neither operand is date-shaped: let the numeric path handle it.
        if (actualDate === null && expectedDate === null) {
            return null;
        }

        const allowsNull = node.allowNull === true;
        if (actual === null && allowsNull) {
            return Result.ok(false);
        }

        if (actual === null || actual === undefined) {
            const resolved = actual === null ? "null" : "undefined";
            return this.reportLeafError(
                NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG,
                `${NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG}: "${node.field}" resolved to ${resolved} for date comparison operator "${node.op}"`,
                node,
                actual,
                { allowNull: allowsNull },
            );
        }

        if (
            actualDate === null ||
            actualDate.isErr() ||
            expectedDate === null ||
            expectedDate.isErr()
        ) {
            return this.reportLeafError(
                INVALID_DATE_OPERAND_TAG,
                ConditionEvaluatorV1.invalidDateOperandMessage(node),
                node,
                actual,
            );
        }

        return Result.ok(
            evaluateRelationalNumbers(
                actualDate.getOrNull()!.getTime(),
                node.op,
                expectedDate.getOrNull()!.getTime(),
            ),
        );
    }

    private evaluateOperator(
        actual: unknown,
        op: ConditionOp,
        expected: unknown,
    ): boolean {
        switch (op) {
            case "eq":
                return actual === expected;
            case "neq":
                return actual !== expected;
            case "gt":
            case "gte":
            case "lt":
            case "lte":
                return (
                    typeof actual === "number" &&
                    typeof expected === "number" &&
                    evaluateRelationalNumbers(actual, op, expected)
                );
            case "in":
                return Array.isArray(expected) && expected.includes(actual);
            case "notIn":
                return Array.isArray(expected) && !expected.includes(actual);
            case "isNull":
                return actual === null || actual === undefined;
            case "isNotNull":
                return actual !== null && actual !== undefined;
        }
    }

    private evaluateNumericRelationalNode(
        node: ConditionLeafNode,
        actual: unknown,
    ): Result<boolean, string> {
        const allowsNull = node.allowNull === true;
        if (actual === undefined || (actual === null && !allowsNull)) {
            const resolved = actual === null ? "null" : "undefined";
            return this.reportLeafError(
                NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG,
                `${NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG}: "${node.field}" resolved to ${resolved} for numeric operator "${node.op}"`,
                node,
                actual,
                { allowNull: allowsNull },
            );
        }

        // null + allowNull: a relational comparison against a missing value
        // never matches.
        if (actual === null) {
            return Result.ok(false);
        }

        // Both operands must be finite numbers. A present but wrong-typed or
        // NaN operand is a context/configuration error, surfaced like the date
        // path instead of silently collapsing to "no match".
        if (
            typeof actual !== "number" ||
            Number.isNaN(actual) ||
            typeof node.value !== "number" ||
            Number.isNaN(node.value)
        ) {
            return this.reportLeafError(
                INVALID_NUMERIC_OPERAND_TAG,
                `${INVALID_NUMERIC_OPERAND_TAG}: "${node.field}" with operator "${node.op}" requires numeric operands`,
                node,
                actual,
            );
        }

        return Result.ok(this.evaluateOperator(actual, node.op, node.value));
    }

    private evaluateLeafNode(node: ConditionLeafNode): Result<boolean, string> {
        const actualResult = PolicyContextPath.getOrAbsent(
            this.context,
            node.field,
        );
        if (actualResult.isErr()) {
            const message = `MISSING_CONTEXT_FIELD: "${node.field}" not found in context`;
            this.options.reporter.warn(
                this.buildReport({
                    level: "warn",
                    tag: "MISSING_CONTEXT_FIELD",
                    message,
                    details: { field: node.field, node },
                }),
            );

            return Result.err(message);
        }

        try {
            const actual = actualResult.getOrThrow();
            if (ConditionEvaluatorV1.isRelationalOperator(node.op)) {
                const dateResult = this.evaluateDateRelationalNode(
                    node,
                    actual,
                );
                if (dateResult !== null) {
                    return dateResult;
                }

                return this.evaluateNumericRelationalNode(node, actual);
            }

            if (
                (node.op === "in" || node.op === "notIn") &&
                !Array.isArray(node.value)
            ) {
                return this.reportLeafError(
                    INVALID_SET_OPERAND_TAG,
                    `${INVALID_SET_OPERAND_TAG}: "${node.field}" with operator "${node.op}" requires an array operand`,
                    node,
                    actual,
                );
            }

            if (
                node.op === "eq" ||
                node.op === "neq" ||
                node.op === "in" ||
                node.op === "notIn"
            ) {
                // A Date operand would otherwise compare by reference and
                // silently never match. Normalize valid Dates (either side,
                // including set items) to their ISO string; an invalid Date is
                // a context/configuration error, like the relational path.
                if (
                    containsInvalidDate(actual) ||
                    containsInvalidDate(node.value)
                ) {
                    return this.reportLeafError(
                        INVALID_DATE_OPERAND_TAG,
                        ConditionEvaluatorV1.invalidDateOperandMessage(node),
                        node,
                        actual,
                    );
                }

                return Result.ok(
                    this.evaluateOperator(
                        normalizeDateOperand(actual),
                        node.op,
                        normalizeDateOperand(node.value),
                    ),
                );
            }

            return Result.ok(
                this.evaluateOperator(actual, node.op, node.value),
            );
        } catch (error) {
            return this.conditionEvalErr(node, error);
        }
    }

    private buildTrace(params: {
        readonly conditionPath: string;
        readonly decisiveNode: ConditionNode;
        readonly lastEvaluatedLeaf: ConditionLeafNode;
        readonly lastEvaluatedLeafPath: string;
        readonly lastEvaluatedLeafResult: boolean;
    }): ConditionEvaluationTrace {
        return {
            conditionPath: params.conditionPath,
            decisiveNode: params.decisiveNode,
            lastEvaluatedLeaf: params.lastEvaluatedLeaf,
            lastEvaluatedLeafPath: params.lastEvaluatedLeafPath,
            lastEvaluatedLeafResult: params.lastEvaluatedLeafResult,
        };
    }

    private evaluateWithTraceInternal(
        node: ConditionNode,
        path: string,
    ): Result<TracedConditionEvaluation, string> {
        if (ConditionEvaluatorV1.isLeafNode(node)) {
            const leafResult = this.evaluateLeafNode(node);
            if (leafResult.isErr()) {
                return Result.err(leafResult.errorOrNull()!);
            }

            const matched = leafResult.getOrNull()!;
            return Result.ok({
                matched,
                trace: this.buildTrace({
                    conditionPath: path,
                    decisiveNode: node,
                    lastEvaluatedLeaf: node,
                    lastEvaluatedLeafPath: path,
                    lastEvaluatedLeafResult: matched,
                }),
            });
        }

        if (ConditionEvaluatorV1.isAndNode(node)) {
            if (node.and.length === 0) {
                return Result.err(
                    `${EMPTY_AND_CONDITION_TAG}: AND nodes must contain at least one child condition`,
                );
            }

            let lastTracedChild: TracedConditionEvaluation | null = null;

            for (const [index, child] of node.and.entries()) {
                const childPath = `${path}.and[${index}]`;
                const childResult = this.evaluateWithTraceInternal(
                    child,
                    childPath,
                );
                if (childResult.isErr()) {
                    return Result.err(childResult.errorOrNull()!);
                }

                const tracedChild = childResult.getOrNull()!;
                lastTracedChild = tracedChild;
                if (!tracedChild.matched) {
                    return Result.ok({
                        matched: false,
                        trace: this.buildTrace({
                            conditionPath: childPath,
                            decisiveNode: child,
                            lastEvaluatedLeaf:
                                tracedChild.trace.lastEvaluatedLeaf,
                            lastEvaluatedLeafPath:
                                tracedChild.trace.lastEvaluatedLeafPath,
                            lastEvaluatedLeafResult:
                                tracedChild.trace.lastEvaluatedLeafResult,
                        }),
                    });
                }
            }

            return Result.ok({
                matched: true,
                trace: lastTracedChild!.trace,
            });
        }

        if (ConditionEvaluatorV1.isOrNode(node)) {
            let lastTrace: ConditionEvaluationTrace | null = null;

            for (const [index, child] of node.or.entries()) {
                const childResult = this.evaluateWithTraceInternal(
                    child,
                    `${path}.or[${index}]`,
                );
                if (childResult.isErr()) {
                    return Result.err(childResult.errorOrNull()!);
                }

                const tracedChild = childResult.getOrNull()!;
                lastTrace = tracedChild.trace;
                if (tracedChild.matched) {
                    return Result.ok({
                        matched: true,
                        trace: tracedChild.trace,
                    });
                }
            }

            if (lastTrace === null) {
                return Result.err(
                    `${EMPTY_OR_CONDITION_TAG}: OR nodes must contain at least one child condition`,
                );
            }

            return Result.ok({ matched: false, trace: lastTrace! });
        }

        if (ConditionEvaluatorV1.isNotNode(node)) {
            const childPath = `${path}.not`;
            const childResult = this.evaluateWithTraceInternal(
                node.not,
                childPath,
            );
            if (childResult.isErr()) {
                return Result.err(childResult.errorOrNull()!);
            }

            const tracedChild = childResult.getOrNull()!;
            return Result.ok({
                matched: !tracedChild.matched,
                trace: this.buildTrace({
                    conditionPath: path,
                    decisiveNode: node,
                    lastEvaluatedLeaf: tracedChild.trace.lastEvaluatedLeaf,
                    lastEvaluatedLeafPath:
                        tracedChild.trace.lastEvaluatedLeafPath,
                    lastEvaluatedLeafResult:
                        tracedChild.trace.lastEvaluatedLeafResult,
                }),
            });
        }

        return this.conditionEvalErr(
            node,
            new TypeError("Invalid condition node shape"),
        );
    }

    evaluate(node: ConditionNode): Result<boolean, string> {
        try {
            const result = this.evaluateWithTraceInternal(node, "$");
            if (result.isErr()) {
                return Result.err(result.errorOrNull()!);
            }

            return Result.ok(result.getOrNull()!.matched);
        } catch (error) {
            return this.conditionEvalErr(node, error);
        }
    }

    evaluateWithTrace(
        node: ConditionNode,
    ): Result<TracedConditionEvaluation, string> {
        try {
            return this.evaluateWithTraceInternal(node, "$");
        } catch (error) {
            return this.conditionEvalErr(node, error);
        }
    }

    static extractFields(node: ConditionNode): string[] {
        if (ConditionEvaluatorV1.isLeafNode(node)) {
            return [node.field];
        }

        if (ConditionEvaluatorV1.isAndNode(node)) {
            return node.and.flatMap((child) =>
                ConditionEvaluatorV1.extractFields(child),
            );
        }

        if (ConditionEvaluatorV1.isOrNode(node)) {
            return node.or.flatMap((child) =>
                ConditionEvaluatorV1.extractFields(child),
            );
        }

        if (ConditionEvaluatorV1.isNotNode(node)) {
            return ConditionEvaluatorV1.extractFields(node.not);
        }

        return [];
    }
}
