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

type TemporalizedContextSeed<TSeed extends ContextSeed> = TSeed;

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
        }) as TSeed;
    }
}

export type { TemporalizedContextSeed, TemporalUseCaseInput };
export { TemporalUseCase };
