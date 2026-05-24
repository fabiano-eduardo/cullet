import {
	type CreationRuleset,
	type InvariantRuleset,
	type RulesetId,
} from '../../entity-ruleset.contracts';

type OrderStatus = 'open' | 'cancelled' | 'shipped' | 'delivered';

interface OrderItem {
	readonly sku: string;
	readonly quantity: number;
}

interface OrderCreationData {
	readonly id: string;
	readonly customerId: string;
	readonly items: readonly OrderItem[];
	readonly createdAt: Date;
}

interface OrderSnapshot extends OrderCreationData {
	readonly status: OrderStatus;
	readonly creationRulesetId: RulesetId;
	readonly aggregateVersion: number;
}

interface OrderCancelledEvent {
	readonly type: 'OrderCancelled';
	readonly invariantRulesetId: RulesetId;
}

type OrderDomainEvent = OrderCancelledEvent;

interface OrderCreationRuleset extends CreationRuleset<OrderCreationData> {}

interface OrderInvariantRuleset extends InvariantRuleset {
	assertCanAddItem(order: Order, item: OrderItem): void;
	assertCanCancel(order: Order): void;
	assertCanCheckout(order: Order): void;
	assertCanMarkAsDelivered(order: Order): void;
}

interface OrderStatic {
	create(data: OrderCreationData, ruleset: OrderCreationRuleset): Order;
	reconstitute(snapshot: OrderSnapshot): Order;
}

class Order {
	private readonly _id: string;
	private readonly _customerId: string;
	private _status: OrderStatus;
	private readonly _items: OrderItem[];
	private readonly _createdAt: Date;
	private readonly _creationRulesetId: RulesetId;
	private _aggregateVersion: number;
	private readonly _domainEvents: OrderDomainEvent[] = [];

	private constructor(snapshot: OrderSnapshot) {
		this._id = snapshot.id;
		this._customerId = snapshot.customerId;
		this._status = snapshot.status;
		this._items = [...snapshot.items];
		this._createdAt = new Date(snapshot.createdAt.getTime());
		this._creationRulesetId = snapshot.creationRulesetId;
		this._aggregateVersion = snapshot.aggregateVersion;
	}

	get id(): string {
		return this._id;
	}

	get customerId(): string {
		return this._customerId;
	}

	get status(): OrderStatus {
		return this._status;
	}

	get items(): readonly OrderItem[] {
		return this._items;
	}

	get createdAt(): Date {
		return new Date(this._createdAt.getTime());
	}

	get creationRulesetId(): RulesetId {
		return this._creationRulesetId;
	}

	get aggregateVersion(): number {
		return this._aggregateVersion;
	}

	addItem(item: OrderItem, ruleset: OrderInvariantRuleset): void {
		ruleset.assertCanAddItem(this, item);
		this._items.push(item);
		this._aggregateVersion += 1;
	}

	cancel(ruleset: OrderInvariantRuleset): void {
		ruleset.assertCanCancel(this);
		this._status = 'cancelled';
		this._aggregateVersion += 1;
		this._domainEvents.push({
			type: 'OrderCancelled',
			invariantRulesetId: ruleset.id,
		});
	}

	checkout(ruleset: OrderInvariantRuleset): void {
		ruleset.assertCanCheckout(this);
		this._status = 'shipped';
		this._aggregateVersion += 1;
	}

	markAsDelivered(ruleset: OrderInvariantRuleset): void {
		ruleset.assertCanMarkAsDelivered(this);
		this._status = 'delivered';
		this._aggregateVersion += 1;
	}

	pullDomainEvents(): readonly OrderDomainEvent[] {
		const events = [...this._domainEvents];
		this._domainEvents.length = 0;
		return events;
	}

	static create(
		data: OrderCreationData,
		ruleset: CreationRuleset<OrderCreationData>
	): Order {
		ruleset.validate(data);
		return new Order({
			...data,
			status: 'open',
			creationRulesetId: ruleset.id,
			aggregateVersion: 0,
		});
	}

	static reconstitute(snapshot: OrderSnapshot): Order {
		return new Order(snapshot);
	}
}

const _typeCheck: OrderStatic = Order;
void _typeCheck;

export {
	Order,
	type OrderCancelledEvent,
	type OrderCreationData,
	type OrderCreationRuleset,
	type OrderDomainEvent,
	type OrderInvariantRuleset,
	type OrderItem,
	type OrderSnapshot,
	type OrderStatic,
	type OrderStatus,
};
