import { describe, expect, it } from 'vitest';

import {
	type OrderCreationData,
	type OrderCreationRuleset,
	type OrderItem,
	type OrderStatic,
} from './order';
import { DomainException } from '../../entity-ruleset.contracts';

// TODO: replace with concrete imports in the green step.
declare const Order: OrderStatic;
declare const orderCreationRulesetV1: OrderCreationRuleset;

function makeItem(quantity = 1): OrderItem {
	return {
		sku: 'item-1',
		quantity,
	};
}

function makeValidCreationData(
	overrides: Partial<OrderCreationData> = {}
): OrderCreationData {
	return {
		id: 'order-1',
		customerId: 'customer-1',
		items: [makeItem()],
		createdAt: new Date('2026-04-22T12:00:00.000Z'),
		...overrides,
	};
}

function expectDomainError(callback: () => void): void {
	try {
		callback();
	} catch (error) {
		expect(error).toBeInstanceOf(DomainException);
		return;
	}

	throw new Error('Expected DomainError to be thrown');
}

describe('OrderCreationRuleset', () => {
	it('creates an order with valid data', () => {
		const order = Order.create(
			makeValidCreationData(),
			orderCreationRulesetV1
		);

		expect(order.customerId).toBe('customer-1');
		expect(order.items).toHaveLength(1);
	});

	it('throws DomainError when creating without a customerId', () => {
		expectDomainError(() =>
			Order.create(
				makeValidCreationData({ customerId: '' }),
				orderCreationRulesetV1
			)
		);
	});

	it('throws DomainError when creating with an empty items list', () => {
		expectDomainError(() =>
			Order.create(
				makeValidCreationData({ items: [] }),
				orderCreationRulesetV1
			)
		);
	});

	it('throws DomainError when creating with a zero-quantity item', () => {
		expectDomainError(() =>
			Order.create(
				makeValidCreationData({ items: [makeItem(0)] }),
				orderCreationRulesetV1
			)
		);
	});

	it('throws DomainError when creating with a negative-quantity item', () => {
		expectDomainError(() =>
			Order.create(
				makeValidCreationData({ items: [makeItem(-1)] }),
				orderCreationRulesetV1
			)
		);
	});

	it('persists creationRulesetId on the entity after a successful creation', () => {
		const order = Order.create(
			makeValidCreationData(),
			orderCreationRulesetV1
		);

		expect(order.creationRulesetId).toBe(orderCreationRulesetV1.id);
	});
});
