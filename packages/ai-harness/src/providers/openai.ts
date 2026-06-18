// OpenAI Chat Completions adapter. The same wire format is spoken by OpenRouter
// and most OpenAI-compatible gateways, so this powers both the "openai" and
// "openrouter" providers — only the base URL (and id) differ.
import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
    FetchLike,
    ProviderName,
    ProviderOptions,
} from "./types.js";
import { ProviderError } from "./types.js";

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenAIResponse {
    choices: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function createOpenAICompatibleProvider(
    id: ProviderName,
    defaultBaseURL: string,
    options: ProviderOptions,
): AgentProvider {
    const baseURL = (options.baseURL ?? defaultBaseURL).replace(/\/$/, "");
    const fetchImpl: FetchLike = options.fetchImpl ?? globalThis.fetch;

    return {
        id,
        model: options.model,
        async complete(
            request: CompletionRequest,
            signal?: AbortSignal,
        ): Promise<CompletionResult> {
            const messages = request.system
                ? [
                      { role: "system" as const, content: request.system },
                      ...request.messages,
                  ]
                : request.messages;

            // `request.thinking` is accepted but not mapped — OpenAI/OpenRouter reasoning APIs differ; planned for a follow-up.

            const response = await fetchImpl(`${baseURL}/chat/completions`, {
                method: "POST",
                signal,
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${options.apiKey}`,
                    ...options.headers,
                },
                body: JSON.stringify({
                    model: options.model,
                    messages,
                    ...(request.maxTokens !== undefined
                        ? { max_tokens: request.maxTokens }
                        : {}),
                    ...(request.temperature !== undefined
                        ? { temperature: request.temperature }
                        : {}),
                }),
            });

            if (!response.ok) {
                throw new ProviderError(
                    id,
                    response.status,
                    await response.text(),
                );
            }

            const data = (await response.json()) as OpenAIResponse;
            return {
                text: data.choices[0]?.message?.content ?? "",
                usage: {
                    inputTokens: data.usage?.prompt_tokens ?? 0,
                    outputTokens: data.usage?.completion_tokens ?? 0,
                },
                raw: data,
            };
        },
    };
}

export function createOpenAIProvider(options: ProviderOptions): AgentProvider {
    return createOpenAICompatibleProvider("openai", OPENAI_BASE_URL, options);
}

export function createOpenRouterProvider(
    options: ProviderOptions,
): AgentProvider {
    return createOpenAICompatibleProvider(
        "openrouter",
        OPENROUTER_BASE_URL,
        options,
    );
}
