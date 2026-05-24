import { UseCase } from '../use-case';
import { version } from '../../versioning/version';

/**
 * Paginated result of a list query.
 * Use as `Output` when the query returns a collection with pagination metadata.
 */
interface Page<T> {
	readonly items: readonly T[];
	readonly total: number;
	readonly page: number;
	readonly pageSize: number;
}

/**
 * Cache strategy declared by the query type.
 * Infrastructure reads this value to decide whether and how to cache the result.
 */
type CacheStrategy =
	| { readonly kind: 'NO_CACHE' }
	| { readonly kind: 'TIME_TO_LIVE'; readonly ttlMs: number }
	| { readonly kind: 'STALE_WHILE_REVALIDATE'; readonly ttlMs: number };

type QueryOutput = object | string | number | boolean | bigint | symbol | null;

/**
 * Base for use cases that **only read state**, with no side effects, following CQS.
 *
 * - `Output extends QueryOutput` prevents a query from declaring a `void` or
 *   `undefined` return, while still allowing primitive projections and `null`
 *   when that makes sense for the read. Use `Page<T>` for paginated lists.
 * - Override `cacheStrategy()` to declare how infrastructure should cache the
 *   result. By default, no cache is applied.
 *
 * A Query must never mutate persisted data — its execution must be idempotent
 * and safe to call multiple times with the same input.
 */
@version('1.0')
abstract class Query<
	Input = void,
	Output extends QueryOutput = never,
> extends UseCase<Input, Output> {
	protected cacheStrategy(): CacheStrategy {
		return { kind: 'NO_CACHE' };
	}
}

export type { CacheStrategy, Page, QueryOutput };
export { Query };
