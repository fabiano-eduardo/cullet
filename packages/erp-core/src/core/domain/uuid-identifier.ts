import { ValueObject } from "./value-object.js";

/**
 * Canonical RFC-4122 UUID (versions 1–5), matched case-insensitively. Declared
 * once here so the dozens of typed identifiers a domain accumulates never have
 * to re-state the pattern.
 */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Base class for UUID-backed identity value objects.
 *
 * A domain typically has many of these — `OrderId`, `CustomerId`, `InvoiceId` —
 * all wrapping the same `string` shape. Two problems follow: the UUID format
 * check gets copy-pasted into every one, and because the wrapped shape is
 * identical, TypeScript's structural typing would happily accept an `OrderId`
 * where a `CustomerId` is expected. `UuidIdentifier` solves both: the format
 * lives here once ({@link isValid}), and the `TBrand` phantom tag makes each
 * subtype nominally distinct so the ids cannot be swapped for one another.
 *
 * It deliberately does not impose a factory. Identifiers vary in how they
 * report an invalid value (their own exception type, their own message), so a
 * concrete id adds a validating `create` that calls {@link isValid} plus a
 * `reconstitute` that trusts an already-persisted value:
 *
 * ```ts
 * class OrderId extends UuidIdentifier<"OrderId"> {
 *   private constructor(value: string) { super(value); }
 *   static create(raw: string): OrderId {
 *     if (!UuidIdentifier.isValid(raw)) throw new InvalidOrderIdError(raw);
 *     return new OrderId(raw);
 *   }
 *   static reconstitute(value: string): OrderId { return new OrderId(value); }
 * }
 * ```
 *
 * @typeParam TBrand - A unique string literal that nominally tags the subtype.
 */
abstract class UuidIdentifier<
    TBrand extends string = string,
> extends ValueObject<string, string> {
    /**
     * Phantom brand. Never assigned at runtime (`declare`), it exists only so
     * two identifiers with different brands are not interchangeable at the type
     * level despite sharing the same `string` value.
     */
    protected declare readonly __brand: TBrand;

    protected constructor(value: string) {
        super(value);
    }

    public toPrimitive(): string {
        return this.value;
    }

    /** The wrapped UUID string — convenient for logging and interpolation. */
    public toString(): string {
        return this.value;
    }

    /**
     * Whether `candidate` is a canonical UUID (versions 1–5). The single source
     * of truth for the format; concrete identifiers call this from `create`.
     */
    public static isValid(candidate: string): boolean {
        return UUID_PATTERN.test(candidate);
    }
}

export { UuidIdentifier };
