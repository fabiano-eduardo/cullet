import { type DeepReadonly } from '../value-object';

import {
	createTransactionTime,
	type CreateTransactionTimeInput,
	type TransactionTime,
} from './transaction-time';
import {
	createValidTime,
	type CreateValidTimeInput,
	type ValidTime,
} from './valid-time';

type PrimitiveValue =
	| bigint
	| boolean
	| null
	| number
	| string
	| symbol
	| undefined;

/**
 * Pairs a domain datum with its time dimensions (Business and Transaction).
 * It is the representation of an entry in the append-only (historical) table.
 */
interface TemporalSnapshot<T> {
	/** The data or state captured by the snapshot. */
	readonly data: DeepReadonly<T>;
	/** Period during which this datum was valid in the real world. */
	readonly validTime: ValidTime;
	/** Period during which this record was the state known to the system. */
	readonly txTime: TransactionTime;
}

interface CreateTemporalSnapshotInput<T> {
	readonly data: T;
	readonly validTime: CreateValidTimeInput;
	readonly txTime: CreateTransactionTimeInput;
}

function freezeRecursively<T>(value: T): T {
	if (typeof value !== 'object' || value === null || value instanceof Date) {
		return value;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			freezeRecursively(item);
		}

		return Object.freeze(value);
	}

	const objectValue = value as Record<PropertyKey, object | PrimitiveValue>;

	for (const propertyKey of Reflect.ownKeys(objectValue)) {
		freezeRecursively(objectValue[propertyKey]);
	}

	return Object.freeze(value);
}

function makeImmutable<T>(value: T): DeepReadonly<T> {
	if (typeof value !== 'object' || value === null) {
		return value as DeepReadonly<T>;
	}

	return freezeRecursively(structuredClone(value)) as DeepReadonly<T>;
}

function createTemporalSnapshot<T>(
	input: CreateTemporalSnapshotInput<T>
): TemporalSnapshot<T> {
	return Object.freeze({
		data: makeImmutable(input.data),
		validTime: createValidTime(input.validTime),
		txTime: createTransactionTime(input.txTime),
	});
}

export {
	createTemporalSnapshot,
	type CreateTemporalSnapshotInput,
	type TemporalSnapshot,
};
