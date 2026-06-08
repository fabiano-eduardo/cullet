import { Result } from "../../result/result";

import {
    ContextResolverRegistry,
    registerNamespacedContextResolversIn,
} from "./context-registry";

import type { ContextValueResolver } from "./context-resolver";

/**
 * Official instance of the ContextResolverRegistry.
 * Use `new ContextResolverRegistry()` plus `registerNamespacedContextResolversIn`
 * when each runtime/composition root needs its own isolated resolver graph.
 */
export const contextResolverRegistry = new ContextResolverRegistry();

export function registerNamespacedContextResolvers(
    namespace: string,
    resolvers: readonly ContextValueResolver[],
): Result<ContextResolverRegistry, string> {
    return registerNamespacedContextResolversIn(
        contextResolverRegistry,
        namespace,
        resolvers,
    );
}
