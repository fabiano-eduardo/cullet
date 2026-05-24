import { InvariantViolationException } from '../../exceptions/invariant-violation-exception';

/**
 * Represents transaction time (Transaction Time).
 * Defines when the system learned about or recorded a piece of information.
 * Useful for auditing and reconstructing system state at a specific past moment.
 */
interface TransactionTime {
	/** When the information was first recorded in the system. */
	readonly recordedAt: Date;
	/** When this information was superseded or invalidated by a newer version. */
	readonly supersededAt?: Date;
}

type CreateTransactionTimeInput = TransactionTime;

function cloneDate(date: Date): Date {
	return new Date(date.getTime());
}

function assertValidDate(fieldName: string, value: Date): void {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new InvariantViolationException(
			`${fieldName} must be a valid Date instance`
		);
	}
}

function assertTransactionTime(
	txTime: TransactionTime,
	fieldName: string = 'txTime'
): void {
	assertValidDate(`${fieldName}.recordedAt`, txTime.recordedAt);

	if (txTime.supersededAt === undefined) {
		return;
	}

	assertValidDate(`${fieldName}.supersededAt`, txTime.supersededAt);

	if (txTime.supersededAt.getTime() <= txTime.recordedAt.getTime()) {
		throw new InvariantViolationException(
			`${fieldName}.supersededAt must be later than ${fieldName}.recordedAt`
		);
	}
}

function createTransactionTime(
	input: CreateTransactionTimeInput
): TransactionTime {
	assertTransactionTime(input, 'txTime');

	if (input.supersededAt === undefined) {
		return Object.freeze({
			recordedAt: cloneDate(input.recordedAt),
		});
	}

	return Object.freeze({
		recordedAt: cloneDate(input.recordedAt),
		supersededAt: cloneDate(input.supersededAt),
	});
}

export {
	assertTransactionTime,
	createTransactionTime,
	type CreateTransactionTimeInput,
	type TransactionTime,
};
