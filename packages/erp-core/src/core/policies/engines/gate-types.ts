import type { Outcome } from "../../result/outcome";
import type { Result } from "../../result/result";

import type { GatePayload } from "./gate-payload";

// ─── Shared gate types (version-agnostic) ───────────────────────────────────

export type PolicyContext = Record<string, unknown>;

export interface GateTraceLeafSnapshot {
    readonly kind: "LEAF";
    readonly field: string;
    readonly op: string;
    readonly allowNull?: true;
}

export type GateTraceNodeSnapshot =
    | GateTraceLeafSnapshot
    | {
          readonly kind: "AND" | "OR";
          readonly childCount: number;
      }
    | {
          readonly kind: "NOT";
      };

export interface GateViolationTrace {
    readonly conditionPath: string;
    readonly decisiveNode: GateTraceNodeSnapshot;
    readonly lastEvaluatedLeaf: GateTraceLeafSnapshot;
    readonly lastEvaluatedLeafPath: string;
    readonly lastEvaluatedLeafResult: boolean;
    readonly field: string;
    readonly op: string;
}

export interface PolicyViolation {
    readonly code: string;
    readonly message: string;
    readonly trace?: GateViolationTrace;
}

export type GateStatus = "ALLOW" | "DENY";

export interface GateOutcomeData {
    readonly violations: readonly PolicyViolation[];
}

/** Semantic outcome of a GATE policy evaluation. */
export type GateOutcome = Outcome<GateStatus, GateOutcomeData>;

/**
 * Contract every versioned gate engine must satisfy.
 * Receives an already-parsed `GatePayload`; parsing from raw `unknown` is
 * the registry's responsibility via `parseGatePayload`.
 */
export interface VersionedGateEngine {
    readonly version: number;
    evaluate(
        payload: GatePayload,
        context: PolicyContext,
    ): Result<GateOutcome, string>;
}
