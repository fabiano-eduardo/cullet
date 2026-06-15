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
