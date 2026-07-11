import type { AsOfSource } from "../catalog/index.js";
import type { ContextSeed } from "../context/index.js";
import { Result } from "../../result/result.js";
import { isValidDate } from "../../shared/temporal-guards.js";

const DEFAULT_MAX_AS_OF_FUTURE_YEARS = 10;

export interface DeriveAsOfOptions {
    readonly maxFutureYears?: number;
}

/**
 * Derives the `asOf` instant an evaluation is pinned to.
 *
 * With `asOfSource: "CALLER_PROVIDED"` the instant comes from the reserved
 * `seed.fields.asOf` key (a `Date`); with `"NOW"` it is the evaluation clock.
 *
 * The bound is intentionally asymmetric: a caller-provided `asOf` may be at
 * most `maxFutureYears` in the future (a fat-finger / clock-skew guard against
 * selecting a not-yet-in-force policy), but is unbounded in the past — querying
 * how a policy stood at any historical instant is a first-class use of a
 * temporal engine, so back-dating is never capped.
 */
export class PolicyAsOfResolver {
    private static resolveMaxFutureYears(
        options: DeriveAsOfOptions,
    ): Result<number, string> {
        const maxFutureYears =
            options.maxFutureYears ?? DEFAULT_MAX_AS_OF_FUTURE_YEARS;

        if (!Number.isInteger(maxFutureYears) || maxFutureYears < 0) {
            return Result.err(
                `deriveAsOf maxFutureYears must be a non-negative integer. Received: ${maxFutureYears}`,
            );
        }

        return Result.ok(maxFutureYears);
    }

    static derive(
        source: AsOfSource,
        seed: ContextSeed,
        now: Date,
        options: DeriveAsOfOptions = {},
    ): Result<Date, string> {
        const maxFutureYearsResult =
            PolicyAsOfResolver.resolveMaxFutureYears(options);
        if (maxFutureYearsResult.isErr()) {
            return Result.err(maxFutureYearsResult.errorOrNull()!);
        }
        const maxFutureYears = maxFutureYearsResult.getOrNull()!;

        switch (source) {
            case "NOW":
                return Result.ok(now);

            case "CALLER_PROVIDED": {
                const asOf = seed.fields["asOf"];
                if (!isValidDate(asOf)) {
                    return Result.err(
                        'asOfSource "CALLER_PROVIDED" requires seed.fields.asOf to be a Date',
                    );
                }

                const maxFuture = new Date(now);
                maxFuture.setFullYear(maxFuture.getFullYear() + maxFutureYears);
                if (asOf > maxFuture) {
                    return Result.err(
                        `asOf date is more than ${maxFutureYears} years in the future (received ${asOf.toISOString()})`,
                    );
                }

                return Result.ok(asOf);
            }

            default:
                return Result.err(`Unknown asOfSource: "${source}"`);
        }
    }
}
