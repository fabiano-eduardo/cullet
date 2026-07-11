import { makeImmutable } from "../../shared/immutable.js";

import { assertHalfOpenInterval } from "./half-open-interval.js";

/**
 * Represents business time (Valid Time).
 * Defines when a piece of information is considered true or in effect in the real world.
 *
 * The window is half-open — `from` inclusive, `to` exclusive — and strictly
 * non-empty: `to` must be later than `from`, so a zero-duration range `[t, t)`
 * is deliberately not representable. Model an instantaneous event as an open
 * range closed by the next fact, not as an empty window.
 *
 * One caveat mirrors {@link ValueObject}: `createValidTime` clones the input
 * dates (no aliasing) but the inner `Date`s are NOT frozen — `Object.freeze`
 * cannot block `setTime`/`setFullYear`, so a caller can still mutate `from`
 * in place and corrupt the range after creation. `readonly` only prevents
 * reassignment. Treat the dates as read-only, or keep instants as ISO/epoch in
 * your own state when that guarantee matters.
 */
interface ValidTime {
    /** Start of the validity window (inclusive). */
    readonly from: Date;
    /** End of the validity window (exclusive). When absent, the information is still in effect. */
    readonly to?: Date;
}

type CreateValidTimeInput = ValidTime;

function assertValidTime(
    validTime: ValidTime,
    fieldName: string = "validTime",
): void {
    assertHalfOpenInterval(
        `${fieldName}.from`,
        validTime.from,
        `${fieldName}.to`,
        validTime.to,
    );
}

function createValidTime(input: CreateValidTimeInput): ValidTime {
    assertValidTime(input, "validTime");

    if (input.to === undefined) {
        return makeImmutable({
            from: input.from,
        });
    }

    return makeImmutable({
        from: input.from,
        to: input.to,
    });
}

export {
    assertValidTime,
    createValidTime,
    type CreateValidTimeInput,
    type ValidTime,
};
