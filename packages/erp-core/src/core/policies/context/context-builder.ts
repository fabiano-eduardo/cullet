import { Result } from "../../result/result";

import type { ContextResolverRegistry } from "./context-registry";
import type {
    ContextResolverResilienceOptions,
    ContextResolverRetryOptions,
    ContextValueResolver,
} from "./context-resolver";
import type { ContextSeed } from "./context-seed";
import { PolicyContextPath } from "./path";

interface NormalizedContextResolverRetryOptions {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
    readonly backoffMultiplier: number;
}

interface NormalizedContextResolverCircuitBreakerOptions {
    readonly failureThreshold: number;
    readonly cooldownMs: number;
}

interface NormalizedContextResolverResilienceOptions {
    readonly timeoutMs: number | null;
    readonly retry: NormalizedContextResolverRetryOptions;
    readonly circuitBreaker: NormalizedContextResolverCircuitBreakerOptions | null;
}

interface ContextResolverCircuitState {
    readonly failureCount: number;
    readonly openUntilMs: number | null;
}

export interface PolicyContextBuilderOptions {
    readonly defaultResolverResilience?: ContextResolverResilienceOptions;
    readonly now?: () => number;
    readonly sleep?: (delayMs: number) => Promise<void>;
}

const DEFAULT_RESOLVER_RETRY_OPTIONS: NormalizedContextResolverRetryOptions = {
    maxAttempts: 1,
    initialDelayMs: 25,
    maxDelayMs: 1_000,
    backoffMultiplier: 2,
};

/**
 * Builds a context object by resolving required paths from a seed.
 */
export class PolicyContextBuilder {
    private readonly circuitStates = new Map<
        string,
        ContextResolverCircuitState
    >();
    private readonly defaultResolverResilience?: ContextResolverResilienceOptions;
    private readonly now: () => number;
    private readonly sleep: (delayMs: number) => Promise<void>;

    constructor(
        private readonly registry: ContextResolverRegistry,
        options: PolicyContextBuilderOptions = {},
    ) {
        this.defaultResolverResilience = options.defaultResolverResilience;
        this.now = options.now ?? Date.now;
        this.sleep =
            options.sleep ??
            (async (delayMs) => {
                if (delayMs <= 0) {
                    return;
                }

                await new Promise<void>((resolve) => {
                    setTimeout(resolve, delayMs);
                });
            });
    }

    private static clampPositiveInteger(
        value: number | undefined,
        fallback: number,
    ): number {
        if (value === undefined || !Number.isFinite(value)) {
            return fallback;
        }

        return Math.max(1, Math.trunc(value));
    }

    private static clampNonNegativeInteger(
        value: number | undefined,
        fallback: number,
    ): number {
        if (value === undefined || !Number.isFinite(value)) {
            return fallback;
        }

        return Math.max(0, Math.trunc(value));
    }

    private static normalizeTimeoutMs(
        value: number | undefined,
    ): number | null {
        if (value === undefined || !Number.isFinite(value) || value <= 0) {
            return null;
        }

        return Math.trunc(value);
    }

    private static mergeRetryOptions(
        defaults: ContextResolverRetryOptions | false | undefined,
        overrides: ContextResolverRetryOptions | false | undefined,
    ): ContextResolverRetryOptions | false | undefined {
        if (overrides === false) {
            return false;
        }

        if (overrides !== undefined) {
            return {
                ...(defaults === false || defaults === undefined
                    ? {}
                    : defaults),
                ...overrides,
            };
        }

        return defaults;
    }

    private static mergeCircuitBreakerOptions(
        defaults:
            | ContextResolverResilienceOptions["circuitBreaker"]
            | undefined,
        overrides:
            | ContextResolverResilienceOptions["circuitBreaker"]
            | undefined,
    ): ContextResolverResilienceOptions["circuitBreaker"] | undefined {
        if (overrides === false) {
            return false;
        }

        if (overrides !== undefined) {
            return {
                ...(defaults === false || defaults === undefined
                    ? {}
                    : defaults),
                ...overrides,
            };
        }

        return defaults;
    }

    private resolveResilienceOptions(
        resolver: ContextValueResolver,
    ): NormalizedContextResolverResilienceOptions {
        const defaults = this.defaultResolverResilience;
        const override = resolver.resilience;
        const retry = PolicyContextBuilder.mergeRetryOptions(
            defaults?.retry,
            override?.retry,
        );
        const circuitBreaker = PolicyContextBuilder.mergeCircuitBreakerOptions(
            defaults?.circuitBreaker,
            override?.circuitBreaker,
        );
        const retryOptions = retry === false ? undefined : retry;
        const circuitBreakerOptions =
            circuitBreaker === false ? undefined : circuitBreaker;

        return {
            timeoutMs: PolicyContextBuilder.normalizeTimeoutMs(
                override?.timeoutMs ?? defaults?.timeoutMs,
            ),
            retry: {
                maxAttempts: PolicyContextBuilder.clampPositiveInteger(
                    retryOptions?.maxAttempts,
                    DEFAULT_RESOLVER_RETRY_OPTIONS.maxAttempts,
                ),
                initialDelayMs: PolicyContextBuilder.clampNonNegativeInteger(
                    retryOptions?.initialDelayMs,
                    DEFAULT_RESOLVER_RETRY_OPTIONS.initialDelayMs,
                ),
                maxDelayMs: PolicyContextBuilder.clampNonNegativeInteger(
                    retryOptions?.maxDelayMs,
                    DEFAULT_RESOLVER_RETRY_OPTIONS.maxDelayMs,
                ),
                backoffMultiplier: PolicyContextBuilder.clampPositiveInteger(
                    retryOptions?.backoffMultiplier,
                    DEFAULT_RESOLVER_RETRY_OPTIONS.backoffMultiplier,
                ),
            },
            circuitBreaker:
                circuitBreakerOptions === undefined
                    ? null
                    : {
                          failureThreshold:
                              PolicyContextBuilder.clampPositiveInteger(
                                  circuitBreakerOptions.failureThreshold,
                                  5,
                              ),
                          cooldownMs: PolicyContextBuilder.clampPositiveInteger(
                              circuitBreakerOptions.cooldownMs,
                              30_000,
                          ),
                      },
        };
    }

    private getRetryDelayMs(
        attempt: number,
        retry: NormalizedContextResolverRetryOptions,
    ): number {
        return Math.min(
            retry.initialDelayMs * retry.backoffMultiplier ** (attempt - 1),
            retry.maxDelayMs,
        );
    }

    private resetCircuit(path: string): void {
        this.circuitStates.delete(path);
    }

    private isCircuitOpen(
        path: string,
        circuitBreaker: NormalizedContextResolverCircuitBreakerOptions | null,
    ): boolean {
        if (circuitBreaker === null) {
            return false;
        }

        const state = this.circuitStates.get(path);
        if (state === undefined || state.openUntilMs === null) {
            return false;
        }

        if (state.openUntilMs <= this.now()) {
            this.resetCircuit(path);
            return false;
        }

        return true;
    }

    private recordResolverFailure(
        path: string,
        circuitBreaker: NormalizedContextResolverCircuitBreakerOptions | null,
    ): void {
        if (circuitBreaker === null) {
            return;
        }

        const currentFailureCount =
            this.circuitStates.get(path)?.failureCount ?? 0;
        const nextFailureCount = currentFailureCount + 1;

        if (nextFailureCount >= circuitBreaker.failureThreshold) {
            this.circuitStates.set(path, {
                failureCount: 0,
                openUntilMs: this.now() + circuitBreaker.cooldownMs,
            });
            return;
        }

        this.circuitStates.set(path, {
            failureCount: nextFailureCount,
            openUntilMs: null,
        });
    }

    private static describeThrownResolverError(error: unknown): string {
        if (error instanceof Error) {
            return `threw ${error.name}: ${error.message}`;
        }

        return `threw ${String(error)}`;
    }

    private async resolveOnce(
        resolver: ContextValueResolver,
        seed: ContextSeed,
        timeoutMs: number | null,
    ): Promise<Result<unknown, string>> {
        const execute = async (): Promise<Result<unknown, string>> => {
            try {
                return await resolver.resolve(seed);
            } catch (error) {
                return Result.err(
                    PolicyContextBuilder.describeThrownResolverError(error),
                );
            }
        };

        if (timeoutMs === null) {
            return execute();
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            return await Promise.race([
                execute(),
                new Promise<Result<unknown, string>>((resolve) => {
                    timeoutId = setTimeout(() => {
                        resolve(Result.err(`timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }

    private async resolveWithResilience(
        path: string,
        resolver: ContextValueResolver,
        seed: ContextSeed,
    ): Promise<Result<unknown, string>> {
        const resilience = this.resolveResilienceOptions(resolver);

        if (this.isCircuitOpen(path, resilience.circuitBreaker)) {
            return Result.err("circuit breaker is open");
        }

        let lastError = "resolver failed";

        for (
            let attempt = 1;
            attempt <= resilience.retry.maxAttempts;
            attempt++
        ) {
            const result = await this.resolveOnce(
                resolver,
                seed,
                resilience.timeoutMs,
            );

            if (result.isOk()) {
                this.resetCircuit(path);
                return result;
            }

            lastError = result.errorOrNull() ?? lastError;

            if (attempt < resilience.retry.maxAttempts) {
                await this.sleep(
                    this.getRetryDelayMs(attempt, resilience.retry),
                );
            }
        }

        this.recordResolverFailure(path, resilience.circuitBreaker);
        return Result.err(lastError);
    }

    /**
     * Resolves all required context paths and returns a flat context object.
     * If any required path cannot be resolved, returns an error.
     */
    async build(
        requirements: readonly string[],
        seed: ContextSeed,
    ): Promise<Result<Record<string, unknown>, string>> {
        const context: Record<string, unknown> = {};

        for (const path of requirements) {
            const resolver = this.registry.get(path);
            if (!resolver) {
                return Result.err(`Missing resolver for path "${path}"`);
            }

            const result = await this.resolveWithResilience(
                path,
                resolver,
                seed,
            );
            if (result.isErr()) {
                return Result.err(
                    `Resolver error for path "${path}": ${result.errorOrNull()}`,
                );
            }

            const setPathResult = PolicyContextPath.set(
                context,
                path,
                result.getOrNull(),
            );
            if (setPathResult.isErr()) {
                return Result.err(setPathResult.errorOrNull()!);
            }
        }

        // Final validation: ensure every required path resolved to a defined value.
        // `undefined` is rejected explicitly because resolvers that "succeed" with
        // undefined indicate an unresolved field, not a present-but-empty one.
        const missing = requirements.filter((path) => {
            const result = PolicyContextPath.getOrAbsent(context, path);
            return result.isErr() || result.getOrNull() === undefined;
        });
        if (missing.length > 0) {
            return Result.err(
                `Context missing required paths after resolution: ${missing.join(
                    ", ",
                )}`,
            );
        }

        return Result.ok(context);
    }
}
