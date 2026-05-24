import { z } from 'zod';

import { Result } from '../../../../result/result';

import type { GatePayloadV1 } from './gate-types-v1';
import {
	conditionLeafNodeSchema,
	conditionNodeSchema,
} from '../condition-schema';

// Re-export so gate/v1 public API remains unchanged.
export { conditionLeafNodeSchema, conditionNodeSchema };

export class GatePayloadSchemaV1 {
	static readonly schema = z.union([
		z
			.object({
				condition: conditionNodeSchema,
			})
			.strict(),
		z
			.object({
				allowIf: conditionNodeSchema,
				defaultOutcome: z.enum(['ALLOW', 'DENY']),
			})
			.strict(),
	]);

	static parse(payload: unknown): Result<GatePayloadV1, string> {
		const parsed = GatePayloadSchemaV1.schema.safeParse(payload);
		if (!parsed.success) {
			const details = parsed.error.issues
				.map((issue) => {
					const path = issue.path.join('.');
					return path.length > 0
						? `${path}: ${issue.message}`
						: issue.message;
				})
				.join('; ');

			return Result.err(`Invalid gate payload: ${details}`);
		}

		return Result.ok(parsed.data as GatePayloadV1);
	}
}

export const gatePayloadSchema = GatePayloadSchemaV1.schema;
