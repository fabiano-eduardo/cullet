import { Result } from '../../result/result';

/**
 * Seed data provided by the use case / caller.
 * Contains raw IDs and inputs that the context system will resolve into paths.
 * Each resolver is responsible for validating and extracting what it needs from fields.
 */
export interface ContextSeed {
	readonly tenantId: string;
	readonly schoolId: string;
	readonly fields: Record<string, unknown>;
}

export class ContextSeedValidator {
	private static isBlankSeedId(value: string): boolean {
		return value.trim().length === 0;
	}

	static validate(seed: ContextSeed): Result<ContextSeed, string> {
		if (ContextSeedValidator.isBlankSeedId(seed.tenantId)) {
			return Result.err(
				'ContextSeed tenantId must be a non-empty string'
			);
		}

		if (ContextSeedValidator.isBlankSeedId(seed.schoolId)) {
			return Result.err(
				'ContextSeed schoolId must be a non-empty string'
			);
		}

		return Result.ok(seed);
	}
}
