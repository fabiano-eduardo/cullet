import { Result } from "../../result/result.js";

import type { ContextSeed } from "./context-seed.js";

export interface ContextResolverRetryOptions {
    readonly maxAttempts?: number;
    readonly initialDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly backoffMultiplier?: number;
}

export interface ContextResolverCircuitBreakerOptions {
    readonly failureThreshold?: number;
    readonly cooldownMs?: number;
}

export interface ContextResolverResilienceOptions {
    readonly timeoutMs?: number;
    readonly retry?: ContextResolverRetryOptions | false;
    readonly circuitBreaker?: ContextResolverCircuitBreakerOptions | false;
}

/**
 * A resolver that knows how to produce a value for a specific context path.
 * Designed as async to allow future DB/API lookups without breaking the interface.
 *
 * Resolvers MUST be idempotent, side-effect-free reads. The builder's timeout
 * is a race with no cancellation, so a timed-out resolver keeps running; with
 * retry enabled it may also be invoked several times for one path. Anything but
 * a pure lookup here risks duplicated effects.
 */
export interface ContextValueResolver {
    readonly path: string;
    readonly resilience?: ContextResolverResilienceOptions;
    resolve(seed: ContextSeed): Promise<Result<unknown, string>>;
}
