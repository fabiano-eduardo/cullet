import { type DeepReadonly, makeImmutable } from "../shared/immutable.js";
import { type ContractVersion, version } from "../versioning/version.js";

/**
 * Base class for value objects — domain concepts defined entirely by their
 * contents, with no identity of their own. Two value objects are
 * interchangeable when they hold equal data, which is the opposite of an
 * {@link Entity} (compared by id). Money, a CPF, a date range: replacing one
 * instance with an equal one changes nothing about the model.
 *
 * Immutability is the defining guarantee here. The wrapped `value` is
 * deep-frozen on construction, so a value object can be shared freely without
 * any risk of a consumer mutating shared state. Subclasses seal the instance
 * itself with {@link finalize} once their own fields are set.
 *
 * @typeParam T - The shape of the wrapped data.
 * @typeParam P - The primitive form produced by {@link toPrimitive} / {@link toJSON}.
 */
@version("1.0")
abstract class ValueObject<T, P> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;

    /** The wrapped data, deep-frozen so it can never be mutated after construction. */
    public readonly value: DeepReadonly<T>;

    /**
     * Wraps `value`, deep-freezing it so the value object is immutable from the
     * moment it exists. Declared `protected` because value objects are built
     * through a validating subclass factory, never instantiated directly.
     */
    protected constructor(value: T) {
        this.value = makeImmutable(value);
    }

    /**
     * The schema/contract version stamped on this value-object type by the
     * `@version` decorator — used to detect state persisted under an older shape.
     */
    public get contractVersion(): ContractVersion {
        return ValueObject.CONTRACT_VERSION;
    }

    /**
     * Freezes the instance shell, blocking reassignment of any own field.
     *
     * `value` is already deep-frozen by the constructor, so the wrapped data is
     * immutable regardless. The instance itself is NOT frozen automatically
     * because a subclass may still need to assign its own fields after
     * `super(value)` runs. Call `finalize()` at the very end of the subclass
     * constructor (after all fields are set) to make the whole value object
     * immutable.
     */
    protected finalize(): void {
        Object.freeze(this);
    }

    /**
     * Hook for `JSON.stringify`. Delegates to {@link toPrimitive} so a value
     * object serializes to its primitive form rather than exposing the internal
     * `value` wrapper.
     */
    public toJSON(): P {
        return this.toPrimitive();
    }

    /**
     * Compares this value object with another by content. Because value objects
     * carry no identity, subclasses implement equality over the wrapped data
     * (typically the primitive form), so two independently constructed instances
     * holding the same data are considered equal.
     */
    public abstract equals(other: this): boolean;

    /**
     * Projects the value object down to a plain, serializable primitive form —
     * the representation suitable for persistence, transport, or comparison.
     */
    public abstract toPrimitive(): P;
}

export { type DeepReadonly, ValueObject };
