import type { AppError } from "../../errors/index.js";
import type { Result } from "../../result/result.js";

/**
 * Persistence port for an aggregate in the imperative style: absence is
 * modelled as `null`, and failures (missing row on delete, optimistic
 * concurrency conflicts, infrastructure errors) surface as thrown exceptions.
 *
 * Prefer {@link ResultRepository} when you want those persistence outcomes to
 * be explicit, recoverable values rather than exceptions.
 */
interface Repository<TEntity, TId> {
    findById(id: TId): Promise<TEntity | null>;
    save(entity: TEntity): Promise<void>;
    delete(id: TId): Promise<void>;
}

/**
 * `Result`-returning counterpart of {@link Repository}, aligned with the
 * "errors as values" philosophy used by `Command` / `UseCase`.
 *
 * Where {@link Repository} returns `Promise<void>` from `save`/`delete` and
 * relies on thrown exceptions, this variant lets a repository *signal*
 * recoverable persistence outcomes without breaking control flow — for
 * example a `NotFoundError` when updating/deleting a missing aggregate, or a
 * `ConflictError` on an optimistic-concurrency version mismatch. A successful
 * write resolves to `Result.ok(undefined)`.
 *
 * `findById` keeps `null` as the "not present" answer to a lookup (not an
 * error) while still wrapping the call in a `Result` so genuine failures
 * (e.g. a connectivity error) stay in band.
 *
 * `TError` defaults to {@link AppError} to match the rest of the application
 * boundary (see `PolicyPortError`); narrow it per repository when the failure
 * set is known, e.g. `ResultRepository<Order, OrderId, NotFoundError | ConflictError>`.
 */
interface ResultRepository<TEntity, TId, TError = AppError> {
    findById(id: TId): Promise<Result<TEntity | null, TError>>;
    save(entity: TEntity): Promise<Result<void, TError>>;
    delete(id: TId): Promise<Result<void, TError>>;
}

export type { Repository, ResultRepository };
