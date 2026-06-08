import { Result } from "../../result/result";

import type { ContextSeed } from "./context-seed";

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
 */
export interface ContextValueResolver {
    readonly path: string;
    readonly resilience?: ContextResolverResilienceOptions;
    resolve(seed: ContextSeed): Promise<Result<unknown, string>>;
}
