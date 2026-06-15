import { describe, expect, it } from "vitest";

import {
    AlreadyExistsError,
    DuplicateError,
    translateUniqueViolationToDuplicate,
    UniqueConstraintViolationError,
} from "./conflict-error.js";
import { ErrorCodes } from "./error-codes.js";

describe("ConflictError factories", () => {
    describe("AlreadyExistsError", () => {
        it("defaults operation to create and provides a hint", () => {
            const error = AlreadyExistsError.detected({ entity: "invoice" });

            expect(error.code).toBe(ErrorCodes.conflict.alreadyExists);
            expect(error.kind).toBe("already_exists");
            expect(error.metadata).toMatchObject({
                kind: "already_exists",
                entity: "invoice",
                operation: "create",
                hint: "Verify existing records before retrying.",
            });
        });

        it("preserves a caller-provided operation and hint", () => {
            const error = AlreadyExistsError.detected({
                entity: "invoice",
                operation: "upsert",
                hint: "custom hint",
                existingId: "INV-1",
            });

            expect(error.metadata).toMatchObject({
                operation: "upsert",
                hint: "custom hint",
                existingId: "INV-1",
            });
        });
    });

    describe("DuplicateError", () => {
        it("uses the default hint when none is provided", () => {
            const error = DuplicateError.detected({ entity: "customer" });

            expect(error.code).toBe(ErrorCodes.conflict.duplicate);
            expect(error.kind).toBe("duplicate");
            expect(error.metadata).toMatchObject({
                kind: "duplicate",
                entity: "customer",
                hint: "Adjust the data so it does not duplicate existing records.",
            });
        });

        it("uses a caller-provided hint when present", () => {
            const error = DuplicateError.detected({
                entity: "customer",
                hint: "Use a different document number.",
            });

            expect(error.metadata).toMatchObject({
                hint: "Use a different document number.",
            });
        });
    });

    describe("UniqueConstraintViolationError", () => {
        it("nests the unique-constraint violation details in metadata", () => {
            const error = UniqueConstraintViolationError.detected({
                entity: "customer",
                constraintName: "uq_customer_email",
                table: "customers",
                columns: ["email"],
            });

            expect(error.code).toBe(ErrorCodes.conflict.uniqueViolation);
            expect(error.kind).toBe("unique_violation");
            expect(error.metadata).toMatchObject({
                kind: "unique_violation",
                entity: "customer",
                constraintName: "uq_customer_email",
                violation: {
                    kind: "unique_violation",
                    constraintName: "uq_customer_email",
                    table: "customers",
                    columns: ["email"],
                },
            });
        });
    });

    describe("translateUniqueViolationToDuplicate", () => {
        it("maps a unique-constraint violation onto a DuplicateError", () => {
            const error = translateUniqueViolationToDuplicate({
                entity: "customer",
                operation: "create",
                field: "email",
                violation: {
                    kind: "unique_violation",
                    constraintName: "uq_customer_email",
                    table: "customers",
                    columns: ["email"],
                },
                ctx: {
                    correlationId: "corr-1",
                    requestId: "req-1",
                    nowIso: "2026-06-13T00:00:00.000Z",
                },
            });

            expect(error).toBeInstanceOf(DuplicateError);
            expect(error.metadata).toMatchObject({
                kind: "duplicate",
                entity: "customer",
                field: "email",
                constraintName: "uq_customer_email",
                correlationId: "corr-1",
                requestId: "req-1",
                detectedAtIso: "2026-06-13T00:00:00.000Z",
            });
        });
    });
});
