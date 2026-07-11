import { makeImmutable } from "../../shared/immutable.js";

import { assertHalfOpenInterval } from "./half-open-interval.js";

/**
 * Represents transaction time (Transaction Time).
 * Defines when the system learned about or recorded a piece of information.
 * Useful for auditing and reconstructing system state at a specific past moment.
 *
 * The window is half-open — `recordedAt` inclusive, `supersededAt` exclusive —
 * and strictly non-empty: `supersededAt` must be later than `recordedAt`, so a
 * record superseded in the same instant it was written is not representable.
 *
 * One caveat mirrors {@link ValueObject}: `createTransactionTime` clones the
 * input dates (no aliasing) but the inner `Date`s are NOT frozen —
 * `Object.freeze` cannot block `setTime`/`setFullYear`, so a caller can still
 * mutate `recordedAt` in place and corrupt the audit record after creation.
 * `readonly` only prevents reassignment. Treat the dates as read-only, or keep
 * instants as ISO/epoch in your own state when that guarantee matters.
 */
interface TransactionTime {
    /** When the information was first recorded in the system. */
    readonly recordedAt: Date;
    /** When this information was superseded or invalidated by a newer version. */
    readonly supersededAt?: Date;
}

type CreateTransactionTimeInput = TransactionTime;

function assertTransactionTime(
    txTime: TransactionTime,
    fieldName: string = "txTime",
): void {
    assertHalfOpenInterval(
        `${fieldName}.recordedAt`,
        txTime.recordedAt,
        `${fieldName}.supersededAt`,
        txTime.supersededAt,
    );
}

function createTransactionTime(
    input: CreateTransactionTimeInput,
): TransactionTime {
    assertTransactionTime(input, "txTime");

    if (input.supersededAt === undefined) {
        return makeImmutable({
            recordedAt: input.recordedAt,
        });
    }

    return makeImmutable({
        recordedAt: input.recordedAt,
        supersededAt: input.supersededAt,
    });
}

export {
    assertTransactionTime,
    createTransactionTime,
    type CreateTransactionTimeInput,
    type TransactionTime,
};
