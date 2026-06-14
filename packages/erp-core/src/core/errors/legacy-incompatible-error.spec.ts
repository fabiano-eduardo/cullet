import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import { LegacyIncompatibleError } from "./legacy-incompatible-error";

describe("LegacyIncompatibleError", () => {
    describe("happy path", () => {
        it("uses the legacy-incompatible code and keeps the provided context as metadata", () => {
            const error = new LegacyIncompatibleError(
                "legacy payload cannot be migrated",
                { schemaVersion: 1, legacyId: "L-1" },
            );

            expect(error).toBeInstanceOf(AppError);
            expect(error.code).toBe(ErrorCodes.legacyIncompatible);
            expect(error.message).toBe("legacy payload cannot be migrated");
            expect(error.metadata).toEqual({
                schemaVersion: 1,
                legacyId: "L-1",
            });
        });
    });

    describe("edge cases", () => {
        it("leaves metadata undefined when neither context nor options.metadata is given", () => {
            const error = new LegacyIncompatibleError("incompatible");

            expect(error.metadata).toBeUndefined();
        });

        it("merges options.metadata over the context", () => {
            const error = new LegacyIncompatibleError(
                "incompatible",
                { schemaVersion: 1, source: "context" },
                { metadata: { source: "options", extra: true } },
            );

            expect(error.metadata).toEqual({
                schemaVersion: 1,
                source: "options",
                extra: true,
            });
        });
    });
});
