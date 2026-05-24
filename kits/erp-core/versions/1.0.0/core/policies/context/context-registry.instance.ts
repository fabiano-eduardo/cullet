import { Result } from '../../result/result';

import { ContextResolverRegistry } from './context-registry';

import type { ContextValueResolver } from './context-resolver';

/**
 * Official instance of the ContextResolverRegistry.
 * Use this instance to register and retrieve resolvers across the application
 * to ensure a complete and unique catalog of context resolvers.
 */
export const contextResolverRegistry = new ContextResolverRegistry();

export function registerNamespacedContextResolvers(
	namespace: string,
	resolvers: readonly ContextValueResolver[]
): Result<ContextResolverRegistry, string> {
	const registrationResult = contextResolverRegistry.registerAll(resolvers, {
		namespace,
	});
	if (registrationResult.isErr()) {
		return Result.err(registrationResult.errorOrNull()!);
	}

	return Result.ok(contextResolverRegistry);
}
