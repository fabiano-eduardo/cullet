abstract class DomainException extends Error {
    // ES2020's `Error` lib type does not declare `cause`; mirror the sibling
    // `AppError` and carry it explicitly so a domain exception can wrap the
    // lower-level failure that triggered it. Assigned rather than passed to
    // `super` to stay independent of the ES2022 `Error(message, { cause })`
    // overload the build target doesn't guarantee.
    public readonly cause?: unknown;

    constructor(message: string, options?: { cause?: unknown }) {
        super(message);
        this.cause = options?.cause;
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = new.target.name;
    }
}

export { DomainException };
