import type { TemporalSnapshot } from "../../domain/temporal/index.js";
import type { AppError } from "../../errors/index.js";
import type { Result } from "../../result/result.js";

import type { Repository, ResultRepository } from "./repository.port.js";

type TemporalHistory<TEntity> = readonly TemporalSnapshot<TEntity>[];

/**
 * Bitemporal persistence port in the imperative (exception-raising) style.
 *
 * `delete(id)` is inherited from {@link Repository} and its bitemporal meaning
 * is intentionally left to the implementation: it may close the current
 * valid-time interval (a logical end-of-validity that preserves history) or
 * physically purge the row's whole history. Pick one per adapter and document
 * it — callers cannot tell which from this type. Prefer closing validity so
 * `findAsOf`/`findHistory` stay meaningful for past instants.
 */
interface TemporalRepository<TEntity, TId> extends Repository<TEntity, TId> {
    findAsOf(id: TId, asOf: Date): Promise<TEntity | null>;
    findAtTransaction(id: TId, txTime: Date): Promise<TEntity | null>;
    findHistory(id: TId): Promise<TemporalHistory<TEntity>>;
    save(entity: TEntity, validFrom?: Date): Promise<void>;
}

/**
 * `Result`-returning counterpart of {@link TemporalRepository}, aligned with the
 * "errors as values" philosophy (mirrors the {@link Repository} /
 * {@link ResultRepository} pair). The `delete` semantics note above applies
 * unchanged.
 */
interface ResultTemporalRepository<TEntity, TId, TError = AppError>
    extends ResultRepository<TEntity, TId, TError> {
    findAsOf(id: TId, asOf: Date): Promise<Result<TEntity | null, TError>>;
    findAtTransaction(
        id: TId,
        txTime: Date,
    ): Promise<Result<TEntity | null, TError>>;
    findHistory(id: TId): Promise<Result<TemporalHistory<TEntity>, TError>>;
    save(entity: TEntity, validFrom?: Date): Promise<Result<void, TError>>;
}

export type {
    ResultTemporalRepository,
    TemporalHistory,
    TemporalRepository,
};
