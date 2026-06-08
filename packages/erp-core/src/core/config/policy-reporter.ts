import type { ConditionEvaluationReport } from "../policies/engines/condition-evaluator-reporter";
import type {
    PolicyDecisionId,
    PolicyDefinitionId,
} from "../policies/policy-ids";

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

export type PolicyEvent =
    | ConditionEvalEvent
    | PolicyResolutionEvent
    | PolicyEvaluationFailedEvent
    | PolicyEvaluationCompletedEvent;

// ─── Reporter interface ───────────────────────────────────────────────────────

export interface PolicyReporter {
    report(event: PolicyEvent): void;
}

// ─── Re-export only what external consumers need for event construction ───────

export type {
    ConditionEvaluationReport,
    ConditionEvaluationReportTag,
} from "../policies/engines/condition-evaluator-reporter";
