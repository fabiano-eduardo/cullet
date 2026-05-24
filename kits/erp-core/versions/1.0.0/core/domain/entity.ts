import { InvariantViolationException } from '../exceptions/invariant-violation-exception';
import {
	type ContractVersion,
	version,
} from '../versioning/version';

interface EntityState<TIdentifier> {
	readonly id: TIdentifier;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly aggregateVersion: number;
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

function assertValidAggregateVersion(aggregateVersion: number): void {
	if (!Number.isInteger(aggregateVersion) || aggregateVersion < 0) {
		throw new InvariantViolationException(
			`aggregateVersion must be a non-negative integer. Received: ${aggregateVersion}`
		);
	}
}

@version('1.0')
abstract class Entity<TIdentifier> {
	public static readonly CONTRACT_VERSION: ContractVersion;

	private readonly _id: TIdentifier;
	private readonly _createdAt: Date;
	private _updatedAt: Date;
	private _aggregateVersion: number;

	protected constructor(state: EntityState<TIdentifier>) {
		assertValidDate('createdAt', state.createdAt);
		assertValidDate('updatedAt', state.updatedAt);
		assertValidAggregateVersion(state.aggregateVersion);

		if (state.updatedAt.getTime() < state.createdAt.getTime()) {
			throw new InvariantViolationException(
				'updatedAt cannot be earlier than createdAt'
			);
		}

		this._id = state.id;
		this._createdAt = cloneDate(state.createdAt);
		this._updatedAt = cloneDate(state.updatedAt);
		this._aggregateVersion = state.aggregateVersion;
	}

	public get id(): TIdentifier {
		return this._id;
	}

	public get createdAt(): Date {
		return cloneDate(this._createdAt);
	}

	public get updatedAt(): Date {
		return cloneDate(this._updatedAt);
	}

	public get aggregateVersion(): number {
		return this._aggregateVersion;
	}

	public get contractVersion(): ContractVersion {
		return Entity.CONTRACT_VERSION;
	}

	protected markAsModified(updatedAt: Date = new Date()): number {
		assertValidDate('updatedAt', updatedAt);

		this._updatedAt = cloneDate(updatedAt);
		this._aggregateVersion += 1;

		return this._aggregateVersion;
	}
}

export { Entity, type EntityState };
