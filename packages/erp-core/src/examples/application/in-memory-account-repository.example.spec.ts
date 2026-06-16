import { describe, expect, it } from "vitest";

import {
    type AppError,
    ConflictError,
    NotFoundError,
} from "../../core/errors/index.js";
import type { ResultRepository } from "../../core/application/index.js";

import {
    type Account,
    InMemoryAccountRepository,
} from "./in-memory-account-repository.example.js";

describe("InMemoryAccountRepository", () => {
    it("resolves a successful save to Result.ok(undefined)", async () => {
        const repo = new InMemoryAccountRepository();

        const result = await repo.save({ id: "a-1", version: 0, balance: 100 });

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow()).toBeUndefined();
    });

    it("returns null (not an error) when a lookup misses", async () => {
        const repo = new InMemoryAccountRepository();

        const result = await repo.findById("missing");

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow()).toBeNull();
    });

    it("signals an optimistic-concurrency conflict from save", async () => {
        const repo = new InMemoryAccountRepository();
        repo.seed({ id: "a-1", version: 3, balance: 100 });

        const result = await repo.save({ id: "a-1", version: 1, balance: 50 });

        expect(result.isErr()).toBe(true);
        const error = result.errorOrNull();
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).kind).toBe("already_exists");
    });

    it("signals not-found from delete without throwing", async () => {
        const repo = new InMemoryAccountRepository();

        const result = await repo.delete("missing");

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(NotFoundError);
    });

    it("defaults the error channel to AppError when TError is omitted", async () => {
        const repo: ResultRepository<Account, string> =
            new InMemoryAccountRepository();

        const result = await repo.delete("missing");

        // `errorOrNull()` is typed `AppError | null` here — this only compiles
        // because the default error channel of ResultRepository is `AppError`.
        const error: AppError | null = result.errorOrNull();
        expect(error).toBeInstanceOf(NotFoundError);
    });
});
