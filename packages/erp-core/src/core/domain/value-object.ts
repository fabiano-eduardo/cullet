import { type DeepReadonly, makeImmutable } from "../shared/immutable.js";
import { type ContractVersion, version } from "../versioning/version.js";

@version("1.0")
abstract class ValueObject<T, P> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;
    public readonly value: DeepReadonly<T>;

    protected constructor(value: T) {
        this.value = makeImmutable(value);
    }

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

    public toJSON(): P {
        return this.toPrimitive();
    }

    public abstract equals(other: this): boolean;

    public abstract toPrimitive(): P;
}

export { type DeepReadonly, ValueObject };
