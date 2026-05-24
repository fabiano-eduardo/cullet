import type { PolicyKind } from '../catalog';

// ─── Error Union ─────────────────────────────────────────────────────────────

export type PolicyEvaluationError =
	| {
			readonly kind: 'INVALID_CONTEXT';
			readonly stage:
				| 'SEED_VALIDATION'
				| 'AS_OF_DERIVATION'
				| 'CONTEXT_BUILD';
			readonly policyKey: string;
			readonly message: string;
			readonly cause: string;
	  }
	| {
			readonly kind: 'INVALID_POLICY_KEY';
			readonly rawPolicyKey: string;
			readonly message: string;
			readonly cause: string;
	  }
	| {
			readonly kind: 'POLICY_NOT_FOUND';
			readonly policyKey: string;
			readonly message: string;
			readonly cause: string;
	  }
	| {
			readonly kind: 'POLICY_DEFINITION_NOT_FOUND';
			readonly policyKey: string;
			readonly contextVersion: number;
			readonly asOf: Date;
			readonly message: string;
			readonly cause: string;
	  }
	| {
			readonly kind: 'POLICY_VARIANT_NOT_FOUND';
			readonly policyKey: string;
			readonly policyKind: PolicyKind;
			readonly payloadSchemaVersion: number;
			readonly gateEngineVersion?: number;
			readonly computeEngineVersion?: number;
			readonly message: string;
			readonly cause: string;
	  }
	| {
			readonly kind: 'ENGINE_FAILURE';
			readonly policyKey: string;
			readonly engine: PolicyKind;
			readonly engineVersion: number;
			readonly message: string;
			readonly cause: string;
	  };

// ─── Factory object ─────────────────────────────────────────────────────────

export class PolicyEvaluationErrors {
	static invalidContext(
		stage: Extract<
			PolicyEvaluationError,
			{ kind: 'INVALID_CONTEXT' }
		>['stage'],
		policyKey: string,
		cause: string
	): PolicyEvaluationError {
		return {
			kind: 'INVALID_CONTEXT',
			stage,
			policyKey,
			message: 'Policy evaluation context is invalid',
			cause,
		};
	}

	static invalidPolicyKey(
		rawPolicyKey: string,
		cause: string
	): PolicyEvaluationError {
		return {
			kind: 'INVALID_POLICY_KEY',
			rawPolicyKey,
			message: 'Policy key is invalid',
			cause,
		};
	}

	static policyNotFound(
		policyKey: string,
		cause: string
	): PolicyEvaluationError {
		return {
			kind: 'POLICY_NOT_FOUND',
			policyKey,
			message: 'Policy is not registered in the catalog',
			cause,
		};
	}

	static policyDefinitionNotFound(
		policyKey: string,
		asOf: Date,
		contextVersion: number,
		cause: string
	): PolicyEvaluationError {
		return {
			kind: 'POLICY_DEFINITION_NOT_FOUND',
			policyKey,
			contextVersion,
			asOf,
			message:
				'No published policy definition matched the evaluation inputs',
			cause,
		};
	}

	static policyVariantNotFound(params: {
		readonly policyKey: string;
		readonly policyKind: PolicyKind;
		readonly payloadSchemaVersion: number;
		readonly gateEngineVersion?: number;
		readonly computeEngineVersion?: number;
		readonly cause: string;
	}): PolicyEvaluationError {
		return {
			kind: 'POLICY_VARIANT_NOT_FOUND',
			policyKey: params.policyKey,
			policyKind: params.policyKind,
			payloadSchemaVersion: params.payloadSchemaVersion,
			...(params.gateEngineVersion !== undefined
				? { gateEngineVersion: params.gateEngineVersion }
				: {}),
			...(params.computeEngineVersion !== undefined
				? { computeEngineVersion: params.computeEngineVersion }
				: {}),
			message:
				'No catalog variant matched the selected policy definition',
			cause: params.cause,
		};
	}

	static engineFailure(
		policyKey: string,
		engine: PolicyKind,
		engineVersion: number,
		cause: string
	): PolicyEvaluationError {
		return {
			kind: 'ENGINE_FAILURE',
			policyKey,
			engine,
			engineVersion,
			message: 'Policy engine evaluation failed',
			cause,
		};
	}
}
