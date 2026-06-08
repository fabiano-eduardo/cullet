import type { AppError } from "../../errors";
import type { EvaluateInput, PolicyEvaluationResult } from "../../policies";
import type { Result } from "../../result/result";

type PolicyEvaluationInput = EvaluateInput;
type PolicyEvaluationOutput = PolicyEvaluationResult;
type PolicyEvaluationError = AppError;

interface PolicyPort {
    evaluate(
        input: PolicyEvaluationInput,
    ): Promise<Result<PolicyEvaluationOutput, PolicyEvaluationError>>;
}

export type {
    PolicyEvaluationError,
    PolicyEvaluationInput,
    PolicyEvaluationOutput,
    PolicyPort,
};
