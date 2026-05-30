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
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }

    return Object.freeze(value);
  }

  const objectValue = value as Record<PropertyKey, object | PrimitiveValue>;

  for (const propertyKey of Reflect.ownKeys(objectValue)) {
    deepFreeze(objectValue[propertyKey]);
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
