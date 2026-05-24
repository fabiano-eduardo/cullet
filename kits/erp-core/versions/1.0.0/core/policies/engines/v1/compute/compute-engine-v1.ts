import { type CoreConfig, coreConfig } from '../../../../config';
import { Result } from '../../../../result/result';

import type { ComputePayloadV1 as ComputePayload } from './compute-payload.schema';
import { DecisionTableResolverV1 } from './resolve-decision-table-v1';
import type {
	ComputeEvaluator,
	ComputeOutcome,
	VersionedComputeEngine,
} from '../../compute-types';
import type { PolicyContext } from '../../gate-types';

// ─── Compute engine v1 ───────────────────────────────────────────────────────

const COMPUTE_ENGINE_VERSION = 1;

export class ComputeEngineV1 implements VersionedComputeEngine {
	readonly version = COMPUTE_ENGINE_VERSION;
	private readonly coreConfig: CoreConfig;

	constructor(params: { readonly coreConfig?: CoreConfig } = {}) {
		this.coreConfig = params.coreConfig ?? coreConfig;
	}

	/**
	 * Evaluates an already-parsed ComputePayload against a context.
	 * Pure function — no side effects.
	 *
	 * For `params`: forwards `payload.data` directly to the evaluator.
	 * For `decision-table`: evaluates the rules in order and passes the `result`
	 * of the first one that satisfies its conditions, or `default` if none match.
	 *
	 * The evaluator is responsible for validating and transforming the final value.
	 */
	evaluate(
		payload: ComputePayload,
		context: PolicyContext,
		evaluator: ComputeEvaluator
	): Result<ComputeOutcome, string> {
		if (payload.type === 'params') {
			return evaluator.evaluate(payload.data, context);
		}

		const resolvedResult = DecisionTableResolverV1.resolve(
			payload,
			context,
			this.coreConfig.getConditionEvaluationOptions(
				COMPUTE_ENGINE_VERSION
			)
		);
		if (resolvedResult.isErr()) {
			return Result.err(resolvedResult.errorOrNull()!);
		}

		return evaluator.evaluate(resolvedResult.getOrNull()!, context);
	}
}
