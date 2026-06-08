import { type DeepReadonly, makeImmutable } from "../../shared/immutable";

import {
    createTransactionTime,
    type CreateTransactionTimeInput,
    type TransactionTime,
} from "./transaction-time";
import {
    createValidTime,
    type CreateValidTimeInput,
    type ValidTime,
} from "./valid-time";

/**
 * Pairs a domain datum with its time dimensions (Business and Transaction).
 * It is the representation of an entry in the append-only (historical) table.
 */
interface TemporalSnapshot<T> {
    /** The data or state captured by the snapshot. */
    readonly data: DeepReadonly<T>;
    /** Period during which this datum was valid in the real world. */
    readonly validTime: ValidTime;
    /** Period during which this record was the state known to the system. */
    readonly txTime: TransactionTime;
}

interface CreateTemporalSnapshotInput<T> {
    readonly data: T;
    readonly validTime: CreateValidTimeInput;
    readonly txTime: CreateTransactionTimeInput;
}

function createTemporalSnapshot<T>(
    input: CreateTemporalSnapshotInput<T>,
): TemporalSnapshot<T> {
    return makeImmutable({
        data: input.data,
        validTime: createValidTime(input.validTime),
        txTime: createTransactionTime(input.txTime),
    });
}

export {
    createTemporalSnapshot,
    type CreateTemporalSnapshotInput,
    type TemporalSnapshot,
};
