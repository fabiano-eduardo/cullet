import { UseCase } from "../use-case.js";
import { version } from "../../versioning/version.js";
import type { AppError } from "../../errors/index.js";
import type { Result } from "../../result/result.js";

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
    | { readonly kind: "NO_CACHE" }
    | { readonly kind: "TIME_TO_LIVE"; readonly ttlMs: number }
    | { readonly kind: "STALE_WHILE_REVALIDATE"; readonly ttlMs: number };

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
    protected cacheStrategy(): CacheStrategy {
        return { kind: "NO_CACHE" };
    }
}

export type { CacheStrategy, Page, QueryOutput };
export { Query };
