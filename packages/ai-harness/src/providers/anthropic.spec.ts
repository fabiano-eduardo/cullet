import { describe, expect, it } from "vitest";
import { createAnthropicProvider } from "./anthropic.js";
import { ProviderError } from "./types.js";
import type { FetchLike } from "./types.js";

// A fetch stub that records the last call and returns a scripted Response.
// Lets each test assert what went over the wire without touching the network.
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
    content: [{ type: "text", text: "hello" }],
    usage: { input_tokens: 12, output_tokens: 7 },
};

describe("createAnthropicProvider", () => {
    it("exposes the anthropic id and the configured model", () => {
        const { fetchImpl } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "claude-opus-4-8",
            fetchImpl,
        });

        expect(provider.id).toBe("anthropic");
        expect(provider.model).toBe("claude-opus-4-8");
    });

    it("posts to /messages with model, default max_tokens and a separated system", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "claude-opus-4-8",
            fetchImpl,
        });

        await provider.complete({
            system: "be terse",
            messages: [
                { role: "system", content: "ignored" },
                { role: "user", content: "hi" },
                { role: "assistant", content: "yo" },
            ],
        });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
        expect(calls[0].init.method).toBe("POST");

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.model).toBe("claude-opus-4-8");
        expect(body.max_tokens).toBe(8_000);
        expect(body.system).toBe("be terse");
        // The system-role message is dropped; only user/assistant remain.
        expect(body.messages).toEqual([
            { role: "user", content: "hi" },
            { role: "assistant", content: "yo" },
        ]);
    });

    it("honours an explicit maxTokens and temperature, omitting temperature when unset", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            maxTokens: 256,
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.max_tokens).toBe(256);
        expect("temperature" in body).toBe(false);
        expect("system" in body).toBe(false);
    });

    it("forwards temperature when provided", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            temperature: 0.2,
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.temperature).toBe(0.2);
    });

    it("sends the api key, version and merged custom headers", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "secret",
            model: "m",
            fetchImpl,
            headers: { "x-trace": "abc" },
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers["x-api-key"]).toBe("secret");
        expect(headers["anthropic-version"]).toBe("2023-06-01");
        expect(headers["content-type"]).toBe("application/json");
        expect(headers["x-trace"]).toBe("abc");
    });

    it("trims a trailing slash from a custom baseURL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
            baseURL: "https://gateway.internal/v1/",
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe("https://gateway.internal/v1/messages");
    });

    it("concatenates only text blocks and maps usage", async () => {
        const { fetchImpl } = stubFetch(
            jsonResponse({
                content: [
                    { type: "text", text: "foo" },
                    { type: "tool_use", id: "t1" },
                    { type: "text", text: "bar" },
                    { type: "text" }, // missing text → skipped
                ],
                usage: { input_tokens: 3, output_tokens: 4 },
            }),
        );
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(result.text).toBe("foobar");
        expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
        expect(result.raw).toMatchObject({ usage: { input_tokens: 3 } });
    });

    it("throws a ProviderError carrying status and body when the response is not ok", async () => {
        const { fetchImpl } = stubFetch(
            new Response("rate limited", { status: 429 }),
        );
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
            fetchImpl,
        });

        const error = await provider
            .complete({ messages: [{ role: "user", content: "hi" }] })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).provider).toBe("anthropic");
        expect((error as ProviderError).status).toBe(429);
        expect((error as ProviderError).body).toBe("rate limited");
    });

    it("passes the abort signal through to fetch", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createAnthropicProvider({
            apiKey: "key",
            model: "m",
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
