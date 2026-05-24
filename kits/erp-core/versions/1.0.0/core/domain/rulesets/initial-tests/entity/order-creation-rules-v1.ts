import { DomainException } from '../../entity-ruleset.contracts';
import { type OrderCreationData, type OrderCreationRuleset } from './order';

class OrderCreationValidationError extends DomainException {}

class OrderCreationRulesV1 implements OrderCreationRuleset {
	readonly id = 'order-creation@1.0' as const;
	readonly description = 'Order creation rules — version 1.0';

	validate(data: OrderCreationData): void {
		if (!data.customerId) {
			throw new OrderCreationValidationError('customerId is required.');
		}

		if (!data.items || data.items.length === 0) {
			throw new OrderCreationValidationError(
				'The order must contain at least one item.'
			);
		}

		for (const item of data.items) {
			if (item.quantity <= 0) {
				throw new OrderCreationValidationError(
					`Item "${item.sku}" quantity must be greater than zero. Received: ${item.quantity}.`
				);
			}
		}
	}
}

export { OrderCreationRulesV1 };
