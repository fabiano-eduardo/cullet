import { DomainException } from "../../../core/exceptions/domain-exception.js";
import { type OrderCreationData, type OrderCreationRuleset } from "./order.js";

class OrderCreationValidationException extends DomainException {}

class OrderCreationRulesV1 implements OrderCreationRuleset {
    readonly id = "order-creation@1.0" as const;
    readonly description = "Order creation rules — version 1.0";

    validate(data: OrderCreationData): void {
        if (!data.customerId) {
            throw new OrderCreationValidationException(
                "customerId is required.",
            );
        }

        if (!data.items || data.items.length === 0) {
            throw new OrderCreationValidationException(
                "The order must contain at least one item.",
            );
        }

        for (const item of data.items) {
            if (item.quantity <= 0) {
                throw new OrderCreationValidationException(
                    `Item "${item.sku}" quantity must be greater than zero. Received: ${item.quantity}.`,
                );
            }
        }
    }
}

export { OrderCreationRulesV1 };
