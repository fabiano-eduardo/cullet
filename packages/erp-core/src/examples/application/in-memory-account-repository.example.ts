/**
 * Reference implementation of a {@link ResultRepository}: shows how a
 * repository signals recoverable persistence outcomes as `Result` values
 * instead of throwing.
 *
 * - `save` returns a `ConflictError` on an optimistic-concurrency version
 *   mismatch, otherwise persists and bumps the version.
 * - `delete` returns a `NotFoundError` when the row is absent.
 * - `findById` keeps `null` as the "not present" answer (a valid lookup
 *   result, not an error), still wrapped in a `Result` so genuine infra
 *   failures could stay in band.
 *
 * Consumers import `ResultRepository` from the package root
 * (`@cullet/erp-core`); the relative paths here keep the example compilable
 * and test-covered.
 */
import type { ResultRepository } from "../../core/application/index.js";
import {
    AlreadyExistsError,
    type ConflictError,
    NotFoundError,
} from "../../core/errors/index.js";
import { Result } from "../../core/result/result.js";

interface Account {
    readonly id: string;
    readonly version: number;
    readonly balance: number;
}

type AccountError = NotFoundError | ConflictError;

class InMemoryAccountRepository implements ResultRepository<
    Account,
    string,
    AccountError
> {
    private readonly store = new Map<string, Account>();

    seed(account: Account): void {
        this.store.set(account.id, account);
    }

    async findById(id: string): Promise<Result<Account | null, AccountError>> {
        return Result.ok(this.store.get(id) ?? null);
    }

    async save(entity: Account): Promise<Result<void, AccountError>> {
        const current = this.store.get(entity.id);
        if (current && current.version !== entity.version) {
            return Result.err(
                AlreadyExistsError.detected({
                    entity: "Account",
                    operation: "update",
                    existingId: entity.id,
                }),
            );
        }
        this.store.set(entity.id, { ...entity, version: entity.version + 1 });
        return Result.ok(undefined);
    }

    async delete(id: string): Promise<Result<void, AccountError>> {
        if (!this.store.has(id)) {
            return Result.err(new NotFoundError("Account", { id }));
        }
        this.store.delete(id);
        return Result.ok(undefined);
    }
}

export { InMemoryAccountRepository };
export type { Account, AccountError };
