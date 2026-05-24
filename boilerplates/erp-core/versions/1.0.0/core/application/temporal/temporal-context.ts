import { InvariantViolationException } from '../../exceptions/invariant-violation-exception';

interface TemporalContext {
	readonly asOf: Date;
	readonly requestedAt: Date;
}

interface CreateTemporalContextInput {
	readonly asOf?: Date;
	readonly requestedAt?: Date;
}

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

function assertTemporalContext(
	temporalContext: TemporalContext,
	fieldName: string = 'temporalContext'
): void {
	assertValidDate(`${fieldName}.asOf`, temporalContext.asOf);
	assertValidDate(`${fieldName}.requestedAt`, temporalContext.requestedAt);
}

function createTemporalContext(
	input: CreateTemporalContextInput = {}
): TemporalContext {
	const requestedAt = input.requestedAt ?? new Date();
	const asOf = input.asOf ?? requestedAt;

	assertTemporalContext({ asOf, requestedAt });

	return Object.freeze({
		asOf: cloneDate(asOf),
		requestedAt: cloneDate(requestedAt),
	});
}

export {
	assertTemporalContext,
	createTemporalContext,
	type CreateTemporalContextInput,
	type TemporalContext,
};
