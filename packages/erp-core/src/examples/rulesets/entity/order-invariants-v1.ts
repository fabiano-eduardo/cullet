import { DomainException } from "../../../core/exceptions/domain-exception.js";
import { type RulesetId } from "../../../core/domain/rulesets/entity-ruleset.contracts.js";
import {
    type Order,
    type OrderInvariantRuleset,
    type OrderItem,
} from "./order.js";

class OrderInvariantError extends DomainException {}

class OrderInvariantsV1 implements OrderInvariantRuleset {
    readonly id: RulesetId = "order-invariants@1.0";
    readonly description: string = "Order invariants — version 1.0";

    assertCanAddItem(order: Order, _item: OrderItem): void {
        if (order.status !== "open") {
            throw new OrderInvariantError(
                `Cannot add an item to an order with status "${order.status}". The order must be open.`,
            );
        }
    }

    assertCanCancel(order: Order): void {
        if (order.status === "delivered") {
            throw new OrderInvariantError(
                "Cannot cancel an order that has already been delivered.",
            );
        }
    }

    assertCanCheckout(order: Order): void {
        if (order.items.length === 0) {
            throw new OrderInvariantError(
                "Cannot check out an order with no items.",
            );
        }
    }

    assertCanMarkAsDelivered(order: Order): void {
        if (order.status !== "shipped") {
            throw new OrderInvariantError(
                `Cannot mark as delivered an order with status "${order.status}". The order must be shipped.`,
            );
        }
    }
}

export { OrderInvariantsV1 };
