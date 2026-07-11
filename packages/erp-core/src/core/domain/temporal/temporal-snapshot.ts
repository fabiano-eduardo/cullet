import { type DeepReadonly, makeImmutable } from "../../shared/immutable.js";

import {
    createTransactionTime,
    type CreateTransactionTimeInput,
    type TransactionTime,
} from "./transaction-time.js";
import {
    createValidTime,
    type CreateValidTimeInput,
    type ValidTime,
} from "./valid-time.js";

/**
 * Pairs a domain datum with its time dimensions (Business and Transaction).
 * It is the representation of an entry in the append-only (historical) table.
 *
 * `data` must be plain, structured-cloneable state — the primitive shape of an
 * aggregate, not the aggregate itself. `createTemporalSnapshot` deep-clones it
 * via `structuredClone`: functions and symbols inside `data` throw an
 * `InvariantViolationException`, and class instances (a `ValueObject`, an
 * `Entity`) are NOT rejected — they are silently flattened to plain objects,
 * losing their prototype (and with it `equals`/`toPrimitive`). Project rich
 * objects down first, e.g. with `toPrimitive()`.
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
    // The time dimensions come out of their factories already cloned and
    // frozen; only `data` still needs the clone+freeze. Freezing the shell by
    // hand avoids a second structuredClone pass over the whole snapshot.
    return Object.freeze({
        data: makeImmutable(input.data),
        validTime: createValidTime(input.validTime),
        txTime: createTransactionTime(input.txTime),
    });
}

export {
    createTemporalSnapshot,
    type CreateTemporalSnapshotInput,
    type TemporalSnapshot,
};
