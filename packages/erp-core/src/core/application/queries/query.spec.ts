import { describe, expect, it } from "vitest";

import { Result } from "../../result/result.js";
import { UseCase } from "../use-case.js";

import { Query } from "./query.js";

class FindEntityQuery extends Query<{ id: string }, string | null, never> {
    protected execute(input: { id: string }): Result<string | null, never> {
        // in production this would query the repository
        return Result.ok(input.id === "known" ? "entity-data" : null);
    }
}

class CountQuery extends Query<void, number, never> {
    protected execute(): Result<number, never> {
        return Result.ok(42);
    }
}

describe("Query", () => {
    it("is a subclass of UseCase", () => {
        const query = new FindEntityQuery();

        expect(query).toBeInstanceOf(UseCase);
    });

    it("executes via run() and returns the output of execute()", async () => {
        const query = new FindEntityQuery();

        expect((await query.run({ id: "known" })).getOrNull()).toBe(
            "entity-data",
        );
        expect((await query.run({ id: "unknown" })).getOrNull()).toBeNull();
    });

    it("accepts void input and returns a value", async () => {
        const query = new CountQuery();
        const result = await query.run();

        expect(result.getOrNull()).toBe(42);
    });

    it("inherits CONTRACT_VERSION from UseCase", () => {
        expect(Query.CONTRACT_VERSION).toBe("1.0");
    });

    it("inherits the contractVersion getter on the instance", () => {
        const query = new FindEntityQuery();

        expect(query.contractVersion).toBe("1.0");
    });
});
