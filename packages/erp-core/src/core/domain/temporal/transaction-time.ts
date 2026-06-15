import { InvariantViolationException } from "../../exceptions/invariant-violation-exception.js";
import { makeImmutable } from "../../shared/immutable.js";
import { assertValidDate } from "../../shared/temporal-guards.js";

/**
 * Represents transaction time (Transaction Time).
 * Defines when the system learned about or recorded a piece of information.
 * Useful for auditing and reconstructing system state at a specific past moment.
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
    assertValidDate(`${fieldName}.recordedAt`, txTime.recordedAt);

    if (txTime.supersededAt === undefined) {
        return;
    }

    assertValidDate(`${fieldName}.supersededAt`, txTime.supersededAt);

    if (txTime.supersededAt.getTime() <= txTime.recordedAt.getTime()) {
        throw new InvariantViolationException(
            `${fieldName}.supersededAt must be later than ${fieldName}.recordedAt`,
        );
    }
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
