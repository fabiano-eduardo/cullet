import { Result } from '../../result/result';

import type { ContextValueResolver } from './context-resolver';

export interface ContextResolverRegistrationOptions {
	readonly namespace?: string;
}

interface RegisteredContextResolver {
	readonly namespace: string;
	readonly resolver: ContextValueResolver;
}

const DEFAULT_CONTEXT_RESOLVER_NAMESPACE = 'default';

function normalizeNamespace(namespace?: string): string {
	const normalized = namespace?.trim();

	if (normalized === undefined || normalized.length === 0) {
		return DEFAULT_CONTEXT_RESOLVER_NAMESPACE;
	}

	return normalized;
}

/**
 * Registry of context value resolvers, keyed by path.
 */
export class ContextResolverRegistry {
	private readonly resolvers = new Map<string, RegisteredContextResolver>();

	register(
		resolver: ContextValueResolver,
		options: ContextResolverRegistrationOptions = {}
	): Result<void, string> {
		const namespace = normalizeNamespace(options.namespace);
		const existing = this.resolvers.get(resolver.path);

		if (existing !== undefined && existing.namespace !== namespace) {
			return Result.err(
				`Resolver path "${resolver.path}" is already registered by namespace "${existing.namespace}" and cannot be replaced by "${namespace}".`
			);
		}

		this.resolvers.set(resolver.path, {
			namespace,
			resolver,
		});

		return Result.ok(undefined);
	}

	registerAll(
		resolvers: readonly ContextValueResolver[],
		options: ContextResolverRegistrationOptions = {}
	): Result<void, string> {
		for (const r of resolvers) {
			const registrationResult = this.register(r, options);
			if (registrationResult.isErr()) {
				return registrationResult;
			}
		}

		return Result.ok(undefined);
	}

	get(path: string): ContextValueResolver | undefined {
		return this.resolvers.get(path)?.resolver;
	}

	has(path: string): boolean {
		return this.resolvers.has(path);
	}

	getNamespace(path: string): string | undefined {
		return this.resolvers.get(path)?.namespace;
	}
}

export { DEFAULT_CONTEXT_RESOLVER_NAMESPACE };
