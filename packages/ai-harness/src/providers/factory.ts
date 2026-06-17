// Single entry point to build any supported provider from a plain config.
import type { AgentProvider, ProviderName, ProviderOptions } from "./types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAIProvider, createOpenRouterProvider } from "./openai.js";
import { createGoogleProvider } from "./google.js";

export interface CreateProviderOptions extends ProviderOptions {
    provider: ProviderName;
}

/**
 * Build an `AgentProvider` for the given vendor.
 *
 * @example
 *   const provider = createProvider({
 *     provider: "anthropic",
 *     apiKey: process.env.ANTHROPIC_API_KEY!,
 *     model: "claude-opus-4-8",
 *   });
 */
export function createProvider(options: CreateProviderOptions): AgentProvider {
    const { provider, ...rest } = options;
    switch (provider) {
        case "anthropic":
            return createAnthropicProvider(rest);
        case "openai":
            return createOpenAIProvider(rest);
        case "openrouter":
            return createOpenRouterProvider(rest);
        case "google":
            return createGoogleProvider(rest);
        default: {
            const exhaustive: never = provider;
            throw new Error(`Unknown provider: ${String(exhaustive)}`);
        }
    }
}
