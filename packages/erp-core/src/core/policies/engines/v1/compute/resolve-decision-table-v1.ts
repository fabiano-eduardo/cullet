import { Result } from "../../../../result/result";

import type { ConditionEvaluationOptions } from "../../condition-evaluator-reporter";

import { ConditionEvaluatorV1 } from "../condition-evaluator";
import type { ComputeDecisionTablePayload } from "./compute-payload.schema";

const COMPUTE_CONDITION_EVAL_FAILED_TAG = "COMPUTE_CONDITION_EVAL_FAILED";

export class DecisionTableResolverV1 {
    constructor(
        private readonly payload: ComputeDecisionTablePayload,
        private readonly context: Record<string, unknown>,
        private readonly conditionEvaluationOptions: ConditionEvaluationOptions,
    ) {}

    private wrapConditionEvaluationError(
        error: string,
    ): Result<unknown, string> {
        return Result.err(`${COMPUTE_CONDITION_EVAL_FAILED_TAG}: ${error}`);
    }

    resolve(): Result<unknown, string> {
        const evaluator = new ConditionEvaluatorV1(
            this.context,
            this.conditionEvaluationOptions,
        );

        for (const rule of this.payload.rules) {
            const conditionResult = evaluator.evaluate(rule.conditions);
            if (conditionResult.isErr()) {
                return this.wrapConditionEvaluationError(
                    conditionResult.errorOrNull()!,
                );
            }

            if (conditionResult.getOrNull()) {
                return Result.ok(rule.result);
            }
        }

        return Result.ok(this.payload.default);
    }

    static resolve(
        payload: ComputeDecisionTablePayload,
        context: Record<string, unknown>,
        conditionEvaluationOptions: ConditionEvaluationOptions,
    ): Result<unknown, string> {
        return new DecisionTableResolverV1(
            payload,
            context,
            conditionEvaluationOptions,
        ).resolve();
    }
}
