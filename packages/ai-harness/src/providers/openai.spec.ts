import { describe, expect, it } from "vitest";
import {
    OPENAI_BASE_URL,
    OPENROUTER_BASE_URL,
    createOpenAIProvider,
    createOpenRouterProvider,
} from "./openai.js";
import { ProviderError } from "./types.js";
import type { FetchLike } from "./types.js";

function stubFetch(response: Response): {
    fetchImpl: FetchLike;
    calls: Array<{ url: string; init: RequestInit }>;
} {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        // Clone so each call gets a fresh, unread body (tests may call twice).
        return response.clone();
    }) as unknown as FetchLike;
    return { fetchImpl, calls };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}

const okBody = {
    choices: [{ message: { content: "hello" } }],
    usage: { prompt_tokens: 11, completion_tokens: 6 },
};

describe("createOpenAIProvider", () => {
    it("exposes the openai id and posts to the OpenAI base URL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        expect(provider.id).toBe("openai");
        expect(provider.model).toBe("gpt-4o");
        expect(OPENAI_BASE_URL).toBe("https://api.openai.com/v1");

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe(`${OPENAI_BASE_URL}/chat/completions`);
        expect(calls[0].init.method).toBe("POST");
    });

    it("prepends the system prompt as the first message", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        await provider.complete({
            system: "be terse",
            messages: [
                { role: "user", content: "hi" },
                { role: "assistant", content: "yo" },
            ],
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.model).toBe("gpt-4o");
        expect(body.messages).toEqual([
            { role: "system", content: "be terse" },
            { role: "user", content: "hi" },
            { role: "assistant", content: "yo" },
        ]);
    });

    it("leaves the messages untouched when no system prompt is given", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    });

    it("includes max_tokens and temperature only when defined", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });
        const withoutLimits = JSON.parse(calls[0].init.body as string);
        expect("max_tokens" in withoutLimits).toBe(false);
        expect("temperature" in withoutLimits).toBe(false);

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            maxTokens: 128,
            temperature: 0.5,
        });
        const withLimits = JSON.parse(calls[1].init.body as string);
        expect(withLimits.max_tokens).toBe(128);
        expect(withLimits.temperature).toBe(0.5);
    });

    it("sends a Bearer authorization header with merged custom headers", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "secret",
            model: "gpt-4o",
            fetchImpl,
            headers: { "x-trace": "abc" },
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers.authorization).toBe("Bearer secret");
        expect(headers["content-type"]).toBe("application/json");
        expect(headers["x-trace"]).toBe("abc");
    });

    it("trims a trailing slash from a custom baseURL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
            baseURL: "https://gateway.internal/v1/",
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe(
            "https://gateway.internal/v1/chat/completions",
        );
    });

    it("parses choices[0].message.content and usage", async () => {
        const { fetchImpl } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(result.text).toBe("hello");
        expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 6 });
        expect(result.raw).toMatchObject({ usage: { prompt_tokens: 11 } });
    });

    it("falls back to empty text and zero usage when fields are missing", async () => {
        const { fetchImpl } = stubFetch(jsonResponse({ choices: [] }));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(result.text).toBe("");
        expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it("throws a ProviderError tagged openai when the response is not ok", async () => {
        const { fetchImpl } = stubFetch(
            new Response("bad request", { status: 400 }),
        );
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });

        const error = await provider
            .complete({ messages: [{ role: "user", content: "hi" }] })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).provider).toBe("openai");
        expect((error as ProviderError).status).toBe(400);
        expect((error as ProviderError).body).toBe("bad request");
    });

    it("passes the abort signal through to fetch", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenAIProvider({
            apiKey: "key",
            model: "gpt-4o",
            fetchImpl,
        });
        const controller = new AbortController();

        await provider.complete(
            { messages: [{ role: "user", content: "hi" }] },
            controller.signal,
        );

        expect(calls[0].init.signal).toBe(controller.signal);
    });
});

describe("createOpenRouterProvider", () => {
    it("uses the openrouter id and the OpenRouter base URL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createOpenRouterProvider({
            apiKey: "key",
            model: "anthropic/claude-opus-4-8",
            fetchImpl,
        });

        expect(provider.id).toBe("openrouter");
        expect(OPENROUTER_BASE_URL).toBe("https://openrouter.ai/api/v1");

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    });

    it("tags ProviderError with the openrouter id", async () => {
        const { fetchImpl } = stubFetch(new Response("nope", { status: 500 }));
        const provider = createOpenRouterProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
        });

        const error = await provider
            .complete({ messages: [{ role: "user", content: "hi" }] })
            .catch((e: unknown) => e);

        expect((error as ProviderError).provider).toBe("openrouter");
        expect((error as ProviderError).status).toBe(500);
    });
});
