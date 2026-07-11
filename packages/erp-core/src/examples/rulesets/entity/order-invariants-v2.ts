import { DomainException } from "../../../core/exceptions/domain-exception.js";
import { type RulesetId } from "../../../core/domain/rulesets/entity-ruleset.contracts.js";
import { type Order } from "./order.js";
import { OrderInvariantsV1 } from "./order-invariants-v1.js";

class OrderCancellationWindowError extends DomainException {}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

class OrderInvariantsV2 extends OrderInvariantsV1 {
    override readonly id: RulesetId = "order-invariants@2.0";
    override readonly description = "Order invariants — version 2.0";

    override assertCanCancel(order: Order): void {
        super.assertCanCancel(order);

        const ageMs = Date.now() - order.createdAt.getTime();
        if (ageMs > FORTY_EIGHT_HOURS_MS) {
            throw new OrderCancellationWindowError(
                "Cannot cancel an order created more than 48 hours ago.",
            );
        }
    }
}

export { OrderInvariantsV2 };
