// Anthropic Messages API adapter (https://docs.anthropic.com/en/api/messages).
// Talks to the REST endpoint directly via fetch — no SDK dependency.
import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
    FetchLike,
    ProviderOptions,
} from "./types.js";
import { ProviderError } from "./types.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicResponse {
    content: Array<{ type: string; text?: string; thinking?: string }>;
    usage: { input_tokens: number; output_tokens: number };
}

export function createAnthropicProvider(
    options: ProviderOptions,
): AgentProvider {
    const baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const fetchImpl: FetchLike = options.fetchImpl ?? globalThis.fetch;

    return {
        id: "anthropic",
        model: options.model,
        async complete(
            request: CompletionRequest,
            signal?: AbortSignal,
        ): Promise<CompletionResult> {
            const maxTokens = request.maxTokens ?? 8_000;

            if (request.thinking) {
                if (maxTokens <= request.thinking.budgetTokens) {
                    throw new Error(
                        `[anthropic] max_tokens (${maxTokens}) must be greater than thinking.budgetTokens (${request.thinking.budgetTokens})`,
                    );
                }
            }

            const response = await fetchImpl(`${baseURL}/messages`, {
                method: "POST",
                signal,
                headers: {
                    "content-type": "application/json",
                    "x-api-key": options.apiKey,
                    "anthropic-version": ANTHROPIC_VERSION,
                    ...options.headers,
                },
                body: JSON.stringify({
                    model: options.model,
                    max_tokens: maxTokens,
                    ...(request.thinking
                        ? {
                              thinking: {
                                  type: "enabled",
                                  budget_tokens:
                                      request.thinking.budgetTokens,
                              },
                          }
                        : {}),
                    ...(!request.thinking && request.temperature !== undefined
                        ? { temperature: request.temperature }
                        : {}),
                    ...(request.system ? { system: request.system } : {}),
                    messages: request.messages
                        .filter((m) => m.role !== "system")
                        .map((m) => ({ role: m.role, content: m.content })),
                }),
            });

            if (!response.ok) {
                throw new ProviderError(
                    "anthropic",
                    response.status,
                    await response.text(),
                );
            }

            const data = (await response.json()) as AnthropicResponse;
            const text = data.content
                .filter(
                    (block) =>
                        block.type === "text" && typeof block.text === "string",
                )
                .map((block) => block.text!)
                .join("");

            const thinkingText = data.content
                .filter(
                    (block) =>
                        block.type === "thinking" &&
                        typeof block.thinking === "string",
                )
                .map((block) => block.thinking!)
                .join("");

            return {
                text,
                usage: {
                    inputTokens: data.usage.input_tokens,
                    outputTokens: data.usage.output_tokens,
                },
                raw: data,
                ...(thinkingText ? { reasoning: thinkingText } : {}),
            };
        },
    };
}
