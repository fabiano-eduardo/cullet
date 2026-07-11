import { PluginManager } from "../plugins/index.js";
import { type DeepReadonly, makeImmutable } from "../shared/immutable.js";
import { stableStringify } from "../shared/stable-stringify.js";
import { type ContractVersion, version } from "../versioning/version.js";

/**
 * Extension point for value-object equality. A plugin implementing this
 * contract overrides how any two value objects are compared, letting the host
 * application swap in a structural comparator (e.g. `lodash.isEqual` over the
 * wrapped `value`) without every value object having to implement `equals` by
 * hand.
 */
type ValueObjectPluginContract = {
    equals: (
        a: ValueObject<unknown, unknown>,
        b: ValueObject<unknown, unknown>,
    ) => boolean;
};

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
 * One exception: nested `Date` instances are cloned but NOT frozen —
 * `Object.freeze` does not block `setTime`/`setFullYear`, so a consumer of
 * `value` can still mutate an inner `Date` in place. Store instants as ISO
 * strings or epoch timestamps in the wrapped state (converting to `Date` only
 * in an accessor) when that guarantee matters.
 *
 * @typeParam T - The shape of the wrapped data.
 * @typeParam P - The primitive form produced by {@link toPrimitive} / {@link toJSON}.
 */
@version("1.0")
abstract class ValueObject<T, P> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;

    /**
     * Registry of equality plugins shared by every value object. Empty by
     * default — when nothing is registered, {@link equals} falls back to a
     * structural comparison of the wrapped `value`. Hosts register a plugin
     * (e.g. `lodash.isEqual`) once at startup to customise equality globally.
     *
     * "Globally" is literal: this static registry is process-wide and shared
     * by **every** `ValueObject` subclass, including the value objects the kit
     * itself ships (RBAC's `Permission`, `Scope`, …). A registered plugin
     * therefore redefines equality for those too — it must honour generic
     * value-object semantics, not the quirks of one host type. For a
     * type-specific comparison, override `equals` on that subclass instead.
     */
    public static readonly plugins =
        new PluginManager<ValueObjectPluginContract>();

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
        return (this.constructor as typeof ValueObject).CONTRACT_VERSION;
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
     * carry no identity, two independently constructed instances holding the
     * same data are considered equal.
     *
     * Delegates to the registered equality {@link plugins}; with no plugin
     * registered it falls back to comparing the serialized wrapped `value`,
     * with object keys sorted so insertion order (e.g. code-built vs
     * JSON-rehydrated) never affects the result.
     * Subclasses may still override for a faster or domain-specific comparison.
     *
     * The fallback also requires both sides to be the same concrete class, so
     * an `OrderId` never equals a `CustomerId` that wraps the same string —
     * `other: this` only guards at compile time, and a cast would otherwise
     * slip through. And because the fallback serializes via `stableStringify`,
     * it inherits `JSON.stringify` semantics: `undefined` properties are
     * dropped (`{a: 1, b: undefined}` equals `{a: 1}`) and `Map`/`Set` collapse
     * to `{}` — see the caveats in `shared/stable-stringify.ts`. Override
     * `equals` when the wrapped value relies on such shapes.
     */
    public equals(other: this): boolean {
        return ValueObject.plugins.invoke("equals", [this, other], {
            fallback: (a, b) =>
                a.constructor === b.constructor &&
                stableStringify(a.value) === stableStringify(b.value),
        });
    }

    /**
     * Projects the value object down to a plain, serializable primitive form —
     * the representation suitable for persistence, transport, or comparison.
     */
    public abstract toPrimitive(): P;
}

export { type DeepReadonly, ValueObject, type ValueObjectPluginContract };
