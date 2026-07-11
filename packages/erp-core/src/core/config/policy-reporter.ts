import type { ConditionEvaluationReport } from "../policies/engines/condition-evaluator-reporter.js";
import type {
    PolicyDecisionId,
    PolicyDefinitionId,
} from "../policies/policy-ids.js";

// ─── Event kinds ─────────────────────────────────────────────────────────────

export type ConditionEvalEvent = ConditionEvaluationReport & {
    readonly kind: "condition-eval";
};

export interface PolicyResolutionEvent {
    readonly kind: "policy-resolution";
    readonly level: "info";
    readonly policyKey: string;
    readonly definitionId: PolicyDefinitionId;
    readonly policyVersion: string;
    readonly engineKind: "GATE" | "COMPUTE";
    readonly engineVersion: number;
    readonly occurredAt: Date;
}

export interface PolicyEvaluationFailedEvent {
    readonly kind: "policy-evaluation-failed";
    readonly level: "error";
    readonly policyKey: string | undefined;
    readonly errorKind: string;
    readonly message: string;
    readonly cause: string;
    readonly occurredAt: Date;
}

export interface PolicyEvaluationCompletedEvent {
    readonly kind: "policy-evaluation-completed";
    readonly level: "info";
    readonly policyKey: string;
    readonly decisionId: PolicyDecisionId;
    readonly engineKind: "GATE" | "COMPUTE";
    readonly occurredAt: Date;
}

/**
 * A resolved ABAC decision (both PERMIT and DENY). Emitted best-effort by the
 * `AbacAuthorizer` so a host can build an authorization audit trail without an
 * adapter of its own; silent by default like every other event. Types are kept
 * self-contained (no import from `core/abac`) to avoid a config→abac cycle.
 */
export interface AbacDecisionEvent {
    readonly kind: "abac-decision";
    readonly level: "info";
    readonly action: string;
    readonly resource?: { readonly type: string; readonly id?: string };
    readonly actorId: string;
    readonly effect: "PERMIT" | "DENY";
    /** Deciding rule id, or `"<default>"` / `"<default-deny>"` when the set's default decided. */
    readonly decidingRuleId: string;
    readonly decidingRuleVersion?: number;
    readonly algorithm: string;
    readonly occurredAt: Date;
}

export type PolicyEvent =
    | ConditionEvalEvent
    | PolicyResolutionEvent
    | PolicyEvaluationFailedEvent
    | PolicyEvaluationCompletedEvent
    | AbacDecisionEvent;

// ─── Reporter interface ───────────────────────────────────────────────────────

/**
 * Sink for policy telemetry. The core never logs on its own — it hands typed
 * events here and a host implementation decides what to do with them.
 *
 * Redaction is the host's responsibility: a `condition-eval` event carries the
 * evaluated field path and value in `details` (e.g. `student.flags.*`), so in
 * an ERP those payloads can contain PII. Sanitize before persisting or shipping
 * events off-box; the core deliberately keeps no redaction seam so it stays
 * pure and unopinionated about your logging stack.
 */
export interface PolicyReporter {
    report(event: PolicyEvent): void;
}

// ─── Re-export only what external consumers need for event construction ───────

export type {
    ConditionEvaluationReport,
    ConditionEvaluationReportTag,
} from "../policies/engines/condition-evaluator-reporter.js";
