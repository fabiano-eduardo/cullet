import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";
import { assertValidAggregateVersion } from "../shared/aggregate-version.js";
import { assertValidDate, cloneDate } from "../shared/temporal-guards.js";
import { type ContractVersion, version } from "../versioning/version.js";

import { ValueObject } from "./value-object.js";

/**
 * The minimal persisted shape needed to reconstitute an {@link Entity}.
 *
 * This is the contract between storage and the domain: a repository maps a row
 * (or document) onto these four fields and hands them to a subclass constructor.
 * `aggregateVersion` travels with the state so optimistic-concurrency checks
 * survive a round-trip through the database.
 */
interface EntityState<TIdentifier> {
    readonly id: TIdentifier;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly aggregateVersion: number;
}

/**
 * Base class for domain entities — objects defined by a stable identity rather
 * than by their attributes. Two entities are "the same" when their `id`
 * matches, even if every other field differs; this is the opposite of a
 * {@link ValueObject}, which is defined entirely by its contents.
 *
 * The class owns the bookkeeping common to every aggregate root: a creation
 * timestamp that never changes, a last-modified timestamp, and an
 * `aggregateVersion` counter used for optimistic concurrency control. All three
 * are validated on construction and the dates are defensively cloned, so an
 * entity can never be built into — or leak — an inconsistent temporal state.
 *
 * @typeParam TIdentifier - The identity type (e.g. a branded string id or a VO).
 */
@version("1.0")
abstract class Entity<TIdentifier> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;

    private readonly _id: TIdentifier;
    private readonly _createdAt: Date;
    private _updatedAt: Date;
    private _aggregateVersion: number;

    /**
     * Reconstitutes an entity from its persisted {@link EntityState}.
     *
     * Validates the temporal invariants up front so an invalid entity is
     * impossible to construct: both dates must be valid, the aggregate version
     * must be a non-negative integer, and `updatedAt` may not predate
     * `createdAt`. Both dates are cloned on the way in so a later mutation of
     * the caller's `Date` objects cannot reach into the entity's internal state.
     *
     * Declared `protected` because entities are reconstituted through a
     * subclass factory, never instantiated directly by application code.
     *
     * @throws {InvariantViolationException} When `id` is absent, or when
     *   `updatedAt` is earlier than `createdAt`.
     */
    protected constructor(state: EntityState<TIdentifier>) {
        if (state.id == null) {
            throw new InvariantViolationException(
                "id is required: an entity cannot exist without an identity",
            );
        }

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

    /** The entity's stable identity — the basis for equality between entities. */
    public get id(): TIdentifier {
        return this._id;
    }

    /**
     * When the entity was first created.
     *
     * Returns a clone so callers cannot mutate the entity's internal `Date`;
     * the value is fixed at construction and never changes thereafter.
     */
    public get createdAt(): Date {
        return cloneDate(this._createdAt);
    }

    /**
     * When the entity was last modified.
     *
     * Returns a clone for the same encapsulation reason as {@link createdAt};
     * the underlying value advances only through {@link markAsModified}.
     */
    public get updatedAt(): Date {
        return cloneDate(this._updatedAt);
    }

    /**
     * Monotonic counter incremented on every mutation, used for optimistic
     * concurrency control: a writer reads this value, and the persistence layer
     * rejects the write if the stored version has moved on in the meantime.
     */
    public get aggregateVersion(): number {
        return this._aggregateVersion;
    }

    /**
     * The schema/contract version stamped on this entity type by the
     * `@version` decorator — used to detect and migrate state persisted under
     * an older shape.
     */
    public get contractVersion(): ContractVersion {
        return (this.constructor as typeof Entity).CONTRACT_VERSION;
    }

    /**
     * The single seam through which an entity records a mutation: it advances
     * `updatedAt` and bumps {@link aggregateVersion} by one. Subclasses must
     * call this from every state-changing method so the version counter stays
     * an accurate optimistic-lock token.
     *
     * `updatedAt` is monotonic: each call must be at or after the current
     * `updatedAt` (equal is fine — two mutations can share a millisecond).
     * Without this, the version counter would advance while the timestamp
     * walked backwards, corrupting any audit trail or ordering that reads
     * `updatedAt`. A caller replaying out-of-order events must sort them first.
     *
     * @param updatedAt - The modification instant; defaults to now.
     * @returns The new aggregate version after the increment.
     * @throws {InvariantViolationException} When `updatedAt` is earlier than
     *   the current `updatedAt`.
     */
    protected markAsModified(updatedAt: Date = new Date()): number {
        assertValidDate("updatedAt", updatedAt);

        if (updatedAt.getTime() < this._updatedAt.getTime()) {
            throw new InvariantViolationException(
                "updatedAt cannot move backwards: it must be at or after the current updatedAt",
            );
        }

        this._updatedAt = cloneDate(updatedAt);
        this._aggregateVersion += 1;

        return this._aggregateVersion;
    }

    /**
     * Identity-based equality — the semantics that define an entity. Two
     * entities are equal when they are the same concrete class and their ids
     * match, regardless of any other field.
     *
     * The class check keeps a `CustomerId`-bearing entity from equalling an
     * unrelated entity that happens to reuse the same raw id. Value-object ids
     * are compared through their own `equals`, so two independently
     * reconstituted id instances still match; primitive ids use `===`.
     */
    public equals(other: Entity<TIdentifier> | null | undefined): boolean {
        if (other == null) {
            return false;
        }
        if (other === this) {
            return true;
        }
        if (other.constructor !== this.constructor) {
            return false;
        }

        const id: unknown = this._id;
        if (id instanceof ValueObject) {
            return id.equals(other._id as typeof id);
        }

        return this._id === other._id;
    }
}

export { Entity, type EntityState };
