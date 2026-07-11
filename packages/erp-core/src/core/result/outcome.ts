import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";

/**
 * Outcome — Business decision abstraction.
 *
 * Represents the semantic result of a domain decision, policy evaluation,
 * or business rule. NOT for technical success/failure — use Result for that.
 *
 * Mental model:
 *   "What was the business decision?"
 *   NOT "Did the operation succeed?"
 *
 * The status axis represents valid business outcomes (APPROVED, REJECTED,
 * ALLOW, DENY, NO_OP, etc.), never technical Ok/Err.
 *
 * @typeParam S - Union of valid status literals for this outcome
 * @typeParam D - Shape of the decision data carried by this outcome
 */
export class Outcome<S extends string, D = undefined> {
    readonly status: S;
    readonly data: D;
    readonly reason: string | undefined;
    readonly metadata: Readonly<Record<string, unknown>>;

    private constructor(
        status: S,
        data: D,
        reason: string | undefined,
        metadata: Readonly<Record<string, unknown>>,
    ) {
        this.status = status;
        this.data = data;
        this.reason = reason;
        this.metadata = metadata;
        Object.freeze(this);
    }

    // ─── Generic factory ────────────────────────────────────────────────

    static of<S extends string, D = undefined>(
        status: S,
        data: D,
        reason?: string,
        metadata?: Record<string, unknown>,
    ): Outcome<S, D> {
        return new Outcome(
            status,
            data,
            reason,
            Object.freeze({ ...metadata }),
        );
    }

    // ─── Convenience factories for common business statuses ─────────────

    static approved<D = undefined>(
        data: D,
        reason?: string,
    ): Outcome<"APPROVED", D> {
        return Outcome.of("APPROVED", data, reason);
    }

    static rejected<D = undefined>(
        data: D,
        reason: string,
    ): Outcome<"REJECTED", D> {
        return Outcome.of("REJECTED", data, reason);
    }

    static noOp<D = undefined>(data: D, reason?: string): Outcome<"NO_OP", D> {
        return Outcome.of("NO_OP", data, reason);
    }

    static deferred<D = undefined>(
        data: D,
        reason: string,
    ): Outcome<"DEFERRED", D> {
        return Outcome.of("DEFERRED", data, reason);
    }

    static requiresReview<D = undefined>(
        data: D,
        reason: string,
    ): Outcome<"REQUIRES_REVIEW", D> {
        return Outcome.of("REQUIRES_REVIEW", data, reason);
    }

    // ─── Type narrowing ────────────────────────────────────────────────

    /**
     * Narrows this Outcome to a specific status.
     *
     * @example
     * if (outcome.is('DENY')) {
     *   outcome.data.violations // TS knows status is 'DENY'
     * }
     */
    is<T extends S>(status: T): this is Outcome<T, D> {
        return (this.status as string) === status;
    }

    // ─── Exhaustive match ──────────────────────────────────────────────

    /**
     * Exhaustive pattern match over all possible statuses.
     * TypeScript enforces that every status has a handler.
     *
     * @example
     * outcome.match({
     *   ALLOW: (o) => handleAllow(o.data),
     *   DENY:  (o) => handleDeny(o.data.violations),
     * })
     */
    match<THandlers extends { [K in S]: (outcome: Outcome<K, D>) => unknown }>(
        handlers: THandlers,
    ): ReturnType<THandlers[S]> {
        const handler = (
            handlers as Partial<Record<string, (o: unknown) => unknown>>
        )[this.status];

        if (typeof handler !== "function") {
            const availableStatuses = Object.keys(handlers);
            throw new InvariantViolationException(
                `Outcome.match is missing a handler for runtime status "${this.status}". Available handlers: ${availableStatuses.join(", ") || "(none)"}`,
            );
        }

        return handler(this) as ReturnType<THandlers[S]>;
    }

    // ─── Derived copies ────────────────────────────────────────────────

    withMetadata(extra: Record<string, unknown>): Outcome<S, D> {
        return new Outcome(
            this.status,
            this.data,
            this.reason,
            Object.freeze({ ...this.metadata, ...extra }),
        );
    }

    withReason(reason: string): Outcome<S, D> {
        return new Outcome(this.status, this.data, reason, this.metadata);
    }

    // ─── Debug ─────────────────────────────────────────────────────────

    toString(): string {
        const parts: string[] = [this.status];
        if (this.reason) parts.push(`reason="${this.reason}"`);
        return `Outcome(${parts.join(", ")})`;
    }
}

/** Common business outcome statuses. Extend per domain as needed. */
export type CommonOutcomeStatus =
    | "APPROVED"
    | "REJECTED"
    | "NO_OP"
    | "DEFERRED"
    | "REQUIRES_REVIEW";
