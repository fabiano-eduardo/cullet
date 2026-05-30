import { type CoreConfig, coreConfig } from "../../../../config";
import { Outcome } from "../../../../result/outcome";
import { Result } from "../../../../result/result";

import {
  ConditionEvaluatorV1,
  type TracedConditionEvaluation,
} from "../condition-evaluator";
import type { ConditionLeafNode, ConditionNode } from "../condition-types";
import type { GatePayload } from "../../gate-payload";
import type {
  GateOutcome,
  GateStatus,
  GateTraceLeafSnapshot,
  GateTraceNodeSnapshot,
  PolicyContext,
  PolicyViolation,
  VersionedGateEngine,
} from "../../gate-types";

// ─── Gate engine v1 ─────────────────────────────────────────────────────────

export class GateEngineV1 implements VersionedGateEngine {
  public readonly version = 1;
  private readonly coreConfig: CoreConfig;

  constructor(params: { readonly coreConfig?: CoreConfig } = {}) {
    this.coreConfig = params.coreConfig ?? coreConfig;
  }

  private allow(): Result<GateOutcome, string> {
    return Result.ok(Outcome.of("ALLOW", { violations: [] }));
  }

  private deny(violation: PolicyViolation): Result<GateOutcome, string> {
    return Result.ok(
      Outcome.of("DENY", {
        violations: [violation],
      }),
    );
  }

  private outcomeFromStatus(
    status: GateStatus,
    violation: PolicyViolation,
  ): Result<GateOutcome, string> {
    return status === "ALLOW" ? this.allow() : this.deny(violation);
  }

  private isLeafNode(node: ConditionNode): node is ConditionLeafNode {
    return "field" in node && "op" in node;
  }

  private toLeafSnapshot(node: ConditionLeafNode): GateTraceLeafSnapshot {
    return {
      kind: "LEAF",
      field: node.field,
      op: node.op,
      ...(node.allowNull === true ? { allowNull: true } : {}),
    };
  }

  private toNodeSnapshot(node: ConditionNode): GateTraceNodeSnapshot {
    if (this.isLeafNode(node)) {
      return this.toLeafSnapshot(node);
    }

    if ("and" in node) {
      return {
        kind: "AND",
        childCount: node.and.length,
      };
    }

    if ("or" in node) {
      return {
        kind: "OR",
        childCount: node.or.length,
      };
    }

    return {
      kind: "NOT",
    };
  }

  private buildDenyViolation(
    conditionResult: TracedConditionEvaluation,
  ): PolicyViolation {
    return {
      code: "DENY_CONDITION_MET",
      message: `Gate denied at ${conditionResult.trace.conditionPath}`,
      trace: {
        conditionPath: conditionResult.trace.conditionPath,
        decisiveNode: this.toNodeSnapshot(conditionResult.trace.decisiveNode),
        lastEvaluatedLeaf: this.toLeafSnapshot(
          conditionResult.trace.lastEvaluatedLeaf,
        ),
        lastEvaluatedLeafPath: conditionResult.trace.lastEvaluatedLeafPath,
        lastEvaluatedLeafResult: conditionResult.trace.lastEvaluatedLeafResult,
        field: conditionResult.trace.lastEvaluatedLeaf.field,
        op: conditionResult.trace.lastEvaluatedLeaf.op,
      },
    };
  }

  private normalizePayload(payload: GatePayload): {
    readonly allowIf: ConditionNode;
    readonly defaultOutcome: "ALLOW" | "DENY";
  } {
    if ("condition" in payload) {
      return {
        allowIf: payload.condition,
        defaultOutcome: "DENY",
      };
    }

    return payload;
  }

  /**
   * Evaluates a GATE payload against a context object.
   * Pure function — no side effects.
   *
   * Receives an already-parsed `GatePayload`; the registry is responsible
   * for parsing from raw `unknown` before calling this method.
   * Returns Result for technical failures (condition evaluation errors).
   * The Outcome inside carries the business decision (ALLOW/DENY).
   */
  evaluate(
    payload: GatePayload,
    context: PolicyContext,
  ): Result<GateOutcome, string> {
    const gatePayload = this.normalizePayload(payload);
    const conditionEvaluator = new ConditionEvaluatorV1(
      context,
      this.coreConfig.getConditionEvaluationOptions(this.version),
    );

    const isAllowedResult = conditionEvaluator.evaluateWithTrace(
      gatePayload.allowIf,
    );
    if (isAllowedResult.isErr()) {
      return Result.err(isAllowedResult.errorOrNull()!);
    }

    const isAllowed = isAllowedResult.getOrNull()!;
    if (isAllowed.matched) {
      return this.allow();
    }

    return this.outcomeFromStatus(
      gatePayload.defaultOutcome,
      this.buildDenyViolation(isAllowed),
    );
  }
}
