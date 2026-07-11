import { UseCase } from "../use-case.js";
import { version } from "../../versioning/version.js";
import type { ContextSeed } from "../../policies/index.js";
import type { Result } from "../../result/result.js";

import {
    createTemporalContext,
    type TemporalContext,
} from "./temporal-context.js";

/**
 * Marker mixed into a temporal use case's `Input`.
 *
 * The consumer's `Input` must not re-declare `temporalContext` with an
 * incompatible type: `TemporalUseCase` intersects the two, and a clashing
 * declaration collapses the field to `never` (surfacing only as a confusing
 * error at the call site, not here).
 */
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

@version("1.0")
abstract class TemporalUseCase<
    Input extends object,
    Output extends Result<unknown, unknown>,
> extends UseCase<Input & TemporalUseCaseInput, Output> {
    protected resolveTemporalContext(
        input: Input & TemporalUseCaseInput,
    ): TemporalContext {
        return createTemporalContext(input.temporalContext);
    }

    /**
     * Enriches a policy `ContextSeed` with `fields.now`, taken from the
     * context's `requestedAt` (wall-clock time of the request).
     *
     * NOTE: this injects **only** `now` (from `requestedAt`) — it does *not*
     * propagate `temporalContext.asOf`. Policy evaluation derives its own
     * `asOf` from whichever seed field the policy's `asOfSource` points at
     * (via `fields.now` by default). So a retroactive use case (an `asOf` in
     * the past) will still evaluate policies at the *current* time unless the
     * author maps `temporalContext.asOf` onto that seed field explicitly. Do
     * that mapping in the use case when back-dated evaluation is intended.
     */
    protected buildPolicySeed<TSeed extends ContextSeed>(
        seed: TSeed,
        temporalContext: TemporalContext,
    ): TemporalizedContextSeed<TSeed> {
        // ponytail: shallow-freeze the two objects we create (outer + fields);
        // nested `fields` values belong to the caller's seed — not ours to
        // deep-freeze (would freeze shared refs) or structuredClone (would
        // flatten any class instances the seed carries).
        const fields = Object.freeze({
            ...seed.fields,
            now: new Date(temporalContext.requestedAt.getTime()),
        });
        return Object.freeze({
            ...seed,
            fields,
        }) as TemporalizedContextSeed<TSeed>;
    }
}

export type { TemporalizedContextSeed, TemporalUseCaseInput };
export { TemporalUseCase };
