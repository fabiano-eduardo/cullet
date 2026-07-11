import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";

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

function deepFreeze<T>(value: T): T {
    return deepFreezeInternal(value, new WeakSet<object>());
}

function deepFreezeInternal<T>(value: T, seen: WeakSet<object>): T {
    // Primitives and `null` need no freezing. `Date` is intentionally returned
    // as-is: `Object.freeze` cannot stop a Date's mutators (`setTime`,
    // `setFullYear`, …) because they write an internal slot, not an own
    // property — freezing it is a no-op against mutation. `makeImmutable`
    // already hands us a `structuredClone` copy, so the caller's original Date
    // is never aliased; deep-freezing of nested Dates is deliberately skipped.
    //
    // The same no-op caveat applies to `Map`/`Set`: `Object.freeze` locks the
    // wrapper's own properties but not `.set`/`.delete`/`.clear`, which mutate
    // internal slots. A frozen Map is still mutable through its methods. We do
    // not neuter those methods here (no value object wraps a Map today); if one
    // ever does, its immutability guarantee would be false — handle it there.
    if (typeof value !== "object" || value === null || value instanceof Date) {
        return value;
    }

    // A value already on `seen` has been visited on this pass (cyclic graph or a
    // shared reference); revisiting it would recurse forever.
    if (seen.has(value)) {
        return value;
    }
    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            deepFreezeInternal(item, seen);
        }

        return Object.freeze(value);
    }

    const objectValue = value as Record<PropertyKey, object | PrimitiveValue>;

    for (const propertyKey of Reflect.ownKeys(objectValue)) {
        // Read through the descriptor rather than `objectValue[propertyKey]` so
        // accessor properties are not invoked — a getter could have side effects
        // or throw, and its computed result can't be frozen anyway. Only data
        // properties hold a nested value worth recursing into.
        const descriptor = Object.getOwnPropertyDescriptor(
            objectValue,
            propertyKey,
        );
        if (descriptor && "value" in descriptor) {
            deepFreezeInternal(descriptor.value, seen);
        }
    }

    return Object.freeze(value);
}

function makeImmutable<T>(value: T): DeepReadonly<T> {
    if (typeof value !== "object" || value === null) {
        return value as DeepReadonly<T>;
    }

    let snapshot: T;
    try {
        snapshot = structuredClone(value);
    } catch (error) {
        // `structuredClone` throws `DataCloneError` for functions and symbols.
        // (Class instances do NOT throw — they are silently flattened to plain
        // objects, prototype lost.) Surface the error as a domain invariant
        // instead of leaking a host-specific runtime error to callers building
        // value objects.
        throw new InvariantViolationException(
            `makeImmutable requires a structured-cloneable value: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }

    return deepFreeze(snapshot) as DeepReadonly<T>;
}

export { deepFreeze, makeImmutable, type DeepReadonly };
