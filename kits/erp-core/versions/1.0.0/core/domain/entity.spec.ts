import { describe, expect, it } from 'vitest';

import { Entity, type EntityState } from './entity';
import { InvariantViolationException } from '../exceptions/invariant-violation-exception';

class TestEntity extends Entity<string> {
	constructor(state: EntityState<string>) {
		super(state);
	}

	public modify(updatedAt?: Date): number {
		return this.markAsModified(updatedAt);
	}
}

function makeState(
	overrides: Partial<EntityState<string>> = {}
): EntityState<string> {
	const createdAt = new Date('2024-01-01T00:00:00.000Z');
	const updatedAt = new Date('2024-01-01T00:00:00.000Z');
	return {
		id: 'entity-id-1',
		createdAt,
		updatedAt,
		aggregateVersion: 0,
		...overrides,
	};
}

describe('Entity', () => {
	describe('constructor', () => {
		it('creates an entity with a valid state', () => {
			const state = makeState();
			const entity = new TestEntity(state);

			expect(entity.id).toBe('entity-id-1');
			expect(entity.aggregateVersion).toBe(0);
		});

		it('accepts an aggregateVersion greater than zero', () => {
			const entity = new TestEntity(makeState({ aggregateVersion: 5 }));

			expect(entity.aggregateVersion).toBe(5);
		});

		it('accepts updatedAt equal to createdAt', () => {
			const date = new Date('2024-06-01T00:00:00.000Z');
			const entity = new TestEntity(
				makeState({ createdAt: date, updatedAt: date })
			);

			expect(entity.createdAt.getTime()).toBe(entity.updatedAt.getTime());
		});

		it('accepts updatedAt after createdAt', () => {
			const entity = new TestEntity(
				makeState({
					createdAt: new Date('2024-01-01'),
					updatedAt: new Date('2024-06-01'),
				})
			);

			expect(entity.updatedAt > entity.createdAt).toBe(true);
		});

		it('throws InvariantViolationException when createdAt is not a Date', () => {
			expect(
				() =>
					new TestEntity(
						makeState({
							createdAt: 'not-a-date' as unknown as Date,
						})
					)
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when createdAt is an invalid date', () => {
			expect(
				() =>
					new TestEntity(
						makeState({ createdAt: new Date('invalid') })
					)
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when updatedAt is not a Date', () => {
			expect(
				() =>
					new TestEntity(
						makeState({
							updatedAt: 'not-a-date' as unknown as Date,
						})
					)
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when updatedAt is an invalid date', () => {
			expect(
				() =>
					new TestEntity(
						makeState({ updatedAt: new Date('invalid') })
					)
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when aggregateVersion is negative', () => {
			expect(
				() => new TestEntity(makeState({ aggregateVersion: -1 }))
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when aggregateVersion is not an integer', () => {
			expect(
				() => new TestEntity(makeState({ aggregateVersion: 1.5 }))
			).toThrow(InvariantViolationException);
		});

		it('throws InvariantViolationException when updatedAt is earlier than createdAt', () => {
			expect(
				() =>
					new TestEntity(
						makeState({
							createdAt: new Date('2024-06-01'),
							updatedAt: new Date('2024-01-01'),
						})
					)
			).toThrow(InvariantViolationException);
		});
	});

	describe('getters', () => {
		it('id returns the correct identifier', () => {
			const entity = new TestEntity(makeState({ id: 'my-unique-id' }));

			expect(entity.id).toBe('my-unique-id');
		});

		it('createdAt returns a clone (protection against external mutation)', () => {
			const createdAt = new Date('2024-01-01T00:00:00.000Z');
			const entity = new TestEntity(
				makeState({ createdAt, updatedAt: createdAt })
			);
			const returned = entity.createdAt;
			returned.setFullYear(2099);

			expect(entity.createdAt.getFullYear()).toBe(2024);
		});

		it('updatedAt returns a clone (protection against external mutation)', () => {
			const date = new Date('2024-01-01T00:00:00.000Z');
			const entity = new TestEntity(
				makeState({ createdAt: date, updatedAt: date })
			);
			const returned = entity.updatedAt;
			returned.setFullYear(2099);

			expect(entity.updatedAt.getFullYear()).toBe(2024);
		});

		it('aggregateVersion returns the correct value', () => {
			const entity = new TestEntity(makeState({ aggregateVersion: 3 }));

			expect(entity.aggregateVersion).toBe(3);
		});
	});

	describe('markAsModified()', () => {
		it('increments aggregateVersion by 1', () => {
			const entity = new TestEntity(makeState({ aggregateVersion: 0 }));
			const newVersion = entity.modify(new Date());

			expect(newVersion).toBe(1);
			expect(entity.aggregateVersion).toBe(1);
		});

		it('increments aggregateVersion across multiple calls', () => {
			const entity = new TestEntity(makeState({ aggregateVersion: 0 }));
			entity.modify(new Date());
			entity.modify(new Date());
			const final = entity.modify(new Date());

			expect(final).toBe(3);
			expect(entity.aggregateVersion).toBe(3);
		});

		it('updates updatedAt with the provided date', () => {
			const entity = new TestEntity(makeState());
			const newDate = new Date('2025-12-31T00:00:00.000Z');
			entity.modify(newDate);

			expect(entity.updatedAt.getTime()).toBe(newDate.getTime());
		});

		it('uses the current date when none is provided', () => {
			const before = Date.now();
			const entity = new TestEntity(makeState());
			entity.modify();
			const after = Date.now();

			expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(after);
		});

		it('throws InvariantViolationException when the provided updatedAt is invalid', () => {
			const entity = new TestEntity(makeState());

			expect(() => entity.modify(new Date('invalid'))).toThrow(
				InvariantViolationException
			);
		});

		it('returns a clone of updatedAt (protection against mutation)', () => {
			const entity = new TestEntity(makeState());
			const updateDate = new Date('2025-01-01T00:00:00.000Z');
			entity.modify(updateDate);
			const returned = entity.updatedAt;
			returned.setFullYear(2099);

			expect(entity.updatedAt.getFullYear()).toBe(2025);
		});
	});
});
