// Provider-neutral contract for talking to an AI model. Every concrete adapter
// (Anthropic, OpenAI, OpenRouter, Google) implements `AgentProvider` so the
// harness never depends on a specific vendor SDK or wire format.

export type ProviderName = "anthropic" | "openai" | "openrouter" | "google";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export interface CompletionRequest {
    messages: ChatMessage[];
    /** System / developer instruction applied to the whole exchange. */
    system?: string;
    maxTokens?: number;
    temperature?: number;
    /** Request extended thinking with a dedicated token budget. Provider-neutral; each adapter translates to its API or ignores it. */
    thinking?: { budgetTokens: number };
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

export interface CompletionResult {
    /** Concatenated text content returned by the model. */
    text: string;
    usage: TokenUsage;
    /** The raw, provider-specific response body, for callers that need more. */
    raw: unknown;
    /** Reasoning/thinking text when requested via `thinking` and returned by the provider. Always separate from `text`. */
    reasoning?: string;
}

/**
 * A vendor-neutral handle to a model. Construct one with `createProvider` and
 * pass it to `runHarness`; the harness only ever calls `complete`.
 */
export interface AgentProvider {
    readonly id: ProviderName;
    readonly model: string;
    complete(
        request: CompletionRequest,
        signal?: AbortSignal,
    ): Promise<CompletionResult>;
}

/** Injected `fetch`, defaulting to the global one. Lets tests stub the network. */
export type FetchLike = typeof globalThis.fetch;

export interface ProviderOptions {
    /** API key for the chosen vendor. Always passed explicitly — never read from env here. */
    apiKey: string;
    /** Model id, e.g. "claude-opus-4-8", "gpt-4o", "gemini-2.0-flash". Required. */
    model: string;
    /** Override the API base URL (e.g. a self-hosted gateway). */
    baseURL?: string;
    /** Extra headers merged into every request. */
    headers?: Record<string, string>;
    /** Custom fetch implementation (defaults to `globalThis.fetch`). */
    fetchImpl?: FetchLike;
}

/** Thrown when a provider HTTP call fails, carrying the status and body. */
export class ProviderError extends Error {
    constructor(
        public readonly provider: ProviderName,
        public readonly status: number,
        public readonly body: string,
    ) {
        super(
            `[${provider}] request failed with status ${status}: ${body.slice(0, 500)}`,
        );
        this.name = "ProviderError";
    }
}
