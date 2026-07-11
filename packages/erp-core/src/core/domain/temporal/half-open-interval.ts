import { InvariantViolationException } from "../../exceptions/invariant-violation-exception.js";
import { assertValidDate } from "../../shared/temporal-guards.js";

/**
 * Shared core of the bitemporal primitives: a half-open interval
 * `[start, end)` whose end, when present, must be strictly later than its
 * start. `ValidTime` and `TransactionTime` are the same shape under different
 * (deliberate) vocabularies — the invariant lives here once so the two files
 * cannot drift apart.
 *
 * Internal to `domain/temporal`; not exported from the barrel.
 */
function assertHalfOpenInterval(
    startLabel: string,
    start: Date,
    endLabel: string,
    end: Date | undefined,
): void {
    assertValidDate(startLabel, start);

    if (end === undefined) {
        return;
    }

    assertValidDate(endLabel, end);

    if (end.getTime() <= start.getTime()) {
        throw new InvariantViolationException(
            `${endLabel} must be later than ${startLabel}`,
        );
    }
}

export { assertHalfOpenInterval };
