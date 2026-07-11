/**
 * Represents the outcome of an operation that may succeed or fail.
 * Useful for avoiding excessive exceptions and making error flows explicit.
 */
export abstract class Result<T, E> {
    protected constructor() {
        // prevent direct instantiation
    }

    /**
     * Creates a success result containing a value.
     */
    static ok<T>(value: T): Result<T, never> {
        return new Ok(value);
    }

    /**
     * Creates an error result containing an error object.
     */
    static err<E>(error: E): Result<never, E> {
        return new Err(error);
    }

    /**
     * Returns true when this is a success result.
     */
    abstract isOk(): this is Ok<T>;

    /**
     * Returns true when this is an error result.
     */
    abstract isErr(): this is Err<E>;

    /**
     * Runs a handler based on the result state (similar to pattern matching).
     */
    abstract match<R>(handlers: {
        ok: (value: T) => R;
        err: (error: E) => R;
    }): R;

    /**
     * Returns the value when this is success, or null when this is an error.
     *
     * Note: an `Ok(null)` also returns `null`, indistinguishable from an `Err`.
     * Use `match`/`isOk` when that distinction matters.
     */
    getOrNull(): T | null {
        return this.match({
            ok: (value) => value,
            err: () => null,
        });
    }

    /**
     * Returns the error when this is a failure, or null when this is a success.
     */
    errorOrNull(): E | null {
        return this.match({
            ok: () => null,
            err: (error) => error,
        });
    }

    /**
     * Returns the value when this is a success, or throws the error when this is a failure.
     */
    getOrThrow(): T {
        return this.match({
            ok: (value) => value,
            err: (error) => {
                throw toError(error);
            },
        });
    }

    /**
     * Transforms the success value using the provided function. Keeps the error when this is a failure.
     *
     * Exceptions thrown by `transform` propagate; they are not captured into an `Err`.
     */
    map<R>(transform: (value: T) => R): Result<R, E> {
        return this.match<Result<R, E>>({
            ok: (value) => Result.ok(transform(value)),
            // TS does not "see" variance here; the cast is intentional and safe:
            // Err carries no T, so it can be widened to Result<R, E> safely.
            err: (error) => Result.err(error) as unknown as Result<R, E>,
        });
    }

    /**
     * Transforms the error using the provided function. Keeps the value when this is a success.
     *
     * Exceptions thrown by `transform` propagate; they are not captured into an `Err`.
     */
    mapError<F>(transform: (error: E) => F): Result<T, F> {
        return this.match<Result<T, F>>({
            // Ok carries no E, so it can be widened to Result<T, F>.
            ok: (value) => Result.ok(value) as unknown as Result<T, F>,
            err: (error) => Result.err(transform(error)),
        });
    }

    /**
     * Chains another operation that returns a Result when this result is a success.
     *
     * Exceptions thrown by `transform` propagate; they are not captured into an `Err`.
     */
    flatMap<R>(transform: (value: T) => Result<R, E>): Result<R, E> {
        return this.match<Result<R, E>>({
            ok: (value) => transform(value),
            err: (error) => Result.err(error) as unknown as Result<R, E>,
        });
    }
}

/**
 * Success variant of Result.
 *
 * The instance is frozen, but the freeze is shallow: a contained mutable
 * object is not frozen.
 */
export class Ok<T> extends Result<T, never> {
    public readonly value: T;

    constructor(value: T) {
        super();
        this.value = value;
        Object.freeze(this);
    }

    isOk(): this is Ok<T> {
        return true;
    }

    isErr(): this is Err<never> {
        return false;
    }

    match<R>(handlers: { ok: (value: T) => R; err: (error: never) => R }): R {
        return handlers.ok(this.value);
    }
}

/**
 * Error variant of Result.
 */
export class Err<E> extends Result<never, E> {
    public readonly error: E;

    constructor(error: E) {
        super();
        this.error = error;
        Object.freeze(this);
    }

    isOk(): this is Ok<never> {
        return false;
    }

    isErr(): this is Err<E> {
        return true;
    }

    match<R>(handlers: { ok: (value: never) => R; err: (error: E) => R }): R {
        return handlers.err(this.error);
    }
}

/**
 * Coerces an arbitrary error value into an Error for `getOrThrow`, preserving
 * the original structured payload as `cause` so nothing is lost when `E` is a
 * plain object/DTO rather than an Error.
 */
function toError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === "string") return new Error(error);
    let message: string | undefined;
    try {
        message = JSON.stringify(error);
    } catch {
        // circular / BigInt / etc.
    }
    const wrapped = new Error(message ?? String(error));
    // Attach the original payload as `cause` (assigned, not passed to the
    // ES2022 constructor option, to stay within the ES2020 lib target).
    (wrapped as Error & { cause?: unknown }).cause = error;
    return wrapped;
}
