import { Result } from '../../result/result';

import type { ContextSeed } from './context-seed';

/**
 * A resolver that knows how to produce a value for a specific context path.
 * Designed as async to allow future DB/API lookups without breaking the interface.
 */
export interface ContextValueResolver {
	readonly path: string;
	resolve(seed: ContextSeed): Promise<Result<unknown, string>>;
}
