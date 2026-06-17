// Google Gemini (Generative Language API) adapter via fetch.
// https://ai.google.dev/api/generate-content
import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
    FetchLike,
    ProviderOptions,
} from "./types.js";
import { ProviderError } from "./types.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GoogleResponse {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
    };
}

export function createGoogleProvider(options: ProviderOptions): AgentProvider {
    const baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const fetchImpl: FetchLike = options.fetchImpl ?? globalThis.fetch;

    return {
        id: "google",
        model: options.model,
        async complete(
            request: CompletionRequest,
            signal?: AbortSignal,
        ): Promise<CompletionResult> {
            // Gemini uses "user"/"model" roles and carries the system prompt separately.
            const contents = request.messages
                .filter((m) => m.role !== "system")
                .map((m) => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }],
                }));

            const url = `${baseURL}/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
            const response = await fetchImpl(url, {
                method: "POST",
                signal,
                headers: {
                    "content-type": "application/json",
                    ...options.headers,
                },
                body: JSON.stringify({
                    contents,
                    ...(request.system
                        ? {
                              systemInstruction: {
                                  parts: [{ text: request.system }],
                              },
                          }
                        : {}),
                    generationConfig: {
                        ...(request.maxTokens !== undefined
                            ? { maxOutputTokens: request.maxTokens }
                            : {}),
                        ...(request.temperature !== undefined
                            ? { temperature: request.temperature }
                            : {}),
                    },
                }),
            });

            if (!response.ok) {
                throw new ProviderError(
                    "google",
                    response.status,
                    await response.text(),
                );
            }

            const data = (await response.json()) as GoogleResponse;
            const text = (data.candidates?.[0]?.content?.parts ?? [])
                .map((part) => part.text ?? "")
                .join("");

            return {
                text,
                usage: {
                    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
                    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
                },
                raw: data,
            };
        },
    };
}
