import type { Outcome } from "../../result/outcome";
import type { Result } from "../../result/result";

import type { ComputePayload } from "./compute-payload";
import type { PolicyContext, PolicyViolation } from "./gate-types";

// ─── Compute outcome (business decision) ────────────────────────────────────

export type ComputeStatus = "OK" | "NOT_APPLICABLE" | "ERROR";

export interface ComputeOutcomeData {
  readonly values: unknown | null;
  readonly violations: readonly PolicyViolation[];
}

/** Semantic outcome of a COMPUTE policy evaluation. */
export type ComputeOutcome = Outcome<ComputeStatus, ComputeOutcomeData>;

/**
 * Pure compute operation: receives a resolved value + context, returns a
 * business decision. Registration metadata (policy key/version) lives outside
 * this contract.
 *
 * The engine resolves the structural payload before calling the evaluator:
 * - `params` -> `payload.data`
 * - `decision-table` -> matching `rule.result` or `default`
 *
 * Result wraps technical failures (invalid value shape).
 * Outcome carries the semantic business decision.
 */
export interface ComputeEvaluator {
  evaluate(
    resolvedValue: unknown,
    context: Record<string, unknown>,
  ): Result<ComputeOutcome, string>;
}

export interface ComputeEvaluatorRegistration {
  readonly policyKey: string;
  readonly version: number;
  readonly evaluator: ComputeEvaluator;
}

export interface VersionedComputeEngine {
  readonly version: number;
  evaluate(
    payload: ComputePayload,
    context: PolicyContext,
    evaluator: ComputeEvaluator,
  ): Result<ComputeOutcome, string>;
}
