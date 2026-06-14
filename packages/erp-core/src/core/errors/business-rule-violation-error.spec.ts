import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { BusinessRuleViolationError } from "./business-rule-violation-error";
import { ErrorCodes } from "./error-codes";

describe("BusinessRuleViolationError", () => {
    describe("happy path", () => {
        it("carries the rule and detail as metadata under the stable code", () => {
            const error = new BusinessRuleViolationError(
                "order.total_must_be_positive",
                "order total must be greater than zero",
                { orderId: "ORD-1", total: -5 },
            );

            expect(error).toBeInstanceOf(AppError);
            expect(error.code).toBe(ErrorCodes.businessRuleViolation);
            expect(error.message).toBe("order total must be greater than zero");
            expect(error.metadata).toEqual({
                rule: "order.total_must_be_positive",
                detail: { orderId: "ORD-1", total: -5 },
            });
        });

        it("omits the detail key when no detail is provided", () => {
            const error = new BusinessRuleViolationError(
                "order.must_have_items",
                "order must have at least one item",
            );

            expect(error.metadata).toEqual({ rule: "order.must_have_items" });
            expect(error.metadata).not.toHaveProperty("detail");
        });
    });

    describe("edge cases", () => {
        it("merges options.metadata over the rule/detail base and keeps top-level ids", () => {
            const cause = new Error("upstream");
            const error = new BusinessRuleViolationError(
                "order.rule",
                "violated",
                { orderId: "ORD-2" },
                {
                    metadata: { tenantId: "tenant-1" },
                    cause,
                    correlationId: "corr-1",
                },
            );

            expect(error.cause).toBe(cause);
            expect(error.correlationId).toBe("corr-1");
            expect(error.metadata).toEqual({
                rule: "order.rule",
                detail: { orderId: "ORD-2" },
                tenantId: "tenant-1",
            });
        });
    });
});
