import { PolicyContextPath } from "../../context";
import { PolicyDateUtils } from "../../utils";
import { Result } from "../../../result/result";

import type {
  ConditionAndNode,
  ConditionLeafNode,
  ConditionNode,
  ConditionNotNode,
  ConditionOp,
  ConditionOrNode,
} from "./condition-types";
import type {
  ConditionEvaluationOptions,
  ConditionEvaluationReport,
} from "../condition-evaluator-reporter";
import type { PolicyContext } from "../gate-types";

const CONDITION_EVAL_THROWN_TAG = "CONDITION_EVAL_THREW";
const NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG =
  "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED";
const NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG = "NULLISH_DATE_OPERAND_NOT_ALLOWED";
const INVALID_DATE_OPERAND_TAG = "INVALID_DATE_OPERAND";
const EMPTY_OR_CONDITION_TAG = "EMPTY_OR_CONDITION";
const ISO_8601_UTC_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

type RelationalOperator = Extract<ConditionOp, "gt" | "gte" | "lt" | "lte">;

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
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      name: "NonErrorThrown",
      message: String(error),
    };
  }

  private static buildNullishNumericOperandMessage(
    node: ConditionLeafNode,
    actual: null | undefined,
  ): string {
    const resolvedValue = actual === null ? "null" : "undefined";

    return `${NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG}: "${node.field}" resolved to ${resolvedValue} for numeric operator "${node.op}"`;
  }

  private static buildNullishDateOperandMessage(
    node: ConditionLeafNode,
    actual: null | undefined,
  ): string {
    const resolvedValue = actual === null ? "null" : "undefined";

    return `${NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG}: "${node.field}" resolved to ${resolvedValue} for date comparison operator "${node.op}"`;
  }

  private static buildInvalidDateOperandMessage(
    node: ConditionLeafNode,
  ): string {
    return `${INVALID_DATE_OPERAND_TAG}: "${node.field}" with operator "${node.op}" requires Date or ISO 8601 UTC string operands`;
  }

  private static buildEmptyOrConditionMessage(): string {
    return `${EMPTY_OR_CONDITION_TAG}: OR nodes must contain at least one child condition`;
  }

  private static parseComparableDate(
    value: unknown,
  ): Result<Date, string> | null {
    if (value instanceof Date) {
      if (!PolicyDateUtils.isValid(value)) {
        return Result.err("Invalid Date instance");
      }

      return Result.ok(value);
    }

    if (typeof value !== "string" || !ISO_8601_UTC_DATE_PATTERN.test(value)) {
      return null;
    }

    const parsed = new Date(value);
    if (!PolicyDateUtils.isValid(parsed) || parsed.toISOString() !== value) {
      return Result.err("Invalid ISO 8601 UTC date string");
    }

    return Result.ok(parsed);
  }

  private static evaluateRelationalNumbers(
    actual: number,
    op: RelationalOperator,
    expected: number,
  ): boolean {
    switch (op) {
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
    }
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

  private reportDateOperandError(
    node: ConditionLeafNode,
    actual: unknown,
  ): Result<boolean, string> {
    const message = ConditionEvaluatorV1.buildInvalidDateOperandMessage(node);

    this.options.reporter.error(
      this.buildReport({
        level: "error",
        tag: INVALID_DATE_OPERAND_TAG,
        message,
        details: {
          field: node.field,
          op: node.op,
          actual,
          expected: node.value,
          node,
        },
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

    const actualDateResult = ConditionEvaluatorV1.parseComparableDate(actual);
    const expectedDateResult = ConditionEvaluatorV1.parseComparableDate(
      node.value,
    );

    if (actualDateResult === null && expectedDateResult === null) {
      return null;
    }

    const allowsNull = node.allowNull === true;

    if (actual === null) {
      if (allowsNull) {
        return Result.ok(false);
      }

      const message = ConditionEvaluatorV1.buildNullishDateOperandMessage(
        node,
        actual,
      );
      this.options.reporter.error(
        this.buildReport({
          level: "error",
          tag: NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG,
          message,
          details: {
            field: node.field,
            op: node.op,
            actual,
            expected: node.value,
            allowNull: allowsNull,
            node,
          },
        }),
      );

      return Result.err(message);
    }

    if (actual === undefined) {
      const message = ConditionEvaluatorV1.buildNullishDateOperandMessage(
        node,
        actual,
      );
      this.options.reporter.error(
        this.buildReport({
          level: "error",
          tag: NULLISH_DATE_OPERAND_NOT_ALLOWED_TAG,
          message,
          details: {
            field: node.field,
            op: node.op,
            actual,
            expected: node.value,
            allowNull: allowsNull,
            node,
          },
        }),
      );

      return Result.err(message);
    }

    if (
      actualDateResult === null ||
      actualDateResult.isErr() ||
      expectedDateResult === null ||
      expectedDateResult.isErr()
    ) {
      return this.reportDateOperandError(node, actual);
    }

    return Result.ok(
      ConditionEvaluatorV1.evaluateRelationalNumbers(
        actualDateResult.getOrNull()!.getTime(),
        node.op,
        expectedDateResult.getOrNull()!.getTime(),
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
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          ConditionEvaluatorV1.evaluateRelationalNumbers(actual, op, expected)
        );
      case "gte":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          ConditionEvaluatorV1.evaluateRelationalNumbers(actual, op, expected)
        );
      case "lt":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          ConditionEvaluatorV1.evaluateRelationalNumbers(actual, op, expected)
        );
      case "lte":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          ConditionEvaluatorV1.evaluateRelationalNumbers(actual, op, expected)
        );
      case "in":
        return Array.isArray(expected) && expected.includes(actual);
      case "notIn":
        return Array.isArray(expected) && !expected.includes(actual);
      case "isNull":
        return actual === null;
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
      const message = ConditionEvaluatorV1.buildNullishNumericOperandMessage(
        node,
        actual as null | undefined,
      );

      this.options.reporter.error(
        this.buildReport({
          level: "error",
          tag: NULLISH_NUMERIC_OPERAND_NOT_ALLOWED_TAG,
          message,
          details: {
            field: node.field,
            op: node.op,
            actual,
            expected: node.value,
            allowNull: allowsNull,
            node,
          },
        }),
      );

      return Result.err(message);
    }

    return Result.ok(this.evaluateOperator(actual, node.op, node.value));
  }

  private evaluateLeafNode(node: ConditionLeafNode): Result<boolean, string> {
    const actualResult = PolicyContextPath.getOrAbsent(
      this.context,
      node.field,
    );
    if (actualResult.isErr()) {
      this.options.reporter.warn(
        this.buildReport({
          level: "warn",
          tag: "MISSING_CONTEXT_FIELD",
          message: `MISSING_CONTEXT_FIELD: "${node.field}" not found in context`,
          details: { field: node.field, node },
        }),
      );

      return Result.err(
        `MISSING_CONTEXT_FIELD: "${node.field}" not found in context`,
      );
    }

    try {
      const actual = actualResult.getOrThrow();
      if (ConditionEvaluatorV1.isRelationalOperator(node.op)) {
        const dateResult = this.evaluateDateRelationalNode(node, actual);
        if (dateResult !== null) {
          return dateResult;
        }

        return this.evaluateNumericRelationalNode(node, actual);
      }

      return Result.ok(this.evaluateOperator(actual, node.op, node.value));
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
      let lastTracedChild: TracedConditionEvaluation | null = null;

      for (const [index, child] of node.and.entries()) {
        const childPath = `${path}.and[${index}]`;
        const childResult = this.evaluateWithTraceInternal(child, childPath);
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
              lastEvaluatedLeaf: tracedChild.trace.lastEvaluatedLeaf,
              lastEvaluatedLeafPath: tracedChild.trace.lastEvaluatedLeafPath,
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
        return Result.err(ConditionEvaluatorV1.buildEmptyOrConditionMessage());
      }

      return Result.ok({ matched: false, trace: lastTrace! });
    }

    if (ConditionEvaluatorV1.isNotNode(node)) {
      const childPath = `${path}.not`;
      const childResult = this.evaluateWithTraceInternal(node.not, childPath);
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
          lastEvaluatedLeafPath: tracedChild.trace.lastEvaluatedLeafPath,
          lastEvaluatedLeafResult: tracedChild.trace.lastEvaluatedLeafResult,
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
