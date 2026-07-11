import { UseCase } from "../use-case.js";
import { version } from "../../versioning/version.js";
import type { AppError } from "../../errors/index.js";
import type { Result } from "../../result/result.js";

/**
 * Paginated result of a list query (offset-based).
 * Use as `Output` when the query returns a collection with pagination metadata.
 * For cursor/keyset pagination, model your own `Output` type instead.
 */
interface Page<T> {
    readonly items: readonly T[];
    /** Total rows across all pages, ignoring `page`/`pageSize`. */
    readonly total: number;
    /** 1-based page number (the first page is `1`, not `0`). */
    readonly page: number;
    readonly pageSize: number;
}

/**
 * Cache strategy declared by the query type.
 * Infrastructure reads this value to decide whether and how to cache the result.
 *
 * These are pure descriptors: the type cannot enforce that a duration is finite
 * and positive, so the caching adapter must validate `ttlMs` /
 * `staleWhileRevalidateMs` (`> 0`, finite) before honoring the strategy.
 */
type CacheStrategy =
    | { readonly kind: "NO_CACHE" }
    | { readonly kind: "TIME_TO_LIVE"; readonly ttlMs: number }
    | {
          readonly kind: "STALE_WHILE_REVALIDATE";
          /** How long the entry is served fresh. */
          readonly ttlMs: number;
          /**
           * How long *after* `ttlMs` a stale entry may still be served while a
           * background refresh runs. SWR needs both windows; a single TTL is
           * ambiguous and each adapter would guess the second one.
           */
          readonly staleWhileRevalidateMs: number;
      };

type QueryOutput = object | string | number | boolean | bigint | symbol | null;

/**
 * Base for use cases that **only read state**, with no side effects, following CQS.
 *
 * - `Data extends QueryOutput` prevents a query from declaring a `void` or
 *   `undefined` success payload, while still allowing primitive projections
 *   and `null` when that makes sense for the read. Failures stay explicit in
 *   `Result<T, E>`.
 * - Override `cacheStrategy()` to declare how infrastructure should cache the
 *   result. By default, no cache is applied.
 *
 * A Query must never mutate persisted data — its execution must be idempotent
 * and safe to call multiple times with the same input.
 */
@version("1.0")
abstract class Query<
    Input = void,
    Data extends QueryOutput = never,
    Failure = AppError,
> extends UseCase<Input, Result<Data, Failure>> {
    /**
     * Declares how infrastructure should cache this query's result. Public so
     * a caching adapter can actually read it off the instance; overrides must
     * stay public.
     */
    public cacheStrategy(): CacheStrategy {
        return { kind: "NO_CACHE" };
    }
}

export type { CacheStrategy, Page, QueryOutput };
export { Query };
