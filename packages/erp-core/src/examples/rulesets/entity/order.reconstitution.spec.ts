import { describe, expect, it } from "vitest";

import { Order, type OrderSnapshot } from "./order";

function makeHistoricalSnapshot(
    overrides: Partial<OrderSnapshot> = {},
): OrderSnapshot {
    return {
        id: "legacy-order-1",
        customerId: "",
        status: "delivered",
        items: [],
        createdAt: new Date("2023-01-10T10:00:00.000Z"),
        creationRulesetId: "order-creation@0.9",
        aggregateVersion: 7,
        ...overrides,
    };
}

describe("Order reconstitution", () => {
    it("does not invoke current rulesets when reconstituting historical data invalid under current rules", () => {
        expect(() =>
            Order.reconstitute(makeHistoricalSnapshot()),
        ).not.toThrow();
    });

    it("preserves historical data exactly as persisted", () => {
        const order = Order.reconstitute(makeHistoricalSnapshot());

        expect(order.customerId).toBe("");
        expect(order.items).toHaveLength(0);
        expect(order.creationRulesetId).toBe("order-creation@0.9");
    });
});
