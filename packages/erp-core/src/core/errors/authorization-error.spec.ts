import { describe, expect, it } from "vitest";

import { AuthorizationError } from "./authorization-error.js";
import { ErrorCodes } from "./error-codes.js";

describe("AuthorizationError", () => {
    describe("missingRole", () => {
        it("carries the dedicated code, reason, and required-grant metadata", () => {
            const error = AuthorizationError.missingRole({
                action: "order.cancel",
                resource: { type: "Order", id: "order-1" },
                actor: { userId: "user-1" },
                required: { capability: "orders:cancel", scope: "school:42" },
            });

            expect(error).toBeInstanceOf(AuthorizationError);
            expect(error.code).toBe(ErrorCodes.authorization.missingRole);
            expect(error.reason).toBe("missing_role");
            expect(error.metadata).toEqual({
                reason: "missing_role",
                action: "order.cancel",
                resource: { type: "Order", id: "order-1" },
                actor: { userId: "user-1" },
                required: { capability: "orders:cancel", scope: "school:42" },
            });
        });

        it("hoists AppError options to the top level instead of into metadata", () => {
            const error = AuthorizationError.missingRole({
                action: "order.cancel",
                required: { capability: "orders:cancel" },
                correlationId: "corr-1",
                requestId: "req-1",
            });

            expect(error.correlationId).toBe("corr-1");
            expect(error.requestId).toBe("req-1");
            expect(error.metadata).toEqual({
                reason: "missing_role",
                action: "order.cancel",
                required: { capability: "orders:cancel" },
            });
            expect(error.metadata).not.toHaveProperty("correlationId");
        });
    });
});
