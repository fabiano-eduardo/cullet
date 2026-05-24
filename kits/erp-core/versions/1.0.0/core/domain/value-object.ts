import {
	type ContractVersion,
	version,
} from '../versioning/version';

type PrimitiveValue =
	| bigint
	| boolean
	| null
	| number
	| string
	| symbol
	| undefined;

type DeepReadonly<T> = T extends PrimitiveValue | Date
	? T
	: T extends readonly (infer TItem)[]
	? readonly DeepReadonly<TItem>[]
	: { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> };

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

@version('1.0')
abstract class ValueObject<T, P> {
	public static readonly CONTRACT_VERSION: ContractVersion;
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
