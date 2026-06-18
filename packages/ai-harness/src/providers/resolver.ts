// Batteries-included bridge from a task's `provider`/`model` strings to a
// concrete `AgentProvider`. The neutral core never reads API keys, so the keys
// live here — passed explicitly by the consumer, once — and this helper turns
// per-task selection into a `resolveProvider` hook for `runHarness`.
import type { Task } from "../harness/types.js";
import type { AgentProvider, ProviderName, ProviderOptions } from "./types.js";
import { createProvider } from "./factory.js";

/** Per-vendor credentials and defaults: everything `createProvider` needs except the model. */
export type ProviderResolverVendorConfig = Omit<ProviderOptions, "model"> & {
    /** Model used when a task that targets this vendor sets no `model`. */
    defaultModel?: string;
};

export type ProviderResolverConfig = {
    [P in ProviderName]?: ProviderResolverVendorConfig;
} & {
    /** Vendor used when a task sets no `provider`. */
    defaultProvider?: ProviderName;
    /** Model used when neither the task nor the vendor config supplies one. */
    defaultModel?: string;
};

/**
 * Build a {@link ProviderResolver} that maps each task's `provider`/`model` to a
 * memoized `AgentProvider`. Pass it as `config.resolveProvider` to `runHarness`.
 *
 * Resolution precedence:
 *   - vendor: `task.provider` → `config.defaultProvider`
 *   - model:  `task.model` → `<vendor>.defaultModel` → `config.defaultModel`
 *
 * Providers are cached by `provider|model|baseURL`, so repeated tasks on the
 * same model reuse one instance.
 *
 * @example
 *   const resolveProvider = createProviderResolver({
 *     anthropic: { apiKey: process.env.ANTHROPIC_API_KEY!, defaultModel: "claude-opus-4-8" },
 *     openai:    { apiKey: process.env.OPENAI_API_KEY! },
 *     defaultProvider: "anthropic",
 *   });
 */
export function createProviderResolver(
    config: ProviderResolverConfig,
): (task: Task) => AgentProvider {
    const { defaultProvider, defaultModel, ...vendors } = config;
    const cache = new Map<string, AgentProvider>();

    return (task: Task): AgentProvider => {
        const provider = task.provider ?? defaultProvider;
        if (!provider) {
            throw new Error(
                `createProviderResolver: task "${task.id}" has no provider and no ` +
                    `defaultProvider was configured.`,
            );
        }

        const vendor = (
            vendors as Record<ProviderName, ProviderResolverVendorConfig>
        )[provider];
        if (!vendor) {
            throw new Error(
                `createProviderResolver: task "${task.id}" targets provider "${provider}" ` +
                    `which is not configured. Add it to createProviderResolver({ ... }).`,
            );
        }

        const model = task.model ?? vendor.defaultModel ?? defaultModel;
        if (!model) {
            throw new Error(
                `createProviderResolver: task "${task.id}" (provider "${provider}") has no ` +
                    `model. Set task.model, vendor defaultModel, or config.defaultModel.`,
            );
        }

        const key = `${provider}|${model}|${vendor.baseURL ?? ""}`;
        let resolved = cache.get(key);
        if (!resolved) {
            const { defaultModel: _omit, ...options } = vendor;
            void _omit;
            resolved = createProvider({ provider, model, ...options });
            cache.set(key, resolved);
        }
        return resolved;
    };
}
