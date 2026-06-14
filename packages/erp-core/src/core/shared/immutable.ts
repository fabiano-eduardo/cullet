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
        deepFreezeInternal(objectValue[propertyKey], seen);
    }

    return Object.freeze(value);
}

function makeImmutable<T>(value: T): DeepReadonly<T> {
    if (typeof value !== "object" || value === null) {
        return value as DeepReadonly<T>;
    }

    return deepFreeze(structuredClone(value)) as DeepReadonly<T>;
}

export { deepFreeze, makeImmutable, type DeepReadonly };
