import type { AppError } from "../../errors/index.js";
import type {
    EvaluateInput,
    PolicyEvaluationResult,
} from "../../policies/index.js";
import type { Result } from "../../result/result.js";

type PolicyEvaluationInput = EvaluateInput;
type PolicyEvaluationOutput = PolicyEvaluationResult;

/**
 * Failure surfaced by {@link PolicyPort.evaluate}.
 *
 * This is the *post-mapping* boundary: the structured `PolicyEvaluationError`
 * union produced inside the policies module is expected to have already been
 * translated into an {@link AppError} (e.g. via `mapPolicyEvaluationError`)
 * before it reaches a use case. Named distinctly from the policies-layer
 * `PolicyEvaluationError` to avoid a collision on the public surface.
 */
type PolicyPortError = AppError;

interface PolicyPort {
    evaluate(
        input: PolicyEvaluationInput,
    ): Promise<Result<PolicyEvaluationOutput, PolicyPortError>>;
}

export type {
    PolicyEvaluationInput,
    PolicyEvaluationOutput,
    PolicyPort,
    PolicyPortError,
};
