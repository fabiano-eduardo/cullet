import { UseCase } from "../use-case.js";
import type { ContextSeed } from "../../policies/index.js";
import type { Result } from "../../result/result.js";

import {
    createTemporalContext,
    type TemporalContext,
} from "./temporal-context.js";

interface TemporalUseCaseInput {
    readonly temporalContext?: TemporalContext;
}

/**
 * A {@link ContextSeed} after temporal enrichment by
 * {@link TemporalUseCase.buildPolicySeed}: structurally identical to `TSeed`,
 * except `fields.now` is now guaranteed present as a `Date` (injected from the
 * resolved {@link TemporalContext}). Downstream policies can therefore read
 * `seed.fields.now` without a presence/type guard.
 */
type TemporalizedContextSeed<TSeed extends ContextSeed> = Omit<
    TSeed,
    "fields"
> & {
    readonly fields: TSeed["fields"] & { readonly now: Date };
};

abstract class TemporalUseCase<
    Input extends object,
    Output extends Result<unknown, unknown>,
> extends UseCase<Input & TemporalUseCaseInput, Output> {
    protected resolveTemporalContext(
        input: Input & TemporalUseCaseInput,
    ): TemporalContext {
        return createTemporalContext(input.temporalContext);
    }

    protected buildPolicySeed<TSeed extends ContextSeed>(
        seed: TSeed,
        temporalContext: TemporalContext,
    ): TemporalizedContextSeed<TSeed> {
        return Object.freeze({
            ...seed,
            fields: {
                ...seed.fields,
                now: new Date(temporalContext.requestedAt.getTime()),
            },
        }) as TemporalizedContextSeed<TSeed>;
    }
}

export type { TemporalizedContextSeed, TemporalUseCaseInput };
export { TemporalUseCase };
