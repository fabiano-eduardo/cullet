import { Result } from '../../result/result';

import type { ContextResolverRegistry } from './context-registry';
import type { ContextSeed } from './context-seed';
import { PolicyContextPath } from './path';

/**
 * Builds a context object by resolving required paths from a seed.
 */
export class PolicyContextBuilder {
	constructor(private readonly registry: ContextResolverRegistry) {}

	/**
	 * Resolves all required context paths and returns a flat context object.
	 * If any required path cannot be resolved, returns an error.
	 */
	async build(
		requirements: readonly string[],
		seed: ContextSeed
	): Promise<Result<Record<string, unknown>, string>> {
		const context: Record<string, unknown> = {};

		for (const path of requirements) {
			const resolver = this.registry.get(path);
			if (!resolver) {
				return Result.err(`Missing resolver for path "${path}"`);
			}

			const result = await resolver.resolve(seed);
			if (result.isErr()) {
				return Result.err(
					`Resolver error for path "${path}": ${result.errorOrNull()}`
				);
			}

			const setPathResult = PolicyContextPath.set(
				context,
				path,
				result.getOrNull()
			);
			if (setPathResult.isErr()) {
				return Result.err(setPathResult.errorOrNull()!);
			}
		}

		// Final validation: ensure every required path resolved to a defined value.
		// `undefined` is rejected explicitly because resolvers that "succeed" with
		// undefined indicate an unresolved field, not a present-but-empty one.
		const missing = requirements.filter((path) => {
			const result = PolicyContextPath.getOrAbsent(context, path);
			return result.isErr() || result.getOrNull() === undefined;
		});
		if (missing.length > 0) {
			return Result.err(
				`Context missing required paths after resolution: ${missing.join(
					', '
				)}`
			);
		}

		return Result.ok(context);
	}
}
