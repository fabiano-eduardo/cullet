import type { AppError } from "../../errors/index.js";
import type {
    EvaluateInput,
    PolicyEvaluationResult,
} from "../../policies/index.js";
import type { Result } from "../../result/result.js";

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
