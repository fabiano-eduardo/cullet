import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";
import { assertValidAggregateVersion } from "../shared/aggregate-version.js";
import { assertValidDate, cloneDate } from "../shared/temporal-guards.js";
import { type ContractVersion, version } from "../versioning/version.js";

interface EntityState<TIdentifier> {
    readonly id: TIdentifier;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly aggregateVersion: number;
}

@version("1.0")
abstract class Entity<TIdentifier> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;

    private readonly _id: TIdentifier;
    private readonly _createdAt: Date;
    private _updatedAt: Date;
    private _aggregateVersion: number;

    protected constructor(state: EntityState<TIdentifier>) {
        assertValidDate("createdAt", state.createdAt);
        assertValidDate("updatedAt", state.updatedAt);
        assertValidAggregateVersion(state.aggregateVersion);

        if (state.updatedAt.getTime() < state.createdAt.getTime()) {
            throw new InvariantViolationException(
                "updatedAt cannot be earlier than createdAt",
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
        assertValidDate("updatedAt", updatedAt);

        if (updatedAt.getTime() < this._createdAt.getTime()) {
            throw new InvariantViolationException(
                "updatedAt cannot be earlier than createdAt",
            );
        }

        this._updatedAt = cloneDate(updatedAt);
        this._aggregateVersion += 1;

        return this._aggregateVersion;
    }
}

export { Entity, type EntityState };
