export interface ConditionEvaluationCause {
    readonly name: string;
    readonly message: string;
}

export type ConditionEvaluationReportLevel = "warn" | "error";

export type ConditionEvaluationReportTag =
    | "MISSING_CONTEXT_FIELD"
    | "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED"
    | "NULLISH_DATE_OPERAND_NOT_ALLOWED"
    | "INVALID_DATE_OPERAND"
    | "INVALID_NUMERIC_OPERAND"
    | "INVALID_SET_OPERAND"
    | "CONDITION_EVAL_THREW";

export interface ConditionEvaluationReport {
    readonly occurredAt: Date;
    readonly level: ConditionEvaluationReportLevel;
    readonly tag: ConditionEvaluationReportTag;
    readonly message: string;
    readonly engineVersion: number;
    readonly details: Readonly<Record<string, unknown>>;
}

export interface ConditionEvaluatorReporter {
    warn(report: ConditionEvaluationReport): void;
    error(report: ConditionEvaluationReport): void;
}

// Either fully silent (no reporter, no version stamp) or fully observable
// (reporter paired with engineVersion so every report carries its origin).
export type ConditionEvaluationOptions = {
    readonly reporter: ConditionEvaluatorReporter;
    readonly engineVersion: number;
};
