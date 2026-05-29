import { describe, expect, it } from "vitest";

import {
  Order,
  type Order as OrderInstance,
  type OrderItem,
  type OrderSnapshot,
} from "./order";
import { OrderInvariantsV1 } from "./order-invariants-v1";
import { OrderInvariantsV2 } from "./order-invariants-v2";
import { DomainException } from "../../entity-ruleset.contracts";

const orderInvariantRulesetV1 = new OrderInvariantsV1();
const orderInvariantRulesetV2 = new OrderInvariantsV2();

function makeItem(quantity = 1): OrderItem {
  return {
    sku: "item-1",
    quantity,
  };
}

function makeSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: "order-1",
    customerId: "customer-1",
    status: "open",
    items: [makeItem()],
    createdAt: new Date("2026-04-22T12:00:00.000Z"),
    creationRulesetId: "order-creation@1.0",
    aggregateVersion: 0,
    ...overrides,
  };
}

function reconstituteOrder(
  overrides: Partial<OrderSnapshot> = {},
): OrderInstance {
  return Order.reconstitute(makeSnapshot(overrides));
}

function expectDomainError(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainException);
    return;
  }

  throw new Error("Expected DomainError to be thrown");
}

describe("OrderInvariantRuleset v1", () => {
  it("allows addItem on an open order", () => {
    expect(() =>
      orderInvariantRulesetV1.assertCanAddItem(
        reconstituteOrder({ status: "open" }),
        makeItem(),
      ),
    ).not.toThrow();
  });

  it("rejects addItem on a cancelled order", () => {
    expectDomainError(() =>
      orderInvariantRulesetV1.assertCanAddItem(
        reconstituteOrder({ status: "cancelled" }),
        makeItem(),
      ),
    );
  });

  it("allows cancel on an open order", () => {
    expect(() =>
      orderInvariantRulesetV1.assertCanCancel(
        reconstituteOrder({ status: "open" }),
      ),
    ).not.toThrow();
  });

  it("rejects cancel on a delivered order", () => {
    expectDomainError(() =>
      orderInvariantRulesetV1.assertCanCancel(
        reconstituteOrder({ status: "delivered" }),
      ),
    );
  });

  it("rejects checkout on an order with no items", () => {
    expectDomainError(() =>
      orderInvariantRulesetV1.assertCanCheckout(
        reconstituteOrder({ items: [] }),
      ),
    );
  });

  it("allows markAsDelivered on a shipped order", () => {
    expect(() =>
      orderInvariantRulesetV1.assertCanMarkAsDelivered(
        reconstituteOrder({ status: "shipped" }),
      ),
    ).not.toThrow();
  });

  it("rejects markAsDelivered on an open order", () => {
    expectDomainError(() =>
      orderInvariantRulesetV1.assertCanMarkAsDelivered(
        reconstituteOrder({ status: "open" }),
      ),
    );
  });
});

describe("OrderInvariantRuleset v2", () => {
  it("rejects cancel on an open order created more than 48 hours ago", () => {
    expectDomainError(() =>
      orderInvariantRulesetV2.assertCanCancel(
        reconstituteOrder({
          status: "open",
          createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
        }),
      ),
    );
  });

  it("allows cancel on an open order created less than 48 hours ago", () => {
    expect(() =>
      orderInvariantRulesetV2.assertCanCancel(
        reconstituteOrder({
          status: "open",
          createdAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
        }),
      ),
    ).not.toThrow();
  });
});

describe("Event ruleset tracking", () => {
  it("persists the invariantRulesetId on the OrderCancelled event", () => {
    const order = reconstituteOrder({ status: "open" });

    order.cancel(orderInvariantRulesetV1);

    const events = order.pullDomainEvents();
    const [event] = events;

    expect(events).toHaveLength(1);
    expect(event).toBeDefined();
    expect(event.type).toBe("OrderCancelled");
    expect(event.invariantRulesetId).toBe(orderInvariantRulesetV1.id);
  });
});
