import { makeImmutable } from "../../shared/immutable";
import { assertValidDate } from "../../shared/temporal-guards";

interface TemporalContext {
    readonly asOf: Date;
    readonly requestedAt: Date;
}

interface CreateTemporalContextInput {
    readonly asOf?: Date;
    readonly requestedAt?: Date;
}

function assertTemporalContext(
    temporalContext: TemporalContext,
    fieldName: string = "temporalContext",
): void {
    assertValidDate(`${fieldName}.asOf`, temporalContext.asOf);
    assertValidDate(`${fieldName}.requestedAt`, temporalContext.requestedAt);
}

function createTemporalContext(
    input: CreateTemporalContextInput = {},
): TemporalContext {
    const requestedAt = input.requestedAt ?? new Date();
    const asOf = input.asOf ?? requestedAt;

    assertTemporalContext({ asOf, requestedAt });

    return makeImmutable({
        asOf,
        requestedAt,
    });
}

export {
    assertTemporalContext,
    createTemporalContext,
    type CreateTemporalContextInput,
    type TemporalContext,
};
