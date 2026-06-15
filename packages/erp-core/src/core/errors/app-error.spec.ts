import { describe, expect, it } from "vitest";

import { NotFoundError } from "./not-found-error.js";

// AppError is abstract; NotFoundError is the simplest concrete subclass and is
// enough to exercise the shared base behaviour (toJSON and the optional id
// fields it conditionally serializes).
describe("AppError.toJSON (via NotFoundError)", () => {
    it("includes correlationId, requestId and commandId when they are present", () => {
        const error = new NotFoundError(
            "invoice",
            { id: "INV-1" },
            {
                type: "domain",
                severity: "medium",
                publicMessage: "Recurso nao encontrado.",
                createdAtIso: "2026-06-13T12:00:00.000Z",
                correlationId: "corr-1",
                requestId: "req-1",
                commandId: "cmd-1",
            },
        );

        const json = error.toJSON();

        expect(json).toMatchObject({
            name: "NotFoundError",
            code: error.code,
            type: "domain",
            severity: "medium",
            message: "invoice not found",
            publicMessage: "Recurso nao encontrado.",
            createdAtIso: "2026-06-13T12:00:00.000Z",
            correlationId: "corr-1",
            requestId: "req-1",
            commandId: "cmd-1",
            metadata: { resource: "invoice", criteria: { id: "INV-1" } },
        });
    });

    it("omits the optional id fields when they are not provided", () => {
        const error = new NotFoundError("invoice");

        const json = error.toJSON();

        expect(json).not.toHaveProperty("correlationId");
        expect(json).not.toHaveProperty("requestId");
        expect(json).not.toHaveProperty("commandId");
        expect(json.metadata).toEqual({ resource: "invoice" });
    });
});
